import axios from 'axios';
const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api';
  return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/$/, '')}/api`;
};

const API_BASE = getApiBase();

export interface ChatApiConversation {
  id: number;
  title: string;
  updatedAt: string;
  createdAt: string;
  messages?: any[];
}

export interface StreamInitPayload {
  conversationId: number;
  requestId: string;
  detectedIntent?: any;
  selectedTool?: string | null;
  providerUsed?: string;
}

export type StreamFsmState =
  | 'IDLE'
  | 'REQUEST_CREATED'
  | 'PLACEHOLDER_CREATED'
  | 'THINKING'
  | 'WAITING_FIRST_TOKEN'
  | 'STREAMING'
  | 'COMPLETED'
  | 'FINISHED'
  | 'CANCELLED'
  | 'FAILED';

export type StreamLifecycleStage = StreamFsmState;

export interface StreamTelemetry {
  requestId: string;
  placeholderId: string;
  assistantMessageId: string;
  firstTokenLatencyMs: number | null;
  lastTokenLatencyMs: number | null;
  totalChunks: number;
  finishReason: string | null;
  isTimeout: boolean;
  isAborted: boolean;
  fsmState: StreamFsmState;
}

export interface StreamOptions {
  prompt: string;
  conversationId: number | null;
  requestId: string;
  placeholderId?: string;
  assistantMessageId?: string;
  onChunk: (chunk: string) => void;
  onInit?: (data: StreamInitPayload) => void;
  onStage?: (stage: string, message: string) => void;
  onLifecycleChange?: (stage: StreamFsmState, telemetry?: Partial<StreamTelemetry>) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
  isUserStopRequested?: () => boolean;
}

export async function fetchConversations(): Promise<ChatApiConversation[]> {
  try {
    const res = await axios.get(`${API_BASE}/conversations`);
    return res.data.data || [];
  } catch {
    return [];
  }
}

export async function fetchConversationById(id: number): Promise<ChatApiConversation | null> {
  try {
    const res = await axios.get(`${API_BASE}/conversations/${id}`);
    return res.data.data || null;
  } catch {
    return null;
  }
}

export async function renameConversation(id: number, title: string): Promise<boolean> {
  try {
    await axios.patch(`${API_BASE}/conversations/${id}`, { title });
    return true;
  } catch {
    return false;
  }
}

export async function deleteConversationApi(id: number): Promise<boolean> {
  try {
    await axios.delete(`${API_BASE}/conversations/${id}`);
    return true;
  } catch {
    return false;
  }
}

export async function createNewConversation(title?: string): Promise<ChatApiConversation | null> {
  try {
    const res = await axios.post(`${API_BASE}/conversations`, { title });
    return res.data.data || null;
  } catch {
    return null;
  }
}

export async function uploadScreenshotApi(file: File, conversationId?: number): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  if (conversationId) {
    formData.append('conversationId', conversationId.toString());
  }
  const res = await axios.post(`${API_BASE}/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

export async function streamChatMessage(options: StreamOptions): Promise<StreamTelemetry> {
  try {
    return await streamChatMessageSse(options);
  } catch (err: any) {
    // A failed stream must never blank the page. Unless the failure was an
    // explicit user cancellation, a server-side error, or a provider timeout,
    // gracefully fall back to the regular non-streaming chat endpoint so the
    // user still receives their answer without any manual action.
    const isUserStop = options.isUserStopRequested ? options.isUserStopRequested() : false;
    if (isUserStop) throw err;
    if (err?.isServerError) throw err;
    const msg: string = err?.message || '';
    if (
      msg.includes('[Provider Timeout]') ||
      msg.includes('[User Cancellation]') ||
      msg.includes('Timeout')
    ) {
      throw err;
    }
    return streamChatMessageNonStreaming(options);
  }
}

/**
 * SSE implementation used by streamChatMessage. Kept separate so the public
 * API can wrap it with the non-streaming fallback.
 */
async function streamChatMessageSse(options: StreamOptions): Promise<StreamTelemetry> {
  const {
    prompt,
    conversationId,
    requestId,
    placeholderId = `ph-${requestId}`,
    assistantMessageId = `ai-msg-${requestId}`,
    onChunk,
    onInit,
    onStage,
    onLifecycleChange,
    signal,
    timeoutMs = 60000,
    isUserStopRequested,
  } = options;

  const startTime = Date.now();
  let firstTokenTime: number | null = null;
  let lastTokenTime: number | null = null;
  let chunkCount = 0;
  let finishReason: string | null = null;
  let isDoneReceived = false;
  let currentState: StreamFsmState = 'IDLE';

  const transitionTo = (nextState: StreamFsmState, telemetryUpdate?: Partial<StreamTelemetry>) => {
    currentState = nextState;
    onLifecycleChange?.(nextState, {
      requestId,
      placeholderId,
      assistantMessageId,
      firstTokenLatencyMs: firstTokenTime ? firstTokenTime - startTime : null,
      lastTokenLatencyMs: lastTokenTime ? lastTokenTime - startTime : null,
      totalChunks: chunkCount,
      finishReason,
      fsmState: currentState,
      ...telemetryUpdate,
    });
  };

  transitionTo('REQUEST_CREATED');
  transitionTo('PLACEHOLDER_CREATED');
  transitionTo('THINKING');

  // Internal Timeout Controller
  const internalAbortController = new AbortController();

  const handleExternalAbort = () => {
    internalAbortController.abort();
  };

  if (signal) {
    if (signal.aborted) {
      internalAbortController.abort();
    } else {
      signal.addEventListener('abort', handleExternalAbort, { once: true });
    }
  }

  let timeoutId = setTimeout(() => {
    if (!firstTokenTime && !isDoneReceived) {
      internalAbortController.abort(new Error(`Timeout: No tokens received within ${timeoutMs / 1000}s`));
    }
  }, timeoutMs);

  const resetTimeout = () => {
    clearTimeout(timeoutId);
    if (!firstTokenTime && !isDoneReceived) {
      const elapsed = Date.now() - startTime;
      // Hard wall-clock cap on the first-token wait. Heartbeat keep-alives reset
      // the sliding timer for long streams, but must NEVER keep the UI stuck on
      // 'Thinking...' indefinitely when the backend never produces a first token.
      if (elapsed >= timeoutMs) {
        internalAbortController.abort(new Error(`Timeout: No tokens received within ${timeoutMs / 1000}s`));
        return;
      }
      timeoutId = setTimeout(() => {
        if (!firstTokenTime && !isDoneReceived) {
          internalAbortController.abort(new Error(`Timeout: No tokens received within ${timeoutMs / 1000}s`));
        }
      }, timeoutMs - elapsed);
    }
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/chat/message/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
      body: JSON.stringify({ prompt, conversationId, requestId }),
      signal: internalAbortController.signal,
    });
  } catch (fetchErr: any) {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', handleExternalAbort);

    if (fetchErr.name === 'AbortError' || internalAbortController.signal.aborted) {
      const isUserStop = isUserStopRequested ? isUserStopRequested() : false;
      const isTimeout = fetchErr.message?.includes('Timeout') || internalAbortController.signal.reason?.message?.includes('Timeout');
      
      if (isUserStop) {
        transitionTo('CANCELLED', { isAborted: true });
        const abortError = new Error('[User Cancellation]: Stream request was cancelled by user.');
        abortError.name = 'AbortError';
        throw abortError;
      }
      
      if (isTimeout) {
        transitionTo('FAILED', { isTimeout: true });
        throw new Error(`[Provider Timeout]: Upstream AI provider did not respond within ${timeoutMs / 1000} seconds.`);
      }

      transitionTo('FAILED', { isAborted: false });
      throw new Error(`[Connection Interrupted]: Request aborted without explicit user cancellation.`);
    }
    transitionTo('FAILED');
    throw new Error(`[Network Interruption]: Failed to connect to AI streaming endpoint (${fetchErr.message})`);
  }

  if (!response.ok) {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', handleExternalAbort);
    const errorText = await response.text().catch(() => 'Network stream response error');
    transitionTo('FAILED');
    throw new Error(`[Network Interruption]: Server returned HTTP ${response.status} (${errorText})`);
  }

  if (!response.body) {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', handleExternalAbort);
    transitionTo('FAILED');
    throw new Error('[Network Interruption]: No readable stream body returned from SSE endpoint');
  }

  transitionTo('WAITING_FIRST_TOKEN');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim()) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            parseSseLine(line);
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        parseSseLine(line);
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError' || internalAbortController.signal.aborted) {
      const isUserStop = isUserStopRequested ? isUserStopRequested() : false;
      const isTimeout = err.message?.includes('Timeout') || internalAbortController.signal.reason?.message?.includes('Timeout');
      if (isUserStop) {
        transitionTo('CANCELLED', { isAborted: true });
        const abortError = new Error('[User Cancellation]: Stream cancelled by user.');
        abortError.name = 'AbortError';
        throw abortError;
      }
      if (isTimeout) {
        transitionTo('FAILED', { isTimeout: true });
        throw new Error(`[Provider Timeout]: Stream connection timed out after ${timeoutMs / 1000} seconds.`);
      }
      transitionTo('FAILED');
      throw new Error(`[Stream Interrupted]: Stream connection disconnected.`);
    }
    if (err.isServerError) {
      transitionTo('FAILED');
      throw new Error(`[Provider Error]: ${err.message}`);
    }
    transitionTo('FAILED');
    throw new Error(`[Frontend Parser Error]: Stream parsing error (${err.message})`);
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', handleExternalAbort);
    try {
      reader.releaseLock();
    } catch {
      // Ignore releaseLock errors
    }
  }

  function parseSseLine(rawLine: string) {
    const line = rawLine.trim();
    if (!line || !line.startsWith('data: ')) return;

    const dataContent = line.replace('data: ', '').trim();
    if (!dataContent) return;

    if (dataContent === '[DONE]') {
      isDoneReceived = true;
      finishReason = finishReason || 'stop';
      return;
    }

    try {
      const parsed = JSON.parse(dataContent);
      if (parsed.type === 'heartbeat') {
        resetTimeout();
      } else if (parsed.type === 'init' && onInit) {
        resetTimeout();
        onInit({
          conversationId: parsed.conversationId,
          requestId: parsed.requestId || requestId,
          detectedIntent: parsed.detectedIntent,
          selectedTool: parsed.selectedTool,
          providerUsed: parsed.providerUsed,
        });
      } else if (parsed.type === 'stage' && onStage) {
        resetTimeout();
        onStage(parsed.stage, parsed.message);
      } else if (parsed.type === 'token' && parsed.chunk !== undefined) {
        if (!firstTokenTime) {
          firstTokenTime = Date.now();
          clearTimeout(timeoutId);
          transitionTo('STREAMING', { firstTokenLatencyMs: firstTokenTime - startTime });
        }
        lastTokenTime = Date.now();
        chunkCount++;
        if (parsed.finishReason) finishReason = parsed.finishReason;
        onChunk(parsed.chunk);
      } else if (parsed.type === 'done') {
        isDoneReceived = true;
        finishReason = parsed.finishReason || finishReason || 'stop';
      } else if (parsed.type === 'error') {
        const errMsg = parsed.error || parsed.message || 'Streaming failed from server error';
        const err = new Error(errMsg);
        (err as any).isServerError = true;
        throw err;
      }
    } catch (e: any) {
      if (e?.isServerError || (e.message && (e.message.includes('Streaming failed') || e.message.includes('server error')))) {
        throw e;
      }
    }
  }

  transitionTo('COMPLETED', {
    firstTokenLatencyMs: firstTokenTime ? firstTokenTime - startTime : null,
    lastTokenLatencyMs: lastTokenTime ? lastTokenTime - startTime : null,
    totalChunks: chunkCount,
    finishReason: finishReason || 'completed',
  });

  transitionTo('FINISHED', {
    firstTokenLatencyMs: firstTokenTime ? firstTokenTime - startTime : null,
    lastTokenLatencyMs: lastTokenTime ? lastTokenTime - startTime : null,
    totalChunks: chunkCount,
    finishReason: finishReason || 'completed',
  });

  return {
    requestId,
    placeholderId,
    assistantMessageId,
    firstTokenLatencyMs: firstTokenTime ? firstTokenTime - startTime : null,
    lastTokenLatencyMs: lastTokenTime ? lastTokenTime - startTime : null,
    totalChunks: chunkCount,
    finishReason: finishReason || 'completed',
    isTimeout: false,
    isAborted: false,
    fsmState: 'FINISHED',
  };
}

/**
 * Graceful non-streaming fallback: POSTs to /api/chat/message and delivers the
 * full assistant text through the same onChunk callback, so the Chat UI keeps
 * its normal lifecycle (thinking → completed) even when SSE is unavailable.
 */
async function streamChatMessageNonStreaming(options: StreamOptions): Promise<StreamTelemetry> {
  const {
    prompt,
    conversationId,
    requestId,
    placeholderId = `ph-${requestId}`,
    assistantMessageId = `ai-msg-${requestId}`,
    onChunk,
    onInit,
    onLifecycleChange,
    signal,
  } = options;

  const startTime = Date.now();

  const emit = (stage: StreamFsmState, telemetry?: Partial<StreamTelemetry>) => {
    onLifecycleChange?.(stage, {
      requestId,
      placeholderId,
      assistantMessageId,
      firstTokenLatencyMs: null,
      lastTokenLatencyMs: null,
      totalChunks: 0,
      finishReason: 'stop',
      fsmState: stage,
      ...telemetry,
    });
  };

  emit('THINKING');

  try {
    const res = await fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
      body: JSON.stringify({ prompt, conversationId, requestId }),
      signal,
    });

    if (!res.ok) {
      emit('FAILED');
      throw new Error(`Non-streaming endpoint returned HTTP ${res.status}`);
    }

    const payload = await res.json();
    const data = payload?.data || {};
    const content: string =
      typeof data?.assistantMessage?.content === 'string'
        ? data.assistantMessage.content
        : typeof data?.content === 'string'
          ? data.content
          : '';

    onInit?.({
      conversationId: Number(data?.conversationId ?? conversationId) || 0,
      requestId: data?.requestId ?? requestId,
      detectedIntent: data?.detectedIntent,
      selectedTool: data?.toolExecuted ?? null,
      providerUsed: data?.providerUsed,
    });

    emit('WAITING_FIRST_TOKEN');

    if (content) {
      onChunk(content);
    }

    emit('COMPLETED');
    emit('FINISHED');

    return {
      requestId,
      placeholderId,
      assistantMessageId,
      firstTokenLatencyMs: Date.now() - startTime,
      lastTokenLatencyMs: Date.now() - startTime,
      totalChunks: content ? 1 : 0,
      finishReason: 'stop',
      isTimeout: false,
      isAborted: false,
      fsmState: 'FINISHED',
    };
  } catch (fallbackErr: any) {
    emit('FAILED');
    throw new Error(
      `[Fallback Failed]: ${fallbackErr?.message || 'Non-streaming fallback failed'}`,
    );
  }
}

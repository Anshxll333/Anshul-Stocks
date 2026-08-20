import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar, { type ConversationItem } from '../components/Sidebar';
import {
  streamChatMessage,
  fetchConversations,
  fetchConversationById,
  renameConversation,
  deleteConversationApi,
  createNewConversation,
  uploadScreenshotApi,
  type StreamInitPayload,
  type StreamFsmState,
} from '../api/chat';
import {
  Sparkles,
  Send,
  Paperclip,
  Copy,
  RefreshCw,
  Bot,
  User,
  Menu,
  Check,
  Square,
  Edit2,
  Save,
  X,
  Terminal,
  Activity,
  Layers,
  Database,
  Cpu,
} from 'lucide-react';

import { StockDecisionCard, type StockDecisionData } from '../components/StockDecisionCard';
import { IpoDecisionCard, type IpoDecisionData } from '../components/IpoDecisionCard';
import { ErrorBoundary } from '../components/ErrorBoundary';

interface ChatMessage {
  id: string;
  requestId?: string;
  placeholderId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  model?: string;
  fsmState?: StreamFsmState;
  metadata?: any;
}

interface DevModeMetrics {
  requestId: string;
  conversationId: number | null;
  placeholderId: string;
  assistantMessageId: string;
  detectedIntent: string;
  confidence: number;
  selectedTool: string;
  provider: string;
  cacheStatus: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  firstTokenLatencyMs: number | null;
  lastTokenLatencyMs: number | null;
  executionTimeMs: number;
  finishReason: string;
  fsmState: StreamFsmState;
  errors: string[];
  abortState: string;
}

// ── Robust decision-card JSON extraction (fences, prose-wrapped & truncated) ──
// Scans for the exact balanced JSON object that contains a `"type": "stock"` or
// `"type": "ipo"` marker. Returns null when the object is truncated/unbalanced.
function extractBalancedDecisionJson(content: string): string | null {
  const marker = content.search(/"type"\s*:\s*"(?:stock|ipo)"/);
  if (marker === -1) return null;
  const start = content.lastIndexOf('{', marker);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < content.length; i++) {
    const ch = content[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return content.slice(start, i + 1);
    }
  }
  return null; // truncated / unbalanced
}

// Best-effort repair of a truncated JSON object (e.g. the model hit its
// max_tokens limit mid-response): drop the incomplete trailing token, remove
// dangling commas, then close every still-open brace/bracket.
function repairTruncatedJsonObject(partial: string): string | null {
  let work = partial;
  let stack: string[] = [];
  let inString = false;
  let escaped = false;
  let openStringStart = -1;

  for (let i = 0; i < work.length; i++) {
    const ch = work[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      openStringStart = i;
      continue;
    }
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }

  // 1. Drop a trailing unclosed string (e.g. `"detail": "If you want deta...`)
  if (inString && openStringStart >= 0) {
    work = work.slice(0, openStringStart);
  }

  // 2. Drop a dangling key/value pair that lost its value (text ends with ':')
  let trimmed = work.trimEnd();
  if (trimmed.endsWith(':')) {
    const cut = Math.max(
      trimmed.lastIndexOf(','),
      trimmed.lastIndexOf('{'),
      trimmed.lastIndexOf('['),
    );
    if (cut >= 0) trimmed = trimmed.slice(0, cut);
    else return null;
  }
  work = trimmed.replace(/[,\s]+$/, '');

  // 3. Recompute the open-delimiter stack over the cleaned text
  stack = [];
  inString = false;
  escaped = false;
  for (let i = 0; i < work.length; i++) {
    const ch = work[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }

  // 4. Close every still-open delimiter in reverse order
  for (let i = stack.length - 1; i >= 0; i--) {
    work += stack[i] === '{' ? '}' : ']';
  }

  try {
    const parsed = JSON.parse(work);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? work : null;
  } catch {
    return null;
  }
}

// Extract a parseable stock/IPO decision JSON from any AI message.
// Priority: fenced ```json block → balanced raw object → truncated-JSON repair.
function extractDecisionJson(content: string): { parsed: any; raw: string } | null {
  const looksLikeDecision =
    content.includes('"type"') &&
    (content.includes('"stock"') || content.includes('"ipo"'));

  // 1. Fenced ```json blocks (case-insensitive)
  const fenceRegex = /```json\s*([\s\S]*?)```/gi;
  let fenceMatch: RegExpExecArray | null;
  while ((fenceMatch = fenceRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (parsed && (parsed.type === 'stock' || parsed.type === 'ipo')) {
        return { parsed, raw: fenceMatch[1].trim() };
      }
    } catch {
      /* keep scanning other fences */
    }
  }

  // 2. Balanced raw JSON object (tolerates prose before/after the block)
  const balanced = extractBalancedDecisionJson(content);
  if (balanced) {
    try {
      const parsed = JSON.parse(balanced);
      if (parsed && (parsed.type === 'stock' || parsed.type === 'ipo')) {
        return { parsed, raw: balanced };
      }
    } catch {
      /* fall through to repair */
    }
  }

  // 3. Truncated JSON repair (model hit max_tokens mid-object)
  if (looksLikeDecision) {
    const start = content.indexOf('{');
    if (start >= 0) {
      const repaired = repairTruncatedJsonObject(content.slice(start));
      if (repaired) {
        try {
          const parsed = JSON.parse(repaired);
          if (parsed && (parsed.type === 'stock' || parsed.type === 'ipo')) {
            return { parsed, raw: repaired };
          }
        } catch {
          /* give up — render as markdown/code below */
        }
      }
    }
  }

  return null;
}

// Progressive Markdown & Decision Card Renderer Component
const FormattedContent: React.FC<{
  content: string;
  isStreaming?: boolean;
  isUser?: boolean;
  onSendPrompt?: (prompt: string) => void;
}> = ({ content, isStreaming, isUser, onSendPrompt }) => {
  if (!content) return null;

  const looksLikeDecision =
    content.includes('"type"') &&
    (content.includes('"stock"') || content.includes('"ipo"'));

  // 1. While a decision JSON is still streaming in, ALWAYS show the shimmer
  //    placeholder. Rendering the decision card from a partially-streamed JSON
  //    object was the root cause of the blank-screen bug: the cards crashed on
  //    missing fields (e.g. riskLevel / recommendation / keyRisks) and, without
  //    an error boundary, React unmounted the whole app. Cards are only rendered
  //    once streaming has fully completed.
  if (isStreaming && looksLikeDecision) {
    return (
      <div className="space-y-2.5 py-1 animate-pulse">
        <div className="h-6 w-2/3 rounded-lg bg-[#1F2937]" />
        <div className="h-4 w-1/2 rounded bg-[#1F2937]" />
        <div className="h-3 w-3/4 rounded bg-[#1F2937]" />
        <div className="h-3 w-2/3 rounded bg-[#1F2937]" />
        <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold pt-1">
          <span className="inline-block w-2 h-2 rounded-full bg-sky-400 animate-bounce" />
          Generating decision card...
        </div>
      </div>
    );
  }

  // 2. Structured decision cards (stock / IPO) — parsed robustly so raw JSON is
  //    never dumped to the user, even when the response is truncated. A card is
  //    only rendered when every required field is present; anything incomplete
  //    degrades to a code block instead of crashing.
  const decision = extractDecisionJson(content);
  if (decision) {
    const { parsed, raw } = decision;
    if (
      parsed.type === 'stock' &&
      typeof parsed.companyName === 'string' &&
      parsed.companyName.trim() &&
      typeof parsed.recommendation === 'string' &&
      typeof parsed.bottomLine === 'string'
    ) {
      return <StockDecisionCard data={parsed as StockDecisionData} onSendPrompt={onSendPrompt} />;
    }
    if (
      parsed.type === 'ipo' &&
      typeof parsed.companyName === 'string' &&
      parsed.companyName.trim() &&
      typeof parsed.recommendation === 'string' &&
      typeof parsed.finalVerdict === 'string'
    ) {
      return <IpoDecisionCard data={parsed as IpoDecisionData} />;
    }
    // Decision-type JSON missing required fields — degrade to a code block
    return (
      <div className="space-y-2 text-sm leading-relaxed font-sans text-white">
        <pre className="p-3.5 rounded-xl bg-[#0B1220] border border-[#1F2937] overflow-x-auto text-white leading-relaxed">{raw}</pre>
      </div>
    );
  }

  // Split by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-sm leading-relaxed font-sans text-white">
      {parts.map((part, idx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const codeLines = part.slice(3, -3).trim().split('\n');
          const language = codeLines[0].match(/^[a-zA-Z0-9]+$/) ? codeLines.shift() : '';
          const codeText = codeLines.join('\n');

          return (
            <div key={idx} className="my-2 rounded-xl bg-[#0B1220] border border-[#1F2937] font-mono text-xs overflow-hidden shadow-inner">
              {language && (
                <div className="px-3 py-1.5 bg-[#111827] text-gray-300 text-[10px] uppercase font-semibold border-b border-[#1F2937]">
                  {language}
                </div>
              )}
              <pre className="p-3.5 overflow-x-auto text-white leading-relaxed">{codeText}</pre>
            </div>
          );
        }

        // Handle normal text paragraphs, bold, bullet points
        const lines = part.split('\n');
        return (
          <div key={idx} className="space-y-1">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="text-sky-400 font-bold">•</span>
                    <span className="text-white">{parseInlineMarkdown(line.slice(2), isUser)}</span>
                  </div>
                );
              }
              if (!trimmed) return <div key={lIdx} className="h-1" />;
              return (
                <p key={lIdx} className="text-white">
                  {parseInlineMarkdown(line, isUser)}
                  {isStreaming && idx === parts.length - 1 && lIdx === lines.length - 1 && (
                    <span className="inline-block w-2 h-4 ml-1 bg-sky-400 animate-pulse font-mono align-middle">▌</span>
                  )}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// Helper to parse inline markdown (**bold**, *italic*, `code`)
function parseInlineMarkdown(text: string, _isUser?: boolean): React.ReactNode[] {
  const tokens = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={i} className="font-bold text-white">{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return <em key={i} className="text-gray-300 italic">{token.slice(1, -1)}</em>;
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return <code key={i} className="px-1.5 py-0.5 rounded bg-[#0B1220] text-sky-400 font-mono text-xs border border-[#1F2937]">{token.slice(1, -1)}</code>;
    }
    return token;
  });
}

const Chat: React.FC = () => {
  const location = useLocation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const userStoppedRef = useRef<boolean>(false);
  const tokenBufferRef = useRef<string>('');
  const rafIdRef = useRef<number | null>(null);
  const scrollThrottleRef = useRef<number | null>(null);

  // Request Locking Refs to eliminate duplicate submissions
  const isSubmittingRef = useRef<boolean>(false);
  const activeRequestIdRef = useRef<string | null>(null);
  const processedPromptRef = useRef<string | null>(null);
  const isStreamingRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Mirrors activeConvId so async flows (e.g. Home -> Chat prompt pill) can always
  // read the resolved conversation id without stale-closure issues. This prevents
  // the first message from being sent with conversationId: null, which used to
  // make the backend auto-create a duplicate thread on every re-ask.
  const activeConvIdRef = useRef<number | null>(null);

  const [devMode, setDevMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-welcome',
      role: 'assistant',
      content: `Welcome to **Anshul Stocks Ask Mentor**! How can I help you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fsmState: 'FINISHED',
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Ready');

  const [devMetrics, setDevMetrics] = useState<DevModeMetrics>({
    requestId: 'None',
    conversationId: null,
    placeholderId: 'None',
    assistantMessageId: 'None',
    detectedIntent: 'general',
    confidence: 1.0,
    selectedTool: 'None',
    provider: 'InternalEngine',
    cacheStatus: 'LOOKUP_PASS',
    promptTokens: 0,
    completionTokens: 0,
    latencyMs: 0,
    firstTokenLatencyMs: null,
    lastTokenLatencyMs: null,
    executionTimeMs: 0,
    finishReason: 'none',
    fsmState: 'IDLE',
    errors: [],
    abortState: 'Idle',
  });

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (location.state) {
      const stateObj = location.state as any;
      const initialPrompt = stateObj.initialPrompt ? (stateObj.initialPrompt as string).trim() : null;
      const forceNewChat = stateObj.forceNewChat as boolean;

      if (initialPrompt && processedPromptRef.current !== initialPrompt) {
        processedPromptRef.current = initialPrompt;
        // Immediately replace session history state so browser refresh (F5) never re-submits or duplicates chats!
        window.history.replaceState({}, document.title);
        // Resolve the persisted active conversation BEFORE sending so the prompt
        // carries a real conversationId. Sending with null used to race the
        // conversation-list load and create a brand-new duplicate thread each time.
        (async () => {
          if (forceNewChat) {
            // Create a new conversation for IPO analysis
            const newConv = await createNewConversation();
            if (newConv && newConv.id) {
              // Load conversations to update the list
              await loadConversations(newConv.id);
            } else {
              // Fallback: load existing conversations
              await loadConversations();
            }
          } else {
            await loadConversations();
          }
          handleSendMessage(initialPrompt);
        })();
      } else if (forceNewChat && !initialPrompt) {
        // Start a new chat without an initial prompt
        window.history.replaceState({}, document.title);
        handleNewChat();
      }
    }
  }, [location.state]);

  // Throttled auto-scroll during streaming
  useEffect(() => {
    if (scrollThrottleRef.current === null) {
      scrollThrottleRef.current = window.setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        scrollThrottleRef.current = null;
      }, 100);
    }
  }, [messages, isStreaming, statusMessage]);

  const refreshSidebarList = async () => {
    const list = await fetchConversations();
    if (list && list.length > 0) {
      const formatted: ConversationItem[] = list.map((item) => ({
        id: item.id,
        title: item.title,
        updatedAt: new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }));
      setConversations(formatted);
    }
  };

  const loadConversations = async (explicitTargetId?: number | null) => {
    if (isStreamingRef.current) return;
    const list = await fetchConversations();
    if (list && list.length > 0) {
      const formatted: ConversationItem[] = list.map((item) => ({
        id: item.id,
        title: item.title,
        updatedAt: new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }));
      setConversations(formatted);

      const savedIdStr = localStorage.getItem('anshul_active_conv_id');
      const savedId = savedIdStr ? parseInt(savedIdStr, 10) : null;
      const targetId = explicitTargetId !== undefined ? explicitTargetId : (savedId || formatted[0].id);

      if (targetId && formatted.some((c) => c.id === targetId)) {
        await selectConversation(targetId);
      } else if (formatted.length > 0) {
        await selectConversation(formatted[0].id);
      }
    } else {
      // No conversations exist — show clean welcome state
      setConversations([]);
      setActiveConvId(null);
      activeConvIdRef.current = null;
      localStorage.removeItem('anshul_active_conv_id');
    }
  };

  const selectConversation = async (id: number) => {
    if (isStreaming || isStreamingRef.current) return; // Prevent interrupting active stream
    setActiveConvId(id);
    activeConvIdRef.current = id;
    localStorage.setItem('anshul_active_conv_id', id.toString());
    const detail = await fetchConversationById(id);
    if (detail) {
      setTitleInput(detail.title);
      if (detail.messages && detail.messages.length > 0) {
        setMessages(
          detail.messages.map((m: any) => ({
            id: `msg-${m.id}`,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            model: m.model,
            fsmState: 'FINISHED',
          }))
        );
      } else {
        // Conversation exists but has no messages yet — show welcome
        setMessages([
          {
            id: `m-welcome-${Date.now()}`,
            role: 'assistant',
            content: `Welcome to **Anshul Stocks Ask Mentor**! How can I help you today?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            fsmState: 'FINISHED',
          },
        ]);
      }
    }
  };

  const handleSendMessage = async (overridePrompt?: string) => {
    const textToSend = (overridePrompt || inputMessage).trim();
    if (!textToSend) return;

    if (isSubmittingRef.current || isStreaming || isStreamingRef.current) {
      console.warn('[ChatUI] Submission locked. Ignoring duplicate request trigger.');
      return;
    }

    isSubmittingRef.current = true;
    const reqStartTime = Date.now();
    const uniqueReqId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const placeholderId = `ph-${uniqueReqId}`;
    const assistantMsgId = `ai-msg-${uniqueReqId}`;
    activeRequestIdRef.current = uniqueReqId;

    userStoppedRef.current = false;
    tokenBufferRef.current = '';
    if (!overridePrompt) setInputMessage('');
    setIsStreaming(true);
    isStreamingRef.current = true;
    setStatusMessage('Thinking...');

    // 1. Add User Message
    const userMsgId = `usr-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // 2. Add EXACTLY ONE Assistant Placeholder (THINKING state)
    const placeholderAiMsg: ChatMessage = {
      id: assistantMsgId,
      requestId: uniqueReqId,
      placeholderId,
      role: 'assistant',
      content: '',
      timestamp: '',
      model: 'oc/big-pickle',
      fsmState: 'THINKING',
    };

    setMessages((prev) => [...prev, userMsg, placeholderAiMsg]);

    // Use the resolved conversation id (ref avoids stale closure when this send
    // was triggered right after mount, before the conversation list finished loading).
    const effectiveConvId = activeConvIdRef.current ?? activeConvId;

    setDevMetrics({
      requestId: uniqueReqId,
      conversationId: effectiveConvId,
      placeholderId,
      assistantMessageId: assistantMsgId,
      detectedIntent: 'Detecting...',
      confidence: 0,
      selectedTool: 'Evaluating...',
      provider: 'ProviderManager',
      cacheStatus: 'LOOKUP_ACTIVE',
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 0,
      firstTokenLatencyMs: null,
      lastTokenLatencyMs: null,
      executionTimeMs: 0,
      finishReason: 'none',
      fsmState: 'THINKING',
      errors: [],
      abortState: 'Active',
    });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let receivedTokens = 0;

    try {
      const telemetry = await streamChatMessage({
        prompt: textToSend,
        conversationId: effectiveConvId,
        requestId: uniqueReqId,
        placeholderId,
        assistantMessageId: assistantMsgId,
        isUserStopRequested: () => userStoppedRef.current,
        onLifecycleChange: (stage, stageTelemetry) => {
          setDevMetrics((prev) => ({
            ...prev,
            fsmState: stage,
            firstTokenLatencyMs: stageTelemetry?.firstTokenLatencyMs ?? prev.firstTokenLatencyMs,
            lastTokenLatencyMs: stageTelemetry?.lastTokenLatencyMs ?? prev.lastTokenLatencyMs,
            finishReason: stageTelemetry?.finishReason ?? prev.finishReason,
          }));

          // Update existing placeholder FSM state
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, fsmState: stage } : msg))
          );

          if (stage === 'REQUEST_CREATED') setStatusMessage('Initiating Request...');
          if (stage === 'PLACEHOLDER_CREATED') setStatusMessage('Thinking...');
          if (stage === 'THINKING') setStatusMessage('Thinking...');
          if (stage === 'WAITING_FIRST_TOKEN') setStatusMessage('Waiting for first token...');
          if (stage === 'STREAMING') setStatusMessage('Streaming...');
        },
        onInit: (initPayload: StreamInitPayload) => {
          if (initPayload.conversationId && initPayload.conversationId !== activeConvId) {
            setActiveConvId(initPayload.conversationId);
            activeConvIdRef.current = initPayload.conversationId;
            localStorage.setItem('anshul_active_conv_id', initPayload.conversationId.toString());
            refreshSidebarList();
          }
          setDevMetrics((prev) => ({
            ...prev,
            conversationId: initPayload.conversationId,
            requestId: initPayload.requestId || uniqueReqId,
            detectedIntent: initPayload.detectedIntent?.intent || 'general',
            confidence: initPayload.detectedIntent?.confidence || 0.9,
            selectedTool: initPayload.selectedTool || 'None',
            provider: initPayload.providerUsed || 'InternalEngine',
          }));
        },
        onStage: (_stage: string, msg: string) => {
          setStatusMessage(msg);
        },
        onChunk: (chunk: string) => {
          receivedTokens++;
          tokenBufferRef.current += chunk;

          // Immediate flush for the first token (<2s TTFT)
          if (receivedTokens === 1) {
            const initialChunk = tokenBufferRef.current;
            tokenBufferRef.current = '';
            setStatusMessage('Streaming...');
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { ...msg, content: msg.content + initialChunk, fsmState: 'STREAMING' }
                  : msg
              )
            );
          } else if (rafIdRef.current === null) {
            // Batched 60 FPS updates via requestAnimationFrame
            rafIdRef.current = requestAnimationFrame(() => {
              const bufferedText = tokenBufferRef.current;
              tokenBufferRef.current = '';
              rafIdRef.current = null;
              if (bufferedText) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId ? { ...msg, content: msg.content + bufferedText } : msg
                  )
                );
              }
            });
          }

          setDevMetrics((prev) => ({
            ...prev,
            completionTokens: prev.completionTokens + 1,
            executionTimeMs: Date.now() - reqStartTime,
          }));
        },
        signal: abortController.signal,
        timeoutMs: 60000,
      });

      const finalTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setStatusMessage('Completed');
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId ? { ...msg, timestamp: finalTimestamp, fsmState: 'FINISHED' } : msg
        )
      );

      setDevMetrics((prev) => ({
        ...prev,
        fsmState: 'FINISHED',
        executionTimeMs: Date.now() - reqStartTime,
        firstTokenLatencyMs: telemetry.firstTokenLatencyMs,
        lastTokenLatencyMs: telemetry.lastTokenLatencyMs,
        finishReason: telemetry.finishReason || 'stop',
        abortState: 'No',
      }));
    } catch (err: any) {
      if (err.name === 'AbortError' && userStoppedRef.current) {
        setStatusMessage('Cancelled');
        const finalTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                ...msg,
                content: msg.content + '\n\n*(Stream stopped by user).*',
                timestamp: finalTimestamp,
                fsmState: 'CANCELLED',
              }
              : msg
          )
        );
        setDevMetrics((prev) => ({
          ...prev,
          fsmState: 'CANCELLED',
          finishReason: 'user_cancelled',
          abortState: 'User Stopped',
        }));
      } else {
        setStatusMessage('Failed');
        setDevMetrics((prev) => ({
          ...prev,
          fsmState: 'FAILED',
          errors: [...prev.errors, err.message || 'Stream error occurred'],
          finishReason: 'error',
          abortState: 'Failed',
        }));

        if (receivedTokens === 0) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                  ...msg,
                  content: `⚠️ **Unable to process query**: ${err.message || 'Backend service connection error'}.\n\nPlease check network connectivity or click **Retry** below.`,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  fsmState: 'FAILED',
                }
                : msg
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                  ...msg,
                  content: msg.content + `\n\n*(Stream interrupted: ${err.message}. Click retry to resend).*`,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  fsmState: 'FAILED',
                }
                : msg
            )
          );
        }
      }
    } finally {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (tokenBufferRef.current) {
        const remaining = tokenBufferRef.current;
        tokenBufferRef.current = '';
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, content: msg.content + remaining } : msg
          )
        );
      }

      setIsStreaming(false);
      isStreamingRef.current = false;
      activeRequestIdRef.current = null;
      abortControllerRef.current = null;
      userStoppedRef.current = false;
      isSubmittingRef.current = false;
    }
  };

  const handleStopStream = () => {
    if (abortControllerRef.current) {
      userStoppedRef.current = true;
      abortControllerRef.current.abort();
      setIsStreaming(false);
      isStreamingRef.current = false;
      isSubmittingRef.current = false;
    }
  };

  const handleInlineUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    if (isStreamingRef.current || isStreaming) return;

    try {
      setStatusMessage(`Uploading ${files.length} screenshot(s) for OCR...`);
      const records: any[] = [];
      for (const file of files) {
        const record = await uploadScreenshotApi(file, activeConvId || undefined);
        records.push(record);
      }
      const names = records.map((r, idx) => `"${r?.originalName || files[idx].name}"`).join(', ');
      const ids = records.map(r => r?.id || 'latest').join(', ');
      const prompt = `Analyzing ${files.length} uploaded screenshot(s): ${names} (Upload IDs: ${ids}). Please extract OCR text, summarize key stock holdings or indicators across all images, and analyze total risk exposure.`;
      handleSendMessage(prompt);
    } catch (err: any) {
      alert(`Upload failed: ${err.message || 'Unknown error'}`);
      setStatusMessage('Ready');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleNewChat = () => {
    if (isStreaming || isStreamingRef.current) return;
    setActiveConvId(null);
    activeConvIdRef.current = null;
    localStorage.removeItem('anshul_active_conv_id');
    setTitleInput('New AI Conversation');
    setMessages([
      {
        id: `m-welcome-${Date.now()}`,
        role: 'assistant',
        content: `Welcome to **Anshul Stocks Ask Mentor**! How can I help you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fsmState: 'FINISHED',
      },
    ]);
  };

  const handleDeleteConv = async (id: number) => {
    await deleteConversationApi(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) {
      localStorage.removeItem('anshul_active_conv_id');
      handleNewChat();
    }
  };

  const handleRenameTitle = async () => {
    if (!activeConvId || !titleInput.trim()) return;
    const ok = await renameConversation(activeConvId, titleInput.trim());
    if (ok) {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConvId ? { ...c, title: titleInput.trim() } : c))
      );
      setEditingTitle(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRetry = () => {
    if (isStreaming || isSubmittingRef.current) return;
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      handleSendMessage(lastUserMessage.content);
    }
  };

  const activeTitle = conversations.find((c) => c.id === activeConvId)?.title || 'AI Investment Mentor Chat';

  return (
    <div className="flex-1 flex h-[calc(100vh-4rem)] bg-[var(--bg-base)] overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={(id) => selectConversation(id)}
        onNewChat={handleNewChat}
        onDelete={handleDeleteConv}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-base)]">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-subtle)]"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              {editingTitle ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    className="bg-[#0B1220] text-white caret-sky-400 text-xs font-semibold px-2 py-1 rounded border border-sky-400 focus:outline-none"
                    autoFocus
                  />
                  <button onClick={handleRenameTitle} className="text-sky-400 p-1 hover:bg-[#1F2937] rounded">
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditingTitle(false)} className="text-gray-400 p-1 hover:bg-[#1F2937] rounded">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span className="font-semibold text-sm text-white truncate max-w-xs">{activeTitle}</span>
                  {activeConvId && (
                    <button
                      onClick={() => {
                        setTitleInput(activeTitle);
                        setEditingTitle(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-sky-400 rounded"
                      title="Rename Title"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isStreaming && (
              <span className="flex items-center gap-1.5 text-xs text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2.5 py-1 rounded-full animate-pulse font-semibold">
                <Activity className="w-3 h-3 animate-spin" />
                <span>{statusMessage}</span>
              </span>
            )}

            <button
              onClick={() => setDevMode(!devMode)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${devMode ? 'bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/40' : 'bg-[#111827] border border-[#1F2937] text-gray-300 hover:text-white hover:border-sky-500/40'
                }`}
              title="Toggle Developer Debug Panel"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{devMode ? 'Dev Mode ON' : 'Dev Mode'}</span>
            </button>
          </div>
        </div>

        {/* Developer Mode Debug Drawer */}
        {devMode && (
          <div className="bg-[#0B1220] border-b border-[#1F2937] p-3 text-xs font-mono text-[var(--warning)] grid grid-cols-2 md:grid-cols-4 gap-3 shadow-inner">
            <div className="flex flex-col space-y-0.5">
              <span className="text-[10px] text-[var(--warning)] uppercase flex items-center gap-1">
                <Cpu className="w-3 h-3" /> Identifiers
              </span>
              <span className="truncate text-white font-semibold">Req: {devMetrics.requestId}</span>
              <span className="truncate text-gray-400 text-[10px]">Conv: {devMetrics.conversationId || 'None'}</span>
              <span className="truncate text-gray-400 text-[10px]">Placeholder: {devMetrics.placeholderId}</span>
              <span className="truncate text-gray-400 text-[10px]">Msg: {devMetrics.assistantMessageId}</span>
            </div>

            <div className="flex flex-col space-y-0.5">
              <span className="text-[10px] text-[var(--warning)] uppercase flex items-center gap-1">
                <Layers className="w-3 h-3" /> FSM & Intent
              </span>
              <span className="truncate text-sky-400 font-bold">FSM State: {devMetrics.fsmState}</span>
              <span className="truncate text-white font-semibold">{devMetrics.detectedIntent} ({Math.round(devMetrics.confidence * 100)}%)</span>
              <span className="text-[10px] text-gray-400">Tool: {devMetrics.selectedTool}</span>
            </div>

            <div className="flex flex-col space-y-0.5">
              <span className="text-[10px] text-[var(--warning)] uppercase flex items-center gap-1">
                <Database className="w-3 h-3" /> Provider & Telemetry
              </span>
              <span className="truncate text-white font-semibold">Provider: {devMetrics.provider}</span>
              <span className="text-[10px] text-gray-400">Model: Big Pickle AI</span>
              <span className="text-[10px] text-gray-400">Finish: {devMetrics.finishReason}</span>
              <span className="text-[10px] text-gray-400">Abort: {devMetrics.abortState}</span>
            </div>

            <div className="flex flex-col space-y-0.5">
              <span className="text-[10px] text-[var(--warning)] uppercase flex items-center gap-1">
                <Activity className="w-3 h-3" /> Performance Metrics
              </span>
              <span className="truncate text-white font-semibold">{devMetrics.completionTokens} chunks | {devMetrics.executionTimeMs}ms</span>
              <span className="text-[10px] text-sky-400 font-semibold">
                TTFT: {devMetrics.firstTokenLatencyMs !== null ? `${devMetrics.firstTokenLatencyMs}ms` : 'Waiting...'}
              </span>
              <span className="text-[10px] text-gray-400">
                TTLT: {devMetrics.lastTokenLatencyMs !== null ? `${devMetrics.lastTokenLatencyMs}ms` : 'N/A'}
              </span>
            </div>
          </div>
        )}

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-[#1F2937]">
          <ErrorBoundary
            fallback={(error, reset) => (
              <div className="p-4 rounded-2xl bg-[#111827] border border-red-500/40 text-sm text-red-300 max-w-2xl space-y-2">
                <p className="font-semibold">⚠️ The conversation could not be displayed.</p>
                <p className="text-xs font-mono text-red-400/90 break-words">{error.message}</p>
                <button
                  onClick={reset}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-semibold transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
          >
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isThinkingState =
              !isUser &&
              (!msg.content.trim() ||
                msg.fsmState === 'THINKING' ||
                msg.fsmState === 'REQUEST_CREATED' ||
                msg.fsmState === 'PLACEHOLDER_CREATED' ||
                msg.fsmState === 'WAITING_FIRST_TOKEN');

            const isCompletedState = !isUser && (msg.fsmState === 'FINISHED' || msg.fsmState === 'COMPLETED' || (!isStreaming && msg.content));

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 max-w-4xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${isUser
                      ? 'bg-sky-500 text-white'
                      : 'bg-gradient-to-tr from-[#2563EB] to-sky-500 text-white'
                    }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <ErrorBoundary
                  fallback={(_error, reset) => (
                    <div className="p-4 rounded-2xl bg-[#111827] border border-red-500/40 text-sm text-red-300 max-w-2xl space-y-2">
                      <p className="font-semibold">⚠️ This message could not be rendered.</p>
                      {msg.content && (
                        <pre className="whitespace-pre-wrap text-xs bg-[#0B1220] border border-[#1F2937] rounded-lg p-2.5 max-h-64 overflow-auto text-white">{msg.content}</pre>
                      )}
                      <button
                        onClick={reset}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-semibold transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                >
                <div className="space-y-1.5 max-w-2xl">
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed ${isUser
                        ? 'bg-[#111827] text-white border border-sky-500/40 rounded-tr-none font-medium shadow-md'
                        : 'bg-[#111827] text-white border border-[#1F2937] rounded-tl-none shadow-lg'
                      }`}
                  >
                    {isThinkingState ? (
                      /* ChatGPT-Style Thinking UX */
                      <div className="flex items-center gap-2 text-gray-300 font-medium py-1">
                        <span className="text-sm tracking-wide">Thinking...</span>
                        <span className="flex items-center gap-1.5 ml-1">
                          <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce"></span>
                        </span>
                      </div>
                    ) : (
                      <FormattedContent
                        content={msg.content}
                        isStreaming={msg.fsmState === 'STREAMING'}
                        isUser={isUser}
                        onSendPrompt={(promptText) => handleSendMessage(promptText)}
                      />
                    )}

                    {devMode && !isUser && (
                      <div className="mt-3 p-3 rounded-xl bg-[#0B1220] border border-[var(--warning)]/30 font-mono text-xs text-[var(--warning)]">
                        <div className="text-[10px] text-[var(--warning)] uppercase tracking-wider font-bold mb-1 flex items-center gap-1">
                          <Terminal className="w-3 h-3" />
                          <span>Dev Mode: Single Placeholder & FSM Trace</span>
                        </div>
                        <pre className="overflow-x-auto text-[11px] whitespace-pre-wrap">
                          {`Msg ID: ${msg.id}\nReq ID: ${msg.requestId || devMetrics.requestId}\nPlaceholder ID: ${msg.placeholderId || devMetrics.placeholderId}\nFSM State: ${msg.fsmState || devMetrics.fsmState}`}
                        </pre>
                      </div>
                    )}
                  </div>

                  {!isUser && (
                    <div className="flex items-center justify-between px-1 text-xs text-gray-400">
                      <div className="flex items-center gap-3">
                        {isCompletedState && msg.timestamp && <span>{msg.timestamp}</span>}
                        {msg.model && <span className="font-mono text-[10px] text-gray-400">({msg.model})</span>}
                      </div>

                      {isCompletedState && msg.content && (
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="flex items-center gap-1 text-gray-400 hover:text-sky-400 transition-colors"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-sky-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                </ErrorBoundary>
              </div>
            );
          })}

          </ErrorBoundary>
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-[#1F2937] bg-[#111827]">
          <div className="max-w-4xl mx-auto flex flex-col gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2 bg-[#0B1220] border border-[#1F2937] rounded-xl p-2 shadow-lg focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/30 transition-all"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask your AI Investment Mentor about stocks, IPOs, or valuation ratios..."
                className="flex-1 bg-transparent px-3 text-sm text-white placeholder:text-gray-400 caret-sky-400 focus:outline-none"
              />

              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleInlineUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming}
                title="Upload broker/chart screenshot for live AI OCR analysis"
                className="p-2 text-gray-400 hover:text-sky-400 transition-colors disabled:opacity-40"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStopStream}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--danger)]/10 hover:bg-[var(--danger)]/30 text-[var(--danger)] font-semibold text-xs border border-[var(--danger)]/40 transition-all"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isStreaming}
                  className="btn-primary p-2.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </form>

            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] px-1">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[var(--accent)]" />
                <span>AI Investment Mentor • Live Exchange Data & Unbiased Scoring</span>
              </span>
              {!isStreaming && messages.some((m) => m.fsmState === 'FAILED') && (
                <button
                  onClick={handleRetry}
                  disabled={isStreaming}
                  className="flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry last query</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;

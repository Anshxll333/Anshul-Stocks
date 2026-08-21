import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Headers,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('history')
  async getHistory(@Headers('x-visitor-id') headerVisitorId?: string) {
    const visitorId = headerVisitorId || 'anonymous_fallback';
    const history = await this.chatService.getRecentConversations(visitorId);
    return { success: true, data: history };
  }

  @Post('message')
  async sendMessage(
    @Headers('x-request-id') headerRequestId?: string,
    @Headers('x-visitor-id') headerVisitorId?: string,
    @Body('requestId') bodyRequestId?: string,
    @Body('conversationId') conversationId?: number,
    @Body('prompt') prompt?: string,
  ) {
    if (!prompt || !prompt.trim()) {
      return { success: false, message: 'Prompt message is required' };
    }
    const requestId =
      headerRequestId ||
      bodyRequestId ||
      `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const visitorId = headerVisitorId || 'anonymous_fallback';
    const convId = conversationId ? Number(conversationId) : null;
    const result = await this.chatService.processChatMessage(
      visitorId,
      convId,
      prompt.trim(),
      requestId,
    );

    return {
      success: true,
      requestId,
      data: result,
    };
  }

  @Post('message/stream')
  async streamMessage(
    @Res() res: Response,
    @Headers('x-request-id') headerRequestId?: string,
    @Headers('x-visitor-id') headerVisitorId?: string,
    @Body('requestId') bodyRequestId?: string,
    @Body('conversationId') conversationId?: number,
    @Body('prompt') prompt?: string,
  ) {
    if (!prompt || !prompt.trim()) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: 'Prompt is required' });
    }

    const requestId =
      headerRequestId ||
      bodyRequestId ||
      `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const visitorId = headerVisitorId || 'anonymous_fallback';
    const convId = conversationId ? Number(conversationId) : null;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-open');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('X-Request-ID', requestId);

    const heartbeatInterval = setInterval(() => {
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now(), requestId })}\n\n`,
        );
      }
    }, 3000);

    // Send an immediate stage acknowledgement so the frontend gets instant feedback
    // that the backend received the request (instead of showing 'Thinking...' silently
    // while tool routing / provider lookups run).
    res.write(
      `data: ${JSON.stringify({
        type: 'stage',
        stage: 'THINKING',
        message: 'Received your request. Fetching live market data...',
        requestId,
      })}\n\n`,
    );

    try {
      const {
        convId: activeConvId,
        requestId: activeReqId,
        toolRouting,
        stream,
      } = await this.chatService.processChatStream(
        visitorId,
        convId,
        prompt.trim(),
        requestId,
      );

      // Send initial conversation metadata & lifecycle stage chunks
      res.write(
        `data: ${JSON.stringify({
          type: 'init',
          conversationId: activeConvId,
          requestId: activeReqId,
          detectedIntent: toolRouting.detectedIntent,
          selectedTool: toolRouting.toolExecuted,
          providerUsed: toolRouting.providerUsed,
        })}\n\n`,
      );

      res.write(
        `data: ${JSON.stringify({
          type: 'stage',
          stage: 'STREAMING',
          message: 'Generating AI Response...',
          requestId: activeReqId,
        })}\n\n`,
      );

      for await (const chunk of stream) {
        res.write(
          `data: ${JSON.stringify({ type: 'token', chunk, requestId: activeReqId })}\n\n`,
        );
      }

      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          requestId: activeReqId,
          conversationId: activeConvId,
        })}\n\n`,
      );
    } catch (err: any) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          message: err.message || 'Stream processing failed',
          requestId,
        })}\n\n`,
      );
    } finally {
      clearInterval(heartbeatInterval);
      res.end();
    }
  }
}

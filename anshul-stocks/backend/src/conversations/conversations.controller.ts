import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Headers,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  async getConversations(@Headers('x-visitor-id') headerVisitorId?: string) {
    const visitorId = headerVisitorId || 'anonymous_fallback';
    const items =
      await this.conversationsService.getUserConversations(visitorId);
    return { success: true, data: items };
  }

  @Get(':id')
  async getConversation(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-visitor-id') headerVisitorId?: string,
  ) {
    const visitorId = headerVisitorId || 'anonymous_fallback';
    const item = await this.conversationsService.getConversationById(
      id,
      visitorId,
    );
    return { success: true, data: item };
  }

  @Post()
  async createConversation(
    @Headers('x-visitor-id') headerVisitorId?: string,
    @Body('title') title?: string,
  ) {
    const visitorId = headerVisitorId || 'anonymous_fallback';
    const conv = await this.conversationsService.createConversation(
      visitorId,
      title,
    );
    return { success: true, data: conv };
  }

  @Post(':id/messages')
  async addMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body('role') role: 'user' | 'assistant' | 'system',
    @Body('content') content: string,
    @Body('metadata') metadata?: Record<string, any>,
  ) {
    const msg = await this.conversationsService.addMessage(
      id,
      role,
      content,
      metadata,
    );
    return { success: true, data: msg };
  }

  @Patch(':id')
  async renameConversation(
    @Param('id', ParseIntPipe) id: number,
    @Body('title') title: string,
    @Headers('x-visitor-id') headerVisitorId?: string,
  ) {
    const visitorId = headerVisitorId || 'anonymous_fallback';
    const updated = await this.conversationsService.renameConversationTitle(
      id,
      visitorId,
      title,
    );
    return { success: true, data: updated };
  }

  @Delete(':id')
  async deleteConversation(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-visitor-id') headerVisitorId?: string,
  ) {
    const visitorId = headerVisitorId || 'anonymous_fallback';
    const res = await this.conversationsService.deleteConversation(
      id,
      visitorId,
    );
    return res;
  }
}

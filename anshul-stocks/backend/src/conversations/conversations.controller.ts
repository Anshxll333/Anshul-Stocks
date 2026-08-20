import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  async getConversations() {
    // Demo/placeholder userId = 1 for Sprint 3 readiness
    const demoUserId = 1;
    const items =
      await this.conversationsService.getUserConversations(demoUserId);
    return { success: true, data: items };
  }

  @Get(':id')
  async getConversation(@Param('id', ParseIntPipe) id: number) {
    const demoUserId = 1;
    const item = await this.conversationsService.getConversationById(
      id,
      demoUserId,
    );
    return { success: true, data: item };
  }

  @Post()
  async createConversation(@Body('title') title?: string) {
    const demoUserId = 1;
    const conv = await this.conversationsService.createConversation(
      demoUserId,
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
  ) {
    const demoUserId = 1;
    const updated = await this.conversationsService.renameConversationTitle(
      id,
      demoUserId,
      title,
    );
    return { success: true, data: updated };
  }

  @Delete(':id')
  async deleteConversation(@Param('id', ParseIntPipe) id: number) {
    const demoUserId = 1;
    const res = await this.conversationsService.deleteConversation(
      id,
      demoUserId,
    );
    return res;
  }
}

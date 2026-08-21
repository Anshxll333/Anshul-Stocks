import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { conversations, messages, users } from '../database/schema';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class ConversationsService {
  constructor(@Inject(DRIZZLE_CONNECTION) private readonly db: DrizzleDB) {}

  async resolveVisitor(visitorId: string): Promise<number> {
    const email = `visitor_${visitorId}@anshulstocks.com`;
    const [existing] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!existing) {
      const [newUser] = await this.db
        .insert(users)
        .values({
          email,
          passwordHash: 'secure_visitor_hash',
          fullName: 'Anonymous Visitor',
        })
        .returning();
      return newUser.id;
    }
    return existing.id;
  }

  async getUserConversations(visitorId: string) {
    const userId = await this.resolveVisitor(visitorId);
    return this.db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt));
  }

  async getConversationById(id: number, visitorId: string) {
    const userId = await this.resolveVisitor(visitorId);
    const [conv] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));

    if (!conv || conv.userId !== userId) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    const msgList = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    return {
      ...conv,
      messages: msgList,
    };
  }

  async createConversation(visitorId: string, title?: string) {
    const userId = await this.resolveVisitor(visitorId);
    const [conv] = await this.db
      .insert(conversations)
      .values({
        userId,
        title: title || 'New AI Analysis Chat',
      })
      .returning();

    return conv;
  }

  async addMessage(
    conversationId: number,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>,
  ) {
    const [msg] = await this.db
      .insert(messages)
      .values({
        conversationId,
        role,
        content,
        metadata: metadata ? JSON.stringify(metadata) : null,
      })
      .returning();

    await this.db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    return msg;
  }

  async renameConversationTitle(id: number, visitorId: string, title: string) {
    const userId = await this.resolveVisitor(visitorId);
    await this.getConversationById(id, visitorId);
    const [updated] = await this.db
      .update(conversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return updated;
  }

  async deleteConversation(id: number, visitorId: string) {
    const userId = await this.resolveVisitor(visitorId);
    await this.getConversationById(id, visitorId);
    await this.db.delete(conversations).where(eq(conversations.id, id));
    return { success: true, message: 'Conversation deleted successfully' };
  }
}

import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users } from '../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE_CONNECTION) private readonly db: NodePgDatabase<any>,
  ) {}

  async findByEmail(email: string) {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return result[0] || null;
  }

  async create(user: {
    email: string;
    passwordHash: string;
    fullName: string;
  }) {
    const result = await this.db.insert(users).values(user).returning();
    return result[0];
  }

  async findById(id: number) {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0] || null;
  }
}

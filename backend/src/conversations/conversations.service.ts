import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

const DEFAULT_TITLE = '새 시뮬레이션';

type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  instruction_text?: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
};

@Injectable()
export class ConversationsService {
  constructor(private readonly db: DatabaseService) {}

  createConversation(userId: string, title?: string) {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO conversations (id, user_id, title, instruction_text, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, title?.trim() || DEFAULT_TITLE, null, now, now],
    );
    return this.getConversationOrThrow(id, userId);
  }

  listConversations(userId: string) {
    return this.db.all<Omit<ConversationRow, 'instruction_text' | 'user_id'>>(
      `SELECT id, title, created_at, updated_at
       FROM conversations
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [userId],
    );
  }

  getConversationOrThrow(
    conversationId: string,
    userId: string,
  ): ConversationRow {
    const record = this.db.get<ConversationRow>(
      'SELECT * FROM conversations WHERE id = ?',
      [conversationId],
    );
    if (!record) {
      throw new NotFoundException('대화를 찾을 수 없습니다.');
    }
    if (record.user_id !== userId) {
      throw new ForbiddenException('대화에 접근할 수 없습니다.');
    }
    return record;
  }

  renameConversation(conversationId: string, userId: string, title: string) {
    this.getConversationOrThrow(conversationId, userId);
    const trimmed = title.trim() || DEFAULT_TITLE;
    this.db.run(
      'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
      [trimmed, new Date().toISOString(), conversationId],
    );
    return this.getConversationOrThrow(conversationId, userId);
  }

  updateInstruction(
    conversationId: string,
    userId: string,
    instructionText?: string,
  ) {
    this.getConversationOrThrow(conversationId, userId);
    this.db.run(
      'UPDATE conversations SET instruction_text = ?, updated_at = ? WHERE id = ?',
      [
        instructionText?.trim() || null,
        new Date().toISOString(),
        conversationId,
      ],
    );
    return this.getConversationOrThrow(conversationId, userId);
  }

  deleteConversation(conversationId: string, userId: string) {
    this.getConversationOrThrow(conversationId, userId);
    this.db.run('DELETE FROM messages WHERE conversation_id = ?', [
      conversationId,
    ]);
    this.db.run('DELETE FROM manuals WHERE conversation_id = ?', [
      conversationId,
    ]);
    this.db.run('DELETE FROM conversations WHERE id = ?', [conversationId]);
  }

  appendMessage(
    conversationId: string,
    role: string,
    content: string,
    userId?: string,
  ) {
    const conversation = userId
      ? this.getConversationOrThrow(conversationId, userId)
      : this.db.get<ConversationRow>(
          'SELECT * FROM conversations WHERE id = ?',
          [conversationId],
        );
    if (!conversation) {
      throw new NotFoundException('대화를 찾을 수 없습니다.');
    }
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO messages (id, conversation_id, role, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), conversationId, role, content, now],
    );
    this.db.run('UPDATE conversations SET updated_at = ? WHERE id = ?', [
      now,
      conversationId,
    ]);

    if (conversation.title === DEFAULT_TITLE && role !== 'system') {
      const snippet = content.trim().slice(0, 30) || DEFAULT_TITLE;
      this.db.run('UPDATE conversations SET title = ? WHERE id = ?', [
        snippet,
        conversationId,
      ]);
    }
  }

  getMessages(conversationId: string, userId: string) {
    this.getConversationOrThrow(conversationId, userId);
    return this.db.all<MessageRow>(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId],
    );
  }

  getInstruction(conversationId: string) {
    const record = this.db.get<{ instruction_text?: string | null }>(
      'SELECT instruction_text FROM conversations WHERE id = ?',
      [conversationId],
    );
    return record?.instruction_text ?? null;
  }
}

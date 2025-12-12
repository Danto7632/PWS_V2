import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { ProjectsService } from '../projects/projects.service';

const DEFAULT_TITLE = '새 시뮬레이션';

type ConversationRow = {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  role: 'customer' | 'employee';
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
  constructor(
    private readonly db: DatabaseService,
    private readonly projectsService: ProjectsService,
  ) {}

  async createConversation(
    projectId: string,
    userId: string,
    options: { title?: string; role: 'customer' | 'employee' },
  ) {
    await this.projectsService.getProjectOrThrow(projectId, userId);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO conversations (id, user_id, project_id, title, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        projectId,
        options.title?.trim() || DEFAULT_TITLE,
        options.role,
        now,
        now,
      ],
    );
    this.projectsService.touchProject(projectId);
    return this.getConversationOrThrow(id, userId);
  }

  async listProjectChats(projectId: string, userId: string) {
    await this.projectsService.getProjectOrThrow(projectId, userId);
    return this.db.all<ConversationRow>(
      `SELECT id, user_id, project_id, title, role, created_at, updated_at
       FROM conversations
       WHERE project_id = ?
       ORDER BY updated_at DESC`,
      [projectId],
    );
  }

  listUserConversations(userId: string) {
    return this.db.all<ConversationRow>(
      `SELECT c.id, c.user_id, c.project_id, c.title, c.role, c.created_at, c.updated_at
       FROM conversations c
       JOIN projects p ON c.project_id = p.id
       WHERE p.user_id = ?
       ORDER BY c.updated_at DESC`,
      [userId],
    );
  }

  async createUserConversation(userId: string, title?: string) {
    const normalizedTitle = title?.trim() || DEFAULT_TITLE;
    const project = this.projectsService.createProject(userId, {
      name: normalizedTitle,
    });
    return this.createConversation(project.id, userId, {
      title: normalizedTitle,
      role: 'customer',
    });
  }

  getConversationOrThrow(
    conversationId: string,
    userId?: string,
  ): ConversationRow {
    const record = this.db.get<
      ConversationRow & { project_owner_id: string }
    >(
      `SELECT c.*, p.user_id as project_owner_id
       FROM conversations c
       JOIN projects p ON c.project_id = p.id
       WHERE c.id = ?`,
      [conversationId],
    );
    if (!record) {
      throw new NotFoundException('대화를 찾을 수 없습니다.');
    }
    if (userId && record.project_owner_id !== userId) {
      throw new ForbiddenException('대화에 접근할 수 없습니다.');
    }
    return record;
  }

  renameConversation(
    conversationId: string,
    projectId: string,
    userId: string,
    title: string,
  ) {
    this.ensureChatBelongsToProject(conversationId, projectId, userId);
    const trimmed = title.trim() || DEFAULT_TITLE;
    this.db.run(
      'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
      [trimmed, new Date().toISOString(), conversationId],
    );
    this.projectsService.touchProject(projectId);
    return this.getConversationOrThrow(conversationId, userId);
  }

  deleteConversation(
    conversationId: string,
    projectId: string,
    userId: string,
  ) {
    this.ensureChatBelongsToProject(conversationId, projectId, userId);
    this.db.run('DELETE FROM messages WHERE conversation_id = ?', [
      conversationId,
    ]);
    this.db.run('DELETE FROM conversations WHERE id = ?', [conversationId]);
    this.projectsService.touchProject(projectId);
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
    this.projectsService.touchProject(conversation.project_id);

    if (conversation.title === DEFAULT_TITLE && role !== 'system') {
      const snippet = content.trim().slice(0, 30) || DEFAULT_TITLE;
      this.db.run('UPDATE conversations SET title = ? WHERE id = ?', [
        snippet,
        conversationId,
      ]);
    }
  }

  getMessages(conversationId: string, projectId: string, userId: string) {
    this.ensureChatBelongsToProject(conversationId, projectId, userId);
    return this.db.all<MessageRow>(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId],
    );
  }

  getMessagesForUser(conversationId: string, userId: string) {
    this.getConversationOrThrow(conversationId, userId);
    return this.db.all<MessageRow>(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId],
    );
  }

  renameConversationById(
    conversationId: string,
    userId: string,
    title: string,
  ) {
    const conversation = this.getConversationOrThrow(conversationId, userId);
    return this.renameConversation(
      conversationId,
      conversation.project_id,
      userId,
      title,
    );
  }

  deleteConversationById(conversationId: string, userId: string) {
    const conversation = this.getConversationOrThrow(conversationId, userId);
    this.deleteConversation(conversationId, conversation.project_id, userId);
  }

  ensureChatBelongsToProject(
    conversationId: string,
    projectId: string,
    userId: string,
  ) {
    const conversation = this.getConversationOrThrow(conversationId, userId);
    if (conversation.project_id !== projectId) {
      throw new ForbiddenException('프로젝트에 속한 채팅이 아닙니다.');
    }
    return conversation;
  }
}

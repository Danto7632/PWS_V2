import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { randomUUID } from 'node:crypto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  instruction_text?: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly db: DatabaseService) {}

  createProject(userId: string, dto: CreateProjectDto) {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO projects (id, user_id, name, description, instruction_text, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        dto.name.trim(),
        dto.description?.trim() || null,
        dto.instructionText?.trim() || null,
        now,
        now,
      ],
    );
    return this.getProjectOrThrow(id, userId);
  }

  listProjects(userId: string) {
    return this.db.all<
      ProjectRow & {
        chat_count: number;
      }
    >(
      `SELECT p.*, COUNT(c.id) AS chat_count
       FROM projects p
       LEFT JOIN conversations c ON c.project_id = p.id
       WHERE p.user_id = ?
       GROUP BY p.id
       ORDER BY p.updated_at DESC`,
      [userId],
    );
  }

  getProjectOrThrow(projectId: string, userId: string): ProjectRow {
    const record = this.db.get<ProjectRow>(
      'SELECT * FROM projects WHERE id = ?',
      [projectId],
    );
    if (!record) {
      throw new NotFoundException('프로젝트를 찾을 수 없습니다.');
    }
    if (record.user_id !== userId) {
      throw new ForbiddenException('프로젝트에 접근할 수 없습니다.');
    }
    return record;
  }

  updateProject(projectId: string, userId: string, dto: UpdateProjectDto) {
    const project = this.getProjectOrThrow(projectId, userId);
    const nextName = dto.name?.trim() || project.name;
    const nextDescription = dto.description?.trim() ?? project.description ?? null;
    const nextInstruction =
      dto.instructionText?.trim() ?? project.instruction_text ?? null;
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE projects SET name = ?, description = ?, instruction_text = ?, updated_at = ? WHERE id = ?`,
      [nextName, nextDescription, nextInstruction, now, projectId],
    );
    return this.getProjectOrThrow(projectId, userId);
  }

  deleteProject(projectId: string, userId: string) {
    this.getProjectOrThrow(projectId, userId);
    const chatIds = this.db.all<{ id: string }>(
      'SELECT id FROM conversations WHERE project_id = ?',
      [projectId],
    );
    chatIds.forEach((chat) => {
      this.db.run('DELETE FROM messages WHERE conversation_id = ?', [chat.id]);
    });
    this.db.run('DELETE FROM conversations WHERE project_id = ?', [projectId]);
    this.db.run('DELETE FROM manuals WHERE owner_id = ?', [projectId]);
    this.db.run('DELETE FROM projects WHERE id = ?', [projectId]);
  }

  touchProject(projectId: string) {
    this.db.run('UPDATE projects SET updated_at = ? WHERE id = ?', [
      new Date().toISOString(),
      projectId,
    ]);
  }
}

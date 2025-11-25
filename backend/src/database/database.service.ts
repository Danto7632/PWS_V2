import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'node:crypto';

type SQLiteDatabase = ReturnType<typeof Database>;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db: SQLiteDatabase | null = null;
  private readonly dbPath = path.join(process.cwd(), 'storage', 'app.db');

  async onModuleInit() {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.createTables();
    this.logger.log(`SQLite database initialised at ${this.dbPath}`);
  }

  onModuleDestroy() {
    this.db?.close();
  }

  private ensureDb(): SQLiteDatabase {
    if (!this.db) {
      throw new Error('Database not initialised');
    }
    return this.db;
  }

  private createTables() {
    const db = this.ensureDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        instruction_text TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT,
        title TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id)
      );
    `);

    this.ensureColumn('conversations', 'project_id', 'TEXT');
    this.ensureColumn(
      'conversations',
      'role',
      "TEXT DEFAULT 'customer'",
    );
    this.ensureManualsTable();
    this.ensureConversationDefaults();
    this.migrateLegacyConversations();
  }

  private ensureColumn(table: string, column: string, definition: string) {
    const db = this.ensureDb();
    const columns = db
      .prepare(`PRAGMA table_info(${table})`)
      .all() as Array<{ name: string }>;
    const exists = columns.some((item) => item.name === column);
    if (!exists) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  private ensureConversationDefaults() {
    const db = this.ensureDb();
    db.exec(`UPDATE conversations SET role = 'customer' WHERE role IS NULL OR role = ''`);
  }

  private ensureManualsTable() {
    const db = this.ensureDb();
    const columns = db
      .prepare(`PRAGMA table_info(manuals)`)
      .all() as Array<{ name: string }>;
    const hasOwnerId = columns.some((col) => col.name === 'owner_id');
    if (hasOwnerId) {
      return;
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS manuals_new (
        owner_id TEXT PRIMARY KEY,
        owner_type TEXT NOT NULL,
        file_count INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL,
        embedded_chunks INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    const legacyExists = columns.length > 0;
    if (legacyExists) {
      db.exec(`
        INSERT INTO manuals_new (owner_id, owner_type, file_count, chunk_count, embedded_chunks, updated_at)
        SELECT conversation_id, 'conversation', file_count, chunk_count, embedded_chunks, updated_at FROM manuals;
      `);
      db.exec('DROP TABLE manuals');
    }
    db.exec('ALTER TABLE manuals_new RENAME TO manuals');
  }

  private migrateLegacyConversations() {
    const db = this.ensureDb();
    const orphanChats = db
      .prepare(`
        SELECT c.id, c.user_id, c.title, c.instruction_text, c.created_at, c.updated_at
        FROM conversations c
        LEFT JOIN projects p ON c.project_id = p.id
        WHERE c.project_id IS NULL OR c.project_id = ''
      `)
      .all() as Array<{
        id: string;
        user_id: string;
        title: string;
        instruction_text?: string | null;
        created_at: string;
        updated_at: string;
      }>;

    const insertProject = db.prepare(`
      INSERT OR IGNORE INTO projects (id, user_id, name, description, instruction_text, created_at, updated_at)
      VALUES (?, ?, ?, NULL, ?, ?, ?)
    `);
    const updateChat = db.prepare(
      'UPDATE conversations SET project_id = ?, role = COALESCE(role, \'customer\') WHERE id = ?'
    );

    orphanChats.forEach((chat) => {
      const projectId = chat.id || randomUUID();
      insertProject.run(
        projectId,
        chat.user_id,
        chat.title || '새 프로젝트',
        chat.instruction_text ?? null,
        chat.created_at,
        chat.updated_at,
      );
      updateChat.run(projectId, chat.id);
    });
  }

  run(sql: string, params: unknown = []): void {
    const statement = this.ensureDb().prepare(sql);
    statement.run(params);
  }

  get<T>(sql: string, params: unknown = []): T | undefined {
    const statement = this.ensureDb().prepare(sql);
    return statement.get(params);
  }

  all<T>(sql: string, params: unknown = []): T[] {
    const statement = this.ensureDb().prepare(sql);
    return statement.all(params);
  }
}

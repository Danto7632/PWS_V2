import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';
import { promises as fs } from 'fs';

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

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        instruction_text TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id)
      );

      CREATE TABLE IF NOT EXISTS manuals (
        conversation_id TEXT PRIMARY KEY,
        file_count INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL,
        embedded_chunks INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id)
      );
    `);
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

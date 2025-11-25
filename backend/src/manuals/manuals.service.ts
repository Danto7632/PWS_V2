import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { ManualIngestRequestDto } from './dto/manual-request.dto';
import * as path from 'path';
import { promises as fs } from 'fs';
import * as XLSX from 'xlsx';
import { DatabaseService } from '../database/database.service';
import { AuthUser } from '../auth/auth.types';
import { ConversationsService } from '../conversations/conversations.service';
import { randomUUID } from 'node:crypto';

export type ManualSourceType = 'file' | 'instruction';

export interface ManualSource {
  id: string;
  type: ManualSourceType;
  label: string;
  text: string;
  createdAt: string;
  metadata?: {
    size?: number;
    mime?: string;
  };
}

export interface ManualCacheRecord {
  manualText: string;
  chunkCount: number;
  embeddedChunks: number;
  fileCount: number;
  updatedAt: string;
  embedRatio: number;
  sources: ManualSource[];
}

export interface ManualSummarySource {
  id: string;
  type: ManualSourceType;
  label: string;
  createdAt: string;
  preview?: string;
}

export interface ManualSummary {
  fileCount: number;
  chunkCount: number;
  embeddedChunks: number;
  updatedAt: string;
  embedRatio: number;
  sources: ManualSummarySource[];
}

export interface ManualStatusPayload {
  hasManual: boolean;
  stats?: ManualSummary;
}

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  const { PDFParse } = await importPdfParse();
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? '';
  } finally {
    await parser.destroy();
  }
}

type PdfParseModule = typeof import('pdf-parse');

function importPdfParse(): Promise<PdfParseModule> {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const dynamicImport = new Function(
    'specifier',
    'return import(specifier);',
  ) as (specifier: string) => Promise<PdfParseModule>;
  return dynamicImport('pdf-parse');
}

@Injectable()
export class ManualsService implements OnModuleInit {
  private readonly logger = new Logger(ManualsService.name);
  private readonly manualDir = path.join(process.cwd(), 'storage', 'manuals');

  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly vectorStore: VectorStoreService,
    private readonly db: DatabaseService,
    private readonly conversationsService: ConversationsService,
  ) {}

  async onModuleInit() {
    await fs.mkdir(this.manualDir, { recursive: true });
  }

  async ingest(
    files: Express.Multer.File[] = [],
    dto: ManualIngestRequestDto,
    user?: AuthUser | null,
  ): Promise<ManualSummary> {
    const conversationId = dto.conversationId?.trim();
    if (!conversationId) {
      throw new BadRequestException('conversationId is required.');
    }
    if (user) {
      this.conversationsService.getConversationOrThrow(conversationId, user.id);
    }
    const mode = dto.mode === 'replace' ? 'replace' : 'append';
    const existingRecord =
      mode === 'append' ? await this.readManualFile(conversationId) : null;
    const existingSources =
      mode === 'append' && existingRecord ? existingRecord.sources : [];
    const uploadedSources = await this.createSourcesFromPayload(
      files,
      dto.instructionText,
    );

    const mergedSources = [...existingSources, ...uploadedSources];

    if (!mergedSources.length) {
      throw new BadRequestException(
        'Please upload a file or add instructions.',
      );
    }

    const summary = await this.rebuildFromSources(
      conversationId,
      mergedSources,
      dto.embedRatio,
    );

    return summary;
  }

  async getManualOrThrow(conversationId: string): Promise<ManualCacheRecord> {
    const record = await this.readManualFile(conversationId);
    if (!record) {
      throw new NotFoundException('No manuals found for this conversation.');
    }
    return record;
  }

  async hasManual(conversationId: string) {
    const manual = await this.readManualFile(conversationId);
    return Boolean(manual?.manualText.trim());
  }

  async getManualStatusForUser(
    conversationId: string,
    user: AuthUser,
  ): Promise<ManualStatusPayload> {
    this.conversationsService.getConversationOrThrow(conversationId, user.id);
    const record = await this.readManualFile(conversationId);
    if (!record) {
      return { hasManual: false };
    }
    return {
      hasManual: true,
      stats: this.toSummary(record),
    };
  }

  async getManualStatus(conversationId: string): Promise<ManualStatusPayload> {
    const record = await this.readManualFile(conversationId);
    if (!record) {
      return { hasManual: false };
    }
    return {
      hasManual: true,
      stats: this.toSummary(record),
    };
  }

  async removeSource(
    conversationId: string,
    sourceId: string,
    user?: AuthUser | null,
  ): Promise<ManualStatusPayload> {
    if (!conversationId?.trim()) {
      throw new BadRequestException('conversationId is required.');
    }
    if (!sourceId?.trim()) {
      throw new BadRequestException('sourceId is required.');
    }
    if (user) {
      this.conversationsService.getConversationOrThrow(conversationId, user.id);
    }
    const record = await this.readManualFile(conversationId);
    if (!record) {
      throw new NotFoundException('삭제할 자료가 없습니다.');
    }
    const remainingSources = record.sources.filter(
      (source) => source.id !== sourceId,
    );
    if (remainingSources.length === record.sources.length) {
      throw new NotFoundException('요청한 자료를 찾을 수 없습니다.');
    }
    if (!remainingSources.length) {
      await this.deleteManual(conversationId);
      return { hasManual: false };
    }
    const stats = await this.rebuildFromSources(
      conversationId,
      remainingSources,
      record.embedRatio,
    );
    return {
      hasManual: true,
      stats,
    };
  }

  private async persistManual(
    conversationId: string,
    payload: ManualCacheRecord,
  ) {
    const target = path.join(this.manualDir, `${conversationId}.json`);
    await fs.writeFile(target, JSON.stringify(payload, null, 2), 'utf8');
  }

  private async persistMetadata(
    conversationId: string,
    record: ManualCacheRecord,
  ) {
    const timestamp = record.updatedAt;
    try {
      const conversationExists = this.db.get<{ id: string }>(
        'SELECT id FROM conversations WHERE id = ? LIMIT 1',
        [conversationId],
      );
      if (conversationExists) {
        this.db.run(
          `INSERT INTO manuals (conversation_id, file_count, chunk_count, embedded_chunks, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(conversation_id) DO UPDATE SET
             file_count = excluded.file_count,
             chunk_count = excluded.chunk_count,
             embedded_chunks = excluded.embedded_chunks,
             updated_at = excluded.updated_at`,
          [
            conversationId,
            record.fileCount,
            record.chunkCount,
            record.embeddedChunks,
            timestamp,
          ],
        );
      }
    } catch (error) {
      this.logger.warn('Failed to upsert manual metadata', error as Error);
    }
  }

  private async deleteManual(conversationId: string) {
    const target = path.join(this.manualDir, `${conversationId}.json`);
    try {
      await fs.unlink(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Failed to delete manual file for ${conversationId}`);
      }
    }
    await this.vectorStore.clearDocuments(conversationId);
    try {
      this.db.run('DELETE FROM manuals WHERE conversation_id = ?', [conversationId]);
    } catch (error) {
      this.logger.warn('Failed to delete manual metadata', error as Error);
    }
  }

  private async readManualFile(
    conversationId: string,
  ): Promise<ManualCacheRecord | null> {
    const target = path.join(this.manualDir, `${conversationId}.json`);
    try {
      const raw = await fs.readFile(target, 'utf8');
      const parsed = JSON.parse(raw) as Partial<ManualCacheRecord>;
      return this.normalizeRecord(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Failed to load manual for ${conversationId}`);
      }
      return null;
    }
  }

  private normalizeRecord(
    raw: Partial<ManualCacheRecord> | null,
  ): ManualCacheRecord | null {
    if (!raw || !raw.manualText?.trim()) {
      return null;
    }
    const embedRatio = Math.min(1, Math.max(raw.embedRatio ?? 1, 0.2));
    const sources = raw.sources?.length
      ? raw.sources.map((source) => ({
          ...source,
          id: source.id ?? randomUUID(),
          createdAt: source.createdAt ?? raw.updatedAt ?? new Date().toISOString(),
        }))
      : this.reconstructSourcesFromManualText(
          raw.manualText,
          raw.updatedAt ?? new Date().toISOString(),
        );
    return {
      manualText: raw.manualText,
      chunkCount: raw.chunkCount ?? 0,
      embeddedChunks: raw.embeddedChunks ?? 0,
      fileCount:
        raw.fileCount ?? sources.filter((source) => source.type === 'file').length,
      updatedAt: raw.updatedAt ?? new Date().toISOString(),
      embedRatio,
      sources,
    };
  }

  private toSummary(record: ManualCacheRecord): ManualSummary {
    return {
      fileCount: record.fileCount,
      chunkCount: record.chunkCount,
      embeddedChunks: record.embeddedChunks,
      updatedAt: record.updatedAt,
      embedRatio: record.embedRatio,
      sources: this.mapSourcesToSummary(record.sources),
    };
  }

  private mapSourcesToSummary(sources: ManualSource[]): ManualSummarySource[] {
    return sources.map((source) => ({
      id: source.id,
      type: source.type,
      label: source.label,
      createdAt: source.createdAt,
      preview:
        source.type === 'instruction'
          ? source.text.slice(0, 200)
          : undefined,
    }));
  }

  private reconstructSourcesFromManualText(
    manualText: string,
    updatedAt: string,
  ): ManualSource[] {
    const headerPattern = /^===\s*(.+?)\s*===\s*$/gm;
    const matches = Array.from(manualText.matchAll(headerPattern));
    if (!matches.length) {
      return [
        {
          id: randomUUID(),
          type: 'instruction',
          label: '기존 매뉴얼',
          text: manualText,
          createdAt: updatedAt,
        },
      ];
    }

    const sources: ManualSource[] = [];
    matches.forEach((match, index) => {
      const header = match[1]?.trim() ?? `자료 ${index + 1}`;
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? manualText.length;
      const sectionText = manualText.slice(start, end).trim();
      if (!sectionText) {
        return;
      }
      const normalizedHeader = header.toLowerCase();
      const type: ManualSourceType = normalizedHeader.includes('프롬프트') || normalizedHeader.includes('prompt') || normalizedHeader.includes('instruction')
        ? 'instruction'
        : 'file';
      sources.push({
        id: randomUUID(),
        type,
        label: header,
        text: sectionText,
        createdAt: updatedAt,
      });
    });

    if (!sources.length) {
      return [
        {
          id: randomUUID(),
          type: 'instruction',
          label: '기존 매뉴얼',
          text: manualText,
          createdAt: updatedAt,
        },
      ];
    }

    return sources;
  }

  private async createSourcesFromPayload(
    files: Express.Multer.File[],
    instructionText?: string,
  ): Promise<ManualSource[]> {
    const now = new Date().toISOString();
    const attachments: ManualSource[] = [];

    for (const file of files ?? []) {
      const text = await this.extractText(file);
      if (!text.trim()) {
        this.logger.warn(`파일 ${file.originalname}에서 텍스트를 추출하지 못했습니다.`);
        continue;
      }
      attachments.push({
        id: randomUUID(),
        type: 'file',
        label: file.originalname,
        text,
        createdAt: now,
        metadata: {
          size: file.size,
          mime: file.mimetype,
        },
      });
    }

    if (instructionText?.trim()) {
      attachments.push({
        id: randomUUID(),
        type: 'instruction',
        label: '사용자 프롬프트',
        text: instructionText.trim(),
        createdAt: now,
      });
    }

    return attachments;
  }

  private flattenSources(sources: ManualSource[]): string {
    return sources
      .map((source) => {
        const header = source.label || (source.type === 'instruction' ? 'Instruction' : 'File');
        return `=== ${header} ===\n${source.text.trim()}`;
      })
      .join('\n\n');
  }

  private async rebuildFromSources(
    conversationId: string,
    sources: ManualSource[],
    embedRatioInput?: number,
  ): Promise<ManualSummary> {
    if (!sources.length) {
      throw new BadRequestException('업로드할 수 있는 자료가 없습니다.');
    }

    const manualText = this.flattenSources(sources);
    if (!manualText.trim()) {
      throw new BadRequestException('추출된 텍스트가 비어 있습니다.');
    }

    const chunks = chunkText(manualText);
    if (!chunks.length) {
      throw new BadRequestException('텍스트 분할에 실패했습니다.');
    }

    const embedRatio = Math.min(1, Math.max(embedRatioInput ?? 1, 0.2));
    const chunkLimit = Math.max(1, Math.round(chunks.length * embedRatio));
    const targetChunks = chunks.slice(0, chunkLimit);

    const embeddings = await Promise.all(
      targetChunks.map((chunk) => this.embeddingsService.embed(chunk)),
    );

    await this.vectorStore.replaceDocuments(
      conversationId,
      targetChunks,
      embeddings,
    );

    const timestamp = new Date().toISOString();
    const record: ManualCacheRecord = {
      manualText,
      chunkCount: chunks.length,
      embeddedChunks: targetChunks.length,
      fileCount: sources.filter((source) => source.type === 'file').length,
      updatedAt: timestamp,
      embedRatio,
      sources,
    };

    await this.persistManual(conversationId, record);
    await this.persistMetadata(conversationId, record);

    return this.toSummary(record);
  }

  private async extractText(file: Express.Multer.File): Promise<string> {
    const mime = file.mimetype;
    if (mime === 'application/pdf') {
      return parsePdfBuffer(file.buffer);
    }
    if (mime === 'text/plain') {
      return file.buffer.toString('utf8');
    }
    if (
      mime === 'application/vnd.ms-excel' ||
      mime ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheets = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        return XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      });
      return sheets.join('\n');
    }
    throw new BadRequestException(`Unsupported file type: ${mime}`);
  }
}

function chunkText(text: string, chunkSize = 800, overlap = 100) {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = start + chunkSize;
    const chunk = text.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    start = end - overlap;
  }
  return chunks;
}

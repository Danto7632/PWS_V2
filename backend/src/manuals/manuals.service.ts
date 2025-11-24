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
import pdfParse from 'pdf-parse';
import { DatabaseService } from '../database/database.service';

export interface ManualCacheRecord {
  manualText: string;
  chunkCount: number;
  embeddedChunks: number;
  fileCount: number;
  updatedAt: string;
}

type PdfParser = (dataBuffer: Buffer) => Promise<{ text: string }>;
const parsePdf: PdfParser = pdfParse as unknown as PdfParser;

@Injectable()
export class ManualsService implements OnModuleInit {
  private readonly logger = new Logger(ManualsService.name);
  private readonly manualDir = path.join(process.cwd(), 'storage', 'manuals');

  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly vectorStore: VectorStoreService,
    private readonly db: DatabaseService,
  ) {}

  async onModuleInit() {
    await fs.mkdir(this.manualDir, { recursive: true });
  }

  async ingest(files: Express.Multer.File[] = [], dto: ManualIngestRequestDto) {
    const conversationId = dto.conversationId?.trim();
    if (!conversationId) {
      throw new BadRequestException('conversationId is required.');
    }
    const sections: string[] = [];
    for (const file of files) {
      const text = await this.extractText(file);
      if (text) {
        sections.push(`=== ${file.originalname} ===\n${text}`);
      }
    }

    if (dto.instructionText?.trim()) {
      sections.push(`=== User Instruction ===\n${dto.instructionText.trim()}`);
    }

    if (!sections.length) {
      throw new BadRequestException(
        'Please upload a file or add instructions.',
      );
    }

    const manualText = sections.join('\n\n');
    const chunks = chunkText(manualText);
    if (!chunks.length) {
      throw new BadRequestException('No readable text found in manuals.');
    }

    const ratio = Math.min(1, Math.max(dto.embedRatio ?? 1, 0.2));
    const useCount = Math.max(1, Math.round(chunks.length * ratio));
    const chunksToUse = chunks.slice(0, useCount);

    const embeddings: number[][] = [];
    for (const chunk of chunksToUse) {
      const embedding = await this.embeddingsService.embed(chunk);
      embeddings.push(embedding);
    }

    await this.vectorStore.replaceDocuments(
      conversationId,
      chunksToUse,
      embeddings,
    );
    await this.persistManual(conversationId, {
      manualText,
      chunkCount: chunks.length,
      embeddedChunks: chunksToUse.length,
      fileCount: files.length,
      updatedAt: new Date().toISOString(),
    });

    const timestamp = new Date().toISOString();
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
            files.length,
            chunks.length,
            chunksToUse.length,
            timestamp,
          ],
        );
      } else {
        this.logger.warn(
          `Conversation ${conversationId} not found, skipping manual metadata insert`,
        );
      }
    } catch (error) {
      this.logger.warn('Failed to upsert manual metadata', error as Error);
    }

    return {
      fileCount: files.length,
      chunkCount: chunks.length,
      embeddedChunks: chunksToUse.length,
    };
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

  private async persistManual(
    conversationId: string,
    payload: ManualCacheRecord,
  ) {
    const target = path.join(this.manualDir, `${conversationId}.json`);
    await fs.writeFile(target, JSON.stringify(payload, null, 2), 'utf8');
  }

  private async readManualFile(
    conversationId: string,
  ): Promise<ManualCacheRecord | null> {
    const target = path.join(this.manualDir, `${conversationId}.json`);
    try {
      const raw = await fs.readFile(target, 'utf8');
      return JSON.parse(raw) as ManualCacheRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Failed to load manual for ${conversationId}`);
      }
      return null;
    }
  }

  private async extractText(file: Express.Multer.File): Promise<string> {
    const mime = file.mimetype;
    if (mime === 'application/pdf') {
      const parsed = await parsePdf(file.buffer);
      return parsed.text;
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

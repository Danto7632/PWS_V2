import {
  Injectable,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { ManualIngestRequestDto } from './dto/manual-request.dto';
import * as path from 'path';
import { promises as fs } from 'fs';
import * as XLSX from 'xlsx';
import pdfParse from 'pdf-parse';

type PdfParser = (dataBuffer: Buffer) => Promise<{ text: string }>;
const parsePdf: PdfParser = pdfParse as unknown as PdfParser;

@Injectable()
export class ManualsService implements OnModuleInit {
  private readonly logger = new Logger(ManualsService.name);
  private readonly cacheFile = path.join(
    process.cwd(),
    'storage',
    'manual-cache.json',
  );
  private manualText = '';
  private chunkCount = 0;

  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly vectorStore: VectorStoreService,
  ) {}

  async onModuleInit() {
    await fs.mkdir(path.dirname(this.cacheFile), { recursive: true });
    try {
      const raw = await fs.readFile(this.cacheFile, 'utf8');
      const cache = JSON.parse(raw) as {
        manualText?: string;
        chunkCount?: number;
      };
      this.manualText = cache.manualText ?? '';
      this.chunkCount = cache.chunkCount ?? 0;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn('Failed to load manual cache, starting fresh');
      }
    }
  }

  hasManuals() {
    return Boolean(this.manualText.trim());
  }

  getManualText() {
    return this.manualText;
  }

  async ingest(files: Express.Multer.File[], dto: ManualIngestRequestDto) {
    if (!files?.length) {
      throw new BadRequestException('No files received');
    }

    const sections: string[] = [];
    for (const file of files) {
      const text = await this.extractText(file);
      if (text) {
        sections.push(`=== ${file.originalname} ===\n${text}`);
      }
    }

    if (!sections.length) {
      throw new BadRequestException('Failed to parse any documents');
    }

    this.manualText = sections.join('\n\n');
    const chunks = chunkText(this.manualText);
    this.chunkCount = chunks.length;

    const ratio = Math.min(1, Math.max(dto.embedRatio, 0.2));
    const useCount = Math.max(1, Math.round(chunks.length * ratio));
    const chunksToUse = chunks.slice(0, useCount);

    const embeddings: number[][] = [];
    for (const chunk of chunksToUse) {
      const embedding = await this.embeddingsService.embed(chunk);
      embeddings.push(embedding);
    }

    await this.vectorStore.replaceDocuments(chunksToUse, embeddings);
    await this.persistCache();

    return {
      fileCount: files.length,
      chunkCount: chunks.length,
      embeddedChunks: chunksToUse.length,
    };
  }

  private async persistCache() {
    const payload = {
      manualText: this.manualText,
      chunkCount: this.chunkCount,
    };
    await fs.writeFile(
      this.cacheFile,
      JSON.stringify(payload, null, 2),
      'utf8',
    );
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

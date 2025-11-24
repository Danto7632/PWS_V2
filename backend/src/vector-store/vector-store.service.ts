import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import { promises as fs } from 'fs';
import { EmbeddingVector } from '../embeddings/embeddings.service';
import { randomUUID } from 'node:crypto';

export interface VectorDocument {
  id: string;
  content: string;
  embedding: EmbeddingVector;
}

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(VectorStoreService.name);
  private readonly storagePath = path.join(process.cwd(), 'storage');
  private readonly storageFile = path.join(
    this.storagePath,
    'vector-store.json',
  );
  private documents: VectorDocument[] = [];

  async onModuleInit() {
    await fs.mkdir(this.storagePath, { recursive: true });
    try {
      const raw = await fs.readFile(this.storageFile, 'utf8');
      this.documents = JSON.parse(raw) as VectorDocument[];
      this.logger.log(`Loaded ${this.documents.length} vectors from disk.`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(
          'Failed to load vector store, starting fresh.',
          error as Error,
        );
      }
      this.documents = [];
    }
  }

  getDocumentCount() {
    return this.documents.length;
  }

  async replaceDocuments(chunks: string[], embeddings: EmbeddingVector[]) {
    this.documents = chunks.map((content, idx) => ({
      id: `chunk_${idx}_${randomUUID()}`,
      content,
      embedding: embeddings[idx],
    }));
    await this.persist();
  }

  async persist() {
    await fs.writeFile(
      this.storageFile,
      JSON.stringify(this.documents, null, 2),
      'utf8',
    );
    this.logger.log(`Persisted ${this.documents.length} vectors.`);
  }

  queryByEmbedding(
    queryEmbedding: EmbeddingVector,
    topK = 3,
  ): VectorDocument[] {
    if (!queryEmbedding.length || !this.documents.length) {
      return [];
    }
    const scored = this.documents
      .map((doc) => ({
        doc,
        score: cosineSimilarity(queryEmbedding, doc.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((entry) => entry.doc);
    return scored;
  }
}

function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector) {
  if (!a.length || !b.length || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

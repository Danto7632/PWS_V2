import { Injectable, Logger } from '@nestjs/common';

export type EmbeddingVector = number[];
type FeatureExtractionPipeline = (
  text: string,
  options?: {
    pooling?: 'mean' | 'max';
    normalize?: boolean;
  },
) => Promise<{ data: Float32Array }>;

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private extractorPromise?: Promise<FeatureExtractionPipeline>;

  private async getExtractor(): Promise<FeatureExtractionPipeline> {
    if (!this.extractorPromise) {
      this.extractorPromise = (async () => {
        this.logger.log('Loading embedding model (all-MiniLM-L6-v2)...');
        const { pipeline } = await import('@xenova/transformers');
        return (await pipeline(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2',
        )) as FeatureExtractionPipeline;
      })();
    }
    return this.extractorPromise;
  }

  async embed(text: string): Promise<EmbeddingVector> {
    const extractor = await this.getExtractor();
    const sanitized = text.replace(/\s+/g, ' ').trim();
    if (!sanitized) {
      return [];
    }
    const embedding = await extractor(sanitized, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(embedding.data) as EmbeddingVector;
  }
}

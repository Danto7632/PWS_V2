import type { ManualSourceSummary, ManualStats } from '../types';

export type ManualStatsLike = Partial<Omit<ManualStats, 'sources'>> & {
  sources?: ManualSourceSummary[] | null;
};

const MIN_EMBED_RATIO = 0.2;
const MAX_EMBED_RATIO = 1;
const DEFAULT_EMBED_RATIO = 1;

export function normalizeManualStats(raw?: ManualStatsLike | null): ManualStats | null {
  if (!raw) {
    return null;
  }

  const safeSources = Array.isArray(raw.sources)
    ? raw.sources.map((source, index) => ({
        id: source.id ?? `manual-src-${index}`,
        type: source.type ?? 'file',
        label: source.label ?? `자료 ${index + 1}`,
        createdAt: source.createdAt ?? new Date().toISOString(),
        preview: source.preview,
      }))
    : [];

  const ratioCandidate =
    typeof raw.embedRatio === 'number' && Number.isFinite(raw.embedRatio)
      ? raw.embedRatio
      : DEFAULT_EMBED_RATIO;

  return {
    fileCount: raw.fileCount ?? 0,
    chunkCount: raw.chunkCount ?? 0,
    embeddedChunks: raw.embeddedChunks ?? 0,
    updatedAt: raw.updatedAt,
    embedRatio: Math.min(MAX_EMBED_RATIO, Math.max(ratioCandidate, MIN_EMBED_RATIO)),
    sources: safeSources,
  };
}

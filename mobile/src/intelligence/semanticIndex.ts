// forkKSemanticIndexV1

import { getDatabase } from '../storage/database';
import { localFeatureEmbeddingProvider } from './localFeatureEmbedding';
import { loadSemanticCorpus } from './semanticCorpus';
import { contextSearchBoosts } from './contextSpine';
import type {
  EmbeddingProvider,
  SemanticDocument,
  SemanticEntityType,
  SemanticIndexStats,
  SemanticSearchOptions,
  SemanticSearchResult,
} from './semanticTypes';

type IndexedDocument = SemanticDocument & {
  vector: Float32Array;
};

type GraphEvidence = {
  linked: boolean;
  sameCollection: boolean;
};

let provider: EmbeddingProvider =
  localFeatureEmbeddingProvider;

let indexed: IndexedDocument[] = [];
let signature = '';
let builtAt: string | null = null;
let building: Promise<void> | null = null;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function cosine(
  left: Float32Array,
  right: Float32Array,
) {
  if (left.length !== right.length) return 0;

  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    sum += left[index]! * right[index]!;
  }
  return sum;
}

function corpusSignature(documents: SemanticDocument[]) {
  let hash = 0x811c9dc5;

  for (const item of documents) {
    const value =
      item.key + ':' +
      (item.modifiedAt ?? '') + ':' +
      item.text.length + ';';

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
  }

  return provider.id + ':' + (hash >>> 0).toString(16);
}

// forkK2LocalNeuralEmbeddingsV1
async function buildIndex(force = false) {
  await provider.prepare?.();

  const documents = await loadSemanticCorpus();
  const nextSignature = corpusSignature(documents);

  if (!force && indexed.length && signature === nextSignature) {
    return;
  }

  const vectors = provider.embedMany
    ? await provider.embedMany(documents.map((item) => item.text))
    : await Promise.all(documents.map((item) => provider.embed(item.text)));

  if (vectors.length !== documents.length) {
    throw new Error('Embedding provider returned an unexpected batch size.');
  }

  indexed = documents.map((item, index) => ({
    ...item,
    vector: vectors[index]!,
  }));
  signature = nextSignature;
  builtAt = new Date().toISOString();
}

async function ensureIndex(force = false) {
  if (building) {
    await building;
    if (!force) return;
  }

  building = buildIndex(force).finally(() => {
    building = null;
  });

  await building;
}

async function graphEvidence(
  source: SemanticDocument,
  candidate: SemanticDocument,
): Promise<GraphEvidence> {
  // Only the six canonical catalogue types participate in entity_links and
  // collection_items. Collection/Activity results simply receive vector score.
  const canonical = new Set<SemanticEntityType>([
    'BOOK',
    'MEDIA',
    'GAME',
    'TOPIC',
    'ENTRY',
    'FREQUENCY',
  ]);

  if (!canonical.has(source.entityType) || !canonical.has(candidate.entityType)) {
    return { linked: false, sameCollection: false };
  }

  const database = await getDatabase();

  const linked = await database.getFirstAsync<{ link_id: string }>(
    `SELECT link_id
     FROM entity_links
     WHERE (source_type=? AND source_id=? AND target_type=? AND target_id=?)
        OR (source_type=? AND source_id=? AND target_type=? AND target_id=?)
     LIMIT 1`,
    source.entityType,
    source.entityId,
    candidate.entityType,
    candidate.entityId,
    candidate.entityType,
    candidate.entityId,
    source.entityType,
    source.entityId,
  ).catch(() => null);

  const sameCollection = await database.getFirstAsync<{ collection_id: string }>(
    `SELECT left_item.collection_id
     FROM collection_items left_item
     JOIN collection_items right_item
       ON right_item.collection_id = left_item.collection_id
     WHERE left_item.entity_type=?
       AND left_item.entity_id=?
       AND right_item.entity_type=?
       AND right_item.entity_id=?
     LIMIT 1`,
    source.entityType,
    source.entityId,
    candidate.entityType,
    candidate.entityId,
  ).catch(() => null);

  return {
    linked: Boolean(linked),
    sameCollection: Boolean(sameCollection),
  };
}

export function setSemanticEmbeddingProvider(
  nextProvider: EmbeddingProvider,
) {
  if (nextProvider.dimensions < 8) {
    throw new Error('Embedding provider dimensions are invalid.');
  }

  provider = nextProvider;
  indexed = [];
  signature = '';
  builtAt = null;
}

export function invalidateSemanticIndex() {
  signature = '';
}

export async function rebuildSemanticIndex() {
  await ensureIndex(true);
  return getSemanticIndexStats();
}

export function getSemanticIndexStats(): SemanticIndexStats {
  return {
    providerId: provider.id,
    dimensions: provider.dimensions,
    documents: indexed.length,
    signature,
    builtAt,
  };
}

/**
 * Semantic-ish local archive search today; real model embeddings tomorrow.
 * Consumers never need to care which provider generated the vectors.
 */
export async function semanticSearch(
  query: string,
  options: SemanticSearchOptions = {},
): Promise<SemanticSearchResult[]> {
  const clean = query.trim();
  if (!clean) return [];

  await ensureIndex();

  const queryVector = await provider.embed(clean);
  const contextBoosts = await contextSearchBoosts(clean).catch(() => new Map());
  const allowed = options.entityTypes
    ? new Set(options.entityTypes)
    : null;
  const minimumScore = options.minimumScore ?? 0.08;
  const limit = Math.max(1, Math.min(50, options.limit ?? 12));

  return indexed
    .filter((item) => !allowed || allowed.has(item.entityType))
    .filter((item) => !options.excludeKey || item.key !== options.excludeKey)
    .map((item) => {
      const vectorScore = cosine(queryVector, item.vector);
      const normalized = clamp((vectorScore + 0.1) / 1.1, 0, 1);
      const contextual = contextBoosts.get(item.key);
      const contextualBoost = contextual?.boost ?? 0;
      const finalScore = clamp(normalized + contextualBoost, 0, 1);

      return {
        key: item.key,
        entityType: item.entityType,
        entityId: item.entityId,
        title: item.title,
        subtitle: item.subtitle,
        score: finalScore,
        vectorScore,
        graphBonus: 0,
        reasons: [
          'Sličan sadržaj',
          ...(contextual?.reasons ?? []),
        ],
      } satisfies SemanticSearchResult;
    })
    .filter((item) => item.score >= minimumScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

/**
 * Suggested connections for an existing LJingle object.
 * Existing direct links and shared Memory Boxes are intentionally excluded from
 * the suggestion list; they are evidence that the objects are already related.
 */
export async function suggestSemanticLinks(
  entityType: SemanticEntityType,
  entityId: string,
  options: Omit<SemanticSearchOptions, 'excludeKey'> = {},
) {
  await ensureIndex();

  const key = entityType + ':' + entityId;
  const source = indexed.find((item) => item.key === key);
  if (!source) return [] as SemanticSearchResult[];

  const candidates = indexed
    .filter((item) => item.key !== key)
    .filter((item) => !options.entityTypes || options.entityTypes.includes(item.entityType))
    .map((item) => ({
      item,
      vectorScore: cosine(source.vector, item.vector),
    }))
    .sort((left, right) => right.vectorScore - left.vectorScore)
    .slice(0, 36);

  const results: SemanticSearchResult[] = [];

  for (const candidate of candidates) {
    const evidence = await graphEvidence(source, candidate.item);

    if (evidence.linked || evidence.sameCollection) {
      continue;
    }

    const score = clamp((candidate.vectorScore + 0.1) / 1.1, 0, 1);
    if (score < (options.minimumScore ?? 0.13)) continue;

    results.push({
      key: candidate.item.key,
      entityType: candidate.item.entityType,
      entityId: candidate.item.entityId,
      title: candidate.item.title,
      subtitle: candidate.item.subtitle,
      score,
      vectorScore: candidate.vectorScore,
      graphBonus: 0,
      reasons: ['Sličan sadržaj', 'Još nije povezano'],
    });
  }

  return results
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, Math.min(24, options.limit ?? 8)));
}

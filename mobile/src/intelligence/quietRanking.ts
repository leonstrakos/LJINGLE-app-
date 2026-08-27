// forkK5QuietIntelligenceV1

import type { EntityReference, EntityReferenceType } from '../types/collection';
import type { SemanticSearchResult } from './semanticTypes';

export function referenceKey(item: { entityType: string; entityId: string }) {
  return item.entityType + ':' + item.entityId;
}

export function semanticResultToReference(
  result: SemanticSearchResult,
): EntityReference | null {
  const allowed = new Set<EntityReferenceType>([
    'BOOK',
    'MEDIA',
    'GAME',
    'TOPIC',
    'ENTRY',
    'FREQUENCY',
  ]);

  if (!allowed.has(result.entityType as EntityReferenceType)) return null;

  return {
    entityType: result.entityType as EntityReferenceType,
    entityId: result.entityId,
    title: result.title,
    subtitle: result.subtitle,
  };
}

export function mergeReferencesQuietly(
  lexical: EntityReference[],
  semantic: SemanticSearchResult[],
  exclude?: { entityType: EntityReferenceType; entityId: string },
) {
  const seen = new Set<string>();
  const output: EntityReference[] = [];

  const add = (item: EntityReference | null) => {
    if (!item) return;
    if (exclude && item.entityType === exclude.entityType && item.entityId === exclude.entityId) return;
    const key = referenceKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    output.push(item);
  };

  for (const item of lexical) add(item);
  for (const result of semantic) add(semanticResultToReference(result));

  return output;
}

export function rankReferencesQuietly(
  references: EntityReference[],
  semantic: SemanticSearchResult[],
) {
  const rank = new Map(semantic.map((item, index) => [item.key, index]));
  return references
    .map((item, index) => ({ item, index, rank: rank.get(referenceKey(item)) }))
    .sort((left, right) => {
      const leftRank = left.rank ?? Number.POSITIVE_INFINITY;
      const rightRank = right.rank ?? Number.POSITIVE_INFINITY;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.index - right.index;
    })
    .map(({ item }) => item);
}

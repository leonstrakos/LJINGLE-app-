import type {
  CollectionDetail,
  CollectionFilterChip,
  CollectionItem,
  CollectionRequest,
  CollectionSummary,
  EntityLink,
  EntityReference,
  EntityReferenceType,
  RelationType,
} from '../types/collection';
import { apiRequest } from './apiClient';
import { normalizeCollectionSymbol } from '../utils/collectionSymbols';

// forkFCollectionSymbolNormalizationV1

function query(value: string) {
  return encodeURIComponent(value);
}

function normalizeSummary(item: CollectionSummary): CollectionSummary {
  return {
    ...item,
    symbol: normalizeCollectionSymbol(item.symbol),
  };
}

function normalizeDetail(item: CollectionDetail): CollectionDetail {
  return {
    ...item,
    symbol: normalizeCollectionSymbol(item.symbol),
  };
}

function normalizeFilterChip(item: CollectionFilterChip): CollectionFilterChip {
  return {
    ...item,
    symbol: normalizeCollectionSymbol(item.symbol),
  };
}

function normalizeRequest(payload: CollectionRequest): CollectionRequest {
  return {
    ...payload,
    symbol: normalizeCollectionSymbol(payload.symbol),
  };
}

export const collectionApi = {
  getAll: async () =>
    (await apiRequest<CollectionSummary[]>('/collections')).map(normalizeSummary),

  getById: async (collectionId: string) =>
    normalizeDetail(
      await apiRequest<CollectionDetail>(`/collections/${query(collectionId)}`),
    ),

  getForEntity: async (entityType: EntityReferenceType, entityId: string) =>
    (
      await apiRequest<CollectionSummary[]>(
        `/collections/for-entity?entityType=${query(entityType)}&entityId=${query(entityId)}`,
      )
    ).map(normalizeSummary),

  // ljingleCollectionChipsR1: one indexed read, even with many Memory Boxes.
  getFilterChips: async (entityType: EntityReferenceType) =>
    (
      await apiRequest<CollectionFilterChip[]>(
        `/collections/filters?entityType=${query(entityType)}`,
      )
    ).map(normalizeFilterChip),

  create: async (payload: CollectionRequest) =>
    normalizeSummary(
      await apiRequest<CollectionSummary>('/collections', {
        method: 'POST',
        body: JSON.stringify(normalizeRequest(payload)),
      }),
    ),

  update: async (collectionId: string, payload: CollectionRequest) =>
    normalizeSummary(
      await apiRequest<CollectionSummary>(`/collections/${query(collectionId)}`, {
        method: 'PUT',
        body: JSON.stringify(normalizeRequest(payload)),
      }),
    ),

  remove: (collectionId: string) =>
    apiRequest<void>(`/collections/${query(collectionId)}`, { method: 'DELETE' }),

  // forkLCollectionsMemoryBoxV2
  reorder: async (collectionIds: string[]) =>
    (
      await apiRequest<CollectionSummary[]>('/collections/order', {
        method: 'PUT',
        body: JSON.stringify({ collectionIds }),
      })
    ).map(normalizeSummary),

  addItem: (
    collectionId: string,
    entityType: EntityReferenceType,
    entityId: string,
  ) =>
    apiRequest<CollectionItem>(`/collections/${query(collectionId)}/items`, {
      method: 'POST',
      body: JSON.stringify({ entityType, entityId }),
    }),

  removeItem: (collectionId: string, itemId: string) =>
    apiRequest<void>(
      `/collections/${query(collectionId)}/items/${query(itemId)}`,
      { method: 'DELETE' },
    ),

  searchReferences: (search = '') =>
    apiRequest<EntityReference[]>(`/entity-references?query=${query(search)}`),

  getLinks: (entityType: EntityReferenceType, entityId: string) =>
    apiRequest<EntityLink[]>(
      `/entity-links?entityType=${query(entityType)}&entityId=${query(entityId)}`,
    ),

  createLink: (payload: {
    sourceType: EntityReferenceType;
    sourceId: string;
    targetType: EntityReferenceType;
    targetId: string;
    relationType: RelationType;
    note?: string | null;
  }) =>
    apiRequest<EntityLink>('/entity-links', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateLink: (
    linkId: string,
    payload: {
      relationType: RelationType;
      note?: string | null;
    },
  ) =>
    apiRequest<EntityLink>(
      `/entity-links/${query(linkId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    ),

  removeLink: (linkId: string) =>
    apiRequest<void>(`/entity-links/${query(linkId)}`, { method: 'DELETE' }),
};

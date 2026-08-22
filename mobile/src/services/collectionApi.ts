import type {
  CollectionDetail,
  CollectionItem,
  CollectionRequest,
  CollectionSummary,
  EntityLink,
  EntityReference,
  EntityReferenceType,
  RelationType,
} from '../types/collection';
import { apiRequest } from './apiClient';

function query(value: string) {
  return encodeURIComponent(value);
}

export const collectionApi = {
  getAll: () => apiRequest<CollectionSummary[]>('/collections'),

  getById: (collectionId: string) =>
    apiRequest<CollectionDetail>(`/collections/${query(collectionId)}`),

  getForEntity: (entityType: EntityReferenceType, entityId: string) =>
    apiRequest<CollectionSummary[]>(
      `/collections/for-entity?entityType=${query(entityType)}&entityId=${query(entityId)}`,
    ),

  create: (payload: CollectionRequest) =>
    apiRequest<CollectionSummary>('/collections', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (collectionId: string, payload: CollectionRequest) =>
    apiRequest<CollectionSummary>(`/collections/${query(collectionId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  remove: (collectionId: string) =>
    apiRequest<void>(`/collections/${query(collectionId)}`, { method: 'DELETE' }),

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

  removeLink: (linkId: string) =>
    apiRequest<void>(`/entity-links/${query(linkId)}`, { method: 'DELETE' }),
};

import { apiRequest } from './apiClient';
import type {
  EntityLink,
  EntityReference,
  EntityReferenceType,
  RelationType,
} from '../types/collection';

// brutusEntityLinksApiV2
export const entityLinksApi = {
  searchReferences(query: string) {
    return apiRequest<EntityReference[]>(
      '/entity-references?query=' +
        encodeURIComponent(query),
    );
  },

  jingleReferences() {
    return apiRequest<EntityReference[]>(
      '/entity-references/jingle',
    );
  },

  getFor(entityType: EntityReferenceType, entityId: string) {
    return apiRequest<EntityLink[]>(
      '/entity-links?entityType=' +
        encodeURIComponent(entityType) +
        '&entityId=' +
        encodeURIComponent(entityId),
    );
  },

  create(request: {
    sourceType: EntityReferenceType;
    sourceId: string;
    targetType: EntityReferenceType;
    targetId: string;
    relationType: RelationType;
    note?: string | null;
  }) {
    return apiRequest<EntityLink>(
      '/entity-links',
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
    );
  },

  update(
    linkId: string,
    request: {
      relationType: RelationType;
      note?: string | null;
    },
  ) {
    return apiRequest<EntityLink>(
      '/entity-links/' +
        encodeURIComponent(linkId),
      {
        method: 'PUT',
        body: JSON.stringify(request),
      },
    );
  },

  remove(linkId: string) {
    return apiRequest<void>(
      '/entity-links/' + encodeURIComponent(linkId),
      { method: 'DELETE' },
    );
  },
};

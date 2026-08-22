import type { Entry, EntryQuery, EntryRequest } from '../types/entry';
import { apiRequest } from './apiClient';
import {
  cleanupEntryImagesAfterDelete,
  getEntryImageUris,
} from './entryImages';

export { ApiError } from './apiClient';

function queryString(query: EntryQuery) {
  return Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

export const entryApi = {
  getAll: (query: EntryQuery = {}) => {
    const params = queryString(query);
    return apiRequest<Entry[]>(`/entries${params ? `?${params}` : ''}`);
  },

  getById: (entryId: string) => apiRequest<Entry>(`/entries/${entryId}`),

  create: (payload: EntryRequest) =>
    apiRequest<Entry>('/entries', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (entryId: string, payload: EntryRequest) =>
    apiRequest<Entry>(`/entries/${entryId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  remove: async (entryId: string) => {
    const imageUris = await getEntryImageUris(entryId).catch(() => []);

    await apiRequest<void>(`/entries/${entryId}`, {
      method: 'DELETE',
    });

    await cleanupEntryImagesAfterDelete(
      entryId,
      imageUris,
    ).catch(() => undefined);
  },
};

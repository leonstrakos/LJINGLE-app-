import type {
  MediaRequest,
  MediaResponse,
  MediaTimerResponse,
  MediaType,
  TmdbMediaResponse,
  TmdbSearchResponse,
  WatchStatus,
} from '../types/media';
import { apiRequest } from './apiClient';

// catalogueNebitnoFilterV4
type MediaFilters = {
  mediaType?: MediaType;
  status?: WatchStatus;
  ignored?: 'NEBITNO';
  favourite?: boolean;
};

// lazyMoviePostersV5
export type MediaMetadataPatch = {
  originalTitle?: string | null;
  overview?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseYear?: number | null;
};

function queryString(values: Record<string, string | number | undefined>) {
  const params = Object.entries(values)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return params.length > 0 ? `?${params.join('&')}` : '';
}

export const mediaApi = {
  getAll: (filters: MediaFilters = {}) =>
    apiRequest<MediaResponse[]>(
      `/media${queryString({
        mediaType: filters.mediaType,
        status: filters.status,
        ignored: filters.ignored,
        includeIgnored: filters.ignored ? 1 : undefined,
        favourite: filters.favourite ? 1 : undefined,
      })}`,
    ),

  getById: (mediaId: string) => apiRequest<MediaResponse>(`/media/${mediaId}`),

  create: (payload: MediaRequest) =>
    apiRequest<MediaResponse>('/media', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (mediaId: string, payload: MediaRequest) =>
    apiRequest<MediaResponse>(`/media/${mediaId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  remove: (mediaId: string) =>
    apiRequest<void>(`/media/${mediaId}`, { method: 'DELETE' }),

  // lazyMoviePostersV5 — metadata only; personal tracking fields are preserved.
  // jingleCatalogueV3 — favourite only.
  setFavourite: (mediaId: string, favourite: boolean) =>
    apiRequest<MediaResponse>(`/media/${encodeURIComponent(mediaId)}/favourite`, {
      method: 'PATCH',
      body: JSON.stringify({ favourite }),
    }),

  // catalogueFinalPolishV1: user-controlled Nebitno flag.
  isIgnored: (mediaId: string) =>
    apiRequest<{ ignored: boolean }>(`/media/${encodeURIComponent(mediaId)}/ignored`),

  setIgnored: (mediaId: string, ignored: boolean) =>
    apiRequest<{ ignored: boolean }>(`/media/${encodeURIComponent(mediaId)}/ignored`, {
      method: 'PATCH',
      body: JSON.stringify({ ignored }),
    }),

  patchMetadata: (mediaId: string, payload: MediaMetadataPatch) =>
    apiRequest<MediaResponse>(`/media/${encodeURIComponent(mediaId)}/metadata`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getTimer: (mediaId: string) =>
    apiRequest<MediaTimerResponse>(`/media/${mediaId}/watching`),

  startWatching: (mediaId: string) =>
    apiRequest<MediaTimerResponse>(`/media/${mediaId}/watching/start`, {
      method: 'POST',
    }),

  stopWatching: (mediaId: string) =>
    apiRequest<MediaTimerResponse>(`/media/${mediaId}/watching/stop`, {
      method: 'POST',
    }),

  searchTmdb: (query: string, mediaType: MediaType, page = 1) =>
    apiRequest<TmdbSearchResponse>(
      `/media/tmdb/search${queryString({ query, mediaType, page })}`,
    ),

  getTmdbDetails: (mediaType: MediaType, tmdbId: number) =>
    apiRequest<TmdbMediaResponse>(`/media/tmdb/${mediaType}/${tmdbId}`),
};

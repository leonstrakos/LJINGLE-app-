// mediaUpcomingTvTimeR3
import type { MediaType } from '../types/media';
import { apiRequest } from './apiClient';

export type MediaUpcomingRelease = {
  mediaId: string;
  mediaType: MediaType;
  tmdbId: number;
  kind: 'MOVIE' | 'EPISODE';
  date: string;
  region: 'HR' | 'GLOBAL' | 'US' | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeName: string | null;
};

type UpcomingCandidate = {
  mediaId: string;
  mediaType: MediaType;
  tmdbId: number | null;
};

type UpcomingResponse = {
  results: MediaUpcomingRelease[];
};

export const mediaUpcomingApi = {
  async getForItems(
    items: UpcomingCandidate[],
  ): Promise<MediaUpcomingRelease[]> {
    const candidates = items
      .filter(
        (
          item,
        ): item is UpcomingCandidate & { tmdbId: number } =>
          Number.isInteger(item.tmdbId) &&
          Number(item.tmdbId) > 0,
      )
      .map((item) => ({
        mediaId: item.mediaId,
        mediaType: item.mediaType,
        tmdbId: item.tmdbId,
      }));

    if (candidates.length === 0) return [];

    const response = await apiRequest<UpcomingResponse>(
      '/media/tmdb/upcoming',
      {
        method: 'POST',
        body: JSON.stringify({
          items: candidates,
        }),
      },
    );

    return Array.isArray(response.results)
      ? response.results
      : [];
  },
};

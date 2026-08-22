export type MediaType = 'MOVIE' | 'SERIES';

export type WatchStatus = 'WATCHLIST' | 'WATCHING' | 'COMPLETED' | 'DROPPED';

export type MediaEnjoyment = 'ENJOYED' | 'OKAY' | 'REGRET';

export type MediaResponse = {
  mediaId: string;
  mediaType: MediaType;
  tmdbId: number | null;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseYear: number | null;
  watchStatus: WatchStatus;
  progress: number;
  enjoyment: MediaEnjoyment | null;
  favourite: boolean;
  startedOn: string | null;
  completedOn: string | null;
};

export type MediaRequest = Omit<MediaResponse, 'mediaId'>;

export type MediaTimerResponse = {
  activityId: string | null;
  label: string;
  activityType: 'WATCHING';
  mediaId: string;
  running: boolean;
  activeSessionId: string | null;
  activeStartedAt: string | null;
  completedSeconds: number;
  totalSeconds: number;
};

export type TmdbMediaResponse = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  posterPath: string | null;
  posterUrl: string | null;
  backdropPath: string | null;
  backdropUrl: string | null;
  releaseYear: number | null;
};

export type TmdbSearchResponse = {
  page: number;
  totalPages: number;
  totalResults: number;
  results: TmdbMediaResponse[];
};

export const mediaTypeLabels: Record<MediaType, string> = {
  MOVIE: 'Filmovi',
  SERIES: 'Serije',
};

export const watchStatusLabels: Record<WatchStatus, string> = {
  WATCHLIST: 'Za pogledati',
  WATCHING: 'Gledam',
  COMPLETED: 'Pogledano',
  DROPPED: 'Odustao/la',
};

export const mediaEnjoymentLabels: Record<MediaEnjoyment, string> = {
  ENJOYED: 'Svidjelo mi se',
  OKAY: 'Bilo je u redu',
  REGRET: 'Žalim utrošeno vrijeme',
};

export const mediaTypes = Object.keys(mediaTypeLabels) as MediaType[];
export const watchStatuses = Object.keys(watchStatusLabels) as WatchStatus[];
export const mediaEnjoymentOptions = Object.keys(
  mediaEnjoymentLabels,
) as MediaEnjoyment[];

export function tmdbImageUrl(path: string | null, size = 'w500') {
  if (!path) return null;
  return /^https?:\/\//i.test(path) ? path : `https://image.tmdb.org/t/p/${size}${path}`;
}

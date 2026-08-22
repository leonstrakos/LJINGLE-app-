export type SeriesEpisode = {
  episodeId: number;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  runtimeMinutes: number | null;
  airDate: string | null;
  imageUrl: string | null;
  watched: boolean;
  watchedAt: string | null;
};

export type SeriesProgress = {
  episodes: SeriesEpisode[];
  watchedCount: number;
  totalCount: number;
  watchedMinutes: number;
  remainingMinutes: number;
  averageRuntimeMinutes: number | null;
  nextEpisode: SeriesEpisode | null;
};

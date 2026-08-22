import { getDatabase } from '../storage/database';
import type { SeriesEpisode, SeriesProgress } from '../types/series';

type TvMazeShow = {
  id: number;
  _embedded?: { episodes?: TvMazeEpisode[] };
};
type TvMazeEpisode = {
  id: number;
  season: number;
  number: number;
  name: string;
  runtime: number | null;
  airdate: string | null;
  image?: { medium?: string | null; original?: string | null } | null;
};

type EpisodeRow = {
  episode_id: number;
  season_number: number;
  episode_number: number;
  name: string;
  runtime_minutes: number | null;
  air_date: string | null;
  image_url: string | null;
  watched: number;
  watched_at: string | null;
};

function mapEpisode(row: EpisodeRow): SeriesEpisode {
  return {
    episodeId: Number(row.episode_id),
    seasonNumber: Number(row.season_number),
    episodeNumber: Number(row.episode_number),
    name: row.name,
    runtimeMinutes: row.runtime_minutes === null ? null : Number(row.runtime_minutes),
    airDate: row.air_date,
    imageUrl: row.image_url,
    watched: Boolean(row.watched),
    watchedAt: row.watched_at,
  };
}

function summarize(episodes: SeriesEpisode[]): SeriesProgress {
  const regularEpisodes = episodes.filter((episode) => episode.seasonNumber > 0);
  const trackedEpisodes = regularEpisodes.length ? regularEpisodes : episodes;
  const runtimes = trackedEpisodes.flatMap((episode) => episode.runtimeMinutes === null ? [] : [episode.runtimeMinutes]);
  const average = runtimes.length
    ? Math.round(runtimes.reduce((sum, runtime) => sum + runtime, 0) / runtimes.length)
    : null;
  const runtime = (episode: SeriesEpisode) => episode.runtimeMinutes ?? average ?? 0;
  const watched = trackedEpisodes.filter((episode) => episode.watched);
  return {
    episodes,
    watchedCount: watched.length,
    totalCount: trackedEpisodes.length,
    watchedMinutes: watched.reduce((sum, episode) => sum + runtime(episode), 0),
    remainingMinutes: trackedEpisodes.filter((episode) => !episode.watched).reduce((sum, episode) => sum + runtime(episode), 0),
    averageRuntimeMinutes: average,
    nextEpisode: trackedEpisodes.find((episode) => !episode.watched) ?? null,
  };
}

async function cached(mediaId: string) {
  const database = await getDatabase();
  const rows = await database.getAllAsync<EpisodeRow>(
    `SELECT * FROM series_episodes WHERE media_id=?
     ORDER BY season_number, episode_number`,
    mediaId,
  );
  return rows.map(mapEpisode);
}

async function requestJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`TV podaci nisu dostupni (${response.status}).`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

export const seriesApi = {
  async getProgress(mediaId: string): Promise<SeriesProgress> {
    return summarize(await cached(mediaId));
  },

  async sync(mediaId: string, title: string): Promise<SeriesProgress> {
    try {
      const show = await requestJson<TvMazeShow>(
        `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}&embed=episodes`,
      );
      const remote = show._embedded?.episodes
        ?? await requestJson<TvMazeEpisode[]>(`https://api.tvmaze.com/shows/${show.id}/episodes?specials=1`);
      const database = await getDatabase();
      for (const episode of remote) {
        await database.runAsync(
          `INSERT INTO series_episodes
           (media_id, episode_id, season_number, episode_number, name, runtime_minutes, air_date, image_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(media_id, episode_id) DO UPDATE SET
             season_number=excluded.season_number,
             episode_number=excluded.episode_number,
             name=excluded.name,
             runtime_minutes=excluded.runtime_minutes,
             air_date=excluded.air_date,
             image_url=excluded.image_url`,
          mediaId,
          episode.id,
          episode.season,
          episode.number,
          episode.name,
          episode.runtime,
          episode.airdate,
          episode.image?.original ?? episode.image?.medium ?? null,
        );
      }
      return summarize(await cached(mediaId));
    } catch (error) {
      const episodes = await cached(mediaId);
      if (episodes.length) return summarize(episodes);
      throw error;
    }
  },

  async setWatched(mediaId: string, episodeId: number, watched: boolean): Promise<SeriesProgress> {
    const database = await getDatabase();
    await database.runAsync(
      'UPDATE series_episodes SET watched=?, watched_at=? WHERE media_id=? AND episode_id=?',
      watched ? 1 : 0,
      watched ? new Date().toISOString() : null,
      mediaId,
      episodeId,
    );
    return summarize(await cached(mediaId));
  },
};

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

export type ManualSeriesEpisodeInput = {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
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

async function persistSeriesProgress(
  mediaId: string,
  progress: SeriesProgress,
) {
  // // catalogueJingleProgressSemanticsV1:SeriesDerivedProgress
  const percent =
    progress.totalCount > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              progress.watchedCount /
                progress.totalCount *
                100,
            ),
          ),
        )
      : 0;

  const database =
    await getDatabase();

  await database.runAsync(
    `UPDATE media_items
        SET progress=?,
            watch_status=CASE
              WHEN ? > 0 AND ? >= ? THEN 'COMPLETED'
              WHEN watch_status='COMPLETED' AND ? > 0 AND ? < ? THEN 'WATCHING'
              ELSE watch_status
            END,
            modified_at=?
      WHERE media_id=?`,
    percent,
    progress.totalCount,
    progress.watchedCount,
    progress.totalCount,
    progress.totalCount,
    progress.watchedCount,
    progress.totalCount,
    new Date().toISOString(),
    mediaId,
  ); // catalogueFinalPolishV1

  return progress;
}

async function summarizedAndPersisted(
  mediaId: string,
) {
  const progress =
    summarize(
      await cached(mediaId),
    );

  return persistSeriesProgress(
    mediaId,
    progress,
  );
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
      return summarizedAndPersisted(
        mediaId,
      );
    } catch (error) {
      const episodes = await cached(mediaId);
      if (episodes.length) {
        return persistSeriesProgress(
          mediaId,
          summarize(episodes),
        );
      }
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
    return summarizedAndPersisted(
      mediaId,
    );
  },

  async setSeasonWatched(
    mediaId: string,
    seasonNumber: number,
    watched: boolean,
  ): Promise<SeriesProgress> {
    const database = await getDatabase();
    const watchedAt = watched ? new Date().toISOString() : null;
    await database.runAsync(
      'UPDATE series_episodes SET watched=?, watched_at=? WHERE media_id=? AND season_number=?',
      watched ? 1 : 0,
      watchedAt,
      mediaId,
      seasonNumber,
    );
    return summarizedAndPersisted(mediaId);
  },

  // forkK13_3SafeDomainAdaptersV1
  async setWatchedAt(
    mediaId: string,
    episodeId: number,
    watched: boolean,
    watchedAt?: string | null,
  ): Promise<SeriesProgress> {
    const database = await getDatabase();
    await database.runAsync(
      'UPDATE series_episodes SET watched=?, watched_at=? WHERE media_id=? AND episode_id=?',
      watched ? 1 : 0,
      watched ? (watchedAt ?? new Date().toISOString()) : null,
      mediaId,
      episodeId,
    );
    return summarizedAndPersisted(
      mediaId,
    );
  },

  async upsertManualEpisodes(
    mediaId: string,
    episodes: ManualSeriesEpisodeInput[],
  ): Promise<SeriesProgress> {
    // // catalogueJingleProgressSemanticsV1:ManualEpisodes
    const database =
      await getDatabase();

    for (
      const episode
      of episodes
    ) {
      const existing =
        await database.getFirstAsync<{
          episode_id: number;
        }>(
          `SELECT episode_id
           FROM series_episodes
           WHERE media_id=?
             AND season_number=?
             AND episode_number=?
           LIMIT 1`,
          mediaId,
          episode.seasonNumber,
          episode.episodeNumber,
        );

      if (existing) {
        // Keep watched/watched_at and remote runtime metadata.
        await database.runAsync(
          `UPDATE series_episodes
           SET name=?
           WHERE media_id=?
             AND episode_id=?`,
          episode.name,
          mediaId,
          Number(
            existing.episode_id,
          ),
        );

        continue;
      }

      // Negative deterministic IDs cannot collide with normal TV provider IDs.
      const manualEpisodeId =
        -(
          episode.seasonNumber *
            100000 +
          episode.episodeNumber
        );

      await database.runAsync(
        `INSERT INTO series_episodes
         (
           media_id,
           episode_id,
           season_number,
           episode_number,
           name,
           watched
         )
         VALUES (?, ?, ?, ?, ?, 0)
         ON CONFLICT(media_id, episode_id)
         DO UPDATE SET
           season_number=excluded.season_number,
           episode_number=excluded.episode_number,
           name=excluded.name`,
        mediaId,
        manualEpisodeId,
        episode.seasonNumber,
        episode.episodeNumber,
        episode.name,
      );
    }

    return summarizedAndPersisted(
      mediaId,
    );
  },
};

// catalogueJingleProgressSemanticsV1

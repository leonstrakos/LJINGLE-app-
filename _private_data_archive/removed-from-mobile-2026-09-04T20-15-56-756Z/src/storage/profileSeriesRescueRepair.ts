import type { SQLiteDatabase } from 'expo-sqlite';

// profileSeriesRescueRepairV1
//
// Repairs synthetic SERIES rows created by profileWatchRescueV1 when a
// canonical TV Time series already existed under a slightly different title.
//
// Important:
// - NEVER deletes watched episode history.
// - Prefers a non-synthetic candidate that already owns watched episodes.
// - Re-points profile_watch_recovery to the canonical row.
// - Deletes ONLY the synthetic duplicate after a canonical target is found.
// - Idempotent.

type Seed = {
  key: string;
  title: string;
  aliases: string[];
};

type MediaRow = {
  media_id: string;
  media_type: string;
  title: string;
  original_title: string | null;
  watch_status: string;
  progress: number;
  tmdb_id: number | null;
  release_year: number | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
};

type EpisodeCountRow = {
  media_id: string;
  total_episodes: number;
  watched_episodes: number;
};

const MARKER_KEY = 'profile_series_rescue_repair_v1_done';

const seeds: Seed[] = [
  {
    key: 'call-of-the-night',
    title: 'Call of the Night',
    aliases: ['call of the night'],
  },
  {
    key: 'dating-naked-uk',
    title: 'Dating Naked UK',
    aliases: ['dating naked uk'],
  },
  {
    key: 'love-death-robots',
    title: 'Love, Death & Robots',
    aliases: ['love death robots', 'love, death & robots'],
  },
  {
    key: 'squid-game',
    title: 'Squid Game',
    aliases: ['squid game'],
  },
  {
    key: 'rick-and-morty',
    title: 'Rick and Morty',
    aliases: ['rick and morty'],
  },
  {
    key: 'lois-and-clark',
    title: 'Lois & Clark: The New Adventures of Superman',
    aliases: [
      'lois & clark: the new adventures of superman',
      'lois and clark the new adventures of superman',
    ],
  },
  {
    key: 'alien-earth',
    title: 'Alien: Earth',
    aliases: ['alien earth', 'alien: earth'],
  },
  {
    key: 'upload',
    title: 'Upload',
    aliases: ['upload'],
  },
  {
    key: 'doctor-who',
    title: 'Doctor Who',
    aliases: [
      'doctor who',
      'doctor who 2005',
      'doctor who (2005)',
      'doctor who 1963',
      'doctor who (1963)',
    ],
  },
  {
    key: 'dexter',
    title: 'Dexter',
    aliases: ['dexter'],
  },
  {
    key: 'dr-stone',
    title: 'Dr. Stone',
    aliases: ['dr. stone', 'dr stone'],
  },
  {
    key: 'alice-in-borderland',
    title: 'Alice in Borderland',
    aliases: ['alice in the borderland', 'alice in borderland'],
  },
  {
    key: 'green-eggs-and-ham',
    title: 'Green Eggs and Ham',
    aliases: ['gren eggs and ham', 'green eggs and ham'],
  },
  {
    key: 'stranger-things',
    title: 'Stranger Things',
    aliases: ['stranger things'],
  },
  {
    key: 'one-punch-man',
    title: 'One Punch Man',
    aliases: ['one punch man'],
  },
  {
    key: 'malcolm-in-the-middle',
    title: 'Malcolm in the Middle',
    aliases: ['malcolm in the middle'],
  },
  {
    key: 'ted',
    title: 'Ted',
    aliases: ['ted'],
  },
  {
    key: 'malcolm-lifes-still-unfair',
    title: "Malcolm in the Middle: Life's Still Unfair",
    aliases: [
      "malcolm in the middle life's still unfair",
      "malcolm in the middle: life's still unfair",
    ],
  },
  {
    key: 'invincible',
    title: 'Invincible',
    aliases: ['invincible'],
  },
  {
    key: 'the-boys',
    title: 'The Boys',
    aliases: ['the boys'],
  },
];

function normalize(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function tableExists(database: SQLiteDatabase, table: string) {
  const row = await database.getFirstAsync<{ name: string }>(
    `SELECT name
       FROM sqlite_master
      WHERE type='table'
        AND name=?
      LIMIT 1`,
    table,
  );
  return Boolean(row?.name);
}

function isSynthetic(id: string) {
  return id.startsWith('profile-rescue-show2026-');
}

function acceptedNames(seed: Seed) {
  return new Set(
    [seed.title, ...seed.aliases]
      .map(normalize)
      .filter(Boolean),
  );
}

export type SeriesRepairDetail = {
  title: string;
  action:
    | 'MERGED'
    | 'NO_SYNTHETIC'
    | 'NO_CANONICAL'
    | 'CANONICAL_HAS_NO_WATCHED_EPISODES';
  syntheticId: string | null;
  canonicalId: string | null;
  canonicalWatchedEpisodes: number;
};

export type SeriesRepairResult = {
  alreadyDone: boolean;
  checked: number;
  merged: number;
  details: SeriesRepairDetail[];
};

export async function repairProfileSeriesRescueOnce(
  database: SQLiteDatabase,
): Promise<SeriesRepairResult> {
  const hasEpisodes = await tableExists(database, 'series_episodes');
  const hasRecovery = await tableExists(database, 'profile_watch_recovery');

  if (!hasEpisodes || !hasRecovery) {
    console.log('[profileSeriesRescueRepairV1] skipped: required tables missing');
    return {
      alreadyDone: false,
      checked: seeds.length,
      merged: 0,
      details: [],
    };
  }

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY NOT NULL,
      setting_value TEXT NOT NULL
    );
  `);

  const marker = await database.getFirstAsync<{ setting_value: string }>(
    `SELECT setting_value
       FROM app_settings
      WHERE setting_key=?
      LIMIT 1`,
    MARKER_KEY,
  );

  if (marker?.setting_value === 'done') {
    return {
      alreadyDone: true,
      checked: seeds.length,
      merged: 0,
      details: [],
    };
  }

  const mediaRows = await database.getAllAsync<MediaRow>(
    `SELECT
       media_id,
       media_type,
       title,
       original_title,
       watch_status,
       progress,
       tmdb_id,
       release_year,
       overview,
       poster_path,
       backdrop_path
     FROM media_items
     WHERE media_type='SERIES'`,
  );

  const episodeRows = await database.getAllAsync<EpisodeCountRow>(
    `SELECT
       media_id,
       COUNT(*) AS total_episodes,
       SUM(CASE WHEN watched=1 THEN 1 ELSE 0 END) AS watched_episodes
     FROM series_episodes
     GROUP BY media_id`,
  );

  const episodeMap = new Map(
    episodeRows.map((row) => [
      row.media_id,
      {
        total: Number(row.total_episodes ?? 0),
        watched: Number(row.watched_episodes ?? 0),
      },
    ]),
  );

  const details: SeriesRepairDetail[] = [];
  let merged = 0;

  await database.execAsync('BEGIN IMMEDIATE;');

  try {
    for (const seed of seeds) {
      const syntheticId = `profile-rescue-show2026-${seed.key}`;
      const synthetic = mediaRows.find(
        (row) => row.media_id === syntheticId,
      ) ?? null;

      if (!synthetic) {
        details.push({
          title: seed.title,
          action: 'NO_SYNTHETIC',
          syntheticId: null,
          canonicalId: null,
          canonicalWatchedEpisodes: 0,
        });
        continue;
      }

      const accepted = acceptedNames(seed);

      const candidates = mediaRows
        .filter((row) => {
          if (row.media_id === synthetic.media_id) return false;
          if (isSynthetic(row.media_id)) return false;

          const titleMatch =
            accepted.has(normalize(row.title)) ||
            accepted.has(normalize(row.original_title));

          return titleMatch;
        })
        .map((row) => ({
          row,
          watched: episodeMap.get(row.media_id)?.watched ?? 0,
          total: episodeMap.get(row.media_id)?.total ?? 0,
        }))
        .sort((a, b) => {
          if (b.watched !== a.watched) return b.watched - a.watched;
          if (b.total !== a.total) return b.total - a.total;
          return a.row.title.localeCompare(b.row.title);
        });

      const canonical = candidates[0] ?? null;

      if (!canonical) {
        details.push({
          title: seed.title,
          action: 'NO_CANONICAL',
          syntheticId: synthetic.media_id,
          canonicalId: null,
          canonicalWatchedEpisodes: 0,
        });
        continue;
      }

      if (canonical.watched <= 0) {
        details.push({
          title: seed.title,
          action: 'CANONICAL_HAS_NO_WATCHED_EPISODES',
          syntheticId: synthetic.media_id,
          canonicalId: canonical.row.media_id,
          canonicalWatchedEpisodes: canonical.watched,
        });
        continue;
      }

      // Keep the canonical row's history and identity, but fill harmless
      // metadata holes from the synthetic row where possible.
      await database.runAsync(
        `UPDATE media_items
            SET overview=COALESCE(overview, ?),
                poster_path=COALESCE(poster_path, ?),
                backdrop_path=COALESCE(backdrop_path, ?),
                release_year=COALESCE(release_year, ?),
                watch_status=CASE
                  WHEN watch_status='WATCHLIST' THEN 'WATCHING'
                  ELSE watch_status
                END,
                modified_at=?
          WHERE media_id=?`,
        synthetic.overview,
        synthetic.poster_path,
        synthetic.backdrop_path,
        synthetic.release_year,
        new Date().toISOString(),
        canonical.row.media_id,
      );

      await database.runAsync(
        `UPDATE profile_watch_recovery
            SET media_id=?
          WHERE source_key=?
             OR media_id=?`,
        canonical.row.media_id,
        `show2026-${seed.key}`,
        synthetic.media_id,
      );

      // The synthetic row must not own watched history. Refuse deletion if it does.
      const syntheticWatched =
        episodeMap.get(synthetic.media_id)?.watched ?? 0;

      if (syntheticWatched > 0) {
        details.push({
          title: seed.title,
          action: 'NO_CANONICAL',
          syntheticId: synthetic.media_id,
          canonicalId: canonical.row.media_id,
          canonicalWatchedEpisodes: canonical.watched,
        });
        continue;
      }

      await database.runAsync(
        `DELETE FROM media_items WHERE media_id=?`,
        synthetic.media_id,
      );

      merged += 1;

      details.push({
        title: seed.title,
        action: 'MERGED',
        syntheticId: synthetic.media_id,
        canonicalId: canonical.row.media_id,
        canonicalWatchedEpisodes: canonical.watched,
      });
    }

    await database.runAsync(
      `INSERT INTO app_settings(setting_key, setting_value)
       VALUES (?, 'done')
       ON CONFLICT(setting_key)
       DO UPDATE SET setting_value='done'`,
      MARKER_KEY,
    );

    await database.execAsync('COMMIT;');
  } catch (error) {
    try {
      await database.execAsync('ROLLBACK;');
    } catch {
      // Preserve original error.
    }
    throw error;
  }

  const result = {
    alreadyDone: false,
    checked: seeds.length,
    merged,
    details,
  };

  console.log('[profileSeriesRescueRepairV1]', result);
  return result;
}

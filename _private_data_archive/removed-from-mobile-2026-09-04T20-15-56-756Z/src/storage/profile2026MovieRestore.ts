import { getDatabase } from './database';

// profile2026MovieRestoreV1
//
// Profile recovery after the 2025-12 backup cutoff.
// Exact completed_on is used ONLY where the watch date is
// known to equal the Croatian/local release date.

type Seed = {
  id: string;
  title: string;
  aliases: string[];
  releaseYear: number;
  completedOn: string;
};

const movies: Seed[] = [
  {
    id: 'restore-2026-001',
    title: 'Marty Supreme',
    aliases: ['Marty Veličanstveni'],
    releaseYear: 2025,
    completedOn: '2026-01-02',
  },
  {
    id: 'restore-2026-002',
    title: 'Queen of Chess',
    aliases: ['Kraljica šaha'],
    releaseYear: 2026,
    completedOn: '2026-02-06',
  },
  {
    id: 'restore-2026-003',
    title: 'Wuthering Heights',
    aliases: ['Wuthering Heights (2026)', 'Orkanski visovi'],
    releaseYear: 2026,
    completedOn: '2026-02-12',
  },
  {
    id: 'restore-2026-004',
    title: 'Hoppers',
    aliases: ['Skakutavci', 'Hoopers'],
    releaseYear: 2026,
    completedOn: '2026-03-05',
  },
  {
    id: 'restore-2026-005',
    title: 'Project Hail Mary',
    aliases: ['Hail Mary', 'Projekt Spasitelj'],
    releaseYear: 2026,
    completedOn: '2026-03-19',
  },
  {
    id: 'restore-2026-006',
    title: 'Ready or Not 2: Here I Come',
    aliases: [
      'Ready or Not 2 Here I Come',
      'Igra skrivača 2: Duplo ili ništa',
    ],
    releaseYear: 2026,
    completedOn: '2026-03-26',
  },
  {
    id: 'restore-2026-007',
    title: 'The Super Mario Galaxy Movie',
    aliases: ['Super Mario Galaxy', 'Super Mario Galaxy Film'],
    releaseYear: 2026,
    completedOn: '2026-04-02',
  },
  {
    id: 'restore-2026-008',
    title: 'The Devil Wears Prada 2',
    aliases: ['Devil Wears Prada 2', 'Vrag nosi Pradu 2'],
    releaseYear: 2026,
    completedOn: '2026-04-30',
  },
  {
    id: 'restore-2026-009',
    title: 'Disclosure Day',
    aliases: ['Dan razotkrivanja'],
    releaseYear: 2026,
    completedOn: '2026-06-11',
  },
  {
    id: 'restore-2026-010',
    title: 'Toy Story 5',
    aliases: ['Priča o igračkama 5'],
    releaseYear: 2026,
    completedOn: '2026-06-18',
  },
];

export async function restoreProfile2026Movies() {
  const db = await getDatabase();
  const now = new Date().toISOString();

  let inserted = 0;
  let updated = 0;

  for (const movie of movies) {
    const names = [movie.title, ...movie.aliases];

    let existing:
      | { media_id: string; completed_on: string | null }
      | null = null;

    for (const name of names) {
      existing = await db.getFirstAsync<{
        media_id: string;
        completed_on: string | null;
      }>(
        `SELECT media_id, completed_on
           FROM media_items
          WHERE media_type = 'MOVIE'
            AND (
              lower(title) = lower(?)
              OR lower(COALESCE(original_title, '')) = lower(?)
            )
          LIMIT 1`,
        name,
        name,
      );

      if (existing) break;
    }

    if (existing) {
      await db.runAsync(
        `UPDATE media_items
            SET watch_status = 'COMPLETED',
                progress = 100,
                completed_on = COALESCE(completed_on, ?),
                modified_at = ?
          WHERE media_id = ?`,
        movie.completedOn,
        now,
        existing.media_id,
      );

      updated += 1;
      continue;
    }

    await db.runAsync(
      `INSERT INTO media_items (
        media_id, media_type, tmdb_id,
        title, original_title, overview,
        poster_path, backdrop_path, release_year,
        watch_status, progress, enjoyment,
        favourite, started_on, completed_on,
        created_at, modified_at
      )
      VALUES (
        ?, 'MOVIE', NULL,
        ?, ?, NULL,
        NULL, NULL, ?,
        'COMPLETED', 100, NULL,
        0, NULL, ?,
        ?, ?
      )`,
      movie.id,
      movie.title,
      movie.title,
      movie.releaseYear,
      movie.completedOn,
      now,
      now,
    );

    inserted += 1;
  }

  return {
    total: movies.length,
    inserted,
    updated,
  };
}

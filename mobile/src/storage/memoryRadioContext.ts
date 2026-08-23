import { getDatabase } from './database';

// memoryRadioContextV1
// Read-only contextual metadata for Memory Radio.
// NEVER opens SQLite independently.

export type MemoryRadioContext = {
  trackId: string;
  entryId: string;
  occurredAt: string;
  isJingle: boolean;
  entityKind:
    | 'BOOK'
    | 'MEDIA'
    | 'GAME'
    | null;
  entityTitle: string | null;
};

type ContextRow = {
  track_id: string;
  entry_id: string;
  occurred_at: string;
  book_id: string | null;
  book_title: string | null;
  book_favourite: number | null;
  media_id: string | null;
  media_title: string | null;
  media_favourite: number | null;
  game_id: string | null;
  game_title: string | null;
  game_favourite: number | null;
};

export async function loadMemoryRadioContexts():
  Promise<Map<string, MemoryRadioContext>> {
  try {
    const database =
      await getDatabase();

    const sql = [
      'SELECT',
      '  l.track_id,',
      '  l.entry_id,',
      '  COALESCE(e.created_at, l.created_at) AS occurred_at,',
      '  b.book_id,',
      '  b.title AS book_title,',
      '  b.favourite AS book_favourite,',
      '  m.media_id,',
      '  m.title AS media_title,',
      '  m.favourite AS media_favourite,',
      '  g.game_id,',
      '  g.title AS game_title,',
      '  g.favourite AS game_favourite',
      'FROM entry_soundtracks l',
      'JOIN entries e',
      '  ON e.entry_id = l.entry_id',
      'LEFT JOIN activities a',
      '  ON a.activity_id = e.activity_id',
      'LEFT JOIN books b',
      '  ON b.book_id = COALESCE(e.book_id, a.book_id)',
      'LEFT JOIN media_items m',
      '  ON m.media_id = a.media_id',
      'LEFT JOIN games g',
      '  ON g.playing_activity_id = a.activity_id',
      'WHERE l.link_id = (',
      '  SELECT l2.link_id',
      '  FROM entry_soundtracks l2',
      '  WHERE l2.track_id = l.track_id',
      '  ORDER BY l2.created_at DESC',
      '  LIMIT 1',
      ')',
      'ORDER BY l.created_at DESC',
    ].join('\n');

    const rows =
      await database.getAllAsync<ContextRow>(
        sql
      );

    const result =
      new Map<
        string,
        MemoryRadioContext
      >();

    for (const row of rows) {
      let entityKind:
        MemoryRadioContext['entityKind'] =
          null;

      let entityTitle:
        string | null =
          null;

      let isJingle = false;

      if (row.book_id) {
        entityKind = 'BOOK';
        entityTitle =
          row.book_title;
        isJingle =
          Number(
            row.book_favourite ?? 0
          ) === 1;
      } else if (row.media_id) {
        entityKind = 'MEDIA';
        entityTitle =
          row.media_title;
        isJingle =
          Number(
            row.media_favourite ?? 0
          ) === 1;
      } else if (row.game_id) {
        entityKind = 'GAME';
        entityTitle =
          row.game_title;
        isJingle =
          Number(
            row.game_favourite ?? 0
          ) === 1;
      }

      result.set(
        String(row.track_id),
        {
          trackId:
            String(
              row.track_id
            ),
          entryId:
            String(
              row.entry_id
            ),
          occurredAt:
            String(
              row.occurred_at
            ),
          isJingle,
          entityKind,
          entityTitle,
        }
      );
    }

    return result;
  } catch (error) {
    // Context must never make the radio unusable.
    console.warn(
      'Memory Radio context unavailable',
      error
    );

    return new Map();
  }
}

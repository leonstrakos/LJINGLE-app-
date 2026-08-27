// forkKSemanticIndexV1

import { getDatabase } from '../storage/database';
import type { SemanticDocument, SemanticEntityType } from './semanticTypes';

type Row = Record<string, string | number | null>;

function clean(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function joinParts(parts: unknown[]) {
  return parts
    .map(clean)
    .filter(Boolean)
    .join(' · ');
}

function excerpt(value: unknown, maximum = 90) {
  const text = clean(value).replace(/\s+/g, ' ');
  return text.length <= maximum
    ? text
    : text.slice(0, maximum - 1).trimEnd() + '…';
}

function document(
  entityType: SemanticEntityType,
  entityId: unknown,
  title: unknown,
  subtitle: unknown,
  text: unknown[],
  modifiedAt: unknown,
): SemanticDocument | null {
  const id = clean(entityId);
  const resolvedTitle = clean(title);

  if (!id || !resolvedTitle) return null;

  return {
    key: entityType + ':' + id,
    entityType,
    entityId: id,
    title: resolvedTitle,
    subtitle: clean(subtitle) || null,
    text: joinParts([entityType, resolvedTitle, subtitle, ...text]),
    modifiedAt: clean(modifiedAt) || null,
  };
}

async function tableExists(
  database: Awaited<ReturnType<typeof getDatabase>>,
  tableName: string,
) {
  const row = await database.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    tableName,
  );

  return Boolean(row?.name);
}

async function rowsIfPresent(
  database: Awaited<ReturnType<typeof getDatabase>>,
  tableName: string,
  query: string,
) {
  if (!(await tableExists(database, tableName))) return [] as Row[];
  return database.getAllAsync<Row>(query);
}

/**
 * Builds plain-text semantic documents from the existing LJingle catalogue.
 * No mutations. No new main-DB tables. No network calls.
 */
export async function loadSemanticCorpus() {
  const database = await getDatabase();
  const documents: SemanticDocument[] = [];

  const books = await rowsIfPresent(
    database,
    'books',
    'SELECT * FROM books ORDER BY modified_at DESC',
  );
  for (const row of books) {
    const item = document(
      'BOOK',
      row.book_id,
      row.title,
      row.author,
      [
        row.isbn,
        row.published_year,
        row.reading_status,
        row.enjoyment,
        Number(row.favourite ?? 0) ? 'jingle favourite' : '',
      ],
      row.modified_at,
    );
    if (item) documents.push(item);
  }

  const media = await rowsIfPresent(
    database,
    'media_items',
    'SELECT * FROM media_items ORDER BY modified_at DESC',
  );
  for (const row of media) {
    const item = document(
      'MEDIA',
      row.media_id,
      row.title,
      joinParts([row.media_type, row.release_year]),
      [
        row.original_title,
        row.overview,
        row.watch_status,
        row.enjoyment,
        Number(row.favourite ?? 0) ? 'jingle favourite' : '',
      ],
      row.modified_at,
    );
    if (item) documents.push(item);
  }

  const games = await rowsIfPresent(
    database,
    'games',
    'SELECT * FROM games ORDER BY modified_at DESC',
  );
  for (const row of games) {
    const item = document(
      'GAME',
      row.game_id,
      row.title,
      joinParts([row.developer, row.platform]),
      [
        row.release_year,
        row.game_status,
        row.enjoyment,
        Number(row.favourite ?? 0) ? 'jingle favourite' : '',
      ],
      row.modified_at,
    );
    if (item) documents.push(item);
  }

  const topics = await rowsIfPresent(
    database,
    'topics',
    'SELECT * FROM topics ORDER BY modified_at DESC',
  );
  for (const row of topics) {
    const item = document(
      'TOPIC',
      row.topic_id,
      row.name,
      row.description,
      [row.description],
      row.modified_at,
    );
    if (item) documents.push(item);
  }

  const entries = await rowsIfPresent(
    database,
    'entries',
    'SELECT * FROM entries ORDER BY modified_at DESC',
  );
  for (const row of entries) {
    const content = clean(row.content);
    const item = document(
      'ENTRY',
      row.entry_id,
      clean(row.title) || excerpt(content) || 'Zapis',
      row.entry_type,
      [content],
      row.modified_at,
    );
    if (item) documents.push(item);
  }

  const frequencies = await rowsIfPresent(
    database,
    'audio_tracks',
    'SELECT * FROM audio_tracks ORDER BY modified_at DESC',
  );
  for (const row of frequencies) {
    const item = document(
      'FREQUENCY',
      row.track_id,
      row.title,
      row.artist,
      [row.original_name],
      row.modified_at,
    );
    if (item) documents.push(item);
  }

  const collections = await rowsIfPresent(
    database,
    'collections',
    'SELECT * FROM collections ORDER BY modified_at DESC',
  );
  for (const row of collections) {
    const item = document(
      'COLLECTION',
      row.collection_id,
      row.name,
      row.description,
      [row.symbol],
      row.modified_at,
    );
    if (item) documents.push(item);
  }

  const activities = await rowsIfPresent(
    database,
    'activities',
    "SELECT * FROM activities WHERE activity_type <> 'GLOBAL' ORDER BY modified_at DESC",
  );
  for (const row of activities) {
    const item = document(
      'ACTIVITY',
      row.activity_id,
      row.label,
      row.activity_type,
      [row.activity_type],
      row.modified_at,
    );
    if (item) documents.push(item);
  }

  return documents;
}

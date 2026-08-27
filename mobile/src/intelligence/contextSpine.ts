// forkK14_1_2ContextSpineV1

import { getDatabaseConnectionAsync } from '../storage/databaseConnection';
import { getContextAliases } from './contextAliasMemory';

export type ContextEntityKind =
  | 'BOOK'
  | 'MEDIA'
  | 'GAME'
  | 'TOPIC'
  | 'ENTRY'
  | 'FREQUENCY';

export type ContextSignal = {
  key: string;
  kind: ContextEntityKind;
  id: string;
  createdAt: string | null;
  modifiedAt: string | null;
  sessionAt: string | null;
  sessionContextAt: string | null;
  collectionAt: string | null;
  collections: string[];
  relatedTopics: string[];
  aliases: string[];
};

export type ContextRank = {
  key: string;
  score: number;
  reasons: string[];
};

type Row = Record<string, string | number | null>;

let cache:
  | { at: number; signals: Map<string, ContextSignal> }
  | null = null;

const CACHE_MS = 8000;

function norm(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTime(value: string | null): number | null {
  if (!value) return null;
  const normalized =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
      ? value.replace(' ', 'T') + 'Z'
      : value;
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? time : null;
}

function mostRecent(...values: Array<string | null>) {
  let best: { value: string; time: number } | null = null;
  for (const value of values) {
    const time = parseTime(value);
    if (value && time !== null && (!best || time > best.time)) {
      best = { value, time };
    }
  }
  return best?.value ?? null;
}

function hoursAgo(value: string | null) {
  const time = parseTime(value);
  if (time === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - time) / 3_600_000);
}

function isYesterday(value: string | null) {
  const time = parseTime(value);
  if (time === null) return false;
  const then = new Date(time);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  return (
    then.getFullYear() === yesterday.getFullYear() &&
    then.getMonth() === yesterday.getMonth() &&
    then.getDate() === yesterday.getDate()
  );
}

function empty(kind: ContextEntityKind, id: string): ContextSignal {
  return {
    key: kind + ':' + id,
    kind,
    id,
    createdAt: null,
    modifiedAt: null,
    sessionAt: null,
    sessionContextAt: null,
    collectionAt: null,
    collections: [],
    relatedTopics: [],
    aliases: [],
  };
}

async function tableExists(
  database: Awaited<ReturnType<typeof getDatabaseConnectionAsync>>,
  table: string,
) {
  const row = await database
    .getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      table,
    )
    .catch(() => null);
  return Boolean(row?.name);
}

async function safeRows(
  database: Awaited<ReturnType<typeof getDatabaseConnectionAsync>>,
  table: string,
  sql: string,
) {
  if (!(await tableExists(database, table))) return [] as Row[];
  return database.getAllAsync<Row>(sql).catch(() => []);
}

function mergeDate(
  map: Map<string, ContextSignal>,
  kind: ContextEntityKind,
  id: string,
  field: 'createdAt' | 'modifiedAt' | 'sessionAt' | 'sessionContextAt' | 'collectionAt',
  value: string | null,
) {
  if (!id) return;
  const key = kind + ':' + id;
  const signal = map.get(key) ?? empty(kind, id);
  signal[field] = mostRecent(signal[field], value);
  map.set(key, signal);
}

function pushUnique(values: string[], value: string | null) {
  const clean = value?.trim();
  if (clean && !values.some(item => norm(item) === norm(clean))) {
    values.push(clean);
  }
}

export async function loadContextSpine(force = false) {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    for (const signal of cache.signals.values()) {
      signal.aliases = getContextAliases(signal.key);
    }
    return cache.signals;
  }

  const database = await getDatabaseConnectionAsync();
  const map = new Map<string, ContextSignal>();

  const catalogue: Array<{
    table: string;
    kind: ContextEntityKind;
    id: string;
  }> = [
    { table: 'books', kind: 'BOOK', id: 'book_id' },
    { table: 'media_items', kind: 'MEDIA', id: 'media_id' },
    { table: 'games', kind: 'GAME', id: 'game_id' },
    { table: 'topics', kind: 'TOPIC', id: 'topic_id' },
    { table: 'entries', kind: 'ENTRY', id: 'entry_id' },
    { table: 'audio_tracks', kind: 'FREQUENCY', id: 'track_id' },
  ];

  for (const source of catalogue) {
    const rows = await safeRows(
      database,
      source.table,
      `SELECT ${source.id} AS entity_id, created_at, modified_at
       FROM ${source.table}
       ORDER BY modified_at DESC
       LIMIT 24`,
    );

    for (const row of rows) {
      const id = String(row.entity_id ?? '');
      if (!id) continue;
      mergeDate(map, source.kind, id, 'createdAt', row.created_at ? String(row.created_at) : null);
      mergeDate(map, source.kind, id, 'modifiedAt', row.modified_at ? String(row.modified_at) : null);
    }
  }

  if (await tableExists(database, 'time_sessions')) {
    const sessionQueries: Array<{ kind: ContextEntityKind; sql: string }> = [
      {
        kind: 'BOOK',
        sql: `SELECT a.book_id AS entity_id, MAX(s.started_at) AS context_at
              FROM time_sessions s
              JOIN activities a ON a.activity_id=s.activity_id
              WHERE a.book_id IS NOT NULL
              GROUP BY a.book_id
              ORDER BY context_at DESC LIMIT 18`,
      },
      {
        kind: 'MEDIA',
        sql: `SELECT a.media_id AS entity_id, MAX(s.started_at) AS context_at
              FROM time_sessions s
              JOIN activities a ON a.activity_id=s.activity_id
              WHERE a.media_id IS NOT NULL
              GROUP BY a.media_id
              ORDER BY context_at DESC LIMIT 18`,
      },
      {
        kind: 'TOPIC',
        sql: `SELECT a.topic_id AS entity_id, MAX(s.started_at) AS context_at
              FROM time_sessions s
              JOIN activities a ON a.activity_id=s.activity_id
              WHERE a.topic_id IS NOT NULL
              GROUP BY a.topic_id
              ORDER BY context_at DESC LIMIT 18`,
      },
      {
        kind: 'GAME',
        sql: `SELECT g.game_id AS entity_id, MAX(s.started_at) AS context_at
              FROM time_sessions s
              JOIN activities a ON a.activity_id=s.activity_id
              JOIN games g ON g.playing_activity_id=a.activity_id
              GROUP BY g.game_id
              ORDER BY context_at DESC LIMIT 18`,
      },
    ];

    for (const source of sessionQueries) {
      const rows = await database.getAllAsync<Row>(source.sql).catch(() => []);
      for (const row of rows) {
        const id = String(row.entity_id ?? '');
        if (id) {
          mergeDate(
            map,
            source.kind,
            id,
            'sessionAt',
            row.context_at ? String(row.context_at) : null,
          );
        }
      }
    }
  }

  if (await tableExists(database, 'session_contexts')) {
    const rows = await database
      .getAllAsync<Row>(
        `SELECT entity_type, entity_id, MAX(created_at) AS context_at
         FROM session_contexts
         GROUP BY entity_type, entity_id
         ORDER BY context_at DESC
         LIMIT 30`,
      )
      .catch(() => []);

    for (const row of rows) {
      const kind = String(row.entity_type ?? '') as ContextEntityKind;
      const id = String(row.entity_id ?? '');
      if (
        id &&
        ['BOOK', 'MEDIA', 'GAME', 'TOPIC', 'ENTRY', 'FREQUENCY'].includes(kind)
      ) {
        mergeDate(
          map,
          kind,
          id,
          'sessionContextAt',
          row.context_at ? String(row.context_at) : null,
        );
      }
    }
  }

  if (
    (await tableExists(database, 'collection_items')) &&
    (await tableExists(database, 'collections'))
  ) {
    const rows = await database
      .getAllAsync<Row>(
        `SELECT
           ci.entity_type,
           ci.entity_id,
           c.name AS collection_name,
           ci.created_at
         FROM collection_items ci
         JOIN collections c ON c.collection_id=ci.collection_id
         ORDER BY ci.created_at DESC
         LIMIT 80`,
      )
      .catch(() => []);

    for (const row of rows) {
      const kind = String(row.entity_type ?? '') as ContextEntityKind;
      const id = String(row.entity_id ?? '');
      if (
        !id ||
        !['BOOK', 'MEDIA', 'GAME', 'TOPIC', 'ENTRY', 'FREQUENCY'].includes(kind)
      ) {
        continue;
      }

      const key = kind + ':' + id;
      const signal = map.get(key) ?? empty(kind, id);
      pushUnique(signal.collections, row.collection_name ? String(row.collection_name) : null);
      signal.collectionAt = mostRecent(
        signal.collectionAt,
        row.created_at ? String(row.created_at) : null,
      );
      map.set(key, signal);
    }
  }

  // Topic names act as meaningful, user-created aliases for linked entities.
  if (
    (await tableExists(database, 'entity_links')) &&
    (await tableExists(database, 'topics'))
  ) {
    const rows = await database
      .getAllAsync<Row>(
        `SELECT
           el.source_type AS entity_type,
           el.source_id AS entity_id,
           t.name AS topic_name
         FROM entity_links el
         JOIN topics t
           ON el.target_type='TOPIC'
          AND t.topic_id=el.target_id

         UNION ALL

         SELECT
           el.target_type AS entity_type,
           el.target_id AS entity_id,
           t.name AS topic_name
         FROM entity_links el
         JOIN topics t
           ON el.source_type='TOPIC'
          AND t.topic_id=el.source_id`,
      )
      .catch(() => []);

    for (const row of rows) {
      const kind = String(row.entity_type ?? '') as ContextEntityKind;
      const id = String(row.entity_id ?? '');
      if (
        !id ||
        !['BOOK', 'MEDIA', 'GAME', 'TOPIC', 'ENTRY', 'FREQUENCY'].includes(kind)
      ) {
        continue;
      }

      const key = kind + ':' + id;
      const signal = map.get(key) ?? empty(kind, id);
      pushUnique(signal.relatedTopics, row.topic_name ? String(row.topic_name) : null);
      map.set(key, signal);
    }
  }

  for (const signal of map.values()) {
    signal.aliases = getContextAliases(signal.key);
  }

  cache = { at: Date.now(), signals: map };
  return map;
}

function phraseScore(query: string, phrase: string) {
  const q = norm(query);
  const p = norm(phrase);
  if (!q || !p) return 0;

  if (q === p) return 0.97;
  if (q.includes(p) || p.includes(q)) return 0.86;

  const terms = q.split(/\s+/).filter(term => term.length >= 3);
  if (!terms.length) return 0;

  const hits = terms.filter(term => p.includes(term)).length;
  return hits
    ? Math.min(0.82, 0.34 + (hits / terms.length) * 0.48)
    : 0;
}

function typeHint(query: string, kind: ContextEntityKind) {
  const q = norm(query);
  if (/\b(movie|film|series|serija|show|gledao|watched|watching)\b/.test(q)) {
    return kind === 'MEDIA';
  }
  if (/\b(book|knjiga|reading|read|citao|procitao)\b/.test(q)) {
    return kind === 'BOOK';
  }
  if (/\b(game|igra|played|playing)\b/.test(q)) {
    return kind === 'GAME';
  }
  if (/\b(note|entry|zapis|biljeska)\b/.test(q)) {
    return kind === 'ENTRY';
  }
  if (/\b(topic|tema)\b/.test(q)) {
    return kind === 'TOPIC';
  }
  return false;
}

function rankOne(query: string, signal: ContextSignal): ContextRank {
  let score = 0;
  const reasons: string[] = [];
  const q = norm(query);

  for (const alias of signal.aliases) {
    const value = phraseScore(query, alias);
    if (value > score) {
      score = value;
      reasons.splice(0, reasons.length, 'Ranije potvrđen naziv');
    }
  }

  for (const topic of signal.relatedTopics) {
    const value = phraseScore(query, topic);
    if (value > score) {
      score = value;
      reasons.splice(0, reasons.length, 'Povezano s temom “' + topic + '”');
    }
  }

  for (const collection of signal.collections) {
    const value = phraseScore(query, collection);
    if (value > score) {
      score = value;
      reasons.splice(0, reasons.length, 'Nalazi se u “' + collection + '”');
    }
  }

  if (
    /\b(yesterday|jucer|jučer)\b/.test(q) &&
    isYesterday(signal.sessionAt)
  ) {
    score = Math.max(score, 0.91);
    reasons.push('Aktivno jučer');
  }

  if (
    /\b(last night|sinoc|sinoć)\b/.test(q) &&
    isYesterday(signal.sessionAt)
  ) {
    score = Math.max(score, 0.9);
    reasons.push('Aktivno sinoć');
  }

  const createdHours = hoursAgo(signal.createdAt);
  if (
    /\b(added|created|new|dodao|dodala|novo|zadnje dodano)\b/.test(q) &&
    createdHours <= 72
  ) {
    score = Math.max(score, 0.82);
    reasons.push('Nedavno dodano');
  }

  const sessionHours = hoursAgo(signal.sessionAt);
  if (
    /\b(watched|watching|gledao|gledala|read|reading|citao|čitao|played|playing)\b/.test(q) &&
    sessionHours <= 168 &&
    typeHint(query, signal.kind)
  ) {
    score = Math.max(score, 0.79);
    reasons.push(
      signal.kind === 'MEDIA'
        ? 'Nedavno gledano'
        : signal.kind === 'BOOK'
          ? 'Nedavno čitano'
          : 'Nedavno aktivno',
    );
  }

  const recentAt = mostRecent(
    signal.sessionAt,
    signal.sessionContextAt,
    signal.collectionAt,
    signal.modifiedAt,
    signal.createdAt,
  );

  if (
    /\b(recent|recently|last|latest|nedavno|zadnje|posljednje)\b/.test(q) &&
    hoursAgo(recentAt) <= 168
  ) {
    score = Math.max(score, 0.72);
    reasons.push('Nedavni kontekst');
  }

  // Weak rank prior ONLY. This is enough to reorder / surface context in search,
  // but never enough by itself for a HIGH-confidence mutation.
  if (typeHint(query, signal.kind)) {
    if (sessionHours <= 72) {
      score = Math.max(score, 0.34);
      reasons.push('Nedavno aktivno');
    } else if (createdHours <= 72) {
      score = Math.max(score, 0.3);
      reasons.push('Nedavno dodano');
    } else if (hoursAgo(signal.modifiedAt) <= 72) {
      score = Math.max(score, 0.27);
      reasons.push('Nedavno promijenjeno');
    }
  }

  return {
    key: signal.key,
    score,
    reasons: [...new Set(reasons)].slice(0, 3),
  };
}

export async function rankContextCandidates(
  query: string,
  allowedKeys?: Set<string>,
  limit = 8,
): Promise<ContextRank[]> {
  const signals = await loadContextSpine();

  return [...signals.values()]
    .filter(signal => !allowedKeys || allowedKeys.has(signal.key))
    .map(signal => rankOne(query, signal))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, Math.min(24, limit)));
}

/**
 * Search gets only a bounded context BOOST.
 * Context can surface/reorder candidates, never turn pure recency into certainty.
 */
export async function contextSearchBoosts(query: string) {
  const ranked = await rankContextCandidates(query, undefined, 24);
  return new Map(
    ranked.map(item => [
      item.key,
      {
        boost:
          item.score >= 0.85
            ? 0.42
            : item.score >= 0.7
              ? 0.28
              : item.score >= 0.3
                ? 0.11
                : 0,
        reasons: item.reasons,
      },
    ]),
  );
}

export function invalidateContextSpine() {
  cache = null;
}

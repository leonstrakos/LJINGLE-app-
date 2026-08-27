// forkK5QuietIntelligenceV1

import type { SemanticEntityType } from './semanticTypes';

export type QuietSearchPlan = {
  query: string;
  entityTypes?: SemanticEntityType[];
  naturalLanguage: boolean;
};

const TYPE_HINTS: Array<{
  pattern: RegExp;
  types: SemanticEntityType[];
}> = [
  { pattern: /\b(movie|movies|film|filmove|filmovi|filma)\b/iu, types: ['MEDIA'] },
  { pattern: /\b(tv|series|serie|serija|serije|show|shows)\b/iu, types: ['MEDIA'] },
  { pattern: /\b(book|books|knjiga|knjige|knjigu)\b/iu, types: ['BOOK'] },
  { pattern: /\b(game|games|igra|igre|igru)\b/iu, types: ['GAME'] },
  { pattern: /\b(topic|topics|tema|teme|temu)\b/iu, types: ['TOPIC'] },
  { pattern: /\b(note|notes|entry|entries|zapis|zapisi|biljeska|bilješka|biljeske|bilješke)\b/iu, types: ['ENTRY'] },
  { pattern: /\b(song|songs|music|track|tracks|pjesma|pjesme|glazba|muzika|frequency|frekvencija|frekvencije)\b/iu, types: ['FREQUENCY'] },
];

const NATURAL_PREFIX = /^(?:please\s+)?(?:find|show(?:\s+me)?|open|search(?:\s+for)?|where(?:'s|\s+is)|locate|nađi|nadi|pronađi|pronadi|pokaži|pokazi|otvori|traži|trazi|gdje\s+je)\b/iu;

function cleanWords(value: string) {
  return value
    .replace(/[“”]/g, '\"')
    .replace(/^[\s\"']+|[\s\"']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function planQuietSearch(value: string): QuietSearchPlan | null {
  const raw = cleanWords(value);
  if (!raw || raw.startsWith(':') || raw.startsWith('?')) return null;

  let working = raw;
  const naturalLanguage = NATURAL_PREFIX.test(working);
  working = working.replace(NATURAL_PREFIX, '').trim();

  let entityTypes: SemanticEntityType[] | undefined;
  for (const hint of TYPE_HINTS) {
    if (!hint.pattern.test(working)) continue;
    entityTypes = hint.types;
    working = working.replace(hint.pattern, ' ').replace(/\s+/g, ' ').trim();
    break;
  }

  working = working
    .replace(/^(?:about|regarding|related\s+to|vezano\s+za|o)\b/iu, '')
    .trim();

  const query = cleanWords(working) || raw;
  if (query.length < 2) return null;

  return {
    query,
    entityTypes,
    naturalLanguage,
  };
}

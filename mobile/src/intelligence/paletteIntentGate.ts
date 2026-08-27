// forkK15BrainlessContextualLanguageV1

import { routeLJingleIntent } from './intentRouter';
import {
  fuzzyWord,
  normalizeLoose,
} from './deterministicLanguage';

const EXPLICIT_SEARCH =
  /^\s*(?:search(?:\s+for)?|find|look\s+for|show\s+me|traži|trazi|nađi|nadi|pronađi|pronadi)\b/i;

export type NaturalPaletteNote =
  | { kind: 'PROMPT' }
  | {
      kind: 'CREATE';
      content: string;
    };

const NOTE_VERBS = [
  'make',
  'create',
  'write',
  'remember',
  'napravi',
  'stvori',
  'zapisi',
  'zapiši',
  'napisi',
  'napiši',
  'zabiljezi',
  'zabilježi',
  'zapamti',
] as const;

const NOTE_NOUNS = [
  'note',
  'biljesku',
  'bilješku',
  'biljeska',
  'bilješka',
] as const;

export function parseNaturalPaletteNote(
  value: string,
): NaturalPaletteNote | null {
  const source =
    value.trim();

  if (
    !source ||
    source.startsWith(':')
  ) {
    return null;
  }

  const tokens =
    source
      .split(/\s+/)
      .filter(Boolean);

  if (!tokens.length) return null;

  const first =
    tokens[0] ?? '';

  if (fuzzyWord(first, NOTE_NOUNS)) {
    const content = tokens.slice(1).join(' ').trim();
    return content ? { kind: 'CREATE', content } : { kind: 'PROMPT' };
  }

  if (!fuzzyWord(first, NOTE_VERBS)) {
    return null;
  }

  let nounIndex = -1;

  for (
    let index = 1;
    index < Math.min(tokens.length, 6);
    index += 1
  ) {
    if (
      fuzzyWord(
        tokens[index] ?? '',
        NOTE_NOUNS,
      )
    ) {
      nounIndex = index;
      break;
    }
  }

  // Croatian spoken form:
  // "napiši u note nešto..."
  // filler "u / mi / jednu / a / me" is simply skipped while locating NOTE.
  if (nounIndex < 0) {
    return null;
  }

  const content =
    tokens
      .slice(nounIndex + 1)
      .join(' ')
      .replace(
        /^(?:that|da)\s+/i,
        '',
      )
      .trim();

  return content
    ? {
        kind: 'CREATE',
        content,
      }
    : { kind: 'PROMPT' };
}

export function isExplicitSearchInput(
  value: string,
) {
  return EXPLICIT_SEARCH.test(
    value.trim(),
  );
}

export function isCommandShapedInput(
  value: string,
) {
  const clean =
    value.trim();

  if (!clean) return false;

  if (clean.startsWith(':')) {
    return true;
  }

  if (
    parseNaturalPaletteNote(clean)
  ) {
    return true;
  }

  if (
    routeLJingleIntent(clean)
  ) {
    return true;
  }

  const first =
    normalizeLoose(clean)
      .split(/\s+/)[0] ?? '';

  return fuzzyWord(first, [
    'make',
    'create',
    'new',
    'write',
    'add',
    'put',
    'open',
    'start',
    'begin',
    'stop',
    'link',
    'connect',
    'update',
    'napravi',
    'stvori',
    'dodaj',
    'stavi',
    'ubaci',
    'otvori',
    'pokreni',
    'pocni',
    'počni',
    'zaustavi',
    'zapisi',
    'zapiši',
    'napisi',
    'napiši',
    'povezi',
    'poveži',
    'linkaj',
  ]);
}

export function shouldRememberAsSearch(
  value: string,
) {
  const clean =
    value.trim();

  if (!clean) return false;

  if (
    isExplicitSearchInput(clean)
  ) {
    return true;
  }

  return !isCommandShapedInput(clean);
}

/**
 * K14.1.1 compatibility: deterministic clarification copy.
 * This is UI help only; it never invokes a language model and never mutates.
 */
export function commandHelpForInput(
  value: string,
): string | null {
  const clean = value.trim();

  if (
    /^(?:start|begin|pocni|počni)$/i.test(clean)
  ) {
    return 'Što želiš pokrenuti? Npr. “start reading Dune” ili pokreni timer.';
  }

  const pages =
    clean.match(
      /^(?:i\s+)?(?:read|pročitao|procitao|čitao|citao)\s+(\d+)\s+pages?\b/i,
    );

  if (pages) {
    return (
      (pages[1] ?? '') +
      ' stranica je dvosmisleno: misliš “na stranici ' +
      (pages[1] ?? '') +
      '” ili “pročitao sam ' +
      (pages[1] ?? '') +
      ' stranica”? Ništa nije promijenjeno.'
    );
  }

  if (
    /^(?:update|set)\s+(?:book|knjigu?)\s+.+\s+(?:str|page|pg)\s+\d+$/i.test(clean)
  ) {
    return 'Prepoznao sam ažuriranje određene knjige, ali named-book mutation još traži sigurnu rezoluciju knjige. Ništa nije promijenjeno.';
  }

  if (
    /^(?:read|watch|listen|čitaj|citaj|gledaj|slušaj|slusaj)\b/i.test(clean)
  ) {
    return 'Prepoznao sam radnju, ali trebam jasan objekt ili stanje prije izvršenja.';
  }

  return null;
}

// k15ReferentialUpdatesPostSessionV1

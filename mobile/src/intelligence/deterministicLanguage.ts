// forkK15BrainlessContextualLanguageV1

import type { LJingleIntent } from './intentRouter';
import type {
  LocalLanguageContext,
  LocalLanguageResult,
  RawModelIntent,
} from './languageModel/types';

export type NaturalCreateCommand =
  | { kind: 'BOOK'; query: string }
  | { kind: 'MOVIE'; query: string }
  | { kind: 'SERIES'; query: string }
  | { kind: 'GAME'; query: string }
  | { kind: 'TOPIC'; query: string };

function ascii(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US');
}

/**
 * Voice/STT and casual typing often stretch a final sound:
 * duneee, nooo, hellooo. Three-or-more identical chars are never needed
 * for LJingle command/search ownership, so collapse them before matching.
 */
export function collapseSpokenRepeats(value: string) {
  return value.replace(/(.)\1{2,}/giu, '$1');
}

export function normalizeLoose(value: string) {
  return ascii(collapseSpokenRepeats(value))
    .replace(/[“”"']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function distance(left: string, right: string) {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from(
    { length: rows },
    () => new Array<number>(cols).fill(0),
  );

  for (let i = 0; i < rows; i += 1) {
    const row = matrix[i];
    if (row) row[0] = i;
  }

  const firstRow = matrix[0];
  if (firstRow) {
    for (let j = 0; j < cols; j += 1) {
      firstRow[j] = j;
    }
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const row = matrix[i];
      const previous = matrix[i - 1];
      if (!row || !previous) continue;

      const cost =
        left[i - 1] === right[j - 1]
          ? 0
          : 1;

      const deletion =
        (previous[j] ?? Number.MAX_SAFE_INTEGER) + 1;
      const insertion =
        (row[j - 1] ?? Number.MAX_SAFE_INTEGER) + 1;
      const substitution =
        (previous[j - 1] ?? Number.MAX_SAFE_INTEGER) + cost;

      let next =
        Math.min(
          deletion,
          insertion,
          substitution,
        );

      if (
        i > 1 &&
        j > 1 &&
        left[i - 1] === right[j - 2] &&
        left[i - 2] === right[j - 1]
      ) {
        const twoBack =
          matrix[i - 2]?.[j - 2];

        if (twoBack != null) {
          next =
            Math.min(
              next,
              twoBack + 1,
            );
        }
      }

      row[j] = next;
    }
  }

  return (
    matrix[left.length]?.[right.length] ??
    Math.max(left.length, right.length)
  );
}

function typoBudget(value: string) {
  if (value.length <= 3) return 0;
  if (value.length <= 4) return 1;
  if (value.length <= 8) return 2;
  return 2;
}

export function fuzzyWord(
  value: string,
  candidates: readonly string[],
) {
  const clean = normalizeLoose(value);
  if (!clean || clean.includes(' ')) return false;

  return candidates.some((candidate) => {
    const target = normalizeLoose(candidate);
    if (!target) return false;
    if (clean === target) return true;

    const budget =
      Math.min(
        typoBudget(clean),
        typoBudget(target),
      );

    return (
      budget > 0 &&
      distance(clean, target) <= budget
    );
  });
}

export function fuzzyTextIncludes(
  haystackValue: string,
  termValue: string,
) {
  const haystack =
    normalizeLoose(haystackValue);

  const term =
    normalizeLoose(termValue);

  if (!term) return true;
  if (!haystack) return false;
  if (haystack.includes(term)) return true;

  const hayWords =
    haystack.split(/\s+/).filter(Boolean);

  const terms =
    term.split(/\s+/).filter(Boolean);

  return terms.every((needle) => {
    if (
      hayWords.some(
        (word) =>
          word.includes(needle) ||
          needle.includes(word),
      )
    ) {
      return true;
    }

    const budget =
      typoBudget(needle);

    if (budget <= 0) return false;

    return hayWords.some(
      (word) =>
        Math.abs(
          word.length - needle.length,
        ) <= budget &&
        distance(word, needle) <=
          Math.min(
            budget,
            typoBudget(word),
          ),
    );
  });
}

const CREATE = [
  'new',
  'make',
  'create',
  'add',
  'napravi',
  'stvori',
  'dodaj',
  'kreiraj',
] as const;

const BOOK = [
  'book',
  'knjiga',
  'knjigu',
  'knjige',
] as const;

const MOVIE = [
  'movie',
  'film',
  'filma',
] as const;

const SERIES = [
  'series',
  'serie',
  'show',
  'tv',
  'serija',
  'seriju',
] as const;

const GAME = [
  'game',
  'igra',
  'igru',
] as const;

const TOPIC = [
  'topic',
  'tema',
  'temu',
] as const;

function tokenized(value: string) {
  return collapseSpokenRepeats(value)
    .trim()
    .replace(/^:/, ': ')
    .split(/\s+/)
    .map((raw) => ({
      raw,
      clean:
        normalizeLoose(raw),
    }))
    .filter((token) => token.clean);
}

function createKind(value: string):
  NaturalCreateCommand['kind'] | null {
  if (fuzzyWord(value, BOOK)) return 'BOOK';
  if (fuzzyWord(value, MOVIE)) return 'MOVIE';
  if (fuzzyWord(value, SERIES)) return 'SERIES';
  if (fuzzyWord(value, GAME)) return 'GAME';
  if (fuzzyWord(value, TOPIC)) return 'TOPIC';
  return null;
}

export function parseNaturalCreateCommand(
  value: string,
): NaturalCreateCommand | null {
  const clean =
    collapseSpokenRepeats(value)
      .trim();

  if (!clean) return null;

  // ":new movie duneee" and ":new book dune"
  const colon =
    clean.match(
      /^\s*:new\s+([^\s]+)\s+([\s\S]+)$/i,
    );

  if (colon) {
    const kind =
      createKind(colon[1] ?? '');

    const query =
      collapseSpokenRepeats(
        colon[2] ?? '',
      ).trim();

    return kind && query
      ? { kind, query }
      : null;
  }

  const tokens = tokenized(clean);
  if (tokens.length < 2) return null;

  const first =
    tokens[0]?.clean ?? '';

  if (!fuzzyWord(first, CREATE)) {
    return null;
  }

  // Natural speech may insert articles/prepositions:
  // "make a book dune", "napravi mi knjigu dune".
  let kindIndex = -1;
  let kind: NaturalCreateCommand['kind'] | null =
    null;

  for (
    let index = 1;
    index < Math.min(tokens.length, 5);
    index += 1
  ) {
    const candidate =
      createKind(
        tokens[index]?.clean ?? '',
      );

    if (candidate) {
      kind = candidate;
      kindIndex = index;
      break;
    }
  }

  if (!kind || kindIndex < 0) {
    return null;
  }

  const query =
    collapseSpokenRepeats(
      tokens
        .slice(kindIndex + 1)
        .map((token) => token.raw)
        .join(' '),
    )
      .replace(/[.!?]+$/g, '')
      .trim();

  return query
    ? { kind, query }
    : null;
}

const ADD = [
  'put',
  'add',
  'move',
  'stavi',
  'dodaj',
  'ubaci',
] as const;

const LINK = [
  'link',
  'linkaj',
  'connect',
  'povezi',
  'poveži',
] as const;

const OPEN = [
  'open',
  'show',
  'otvori',
  'pokazi',
  'pokaži',
] as const;

const SEARCH = [
  'search',
  'find',
  'trazi',
  'traži',
  'nadi',
  'nađi',
  'pronadi',
  'pronađi',
] as const;

const START = [
  'start',
  'begin',
  'pocni',
  'počni',
  'kreni',
] as const;

const READING = [
  'read',
  'reading',
  'citaj',
  'čitaj',
  'citanje',
  'čitanje',
] as const;

const INTO = [
  'in',
  'into',
  'to',
  'u',
] as const;

const WITH = [
  'with',
  'to',
  's',
  'sa',
] as const;

const CURRENT = [
  'this',
  'that',
  'it',
  'ovo',
  'to',
  'taj',
  'ta',
  'ono',
  'ga',
  'je',
] as const;

function rawIntent(
  action: RawModelIntent['action'],
  target: RawModelIntent['target'],
  values?: Partial<RawModelIntent>,
): RawModelIntent {
  return {
    action,
    target,
    query: '',
    subjectQuery: '',
    content: '',
    value: 0,
    ...values,
  };
}

function naturalSubject(
  value: string,
) {
  const clean =
    normalizeLoose(value);

  if (!clean) {
    return 'latest recent';
  }

  if (
    /\b(?:zadnje|zadnji|last|latest)\b/.test(clean) &&
    /\b(?:gledano|gledao|watched|movie|film)\b/.test(clean)
  ) {
    return 'latest watched';
  }

  if (
    /\b(?:zadnje|zadnji|last|latest)\b/.test(clean) &&
    /\b(?:citano|procitano|read|book|knjig)\w*\b/.test(clean)
  ) {
    return 'latest read';
  }

  if (
    /\b(?:zadnje|zadnji|last|latest)\b/.test(clean) &&
    /\b(?:igrano|played|game|igra)\b/.test(clean)
  ) {
    return 'latest played';
  }

  if (
    /\b(?:zadnje|zadnji|last|latest)\b/.test(clean) &&
    /\b(?:stvoreno|dodano|created|added)\b/.test(clean)
  ) {
    return 'latest created';
  }

  if (
    /\b(?:zadnje|zadnji|last|latest)\b/.test(clean) &&
    /\b(?:otvoreno|opened)\b/.test(clean)
  ) {
    return 'latest recent';
  }

  if (
    CURRENT.some(
      (token) =>
        fuzzyWord(clean, [token]),
    )
  ) {
    return 'latest recent';
  }

  return value.trim();
}

function firstMatchingIndex(
  source: ReturnType<typeof tokenized>,
  candidates: readonly string[],
  start = 0,
) {
  return source.findIndex(
    (token, index) =>
      index >= start &&
      fuzzyWord(
        token.clean,
        candidates,
      ),
  );
}

/**
 * Compatibility output intentionally matches the old K9 LocalLanguageResult,
 * but this function performs ZERO model inference.
 */
export function parseDeterministicLanguageIntent(
  value: string,
  _context: LocalLanguageContext,
): LocalLanguageResult {
  const original =
    collapseSpokenRepeats(value)
      .trim()
      .replace(/\s+/g, ' ');

  if (
    !original ||
    original.startsWith('?') ||
    original.startsWith(':')
  ) {
    return {
      intent: null,
      raw: null,
    };
  }

  const source =
    tokenized(original);

  if (!source.length) {
    return {
      intent: null,
      raw: null,
    };
  }

  const first =
    source[0]?.clean ?? '';

  // "stavi u winter"
  // "dodaj zadnje gledano u winter"
  if (fuzzyWord(first, ADD)) {
    const prepIndex =
      firstMatchingIndex(
        source,
        INTO,
        1,
      );

    if (prepIndex > 0) {
      const destination =
        collapseSpokenRepeats(
          source
            .slice(prepIndex + 1)
            .map((token) => token.raw)
            .join(' '),
        ).trim();

      if (destination) {
        const subjectText =
          source
            .slice(1, prepIndex)
            .map((token) => token.raw)
            .join(' ')
            .trim();

        const subjectQuery =
          naturalSubject(subjectText);

        const raw =
          rawIntent(
            'ADD_TO_COLLECTION',
            'CURRENT_ENTITY',
            {
              query: destination,
              subjectQuery,
            },
          );

        const intent: LJingleIntent = {
          action:
            'ADD_TO_COLLECTION',
          target: 'CURRENT_ENTITY',
          query: destination,
          original,
        };

        return { raw, intent };
      }
    }
  }

  // "linkaj s jung"
  // "povezi zadnje gledano s lynch"
  if (fuzzyWord(first, LINK)) {
    const prepIndex =
      firstMatchingIndex(
        source,
        WITH,
        1,
      );

    if (prepIndex > 0) {
      const destination =
        source
          .slice(prepIndex + 1)
          .map((token) => token.raw)
          .join(' ')
          .trim();

      if (destination) {
        const subjectText =
          source
            .slice(1, prepIndex)
            .map((token) => token.raw)
            .join(' ')
            .trim();

        const raw =
          rawIntent(
            'LINK',
            'CURRENT_ENTITY',
            {
              query: destination,
              subjectQuery:
                naturalSubject(
                  subjectText,
                ),
            },
          );

        const intent: LJingleIntent = {
          action: 'LINK',
          target: 'CURRENT_ENTITY',
          query: destination,
          original,
        };

        return { raw, intent };
      }
    }
  }

  // "otvori zadnje gledano"
  // "open dune"
  if (fuzzyWord(first, OPEN)) {
    const subject =
      source
        .slice(1)
        .map((token) => token.raw)
        .join(' ')
        .trim();

    if (subject) {
      const raw =
        rawIntent(
          'OPEN',
          'CURRENT',
          {
            subjectQuery:
              naturalSubject(subject),
          },
        );

      const intent: LJingleIntent = {
        action: 'OPEN',
        target: 'CURRENT',
        original,
      };

      return { raw, intent };
    }
  }

  if (fuzzyWord(first, SEARCH)) {
    const query =
      source
        .slice(1)
        .map((token) => token.raw)
        .join(' ')
        .trim();

    if (query) {
      return {
        raw:
          rawIntent(
            'SEARCH',
            'NONE',
            { query },
          ),
        intent: {
          action: 'SEARCH',
          query,
          original,
        },
      };
    }
  }

  if (fuzzyWord(first, START)) {
    const readingIndex =
      firstMatchingIndex(
        source,
        READING,
        1,
      );

    if (readingIndex > 0) {
      const query =
        source
          .slice(readingIndex + 1)
          .map((token) => token.raw)
          .join(' ')
          .trim();

      if (query) {
        return {
          raw:
            rawIntent(
              'START_READING',
              'BOOK',
              { query },
            ),
          intent: {
            action: 'START',
            target: 'BOOK',
            query,
            original,
          },
        };
      }
    }
  }

  return {
    intent: null,
    raw: null,
  };
}

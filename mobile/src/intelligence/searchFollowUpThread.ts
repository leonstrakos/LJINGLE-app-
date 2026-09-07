// ljingleBrainSearchFollowUpR2:helper
//
// Session-local conversational search refinements.
// EN + HR are first-class. No persistence, DB writes, network or model calls.

export type SearchThreadKind =
  | 'BOOK'
  | 'MEDIA'
  | 'GAME'
  | 'TOPIC'
  | 'ENTRY'
  | 'FREQUENCY'
  | 'COLLECTION';

export type SearchThreadFilter = {
  kinds: SearchThreadKind[] | null;
  fromBooks: boolean;
  includeCollection: string | null;
  excludeCollection: string | null;
};

export type SearchThreadRefinement =
  | {
      kind: 'FILTER';
      patch: Partial<SearchThreadFilter>;
    }
  | {
      kind: 'RESET';
    };

export function emptySearchThreadFilter(): SearchThreadFilter {
  return {
    kinds: null,
    fromBooks: false,
    includeCollection: null,
    excludeCollection: null,
  };
}

function compact(value: unknown) {
  return String(value ?? '')
    .replace(/s+/g, ' ')
    .trim();
}

function norm(value: unknown) {
  return compact(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase()
    .replace(/[^p{L}p{N}]+/gu, ' ')
    .replace(/s+/g, ' ')
    .trim();
}

const TYPE_REFINEMENTS: Array<{
  pattern: RegExp;
  kinds: SearchThreadKind[];
}> = [
  {
    pattern:
      /^(?:onlys+)?(?:notes?|entries)|^(?:samos+)?(?:zapisi?|biljeske?|bilješke?)$/iu,
    kinds: ['ENTRY'],
  },
  {
    pattern:
      /^(?:onlys+)?books?|^(?:samos+)?knjige?$/iu,
    kinds: ['BOOK'],
  },
  {
    pattern:
      /^(?:onlys+)?(?:movies?|films?|series|shows?)|^(?:samos+)?(?:filmovi?|serije?)$/iu,
    kinds: ['MEDIA'],
  },
  {
    pattern:
      /^(?:onlys+)?games?|^(?:samos+)?igre?$/iu,
    kinds: ['GAME'],
  },
  {
    pattern:
      /^(?:onlys+)?topics?|^(?:samos+)?teme?$/iu,
    kinds: ['TOPIC'],
  },
  {
    pattern:
      /^(?:onlys+)?(?:music|songs?|tracks?|frequencies)|^(?:samos+)?(?:glazba|muzika|pjesme?|frekvencije?)$/iu,
    kinds: ['FREQUENCY'],
  },
  {
    pattern:
      /^(?:onlys+)?(?:memorys*boxes?|collections?)|^(?:samos+)?(?:memorys*boxevi?|kolekcije?)$/iu,
    kinds: ['COLLECTION'],
  },
];

const PREFIXES = [
  'only entry',
  'only entries',
  'only note',
  'only notes',
  'only book',
  'only books',
  'only movie',
  'only movies',
  'only film',
  'only films',
  'only series',
  'only show',
  'only shows',
  'only game',
  'only games',
  'only topic',
  'only topics',
  'only music',
  'only song',
  'only songs',
  'only track',
  'only tracks',
  'only frequency',
  'only frequencies',
  'only memory box',
  'only memory boxes',
  'only collection',
  'only collections',
  'from book',
  'from books',
  'from reading',
  'only from book',
  'only from books',
  'only from reading',
  'not in ',
  'exclude ',
  'except ',
  'only in ',
  'in ',
  'reset filters',
  'clear filters',
  'start over',
  'samo zapis',
  'samo zapisi',
  'samo biljeska',
  'samo biljeske',
  'samo bilješka',
  'samo bilješke',
  'samo knjiga',
  'samo knjige',
  'samo film',
  'samo filmovi',
  'samo serija',
  'samo serije',
  'samo igra',
  'samo igre',
  'samo tema',
  'samo teme',
  'samo glazba',
  'samo muzika',
  'samo pjesma',
  'samo pjesme',
  'samo frekvencija',
  'samo frekvencije',
  'samo memory box',
  'samo memory boxevi',
  'samo kolekcija',
  'samo kolekcije',
  'iz knjige',
  'iz knjiga',
  'iz citanja',
  'iz čitanja',
  'samo iz knjige',
  'samo iz knjiga',
  'samo iz citanja',
  'samo iz čitanja',
  'ne u ',
  'bez ',
  'osim ',
  'samo u ',
  'u ',
  'ponisti filtre',
  'poništi filtre',
  'resetiraj filtre',
  'ispocetka',
  'ispočetka',
];

export function isSearchThreadFollowUpPrefix(value: string) {
  const clean = norm(value);

  if (!clean) return false;

  return PREFIXES.some((candidate) => {
    const normalized = norm(candidate);

    return (
      normalized.startsWith(clean) ||
      clean.startsWith(normalized)
    );
  });
}

export function parseSearchThreadFollowUp(
  value: string,
): SearchThreadRefinement | null {
  const raw = compact(value);

  if (!raw) return null;

  if (
    /^(?:resets+filters?|clears+filters?|starts+over|ponistis+filtre|poništis+filtre|resetirajs+filtre|ispocetka|ispočetka)$/iu.test(
      raw,
    )
  ) {
    return { kind: 'RESET' };
  }

  for (const rule of TYPE_REFINEMENTS) {
    if (rule.pattern.test(raw)) {
      return {
        kind: 'FILTER',
        patch: {
          kinds: rule.kinds,
        },
      };
    }
  }

  if (
    /^(?:onlys+)?froms+(?:thes+)?(?:book|books|reading)$/iu.test(
      raw,
    ) ||
    /^(?:samos+)?izs+(?:knjige|knjiga|citanja|čitanja)$/iu.test(
      raw,
    )
  ) {
    return {
      kind: 'FILTER',
      patch: {
        fromBooks: true,
      },
    };
  }

  const exclude =
    raw.match(
      /^(?:nots+in|exclude|except|nes+u|bez|osim)s+(.{1,80})$/iu,
    );

  if (exclude?.[1]?.trim()) {
    return {
      kind: 'FILTER',
      patch: {
        excludeCollection:
          exclude[1].trim(),
        includeCollection: null,
      },
    };
  }

  const include =
    raw.match(
      /^(?:onlys+in|in|samos+u|u)s+(.{1,80})$/iu,
    );

  if (include?.[1]?.trim()) {
    return {
      kind: 'FILTER',
      patch: {
        includeCollection:
          include[1].trim(),
        excludeCollection: null,
      },
    };
  }

  return null;
}

export function mergeSearchThreadFilter(
  current: SearchThreadFilter,
  refinement: SearchThreadRefinement,
): SearchThreadFilter {
  if (refinement.kind === 'RESET') {
    return emptySearchThreadFilter();
  }

  return {
    ...current,
    ...refinement.patch,
  };
}

export function searchThreadFilterIsActive(
  filter: SearchThreadFilter,
) {
  return Boolean(
    filter.kinds ||
      filter.fromBooks ||
      filter.includeCollection ||
      filter.excludeCollection,
  );
}

export function shouldRememberSearchThreadBase(
  value: string,
) {
  const raw = compact(value);

  if (!raw || raw.length < 2) {
    return false;
  }

  if (
    raw.startsWith(':') ||
    raw.startsWith('?') ||
    parseSearchThreadFollowUp(raw) ||
    isSearchThreadFollowUpPrefix(raw)
  ) {
    return false;
  }

  // Mutation/navigation commands are not search-thread bases.
  if (
    /^(?:open|otvori|add|dodaj|stavi|ubaci|put|place|link|linkaj|povezi|poveži|start|pokreni|create|make|napravi|write|zapisi|zapiši|delete|remove|obrisi|obriši|finish|complete|zavrsi|završi)/iu.test(
      raw,
    )
  ) {
    return false;
  }

  return true;
}

export function searchThreadNameMatches(
  query: string,
  value: string,
) {
  const needle = norm(query);
  const haystack = norm(value);

  if (!needle || !haystack) {
    return false;
  }

  return (
    haystack === needle ||
    haystack.includes(needle) ||
    needle.includes(haystack)
  );
}

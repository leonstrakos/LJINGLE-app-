// ljingleSearchSnippetsBrainContextR2:excerpt

function compact(value: unknown) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function norm(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

const STOP_TERMS = new Set([
  'a', 'an', 'and', 'about', 'after', 'find', 'for',
  'i', 'in', 'is', 'me', 'my', 'note', 'notes',
  'of', 'on', 'search', 'show', 'the', 'to', 'where',
  'wrote', 'entry', 'entries', 'zapis', 'zapisi',
  'biljeska', 'biljeske', 'bilješka', 'bilješke',
  'pronadi', 'pronađi', 'nadi', 'nađi', 'trazi', 'traži',
  'pokazi', 'pokaži', 'gdje', 'sam', 'pisao', 'pisala',
  'zapisao', 'zapisala', 'nakon', 'citanja', 'čitanja',
]);

export function archiveSearchTerms(value: string) {
  const output: string[] = [];

  for (const raw of compact(value).split(/\s+/)) {
    const clean = norm(raw)
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

    if (
      !clean ||
      STOP_TERMS.has(clean) ||
      clean === 'jingle' ||
      /^(?:type|status|year):/i.test(clean)
    ) {
      continue;
    }

    if (!output.includes(clean)) {
      output.push(clean);
    }
  }

  return output;
}

function matchIndex(text: string, terms: string[]) {
  const normalized = norm(text);
  let best = -1;

  for (const term of terms) {
    const at = normalized.indexOf(norm(term));
    if (at >= 0 && (best < 0 || at < best)) {
      best = at;
    }
  }

  return best;
}

/**
 * Returns only source text already stored in LJINGLE.
 * No generated summary, rewrite, inference or completion.
 */
export function archiveMatchedExcerpt(
  value: unknown,
  terms: string[],
  maximum = 168,
) {
  const text = compact(value);
  if (!text || terms.length === 0) return null;

  const at = matchIndex(text, terms);
  if (at < 0) return null;
  if (text.length <= maximum) return text;

  const before = Math.min(44, Math.floor(maximum * 0.3));
  let start = Math.max(0, at - before);
  let end = Math.min(text.length, start + maximum);

  if (end === text.length) {
    start = Math.max(0, end - maximum);
  }

  let excerpt = text.slice(start, end).trim();

  if (start > 0) {
    const firstSpace = excerpt.indexOf(' ');
    if (firstSpace > 0 && firstSpace < 24) {
      excerpt = excerpt.slice(firstSpace + 1);
    }
  }

  if (end < text.length) {
    const lastSpace = excerpt.lastIndexOf(' ');
    if (lastSpace > excerpt.length - 24) {
      excerpt = excerpt.slice(0, lastSpace);
    }
  }

  return (
    (start > 0 ? '…' : '') +
    excerpt +
    (end < text.length ? '…' : '')
  );
}

export function archiveLeadExcerpt(
  value: unknown,
  maximum = 168,
) {
  const text = compact(value);
  if (!text) return null;
  if (text.length <= maximum) return text;

  let excerpt = text.slice(0, maximum).trimEnd();
  const lastSpace = excerpt.lastIndexOf(' ');

  if (lastSpace > maximum - 24) {
    excerpt = excerpt.slice(0, lastSpace);
  }

  return excerpt + '…';
}

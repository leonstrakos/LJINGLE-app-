// ljingleBrainBulkMemoryBoxActionsR1:bulk
//
// Bulk Memory Box mutations for Jingle Brain.
// EN + HR are first-class.
// Preview is read-only. executeBulkCollectionAdd() is called only
// from an explicit POTVRDA / CONFIRM command row.

import { collectionApi } from '../services/collectionApi';
import type { CollectionSummary } from '../types/collection';
import { archiveSearchTerms } from './archiveSearchExcerpt';
import { invalidateContextSpine } from './contextSpine';
import { semanticSearch } from './semanticIndex';

export type BulkCollectionIntent = {
  raw: string;
  sourceQuery: string;
  destinationQuery: string;
  language: 'EN' | 'HR';
};

export type BulkEntryCandidate = {
  entryId: string;
  title: string;
  sourceText: string;
};

export type BulkCollectionMatch = {
  entryId: string;
  title: string;
  score: number;
};

export type BulkCollectionPreview =
  | {
      status: 'READY';
      intent: BulkCollectionIntent;
      collectionId: string;
      collectionName: string;
      matches: BulkCollectionMatch[];
      addable: BulkCollectionMatch[];
      alreadyPresent: number;
    }
  | {
      status:
        | 'NO_COLLECTION'
        | 'AMBIGUOUS_COLLECTION'
        | 'NO_MATCHES'
        | 'ALREADY_PRESENT'
        | 'TOO_MANY';
      intent: BulkCollectionIntent;
      collectionId?: string;
      collectionName?: string;
      matches: BulkCollectionMatch[];
      addable: BulkCollectionMatch[];
      alreadyPresent: number;
    };

const MAX_BULK_ITEMS = 40;

function compact(value: unknown) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function norm(value: unknown) {
  return compact(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}#]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDestination(value: string) {
  return compact(value)
    .replace(/^#+/, '')
    .replace(
      /\s+(?:memory\s+box|box|collection|kolekcija|kolekciju|memory\s+boxu)\s*$/iu,
      '',
    )
    .replace(/^#+/, '')
    .trim();
}

export function parseBulkCollectionIntent(
  value: string,
): BulkCollectionIntent | null {
  const raw = compact(value);

  if (!raw || raw.startsWith(':') || raw.startsWith('?')) {
    return null;
  }

  const english = [
    /^(?:put|add)\s+all(?:\s+my)?\s+(?:notes?|entries?)\s+(?:about|on)\s+(.+?)\s+(?:into|to)\s+(.+)$/iu,
    /^(?:put|add)\s+all(?:\s+my)?\s+(.+?)\s+(?:notes?|entries?)\s+(?:into|to)\s+(.+)$/iu,
  ];

  for (const pattern of english) {
    const match = raw.match(pattern);
    if (!match) continue;

    const sourceQuery = compact(match[1]);
    const destinationQuery = cleanDestination(match[2] ?? '');

    if (!sourceQuery || !destinationQuery) return null;

    return {
      raw,
      sourceQuery,
      destinationQuery,
      language: 'EN',
    };
  }

  const croatian = [
    /^(?:stavi|dodaj)\s+sve(?:\s+moje)?\s+(?:zapise|biljeske|bilješke)\s+(?:o|vezano\s+za)\s+(.+?)\s+u\s+(.+)$/iu,
    /^(?:stavi|dodaj)\s+sve(?:\s+moje)?\s+(.+?)\s+(?:zapise|biljeske|bilješke)\s+u\s+(.+)$/iu,
  ];

  for (const pattern of croatian) {
    const match = raw.match(pattern);
    if (!match) continue;

    const sourceQuery = compact(match[1]);
    const destinationQuery = cleanDestination(match[2] ?? '');

    if (!sourceQuery || !destinationQuery) return null;

    return {
      raw,
      sourceQuery,
      destinationQuery,
      language: 'HR',
    };
  }

  return null;
}

function collectionScore(query: string, name: string) {
  const q = norm(query).replace(/^#/, '');
  const n = norm(name).replace(/^#/, '');

  if (!q || !n) return 0;
  if (q === n) return 1;
  if (n.startsWith(q) || q.startsWith(n)) return 0.94;
  if (n.includes(q) || q.includes(n)) return 0.86;

  const qWords = q.split(/\s+/).filter(Boolean);
  const nWords = n.split(/\s+/).filter(Boolean);

  if (!qWords.length || !nWords.length) return 0;

  const hits = qWords.filter((word) =>
    nWords.some(
      (candidate) =>
        candidate === word ||
        (
          candidate.length >= 4 &&
          word.length >= 4 &&
          (
            candidate.startsWith(word) ||
            word.startsWith(candidate)
          )
        ),
    ),
  ).length;

  return hits
    ? 0.42 + (hits / qWords.length) * 0.38
    : 0;
}

function resolveCollection(
  query: string,
  collections: CollectionSummary[],
) {
  const ranked = collections
    .map((collection) => ({
      collection,
      score: collectionScore(query, collection.name),
    }))
    .filter((row) => row.score >= 0.72)
    .sort((left, right) => right.score - left.score);

  if (!ranked.length) {
    return {
      status: 'NO_COLLECTION' as const,
      collection: null,
    };
  }

  const first = ranked[0]!;
  const second = ranked[1] ?? null;

  if (
    second &&
    first.score < 0.999 &&
    first.score - second.score < 0.08
  ) {
    return {
      status: 'AMBIGUOUS_COLLECTION' as const,
      collection: null,
    };
  }

  return {
    status: 'READY' as const,
    collection: first.collection,
  };
}

function tokenMatch(term: string, token: string) {
  if (term === token) return true;

  if (term.length >= 4 && token.length >= 4) {
    return (
      term.startsWith(token) ||
      token.startsWith(term)
    );
  }

  return false;
}

function lexicalCoverage(query: string, sourceText: string) {
  const terms = archiveSearchTerms(query);
  if (!terms.length) return 0;

  const tokens = norm(sourceText)
    .split(/\s+/)
    .filter(Boolean);

  const matched = terms.filter((term) =>
    tokens.some((token) => tokenMatch(term, token)),
  ).length;

  return matched / terms.length;
}

export async function buildBulkCollectionPreview(
  intent: BulkCollectionIntent,
  candidates: BulkEntryCandidate[],
  collections: CollectionSummary[],
): Promise<BulkCollectionPreview> {
  const target = resolveCollection(
    intent.destinationQuery,
    collections,
  );

  if (target.status !== 'READY' || !target.collection) {
    return {
      status: target.status,
      intent,
      matches: [],
      addable: [],
      alreadyPresent: 0,
    };
  }

  const semantic = await semanticSearch(
    intent.sourceQuery,
    {
      limit: 50,
      entityTypes: ['ENTRY'],
      minimumScore: 0.08,
    },
  ).catch(() => []);

  const semanticById = new Map(
    semantic.map((item) => [
      item.entityId,
      item,
    ]),
  );

  const matches = candidates
    .map((candidate) => {
      const coverage = lexicalCoverage(
        intent.sourceQuery,
        candidate.sourceText,
      );

      const semanticHit = semanticById.get(
        candidate.entryId,
      );

      const semanticScore = semanticHit?.score ?? 0;
      const contextualEvidence = Boolean(
        semanticHit?.reasons.some(
          (reason) => reason !== 'Sličan sadržaj',
        ),
      );

      const confident =
        coverage >= 0.999 ||
        (
          coverage >= 0.5 &&
          (
            semanticScore >= 0.24 ||
            contextualEvidence
          )
        ) ||
        semanticScore >= 0.58;

      if (!confident) return null;

      return {
        entryId: candidate.entryId,
        title: candidate.title,
        score: Math.min(
          1,
          Math.max(
            coverage * 0.88,
            semanticScore,
          ),
        ),
      } satisfies BulkCollectionMatch;
    })
    .filter(
      (item): item is BulkCollectionMatch =>
        Boolean(item),
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.title.localeCompare(right.title),
    );

  if (!matches.length) {
    return {
      status: 'NO_MATCHES',
      intent,
      collectionId: target.collection.collectionId,
      collectionName: target.collection.name,
      matches: [],
      addable: [],
      alreadyPresent: 0,
    };
  }

  if (matches.length > MAX_BULK_ITEMS) {
    return {
      status: 'TOO_MANY',
      intent,
      collectionId: target.collection.collectionId,
      collectionName: target.collection.name,
      matches,
      addable: [],
      alreadyPresent: 0,
    };
  }

  const detail = await collectionApi.getById(
    target.collection.collectionId,
  );

  const existing = new Set(
    detail.items
      .filter((item) => item.entityType === 'ENTRY')
      .map((item) => item.entityId),
  );

  const addable = matches.filter(
    (match) => !existing.has(match.entryId),
  );

  const alreadyPresent =
    matches.length - addable.length;

  if (!addable.length) {
    return {
      status: 'ALREADY_PRESENT',
      intent,
      collectionId: target.collection.collectionId,
      collectionName: target.collection.name,
      matches,
      addable: [],
      alreadyPresent,
    };
  }

  return {
    status: 'READY',
    intent,
    collectionId: target.collection.collectionId,
    collectionName: target.collection.name,
    matches,
    addable,
    alreadyPresent,
  };
}

export async function executeBulkCollectionAdd(
  preview: Extract<
    BulkCollectionPreview,
    { status: 'READY' }
  >,
) {
  if (
    !preview.addable.length ||
    preview.addable.length > MAX_BULK_ITEMS
  ) {
    throw new Error(
      'Bulk preview is no longer safe to execute.',
    );
  }

  // Revalidate membership at confirmation time.
  const latest = await collectionApi.getById(
    preview.collectionId,
  );

  const existing = new Set(
    latest.items
      .filter((item) => item.entityType === 'ENTRY')
      .map((item) => item.entityId),
  );

  const pending = preview.addable.filter(
    (match) => !existing.has(match.entryId),
  );

  if (!pending.length) {
    invalidateContextSpine();
    return {
      added: 0,
      skipped: preview.addable.length,
    };
  }

  const addedItemIds: string[] = [];

  try {
    for (const match of pending) {
      const item = await collectionApi.addItem(
        preview.collectionId,
        'ENTRY',
        match.entryId,
      );

      addedItemIds.push(item.itemId);
    }
  } catch (caught) {
    // Best-effort transactional rollback of only the items this action added.
    for (const itemId of addedItemIds.reverse()) {
      await collectionApi
        .removeItem(
          preview.collectionId,
          itemId,
        )
        .catch(() => undefined);
    }

    invalidateContextSpine();
    throw caught;
  }

  invalidateContextSpine();

  return {
    added: pending.length,
    skipped:
      preview.addable.length - pending.length,
  };
}

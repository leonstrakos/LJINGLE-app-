// ljingleBrainRelationalCurrentContextR2:relational
//
// Read-only relational retrieval for Jingle Brain.
// EN + HR are first-class query languages.
// This module never mutates archive data.

import {
  loadContextSpine,
  type ContextSignal,
} from './contextSpine';
import {
  semanticSearch,
} from './semanticIndex';
import type {
  SemanticEntityType,
} from './semanticTypes';

export type RelationalArchiveCandidate = {
  key: string;
  kind:
    | SemanticEntityType
    | 'COLLECTION';
  title: string;
  sourceText: string;
};

export type RelationalArchivePlan = {
  mode:
    | 'RELATIONAL'
    | 'CURRENT';
  baseQuery: string;
  relationQuery: string | null;
  excludeCollectionQuery:
    | string
    | null;
  entityTypes?:
    SemanticEntityType[];
};

export type RelationalArchiveMatch = {
  key: string;
  score: number;
  reasons: string[];
};

function compact(value: unknown) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function norm(value: unknown) {
  return compact(value)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .toLocaleLowerCase()
    .replace(
      /[^\p{L}\p{N}]+/gu,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function words(value: unknown) {
  return norm(value)
    .split(/\s+/)
    .filter(
      (word) =>
        word.length >= 2,
    );
}

function textScore(
  query: string,
  value: string,
) {
  const q = norm(query);
  const text = norm(value);

  if (!q || !text) return 0;

  if (q === text) return 1;
  if (text.includes(q)) {
    return 0.92;
  }

  const terms = words(q);

  if (!terms.length) return 0;

  const hits =
    terms.filter(
      (term) =>
        text.includes(term),
    ).length;

  return hits
    ? Math.min(
        0.82,
        0.28 +
          (
            hits /
            terms.length
          ) *
            0.54,
      )
    : 0;
}

function typeHint(
  value: string,
):
  | SemanticEntityType[]
  | undefined {
  const clean = norm(value);

  if (
    /\b(note|notes|entry|entries|zapis|zapisi|biljeska|biljeske|bilješka|bilješke)\b/u.test(
      clean,
    )
  ) {
    return ['ENTRY'];
  }

  if (
    /\b(book|books|knjiga|knjige)\b/u.test(
      clean,
    )
  ) {
    return ['BOOK'];
  }

  if (
    /\b(movie|movies|film|filmovi|series|serija|serije|show|shows)\b/u.test(
      clean,
    )
  ) {
    return ['MEDIA'];
  }

  if (
    /\b(game|games|igra|igre)\b/u.test(
      clean,
    )
  ) {
    return ['GAME'];
  }

  if (
    /\b(topic|topics|tema|teme)\b/u.test(
      clean,
    )
  ) {
    return ['TOPIC'];
  }

  if (
    /\b(song|songs|track|tracks|music|pjesma|pjesme|glazba|muzika|frequency|frekvencija)\b/u.test(
      clean,
    )
  ) {
    return ['FREQUENCY'];
  }

  return undefined;
}

function stripTypeWords(
  value: string,
) {
  return compact(value)
    .replace(
      /\b(?:note|notes|entry|entries|zapis|zapisi|biljeska|biljeske|bilješka|bilješke|book|books|knjiga|knjige|movie|movies|film|filmovi|series|serija|serije|show|shows|game|games|igra|igre|topic|topics|tema|teme|song|songs|track|tracks|music|pjesma|pjesme|glazba|muzika|frequency|frekvencija)\b/giu,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

const CURRENT_PATTERNS = [
  /^(?:what\s+else\s+(?:do\s+i\s+have|is\s+there)\s+(?:about|related\s+to)\s+this|show(?:\s+me)?\s+(?:what(?:'s|\s+is)\s+)?related\s+to\s+this|show(?:\s+me)?\s+(?:related|connected)\s+(?:things|stuff|notes|entries)?\s*(?:to|about)?\s*this|notes?\s+(?:related|connected)\s+to\s+this)$/iu,
  /^(?:sto|što|sta|šta)\s+jos\s+imam\s+(?:o|vezano\s+za)\s+(?:ovome|ovo)|^(?:pokazi|pokaži)(?:\s+mi)?\s+(?:sto|što|sta|šta)\s+je\s+povezano\s+s\s+ovim|^(?:pokazi|pokaži)(?:\s+mi)?\s+povezano\s+s\s+ovim|^(?:povezani|vezani)\s+(?:zapisi|tragovi)\s+(?:s\s+ovim)?$/iu,
];

function currentIntent(
  value: string,
) {
  const clean = compact(value);

  return CURRENT_PATTERNS.some(
    (pattern) =>
      pattern.test(clean),
  );
}

function takeExcludeCollection(
  input: string,
) {
  const patterns = [
    /\s+(?:but\s+)?not\s+in\s+(?:my\s+)?(.+?)(?:\s+(?:memory\s+box|box|collection))?\s*$/iu,
    /\s+(?:ali\s+)?(?:ne\s+u|koji\s+nisu\s+u|koje\s+nisu\s+u|nisu\s+u)\s+(.+?)(?:\s+(?:memory\s+boxu|boxu|kolekciji))?\s*$/iu,
  ];

  for (const pattern of patterns) {
    const match =
      input.match(pattern);

    if (!match) continue;

    return {
      value:
        compact(
          match[1],
        ),
      rest:
        compact(
          input.slice(
            0,
            match.index,
          ),
        ),
    };
  }

  return {
    value: null,
    rest: input,
  };
}

function takeRelation(
  input: string,
) {
  const patterns = [
    /\b(?:connected|related|linked)\s+(?:to|with)\s+(.+)$/iu,
    /\b(?:from|out\s+of)\s+(?:the\s+)?(?:book|books)\s+(?:about|on)\s+(.+)$/iu,
    /\b(?:povezan|povezana|povezani|povezane|vezan|vezana|vezani|vezane)\s+(?:s|sa|uz)\s+(.+)$/iu,
    /\b(?:iz|iz\s+knjige|iz\s+knjiga)\s+(?:o|vezano\s+za)\s+(.+)$/iu,
  ];

  for (const pattern of patterns) {
    const match =
      input.match(pattern);

    if (!match) continue;

    return {
      value:
        compact(
          match[1],
        ),
      rest:
        compact(
          input.slice(
            0,
            match.index,
          ),
        ),
    };
  }

  return null;
}

function stripSearchScaffolding(
  value: string,
) {
  return compact(value)
    .replace(
      /^(?:please\s+)?(?:find|show(?:\s+me)?|search(?:\s+for)?|locate|where\s+(?:is|are)|pronadi|pronađi|nadi|nađi|trazi|traži|pokazi|pokaži)(?:\s+mi)?\s+/iu,
      '',
    )
    .replace(
      /\b(?:that|which|koji|koje)\b/giu,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseRelationalArchiveQuery(
  value: string,
): RelationalArchivePlan | null {
  const raw = compact(value);

  if (
    !raw ||
    raw.startsWith(':') ||
    raw.startsWith('?')
  ) {
    return null;
  }

  if (currentIntent(raw)) {
    return {
      mode: 'CURRENT',
      baseQuery: '',
      relationQuery: null,
      excludeCollectionQuery:
        null,
      entityTypes:
        typeHint(raw),
    };
  }

  const excluded =
    takeExcludeCollection(raw);

  const relation =
    takeRelation(
      excluded.rest,
    );

  if (!relation?.value) {
    return null;
  }

  let baseQuery =
    stripSearchScaffolding(
      relation.rest,
    );

  const entityTypes =
    typeHint(baseQuery);

  baseQuery =
    stripTypeWords(baseQuery)
      .replace(
        /^(?:about|regarding|o|vezano\s+za)\s+/iu,
        '',
      )
      .trim();

  return {
    mode: 'RELATIONAL',
    baseQuery,
    relationQuery:
      relation.value,
    excludeCollectionQuery:
      excluded.value,
    entityTypes,
  };
}

export function currentArchiveKeyFromRoute(
  routeValue: unknown,
) {
  const route =
    routeValue as {
      name?: unknown;
      params?: Record<
        string,
        unknown
      >;
    } | null;

  const name =
    String(route?.name ?? '');

  const params =
    route?.params ?? {};

  const id = (
    key: string,
  ) =>
    compact(
      params[key],
    );

  switch (name) {
    case 'BookDetails':
      return id('bookId')
        ? 'BOOK:' +
            id('bookId')
        : null;

    case 'MediaDetails':
      return id('mediaId')
        ? 'MEDIA:' +
            id('mediaId')
        : null;

    case 'GameDetails':
      return id('gameId')
        ? 'GAME:' +
            id('gameId')
        : null;

    case 'TopicDetails':
      return id('topicId')
        ? 'TOPIC:' +
            id('topicId')
        : null;

    case 'EntryForm':
      return id('entryId')
        ? 'ENTRY:' +
            id('entryId')
        : null;

    case 'Entries':
      return id('focusEntryId')
        ? 'ENTRY:' +
            id(
              'focusEntryId',
            )
        : null;

    case 'CollectionDetails':
      return id('collectionId')
        ? 'COLLECTION:' +
            id(
              'collectionId',
            )
        : null;

    default:
      return null;
  }
}

function addReason(
  output: string[],
  value: string,
) {
  if (
    value &&
    !output.includes(value)
  ) {
    output.push(value);
  }
}

function collectionExcluded(
  signal: ContextSignal | null,
  query: string | null,
) {
  if (!signal || !query) {
    return false;
  }

  return signal.collections.some(
    (name) =>
      textScore(
        query,
        name,
      ) >= 0.72,
  );
}

export async function resolveRelationalArchiveQuery(
  plan: RelationalArchivePlan,
  candidates:
    RelationalArchiveCandidate[],
  currentKey:
    string | null,
): Promise<
  RelationalArchiveMatch[]
> {
  const signals =
    await loadContextSpine();

  const byKey =
    new Map(
      candidates.map(
        (candidate) => [
          candidate.key,
          candidate,
        ],
      ),
    );

  const scoreMap =
    new Map<
      string,
      {
        score: number;
        reasons: string[];
      }
    >();

  const add = (
    key: string,
    score: number,
    reason: string,
  ) => {
    if (!byKey.has(key)) {
      return;
    }

    const existing =
      scoreMap.get(key) ?? {
        score: 0,
        reasons: [],
      };

    existing.score =
      Math.max(
        existing.score,
        score,
      );

    addReason(
      existing.reasons,
      reason,
    );

    scoreMap.set(
      key,
      existing,
    );
  };

  if (
    plan.mode === 'CURRENT'
  ) {
    if (!currentKey) {
      return [];
    }

    const currentSignal =
      signals.get(currentKey) ??
      null;

    for (
      const linkedKey of
      currentSignal?.linkedKeys ??
      []
    ) {
      add(
        linkedKey,
        0.99,
        'Trenutni kontekst · Current context',
      );
    }

    for (
      const signal of
      signals.values()
    ) {
      if (
        signal.linkedKeys.includes(
          currentKey,
        )
      ) {
        add(
          signal.key,
          0.97,
          'Povezano s trenutnom stavkom · Related to current item',
        );
      }
    }

    const current =
      byKey.get(currentKey);

    if (
      current &&
      currentSignal
    ) {
      for (
        const candidate of
        candidates
      ) {
        if (
          candidate.key ===
          currentKey
        ) {
          continue;
        }

        for (
          const topic of
          currentSignal.relatedTopics
        ) {
          if (
            textScore(
              topic,
              candidate.title,
            ) >= 0.82
          ) {
            add(
              candidate.key,
              0.91,
              'Tema trenutne stavke · Current item topic',
            );
          }
        }

        for (
          const book of
          currentSignal.relatedBooks
        ) {
          if (
            textScore(
              book,
              candidate.title,
            ) >= 0.72
          ) {
            add(
              candidate.key,
              0.93,
              'Izvor trenutne stavke · Current item source',
            );
          }
        }

        for (
          const collection of
          currentSignal.collections
        ) {
          if (
            candidate.kind ===
              'COLLECTION' &&
            textScore(
              collection,
              candidate.title,
            ) >= 0.82
          ) {
            add(
              candidate.key,
              0.9,
              'Isti Memory Box · Same Memory Box',
            );
          }
        }
      }
    }
  } else {
    const relationQuery =
      plan.relationQuery ?? '';

    // First resolve the named relation source itself.
    const relationSources =
      candidates
        .map(
          (candidate) => ({
            candidate,
            score:
              Math.max(
                textScore(
                  relationQuery,
                  candidate.title,
                ),
                textScore(
                  relationQuery,
                  candidate.sourceText,
                ) *
                  0.7,
              ),
          }),
        )
        .filter(
          (row) =>
            row.score >= 0.66,
        )
        .sort(
          (left, right) =>
            right.score -
            left.score,
        )
        .slice(0, 4);

    for (
      const source of
      relationSources
    ) {
      const sourceSignal =
        signals.get(
          source.candidate.key,
        );

      for (
        const linkedKey of
        sourceSignal?.linkedKeys ??
        []
      ) {
        add(
          linkedKey,
          Math.min(
            0.99,
            0.76 +
              source.score *
                0.2,
          ),
          'Povezano s “' +
            source.candidate.title +
            '” · Related to “' +
            source.candidate.title +
            '”',
        );
      }

      for (
        const signal of
        signals.values()
      ) {
        if (
          signal.linkedKeys.includes(
            source.candidate.key,
          )
        ) {
          add(
            signal.key,
            Math.min(
              0.98,
              0.74 +
                source.score *
                  0.2,
            ),
            'Povezano s “' +
              source.candidate.title +
              '” · Related to “' +
              source.candidate.title +
              '”',
          );
        }
      }
    }

    // Context labels catch intrinsic Book/Topic/Reader relationships
    // even when no explicit entity_link exists.
    for (
      const signal of
      signals.values()
    ) {
      for (
        const topic of
        signal.relatedTopics
      ) {
        const value =
          textScore(
            relationQuery,
            topic,
          );

        if (value >= 0.62) {
          add(
            signal.key,
            0.72 +
              value * 0.2,
            'Povezano s temom “' +
              topic +
              '” · Related to topic “' +
              topic +
              '”',
          );
        }
      }

      for (
        const book of
        signal.relatedBooks
      ) {
        const value =
          textScore(
            relationQuery,
            book,
          );

        if (value >= 0.58) {
          add(
            signal.key,
            0.75 +
              value * 0.2,
            'Povezano s knjigom “' +
              book +
              '” · Related to book “' +
              book +
              '”',
          );
        }
      }

      for (
        const source of
        signal.readerSources
      ) {
        const value =
          textScore(
            relationQuery,
            source,
          );

        if (value >= 0.58) {
          add(
            signal.key,
            0.8 +
              value * 0.18,
            'Iz čitanja “' +
              source +
              '” · From reading “' +
              source +
              '”',
          );
        }
      }
    }
  }

  // Text/semantic constraint for compound relational queries,
  // e.g. "dream notes connected to Jung".
  if (plan.baseQuery) {
    const semanticTypes =
      plan.entityTypes;

    const semantic =
      await semanticSearch(
        plan.baseQuery,
        {
          limit: 24,
          entityTypes:
            semanticTypes,
          minimumScore:
            0.1,
        },
      ).catch(
        () => [],
      );

    const semanticByKey =
      new Map(
        semantic.map(
          (item) => [
            item.key,
            item.score,
          ],
        ),
      );

    for (
      const [
        key,
        evidence,
      ] of scoreMap
    ) {
      const candidate =
        byKey.get(key);

      if (!candidate) {
        scoreMap.delete(key);
        continue;
      }

      const lexical =
        textScore(
          plan.baseQuery,
          candidate.sourceText,
        );

      const semanticScore =
        semanticByKey.get(key) ??
        0;

      const textEvidence =
        Math.max(
          lexical,
          semanticScore,
        );

      if (
        textEvidence < 0.12
      ) {
        scoreMap.delete(key);
        continue;
      }

      evidence.score =
        Math.min(
          1,
          evidence.score *
            0.72 +
            textEvidence *
              0.28,
        );

      if (
        semanticScore >
          lexical &&
        semanticScore >= 0.18
      ) {
        addReason(
          evidence.reasons,
          'Semantičko podudaranje · Semantic match',
        );
      }
    }
  }

  const allowedKinds =
    plan.entityTypes
      ? new Set(
          plan.entityTypes,
        )
      : null;

  const output:
    RelationalArchiveMatch[] =
      [];

  for (
    const [
      key,
      evidence,
    ] of scoreMap
  ) {
    const candidate =
      byKey.get(key);

    if (!candidate) continue;

    if (
      allowedKinds &&
      candidate.kind !==
        'COLLECTION' &&
      !allowedKinds.has(
        candidate.kind as SemanticEntityType,
      )
    ) {
      continue;
    }

    if (
      candidate.kind ===
        'COLLECTION' &&
      allowedKinds
    ) {
      continue;
    }

    const signal =
      signals.get(key) ??
      null;

    if (
      collectionExcluded(
        signal,
        plan.excludeCollectionQuery,
      )
    ) {
      continue;
    }

    if (
      plan.excludeCollectionQuery &&
      candidate.kind ===
        'COLLECTION' &&
      textScore(
        plan.excludeCollectionQuery,
        candidate.title,
      ) >= 0.72
    ) {
      continue;
    }

    output.push({
      key,
      score:
        evidence.score,
      reasons:
        evidence.reasons.slice(
          0,
          3,
        ),
    });
  }

  return output
    .sort(
      (left, right) =>
        right.score -
        left.score,
    )
    .slice(0, 24);
}

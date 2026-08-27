// k15ReferentialUpdatesPostSessionV1

import {
  collapseSpokenRepeats,
  fuzzyWord,
  normalizeLoose,
} from './deterministicLanguage';

export type EntityKindHint =
  | 'BOOK'
  | 'MEDIA'
  | 'GAME'
  | 'TOPIC'
  | 'ENTRY'
  | 'FREQUENCY';

export type EntityPhrase = {
  query: string;
  kindHint: EntityKindHint | null;
  display: string;
};

export type DeterministicMutationCommand =
  | {
      kind: 'UPDATE_BOOK_PAGE';
      subject: EntityPhrase;
      page: number;
    }
  | {
      kind: 'ADD_TO_COLLECTION';
      subject: EntityPhrase;
      collectionQuery: string;
      createCollectionIfMissing: true;
    }
  | {
      kind: 'ADD_TO_TOPIC';
      subject: EntityPhrase;
      topicQuery: string;
      createTopicIfMissing: true;
    }
  | {
      kind: 'CREATE_NOTE_TO_COLLECTION';
      content: string;
      collectionQuery: string;
      createCollectionIfMissing: true;
    }
  | {
      kind: 'CREATE_NOTE_TO_TOPIC';
      content: string;
      topicQuery: string;
      createTopicIfMissing: true;
    }
  | {
      kind: 'LINK';
      source: EntityPhrase;
      target: EntityPhrase;
      createTargetIfMissing: boolean;
    };

const UPDATE = [
  'update',
  'set',
  'postavi',
  'azuriraj',
  'ažuriraj',
  'promijeni',
  'promeni',
] as const;

const ADD = [
  'add',
  'put',
  'move',
  'dodaj',
  'stavi',
  'ubaci',
] as const;

const LINK = [
  'link',
  'linkaj',
  'connect',
  'povezi',
  'poveži',
] as const;

const BOOK = [
  'book',
  'knjiga',
  'knjigu',
  'knjige',
] as const;

const MEDIA = [
  'media',
  'movie',
  'film',
  'filma',
  'series',
  'serija',
  'seriju',
  'show',
  'tv',
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

const ENTRY = [
  'note',
  'entry',
  'zapis',
  'biljeska',
  'bilješka',
  'biljesku',
  'bilješku',
] as const;

const FREQUENCY = [
  'frequency',
  'track',
  'song',
  'audio',
  'frekvencija',
  'pjesma',
  'pesma',
] as const;

const PAGE =
  /(?:str(?:anica)?|page|pg|p)\.?/i;

function cleanQuoted(value: string) {
  return collapseSpokenRepeats(value)
    .trim()
    .replace(/^["“]|["”]$/g, '')
    .trim();
}

function firstAndRest(value: string) {
  const clean = cleanQuoted(value);
  const match = clean.match(/^(\S+)(?:\s+([\s\S]+))?$/);

  return {
    first: match?.[1] ?? '',
    rest: (match?.[2] ?? '').trim(),
  };
}

function recencyPhrase(
  value: string,
): EntityPhrase | null {
  const clean = normalizeLoose(value);

  if (
    /^(?:this|that|it|ovo|to|taj|ta|ono)$/.test(clean)
  ) {
    return {
      query: 'latest recent',
      kindHint: null,
      display: 'zadnje',
    };
  }

  if (
    /^(?:recent|last|latest|zadnje|zadnji|zadnja|posljednje|poslednje)$/.test(
      clean,
    )
  ) {
    return {
      query: 'latest recent',
      kindHint: null,
      display: 'zadnje',
    };
  }

  if (
    /\b(?:zadnje|zadnji|zadnja|last|latest|recent)\b/.test(clean) &&
    /\b(?:gledano|gledao|watched|movie|film|serija|series)\b/.test(clean)
  ) {
    return {
      query: 'latest watched',
      kindHint: 'MEDIA',
      display: 'zadnje gledano',
    };
  }

  if (
    /\b(?:zadnje|zadnji|zadnja|last|latest|recent)\b/.test(clean) &&
    /\b(?:citano|procitano|read|knjiga|knjigu|book)\b/.test(clean)
  ) {
    return {
      query:
        /\b(?:citano|procitano|read)\b/.test(clean)
          ? 'latest read'
          : 'latest recent',
      kindHint: 'BOOK',
      display: 'zadnja knjiga',
    };
  }

  if (
    /\b(?:zadnje|zadnji|zadnja|last|latest|recent)\b/.test(clean) &&
    /\b(?:igrano|played|game|igra)\b/.test(clean)
  ) {
    return {
      query: 'latest played',
      kindHint: 'GAME',
      display: 'zadnje igrano',
    };
  }

  if (
    /\b(?:zadnje|zadnji|zadnja|last|latest|recent)\b/.test(clean) &&
    /\b(?:stvoreno|dodano|created|added|uneseno|upisano)\b/.test(clean)
  ) {
    return {
      query: 'latest created',
      kindHint: null,
      display: 'zadnje stvoreno',
    };
  }

  return null;
}

export function parseEntityPhrase(
  value: string,
): EntityPhrase {
  const raw = cleanQuoted(value);
  const recent = recencyPhrase(raw);

  if (recent) return recent;

  if (raw.startsWith('@')) {
    const query = cleanQuoted(raw.slice(1));
    return {
      query,
      kindHint: 'TOPIC',
      display: '@' + query,
    };
  }

  const { first, rest } =
    firstAndRest(raw);

  if (rest && fuzzyWord(first, BOOK)) {
    return {
      query: rest,
      kindHint: 'BOOK',
      display: rest,
    };
  }

  if (rest && fuzzyWord(first, MEDIA)) {
    return {
      query: rest,
      kindHint: 'MEDIA',
      display: rest,
    };
  }

  if (rest && fuzzyWord(first, GAME)) {
    return {
      query: rest,
      kindHint: 'GAME',
      display: rest,
    };
  }

  if (rest && fuzzyWord(first, TOPIC)) {
    return {
      query: rest,
      kindHint: 'TOPIC',
      display: rest,
    };
  }

  if (rest && fuzzyWord(first, ENTRY)) {
    return {
      query: rest,
      kindHint: 'ENTRY',
      display: rest,
    };
  }

  if (rest && fuzzyWord(first, FREQUENCY)) {
    return {
      query: rest,
      kindHint: 'FREQUENCY',
      display: rest,
    };
  }

  return {
    query:
      raw || 'latest recent',
    kindHint: null,
    display:
      raw || 'zadnje',
  };
}

export function isImplicitEntityPhrase(
  phrase: EntityPhrase,
) {
  return /^latest\s/.test(
    normalizeLoose(phrase.query),
  );
}

function noteContent(
  value: string,
): string | null {
  const { first, rest } =
    firstAndRest(value);

  if (
    rest &&
    fuzzyWord(first, ENTRY)
  ) {
    return rest;
  }

  return null;
}

function pageValue(raw: string) {
  const page = Number(raw);
  return (
    Number.isInteger(page) &&
    page >= 1 &&
    page <= 100000
  )
    ? page
    : null;
}

function firstWord(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)[0] ?? ''
  );
}

function afterFirstWord(value: string) {
  return value
    .trim()
    .replace(/^\S+\s*/, '')
    .trim();
}

export function parseDeterministicMutationCommand(
  value: string,
): DeterministicMutationCommand | null {
  const clean =
    collapseSpokenRepeats(value)
      .trim()
      .replace(/\s+/g, ' ');

  if (
    !clean ||
    clean.startsWith('?') ||
    clean.startsWith(':')
  ) {
    return null;
  }

  // "str 44" / "page 44"
  const directPage =
    clean.match(
      new RegExp(
        '^' +
          PAGE.source +
          '\\s*#?\\s*(\\d{1,6})$',
        'i',
      ),
    );

  if (directPage) {
    const page =
      pageValue(directPage[1] ?? '');

    return page
      ? {
          kind: 'UPDATE_BOOK_PAGE',
          subject: {
            query: 'latest recent',
            kindHint: 'BOOK',
            display: 'zadnja knjiga',
          },
          page,
        }
      : null;
  }

  // "update dune na str 44"
  // "dune str 44"
  // "zadnja knjiga str 44"
  const namedPage =
    clean.match(
      new RegExp(
        '^(?:(?:update|set|postavi|azuriraj|ažuriraj|promijeni|promeni)\\s+)?' +
          '(.+?)\\s+(?:na\\s+|to\\s+)?' +
          PAGE.source +
          '\\s*#?\\s*(\\d{1,6})$',
        'i',
      ),
    );

  if (namedPage) {
    const page =
      pageValue(namedPage[2] ?? '');

    const subjectText =
      cleanQuoted(
        namedPage[1] ?? '',
      );

    if (page && subjectText) {
      const subject =
        parseEntityPhrase(subjectText);

      return {
        kind: 'UPDATE_BOOK_PAGE',
        subject: {
          ...subject,
          kindHint: 'BOOK',
        },
        page,
      };
    }
  }

  const first =
    firstWord(clean);

  // ADD / PUT / STAVI / DODAJ.
  if (fuzzyWord(first, ADD)) {
    const body =
      afterFirstWord(clean);

    const destination =
      body.match(
        /^([\s\S]*?)(?:\s+(?:u|in|into|to))?\s*([#@])\s*(?:"([^"]+)"|(.+))$/i,
      );

    if (destination) {
      const subjectText =
        cleanQuoted(
          destination[1] ?? '',
        );

      const sigil =
        destination[2];

      const destinationQuery =
        cleanQuoted(
          destination[3] ??
            destination[4] ??
            '',
        );

      if (!destinationQuery) {
        return null;
      }

      const content =
        noteContent(subjectText);

      if (content) {
        return sigil === '#'
          ? {
              kind:
                'CREATE_NOTE_TO_COLLECTION',
              content,
              collectionQuery:
                destinationQuery,
              createCollectionIfMissing: true,
            }
          : {
              kind:
                'CREATE_NOTE_TO_TOPIC',
              content,
              topicQuery:
                destinationQuery,
              createTopicIfMissing: true,
            };
      }

      const subject =
        parseEntityPhrase(
          subjectText ||
            'latest recent',
        );

      return sigil === '#'
        ? {
            kind:
              'ADD_TO_COLLECTION',
            subject,
            collectionQuery:
              destinationQuery,
            createCollectionIfMissing: true,
          }
        : {
            kind:
              'ADD_TO_TOPIC',
            subject,
            topicQuery:
              destinationQuery,
            createTopicIfMissing: true,
          };
    }
  }

  // LINK / POVEZI.
  if (fuzzyWord(first, LINK)) {
    const body =
      afterFirstWord(clean);

    // A # target is collection membership even when the user says "link".
    const sigilTarget =
      body.match(
        /^(.+?)(?:\s+(?:s|sa|with|to|and|i))?\s*([#@])\s*(?:"([^"]+)"|(.+))$/i,
      );

    if (sigilTarget) {
      const source =
        parseEntityPhrase(
          sigilTarget[1] ?? '',
        );

      const sigil =
        sigilTarget[2];

      const targetQuery =
        cleanQuoted(
          sigilTarget[3] ??
            sigilTarget[4] ??
            '',
        );

      if (!targetQuery) {
        return null;
      }

      if (sigil === '#') {
        return {
          kind:
            'ADD_TO_COLLECTION',
          subject: source,
          collectionQuery:
            targetQuery,
          createCollectionIfMissing: true,
        };
      }

      return {
        kind: 'LINK',
        source,
        target: {
          query: targetQuery,
          kindHint: 'TOPIC',
          display:
            '@' + targetQuery,
        },
        createTargetIfMissing: true,
      };
    }

    const normalLink =
      body.match(
        /^(.+?)\s+(?:s|sa|with|to|and|i)\s+(.+)$/i,
      );

    if (normalLink) {
      const source =
        parseEntityPhrase(
          normalLink[1] ?? '',
        );

      const target =
        parseEntityPhrase(
          normalLink[2] ?? '',
        );

      if (
        source.query &&
        target.query
      ) {
        return {
          kind: 'LINK',
          source,
          target,
          createTargetIfMissing:
            false,
        };
      }
    }
  }

  return null;
}

export function mutationSourcePhrase(
  command:
    DeterministicMutationCommand | null,
): EntityPhrase | null {
  if (!command) return null;

  if (
    command.kind ===
      'UPDATE_BOOK_PAGE' ||
    command.kind ===
      'ADD_TO_COLLECTION' ||
    command.kind ===
      'ADD_TO_TOPIC'
  ) {
    return command.subject;
  }

  if (
    command.kind === 'LINK'
  ) {
    return command.source;
  }

  return null;
}

export function mutationTargetPhrase(
  command:
    DeterministicMutationCommand | null,
): EntityPhrase | null {
  return command?.kind === 'LINK'
    ? command.target
    : null;
}

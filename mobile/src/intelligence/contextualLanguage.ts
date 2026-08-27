// forkK7ContextualVerbsV1

import type { QuietActiveContext } from './activeContext';

export type ContextualVerbIntent =
  | { kind: 'OPEN_CURRENT' }
  | { kind: 'OPEN_CURRENT_BOOK' }
  | { kind: 'NOTE_ACTIVE'; note: string }
  | { kind: 'ADD_CURRENT_TO_COLLECTION'; collectionQuery: string }
  | { kind: 'LINK_CURRENT_ENTITY'; query: string }
  | { kind: 'START_READING'; query: string };

export type ContextEntityLike = {
  key: string;
  kind: 'BOOK' | 'MEDIA' | 'GAME' | 'TOPIC' | 'ENTRY' | 'FREQUENCY';
  id: string;
};

function cleanTail(value: string | undefined) {
  return (value ?? '').trim().replace(/[.!?]+$/g, '').trim();
}

export function parseContextualVerbIntent(value: string): ContextualVerbIntent | null {
  const clean = value.trim();
  if (!clean || clean.startsWith(':')) return null;

  if (
    /^(?:opens+(?:this|it)|otvoris+(?:ovo|ga|je))$/i.test(clean)
  ) {
    return { kind: 'OPEN_CURRENT' };
  }

  if (
    /^(?:opens+(?:(?:the|my)s+)?(?:currents+)?books+(?:i(?:'m| am)s+reading|ims+reading)|opens+(?:mys+)?currents+book|otvoris+(?:trenutnus+)?knjigus+kojus+[cč]itam|otvoris+trenutnus+knjigu)$/i.test(clean)
  ) {
    return { kind: 'OPEN_CURRENT_BOOK' };
  }

  const notePatterns = [
    /^(?:note|remember)(?:s+that)?s+(.+)$/i,
    /^(?:zapi[sš]i|zapamti)(?:s+da)?s+(.+)$/i,
  ];

  for (const pattern of notePatterns) {
    const match = clean.match(pattern);
    const note = cleanTail(match?.[1]);
    if (note) return { kind: 'NOTE_ACTIVE', note };
  }

  const collectionPatterns = [
    /^(?:put|add)s+(?:this|it)s+(?:in|into|to)s+(.+)$/i,
    /^(?:stavi|dodaj)s+(?:ovo|ga|je)s+us+(.+)$/i,
  ];

  for (const pattern of collectionPatterns) {
    const match = clean.match(pattern);
    const collectionQuery = cleanTail(match?.[1]);
    if (collectionQuery) {
      return { kind: 'ADD_CURRENT_TO_COLLECTION', collectionQuery };
    }
  }

  const directLinkPatterns = [
    /^(?:link|connect)s+(?:it)s+tos+(.+)$/i,
    /^pove[zž]is+(?:ga|je)s+(?:s|sa)s+(.+)$/i,
  ];

  for (const pattern of directLinkPatterns) {
    const match = clean.match(pattern);
    const query = cleanTail(match?.[1]);
    if (query) return { kind: 'LINK_CURRENT_ENTITY', query };
  }

  const readPatterns = [
    /^(?:starts+reading|read)s+(.+)$/i,
    /^(?:po[cč]ni|kreni)s+[cč]itatis+(.+)$/i,
  ];

  for (const pattern of readPatterns) {
    const match = clean.match(pattern);
    const query = cleanTail(match?.[1]);
    if (query) return { kind: 'START_READING', query };
  }

  return null;
}

export function activeEntityKey(context: QuietActiveContext | null): string | null {
  if (!context?.singleTimer?.activeSessionId) return null;

  // A concrete item attached directly to the activity wins over its semantic
  // Topic lens. Reading Dune inside a Topic is still "this = Dune".
  if (context.singleTimer.bookId) {
    return 'BOOK:' + context.singleTimer.bookId;
  }

  const concreteSessionKeys = new Set<string>();
  for (const item of context.sessionContexts) {
    if (item.entityType === 'TOPIC') continue;
    concreteSessionKeys.add(item.entityType + ':' + item.entityId);
  }

  if (concreteSessionKeys.size === 1) {
    return [...concreteSessionKeys][0] ?? null;
  }

  if (concreteSessionKeys.size > 1) return null;

  const topicKeys = new Set<string>();
  if (context.singleTimer.topicId) {
    topicKeys.add('TOPIC:' + context.singleTimer.topicId);
  }
  for (const item of context.sessionContexts) {
    if (item.entityType === 'TOPIC') {
      topicKeys.add('TOPIC:' + item.entityId);
    }
  }

  return topicKeys.size === 1 ? [...topicKeys][0] ?? null : null;
}

export function activeBookKey(context: QuietActiveContext | null): string | null {
  const id = context?.bookContext?.bookId;
  return id ? 'BOOK:' + id : null;
}

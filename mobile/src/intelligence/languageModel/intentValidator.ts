// forkK9LocalLanguageBrainV1
// forkK10ReferentialResolutionV1

import type { LJingleIntent } from '../intentRouter';
import type { LocalLanguageContext, RawModelIntent } from './types';

const ACTIONS = new Set([
  'UNKNOWN',
  'OPEN',
  'UPDATE_PAGE',
  'NOTE',
  'STOP',
  'LINK',
  'ADD_TO_COLLECTION',
  'START_READING',
  'SEARCH',
]);

const TARGETS = new Set([
  'NONE',
  'CURRENT',
  'CURRENT_BOOK',
  'ACTIVE_SESSION',
  'ACTIVE_TIMER',
  'CURRENT_ENTITY',
  'BOOK',
]);

function clean(value: unknown, maximum = 240) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, maximum)
    : '';
}

export function parseRawModelIntent(value: unknown): RawModelIntent | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const action = clean(item.action, 40);
  const target = clean(item.target, 40);
  if (!ACTIONS.has(action) || !TARGETS.has(target)) return null;

  const numeric = typeof item.value === 'number' && Number.isFinite(item.value)
    ? Math.trunc(item.value)
    : 0;

  return {
    action: action as RawModelIntent['action'],
    target: target as RawModelIntent['target'],
    query: clean(item.query),
    subjectQuery: clean(item.subjectQuery),
    content: clean(item.content, 500),
    value: numeric,
  };
}

export function validateModelIntent(
  raw: RawModelIntent,
  original: string,
  context: LocalLanguageContext,
): LJingleIntent | null {
  const source = original.trim().replace(/\s+/g, ' ');
  if (!source || raw.action === 'UNKNOWN') return null;

  if (raw.action === 'OPEN') {
    if (raw.target === 'CURRENT' && context.currentEntity) {
      return { action: 'OPEN', target: 'CURRENT', original: source };
    }
    if (raw.target === 'CURRENT_BOOK' && context.currentBook) {
      return { action: 'OPEN', target: 'CURRENT_BOOK', original: source };
    }
    return null;
  }

  if (raw.action === 'UPDATE_PAGE') {
    if (
      raw.target === 'CURRENT_BOOK' &&
      context.currentBook &&
      Number.isInteger(raw.value) &&
      raw.value >= 1 &&
      raw.value <= 100000
    ) {
      return {
        action: 'UPDATE',
        target: 'CURRENT_BOOK',
        field: 'PAGE',
        value: raw.value,
        original: source,
      };
    }
    return null;
  }

  if (raw.action === 'NOTE') {
    if (raw.target !== 'ACTIVE_SESSION' || context.activeTimerCount !== 1) return null;
    const content = raw.content || source;
    return content
      ? { action: 'NOTE', target: 'ACTIVE_SESSION', content, original: source }
      : null;
  }

  if (raw.action === 'STOP') {
    return raw.target === 'ACTIVE_TIMER' && context.activeTimerCount === 1
      ? { action: 'STOP', target: 'ACTIVE_TIMER', original: source }
      : null;
  }

  if (raw.action === 'LINK') {
    const query = raw.query.trim();
    if (!query) return null;
    if (raw.target === 'CURRENT_ENTITY' && context.currentEntity) {
      return { action: 'LINK', target: 'CURRENT_ENTITY', query, original: source };
    }
    if (raw.target === 'ACTIVE_SESSION' && context.activeTimerCount === 1) {
      return { action: 'LINK', target: 'ACTIVE_SESSION', query, original: source };
    }
    return null;
  }

  if (raw.action === 'ADD_TO_COLLECTION') {
    const query = raw.query.trim();
    return raw.target === 'CURRENT_ENTITY' && (context.currentEntity || raw.subjectQuery.trim()) && query
      ? { action: 'ADD_TO_COLLECTION', target: 'CURRENT_ENTITY', query, original: source }
      : null;
  }

  if (raw.action === 'START_READING') {
    const query = raw.query.trim();
    return raw.target === 'BOOK' && query
      ? { action: 'START', target: 'BOOK', query, original: source }
      : null;
  }

  if (raw.action === 'SEARCH') {
    const explicitSearch = /^\s*(?:search(?:\s+for)?|find|look\s+for|show\s+me|traži|trazi|nađi|nadi|pronađi|pronadi)\b/i.test(source);
    if (!explicitSearch) return null;
    const query = raw.query.trim();
    return query ? { action: 'SEARCH', query, original: source } : null;
  }

  return null;
}

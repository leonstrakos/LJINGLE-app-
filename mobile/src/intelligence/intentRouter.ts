// forkK8IntentRouterV1

import type { QuietContextIntent } from './activeContext';
import type { ContextualVerbIntent } from './contextualLanguage';

/**
 * Canonical command language for LJingle intelligence.
 *
 * Today this file is fed by a deterministic typo-tolerant parser.
 * Later a small local LLM may emit the SAME shape. UI/executors therefore do
 * not need to know whether intent came from regex/fuzzy parsing or an LLM.
 */
export type LJingleIntent =
  | { action: 'OPEN'; target: 'CURRENT' | 'CURRENT_BOOK'; original: string }
  | { action: 'UPDATE'; target: 'CURRENT_BOOK'; field: 'PAGE'; value: number; original: string }
  | { action: 'NOTE'; target: 'ACTIVE_SESSION'; content: string; original: string }
  | { action: 'STOP'; target: 'ACTIVE_TIMER'; original: string }
  | { action: 'LINK'; target: 'CURRENT_ENTITY' | 'ACTIVE_SESSION'; query: string; original: string }
  | { action: 'ADD_TO_COLLECTION'; target: 'CURRENT_ENTITY'; query: string; original: string }
  | { action: 'START'; target: 'BOOK'; query: string; original: string }
  | { action: 'SEARCH'; query: string; original: string }
  | { action: 'CREATE'; entityType: string; query: string; original: string }
  | { action: 'NAVIGATE'; query: string; original: string };

type Word = {
  raw: string;
  normalized: string;
};

function ascii(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US');
}

function words(value: string): Word[] {
  return value
    .trim()
    .replace(/[“”]/g, '"')
    .split(/\s+/)
    .map((raw) => ({
      raw,
      normalized: ascii(raw).replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''),
    }))
    .filter((word) => word.normalized.length > 0);
}

function damerauLevenshtein(left: string, right: string) {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i]![0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0]![j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      let value = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );

      if (
        i > 1 &&
        j > 1 &&
        left[i - 1] === right[j - 2] &&
        left[i - 2] === right[j - 1]
      ) {
        value = Math.min(value, matrix[i - 2]![j - 2]! + 1);
      }

      matrix[i]![j] = value;
    }
  }

  return matrix[left.length]![right.length]!;
}

function typoBudget(value: string) {
  if (value.length <= 3) return 0;
  if (value.length <= 7) return 1;
  return 2;
}

function resembles(value: string, candidates: string[]) {
  if (!value) return false;
  for (const candidate of candidates) {
    if (value === candidate) return true;
    const budget = Math.min(typoBudget(value), typoBudget(candidate));
    if (budget > 0 && damerauLevenshtein(value, candidate) <= budget) return true;
  }
  return false;
}

function firstIndex(source: Word[], candidates: string[]) {
  return source.findIndex((word) => resembles(word.normalized, candidates));
}

function firstNumber(source: Word[]) {
  const numbers = source
    .map((word, index) => ({ index, value: /^\d{1,5}$/.test(word.normalized) ? Number(word.normalized) : null }))
    .filter((item): item is { index: number; value: number } => item.value !== null);
  return numbers.length === 1 ? numbers[0]! : null;
}

function tail(source: Word[], startExclusive: number) {
  return source
    .slice(startExclusive + 1)
    .map((word) => word.raw)
    .join(' ')
    .replace(/[.!?]+$/g, '')
    .trim();
}

function cleanOriginal(value: string) {
  return value.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/g, '').trim();
}

const FINISH = ['finish', 'finished', 'finishing', 'complete', 'completed', 'done', 'zavrsio', 'zavrsila', 'zavrseno', 'gotovo'];
const CHAPTER = ['chapter', 'chap', 'poglavlje', 'poglavlja'];
const PAGE = ['page', 'pg', 'stranica', 'stranici', 'stranu'];
const PAGE_PROGRESS = ['got', 'reached', 'reach', 'on', 'at', 'stigao', 'stigla', 'dosao', 'dosla', 'dosa', 'sam'];
const STOP = ['stop', 'stani', 'zaustavi'];
const OPEN = ['open', 'otvori'];
const CURRENT = ['this', 'it', 'ovo', 'ga', 'je'];
const BOOK = ['book', 'knjiga', 'knjigu'];
const READING = ['reading', 'read', 'citam', 'citanje'];
const NOTE = ['note', 'remember', 'zapisi', 'zabiljezi', 'zapamti'];
const ADD = ['put', 'add', 'stavi', 'dodaj'];
const LINK = ['link', 'connect', 'povezi'];
const START = ['start', 'begin', 'pocni', 'kreni'];
const TO = ['to', 's', 'sa'];
const INTO = ['in', 'into', 'to', 'u'];

export function routeLJingleIntent(value: string): LJingleIntent | null {
  const original = cleanOriginal(value);
  if (!original || original.startsWith(':') || original.startsWith('?')) return null;

  const source = words(original);
  if (source.length === 0) return null;

  const number = firstNumber(source);
  const chapterIndex = firstIndex(source, CHAPTER);
  const finishIndex = firstIndex(source, FINISH);

  // "finoshed chapter 4", "finsihed chpater 4", "zavrsio poglavlje 4"
  if (
    number &&
    finishIndex >= 0 &&
    chapterIndex >= 0 &&
    finishIndex < chapterIndex &&
    Math.abs(number.index - chapterIndex) <= 2
  ) {
    return {
      action: 'NOTE',
      target: 'ACTIVE_SESSION',
      content: original,
      original,
    };
  }

  const pageIndex = firstIndex(source, PAGE);
  const progressIndex = firstIndex(source, PAGE_PROGRESS);
  if (
    number &&
    pageIndex >= 0 &&
    number.value >= 1 &&
    number.value <= 100000 &&
    (pageIndex === 0 || progressIndex >= 0)
  ) {
    return {
      action: 'UPDATE',
      target: 'CURRENT_BOOK',
      field: 'PAGE',
      value: number.value,
      original,
    };
  }

  const first = source[0]?.normalized ?? '';

  if (resembles(first, STOP)) {
    return { action: 'STOP', target: 'ACTIVE_TIMER', original };
  }

  if (resembles(first, NOTE)) {
    let start = 0;
    if (source[1] && resembles(source[1].normalized, ['that', 'da'])) start = 1;
    const content = tail(source, start);
    if (content) {
      return { action: 'NOTE', target: 'ACTIVE_SESSION', content, original };
    }
  }

  if (resembles(first, OPEN)) {
    const hasBook = firstIndex(source.slice(1), BOOK) >= 0;
    const hasReading = firstIndex(source.slice(1), READING) >= 0;
    const hasCurrentWord = firstIndex(source.slice(1), ['current', 'trenutnu', 'trenutna']) >= 0;

    if (hasBook && (hasReading || hasCurrentWord || source.length <= 4)) {
      return { action: 'OPEN', target: 'CURRENT_BOOK', original };
    }

    if (firstIndex(source.slice(1), CURRENT) >= 0) {
      return { action: 'OPEN', target: 'CURRENT', original };
    }
  }

  if (resembles(first, ADD)) {
    const currentIndex = firstIndex(source.slice(1), CURRENT);
    const prepIndex = source.findIndex((word, index) => index > 0 && resembles(word.normalized, INTO));
    if (currentIndex >= 0 && prepIndex > 0) {
      const query = tail(source, prepIndex);
      if (query) {
        return { action: 'ADD_TO_COLLECTION', target: 'CURRENT_ENTITY', query, original };
      }
    }
  }

  if (resembles(first, LINK)) {
    const currentIndex = firstIndex(source.slice(1), CURRENT);
    const prepIndex = source.findIndex((word, index) => index > 0 && resembles(word.normalized, TO));
    if (currentIndex >= 0 && prepIndex > 0) {
      const query = tail(source, prepIndex);
      if (query) {
        return { action: 'LINK', target: 'CURRENT_ENTITY', query, original };
      }
    }
  }

  if (resembles(first, START)) {
    const readingIndex = firstIndex(source.slice(1), READING);
    if (readingIndex >= 0) {
      const absoluteReadingIndex = readingIndex + 1;
      const query = tail(source, absoluteReadingIndex);
      if (query) return { action: 'START', target: 'BOOK', query, original };
    }
  }

  return null;
}

export function toQuietContextIntent(intent: LJingleIntent | null): QuietContextIntent | null {
  if (!intent) return null;

  if (intent.action === 'UPDATE' && intent.field === 'PAGE') {
    return { kind: 'BOOK_PAGE', page: intent.value };
  }

  if (intent.action === 'STOP') return { kind: 'STOP_ACTIVE' };

  if (intent.action === 'LINK' && intent.target === 'ACTIVE_SESSION') {
    return { kind: 'LINK_ACTIVE', query: intent.query };
  }

  return null;
}

export function toContextualVerbIntent(intent: LJingleIntent | null): ContextualVerbIntent | null {
  if (!intent) return null;

  if (intent.action === 'OPEN' && intent.target === 'CURRENT') {
    return { kind: 'OPEN_CURRENT' };
  }

  if (intent.action === 'OPEN' && intent.target === 'CURRENT_BOOK') {
    return { kind: 'OPEN_CURRENT_BOOK' };
  }

  if (intent.action === 'NOTE') {
    return { kind: 'NOTE_ACTIVE', note: intent.content };
  }

  if (intent.action === 'ADD_TO_COLLECTION') {
    return { kind: 'ADD_CURRENT_TO_COLLECTION', collectionQuery: intent.query };
  }

  if (intent.action === 'LINK' && intent.target === 'CURRENT_ENTITY') {
    return { kind: 'LINK_CURRENT_ENTITY', query: intent.query };
  }

  if (intent.action === 'START' && intent.target === 'BOOK') {
    return { kind: 'START_READING', query: intent.query };
  }

  return null;
}

export function isLJingleIntent(value: unknown): value is LJingleIntent {
  if (!value || typeof value !== 'object') return false;
  const action = (value as { action?: unknown }).action;
  return typeof action === 'string' && [
    'OPEN',
    'UPDATE',
    'NOTE',
    'STOP',
    'LINK',
    'ADD_TO_COLLECTION',
    'START',
    'SEARCH',
    'CREATE',
    'NAVIGATE',
  ].includes(action);
}

import type { NaturalCaptureFact } from '../types';
import { resolveCaptureDate } from '../timeResolver';
import type { CapturePreparation, ResolvedCaptureEntity } from './types';

function percentFromProgress(fact: NaturalCaptureFact): number | undefined {
  const p = fact.progress;
  if (!p) return undefined;
  if (p.kind === 'PERCENT') return Math.round(Math.max(0, Math.min(100, p.value)));
  if (p.kind === 'FRACTION') return Math.round(Math.max(0, Math.min(1, p.value)) * 100);
  return undefined;
}

export function prepareReadingCapture(
  fact: NaturalCaptureFact,
  entity: Extract<ResolvedCaptureEntity, { entityType: 'BOOK' }>,
  now = new Date(),
): CapturePreparation {
  const occurredOn = resolveCaptureDate(fact.occurredAt, now);
  const approximate =
    Boolean(fact.occurredAt?.approximate) ||
    fact.progress?.approximation === 'ABOUT';

  if (fact.progress?.kind === 'PAGE' || fact.progress?.kind === 'CHAPTER') {
    return {
      status: 'UNSUPPORTED',
      reason: 'Book storage has no page/chapter total mapping here; refusing to invent a percentage.',
      source: fact,
    };
  }

  if (fact.event === 'FINISHED') {
    return {
      status: 'READY',
      requiresConfirmation: approximate,
      summary: `Mark "${entity.title}" completed${occurredOn ? ' on '+occurredOn : ''}.`,
      operation: {
        kind: 'UPDATE_BOOK',
        entity,
        patch: { progress: 100, readingStatus: 'COMPLETED', finishedOn: occurredOn ?? null },
        occurredOn,
      },
      source: fact,
    };
  }

  if (fact.event === 'STARTED') {
    return {
      status: 'READY',
      requiresConfirmation: approximate || Boolean(fact.occurredAt?.durationAgo),
      summary: `Mark "${entity.title}" in progress${occurredOn ? ' from '+occurredOn : ''}.`,
      operation: {
        kind: 'UPDATE_BOOK',
        entity,
        patch: { readingStatus: 'IN_PROGRESS', startedOn: occurredOn ?? null },
        occurredOn,
      },
      source: fact,
    };
  }

  if (fact.event === 'PAUSED') {
    return {
      status: 'READY',
      requiresConfirmation: false,
      summary: `Pause reading "${entity.title}".`,
      operation: { kind: 'UPDATE_BOOK', entity, patch: { readingStatus: 'PAUSED' }, occurredOn },
      source: fact,
    };
  }

  const progress = percentFromProgress(fact);
  if (fact.event === 'PROGRESSED' && progress !== undefined) {
    return {
      status: 'READY',
      requiresConfirmation: approximate,
      summary: `Set "${entity.title}" reading progress to ${progress}%.`,
      operation: {
        kind: 'UPDATE_BOOK',
        entity,
        patch: { progress, readingStatus: progress >= 100 ? 'COMPLETED' : 'IN_PROGRESS' },
        occurredOn,
      },
      source: fact,
    };
  }

  return { status: 'UNSUPPORTED', reason: 'No safe reading-domain mapping for this fact.', source: fact };
}

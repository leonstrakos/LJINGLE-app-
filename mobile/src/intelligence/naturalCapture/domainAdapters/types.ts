import type { NaturalCaptureFact } from '../types';

export type ResolvedCaptureEntity =
  | { entityType: 'BOOK'; entityId: string; title: string }
  | { entityType: 'MEDIA'; entityId: string; title: string; mediaType?: 'MOVIE' | 'SERIES' };

export type CaptureOperation =
  | {
      kind: 'UPDATE_BOOK';
      entity: Extract<ResolvedCaptureEntity, { entityType: 'BOOK' }>;
      patch: {
        progress?: number;
        readingStatus?: 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED';
        startedOn?: string | null;
        finishedOn?: string | null;
      };
      occurredOn?: string;
    }
  | {
      kind: 'UPDATE_MEDIA';
      entity: Extract<ResolvedCaptureEntity, { entityType: 'MEDIA' }>;
      patch: {
        progress?: number;
        watchStatus?: 'WATCHING' | 'COMPLETED' | 'DROPPED';
        startedOn?: string | null;
        completedOn?: string | null;
      };
      occurredOn?: string;
    }
  | {
      kind: 'MARK_NEXT_SERIES_EPISODES';
      entity: Extract<ResolvedCaptureEntity, { entityType: 'MEDIA' }>;
      count: number;
      occurredOn?: string;
    };

export type CapturePreparation =
  | {
      status: 'READY';
      requiresConfirmation: boolean;
      summary: string;
      operation: CaptureOperation;
      source: NaturalCaptureFact;
    }
  | {
      status: 'UNSUPPORTED';
      reason: string;
      source: NaturalCaptureFact;
    };

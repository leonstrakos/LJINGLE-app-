import type {
  ChronologyEvent,
  ChronologyEventKind,
} from './chronology';

// reconstructionEngineV1

export type ReconstructionPeriodKind =
  | 'DAY'
  | 'MONTH'
  | 'YEAR'
  | 'CUSTOM';

export type ReconstructionPeriod = {
  kind: ReconstructionPeriodKind;

  start: string;
  end: string;

  label: string;

  year: number;
  month?: number;
  day?: number;
};

export type ReconstructionCategory =
  | 'BOOKS'
  | 'MEDIA'
  | 'GAMES'
  | 'ENTRIES'
  | 'SESSIONS'
  | 'OTHER';

export type ReconstructionCategorySummary = {
  category: ReconstructionCategory;

  eventCount: number;
  trackedSeconds: number;

  titles: string[];
};

export type ReconstructionActivitySummary = {
  label: string;

  sessionCount: number;
  trackedSeconds: number;
};

export type ReconstructionKindCount = {
  kind: ChronologyEventKind;
  count: number;
};

export type ReconstructionActiveItem = {
  entityType: 'BOOK' | 'MEDIA' | 'GAME';
  entityId: string;
  title: string;
  subtitle: string | null;
  startedAt: string;
};

export type Reconstruction = {
  period: ReconstructionPeriod;

  eventCount: number;
  trackedSeconds: number;

  firstEvent: ChronologyEvent | null;
  lastEvent: ChronologyEvent | null;

  busiestDay:
    | {
        date: string;
        eventCount: number;
        trackedSeconds: number;
      }
    | null;

  categories: ReconstructionCategorySummary[];

  activities: ReconstructionActivitySummary[];

  eventKinds: ReconstructionKindCount[];

  activeItems: ReconstructionActiveItem[];
  events: ChronologyEvent[];
};

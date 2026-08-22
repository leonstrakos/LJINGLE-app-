// chronologyV1

export type ChronologyEventKind =
  | 'SESSION'
  | 'ENTRY'
  | 'BOOK_STARTED'
  | 'BOOK_FINISHED'
  | 'MEDIA_STARTED'
  | 'MEDIA_COMPLETED'
  | 'GAME_STARTED'
  | 'GAME_FINISHED';

export type ChronologyEntityType =
  | 'ACTIVITY'
  | 'BOOK'
  | 'MEDIA'
  | 'GAME'
  | 'ENTRY'
  | 'TOPIC';

export type ChronologyEvent = {
  id: string;
  kind: ChronologyEventKind;

  at: string;
  endAt: string | null;

  title: string;
  subtitle: string | null;

  entityType: ChronologyEntityType;
  entityId: string | null;

  activityType: string | null;
  durationSeconds: number | null;
  note: string | null;
};

export type ChronologyMonth = {
  key: string;
  year: number;
  month: number;
  label: string;
  events: ChronologyEvent[];
  eventCount: number;
  trackedSeconds: number;
};

export type ChronologyYear = {
  year: number;
  eventCount: number;
  trackedSeconds: number;
  months: ChronologyMonth[];
};

export type ChronologyPeriodSnapshot = {
  start: string;
  end: string;

  eventCount: number;
  trackedSeconds: number;
  sessionCount: number;
  entryCount: number;

  books: string[];
  media: string[];
  games: string[];
  activities: string[];
};

export type SeasonalMemoryGroup = {
  year: number;
  eventCount: number;
  events: ChronologyEvent[];
};

export type ChronologyZoom =
  | 'YEARS'
  | 'MONTHS'
  | 'DAYS';

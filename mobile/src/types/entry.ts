export const entryTypes = [
  'NOTE',
  'QUOTE',
  'OBSERVATION',
  'REVIEW',
  'PROGRESS_UPDATE',
] as const;

export type EntryType = (typeof entryTypes)[number];

export const entryTypeLabels: Record<EntryType, string> = {
  NOTE: 'Bilješka',
  QUOTE: 'Citat',
  OBSERVATION: 'Opažanje',
  REVIEW: 'Osvrt',
  PROGRESS_UPDATE: 'Napredak',
};

export const entryTypeMarks: Record<EntryType, string> = {
  NOTE: '≡',
  QUOTE: '“',
  OBSERVATION: '◉',
  REVIEW: '☆',
  PROGRESS_UPDATE: '↑',
};

export type Entry = {
  entryId: string;
  title: string | null;
  content: string;
  type: EntryType;
  // ljingleZapisiVaultR1: optional user-created filter chip
  customLabel: string | null;
  bookId: string | null;
  topicId: string | null;
  activityId: string | null;
  createdAt: string;
  modifiedAt: string;
};

export type EntryRequest = {
  title?: string | null;
  content: string;
  type: EntryType;
  customLabel?: string | null;
  bookId?: string | null;
  topicId?: string | null;
  activityId?: string | null;
};

export type EntryQuery = {
  bookId?: string;
  topicId?: string;
  activityId?: string;
  type?: EntryType;
  customLabel?: string;
};

export type EntryLinkOption = {
  id: string;
  label: string;
  detail?: string;
  topicId?: string;
};

export type EntryLinks = {
  books: EntryLinkOption[];
  topics: EntryLinkOption[];
  activities: EntryLinkOption[];
};

export type EntryLinkLabels = {
  books: Record<string, string>;
  topics: Record<string, string>;
  activities: Record<string, string>;
};

export type EntryFormParams = {
  entryId?: string;
};

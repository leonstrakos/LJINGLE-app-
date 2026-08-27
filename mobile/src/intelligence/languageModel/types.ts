// forkK9LocalLanguageBrainV1
// forkK10ReferentialResolutionV1
// forkK11CompoundIntentPlannerV1

import type { LJingleIntent } from '../intentRouter';

export type LocalLanguageContext = {
  activeTimerCount: number;
  activeTimerLabel: string | null;
  currentEntity: {
    kind: string;
    title: string;
  } | null;
  currentBook: {
    title: string;
  } | null;
};

export type RawModelIntent = {
  action:
    | 'UNKNOWN'
    | 'OPEN'
    | 'UPDATE_PAGE'
    | 'NOTE'
    | 'STOP'
    | 'LINK'
    | 'ADD_TO_COLLECTION'
    | 'START_READING'
    | 'SEARCH';
  target:
    | 'NONE'
    | 'CURRENT'
    | 'CURRENT_BOOK'
    | 'ACTIVE_SESSION'
    | 'ACTIVE_TIMER'
    | 'CURRENT_ENTITY'
    | 'BOOK';
  query: string;
  /** Natural-language subject phrase only. Never an entity id. */
  subjectQuery: string;
  content: string;
  value: number;
};

export type LocalLanguageBrainStatus = {
  enabled: boolean;
  downloaded: boolean;
  loaded: boolean;
  bytes: number;
  runtime: 'native' | 'web-unavailable';
  model: string;
};

export type LocalLanguageResult = {
  intent: LJingleIntent | null;
  raw: RawModelIntent | null;
};

export type LocalLanguagePlanResult = {
  intents: LJingleIntent[];
  raw: RawModelIntent[];
  /** True only when every parsed child survived strict validation. */
  fullyValid: boolean;
};

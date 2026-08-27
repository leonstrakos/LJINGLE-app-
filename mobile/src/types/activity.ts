export type ActivityType =
  | 'READING'
  | 'WATCHING'
  | 'STUDYING'
  | 'PLAYING'
  | 'RESEARCH'
  | 'WORK'
  | 'EXERCISE'
  | 'CUSTOM'
  | 'GLOBAL';

export type ActivityTimerResponse = {
  activityId: string | null;
  label: string;
  activityType: ActivityType;
  bookId: string | null;
  topicId: string | null;
  running: boolean;
  activeSessionId: string | null;
  activeStartedAt: string | null;
  completedSeconds: number;
  totalSeconds: number;
};

export type TimeSessionResponse = {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  running: boolean;
};


// architectureBatchA_v1
export type GlobalTimerStopResponse = {
  timer: ActivityTimerResponse;
  sessionId: string | null;
};

export type SessionContextReference = {
  contextId: string;
  sessionId: string;
  entityType: 'BOOK' | 'MEDIA' | 'GAME' | 'TOPIC' | 'ENTRY' | 'FREQUENCY';
  entityId: string;
  title: string;
  subtitle: string | null;
  createdAt: string;
};

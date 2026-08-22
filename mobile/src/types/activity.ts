export type ActivityType =
  | 'READING'
  | 'WATCHING'
  | 'STUDYING'
  | 'PLAYING'
  | 'RESEARCH'
  | 'WORK'
  | 'EXERCISE'
  | 'CUSTOM';

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

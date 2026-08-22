export const activityTypes = [
  'READING',
  'STUDYING',
  'PLAYING',
  'RESEARCH',
  'WORK',
  'EXERCISE',
  'CUSTOM',
] as const;

export type ActivityType = (typeof activityTypes)[number];

export const activityTypeLabels: Record<ActivityType, string> = {
  READING: 'Čitanje',
  STUDYING: 'Učenje',
  PLAYING: 'Igranje',
  RESEARCH: 'Istraživanje',
  WORK: 'Rad',
  EXERCISE: 'Vježbanje',
  CUSTOM: 'Ostalo',
};

export const activityTypeMarks: Record<ActivityType, string> = {
  READING: '≡',
  STUDYING: '◇',
  PLAYING: '△',
  RESEARCH: '⌕',
  WORK: '□',
  EXERCISE: '↑',
  CUSTOM: '·',
};

export type TopicResponse = {
  topicId: string;
  name: string;
  description: string | null;
  activityCount: number;
  createdAt: string;
  modifiedAt: string;
};

export type TopicRequest = {
  name: string;
  description?: string;
};

export type TopicActivityResponse = {
  activityId: string;
  label: string;
  activityType: ActivityType;
  bookId: string | null;
  topicId: string | null;
  createdAt: string;
  modifiedAt: string;
};

export type TopicActivityRequest = {
  label: string;
  activityType: ActivityType;
};

export type TopicActivityTimerResponse = {
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

export type TopicDetailsParams = {
  topicId: string;
};

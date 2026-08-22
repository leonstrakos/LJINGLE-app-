export type HistorySession = {
  sessionId: string;
  activityId: string;
  activityLabel: string;
  activityType: string;
  bookId: string | null;
  topicId: string | null;
  startedAt: string;
  endedAt: string | null;
  note?: string | null;
  durationSeconds: number;
  running: boolean;
};

export type HistorySessionPage = {
  content: HistorySession[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};

export type HistoryQuery = {
  page?: number;
  size?: number;
  date?: string;
  zone?: string;
};

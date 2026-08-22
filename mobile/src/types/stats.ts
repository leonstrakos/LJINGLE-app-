export type DailyActivityTime = {
  activityId: string;
  label: string;
  activityType: string;
  bookId: string | null;
  seconds: number;
  running: boolean;
};

export type DailyTimeResponse = {
  date: string;
  zone: string;
  totalSeconds: number;
  activities: DailyActivityTime[];
};

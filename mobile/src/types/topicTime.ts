export type TopicActivityTimeSummary = {
  activityId: string;
  label: string;
  activityType: string;
  totalSeconds: number;
  running: boolean;
};

export type TopicTimeSummary = {
  topicId: string;
  totalSeconds: number;
  directSeconds: number;
  activities: TopicActivityTimeSummary[];
};

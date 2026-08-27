import { apiRequest } from './apiClient';
import type { TopicTimeSummary } from '../types/topicTime';

export const topicTimeApi = {
  getSummary: (topicId: string) =>
    apiRequest<TopicTimeSummary>(
      '/topics/' +
        encodeURIComponent(topicId) +
        '/time-summary',
    ),
};

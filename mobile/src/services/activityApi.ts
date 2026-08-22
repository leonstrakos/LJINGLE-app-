import type {
  ActivityTimerResponse,
  TimeSessionResponse,
} from '../types/activity';
import { apiRequest } from './apiClient';

export const activityApi = {
  getReadingTimer: (bookId: string) =>
    apiRequest<ActivityTimerResponse>(`/activities/books/${bookId}/reading`),

  startReading: (bookId: string) =>
    apiRequest<ActivityTimerResponse>(`/activities/books/${bookId}/reading/start`, {
      method: 'POST',
    }),

  stopReading: (bookId: string) =>
    apiRequest<ActivityTimerResponse>(`/activities/books/${bookId}/reading/stop`, {
      method: 'POST',
    }),

  getActive: () => apiRequest<ActivityTimerResponse[]>('/activities/active'),

  getRecent: (limit = 6) =>
    apiRequest<ActivityTimerResponse[]>(`/activities/recent?limit=${limit}`),

  dismissRecent: (activityId: string) =>
    apiRequest<void>(`/activities/${encodeURIComponent(activityId)}/dismiss-recent`, {
      method: 'POST',
    }),

  start: (activityId: string) =>
    apiRequest<ActivityTimerResponse>(`/activities/${activityId}/start`, {
      method: 'POST',
    }),

  stop: (activityId: string) =>
    apiRequest<ActivityTimerResponse>(`/activities/${activityId}/stop`, {
      method: 'POST',
    }),

  getSessions: (activityId: string) =>
    apiRequest<TimeSessionResponse[]>(`/activities/${activityId}/sessions`),
};

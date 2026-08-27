import { apiRequest } from './apiClient';
import type {
  TopicActivityRequest,
  TopicActivityResponse,
  TopicActivityTimerResponse,
  TopicRequest,
  TopicResponse,
} from '../types/topic';

function jsonBody(body: unknown): RequestInit {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const topicApi = {
  getAll: () => apiRequest<TopicResponse[]>('/topics'),

  getById: (topicId: string) =>
    apiRequest<TopicResponse>(`/topics/${topicId}`),

  create: (request: TopicRequest) =>
    apiRequest<TopicResponse>('/topics', {
      method: 'POST',
      ...jsonBody(request),
    }),

  update: (topicId: string, request: TopicRequest) =>
    apiRequest<TopicResponse>(`/topics/${topicId}`, {
      method: 'PUT',
      ...jsonBody(request),
    }),

  remove: (topicId: string) =>
    apiRequest<void>(`/topics/${topicId}`, { method: 'DELETE' }),

  getActivities: (topicId: string) =>
    apiRequest<TopicActivityResponse[]>(`/topics/${topicId}/activities`),

  searchActivities: (query = '') =>
    apiRequest<TopicActivityResponse[]>(
      '/activities?query=' +
        encodeURIComponent(query),
    ),

  linkActivity: (
    topicId: string,
    activityId: string,
  ) =>
    apiRequest<TopicActivityResponse>(
      '/topics/' +
        encodeURIComponent(topicId) +
        '/activities/' +
        encodeURIComponent(activityId),
      { method: 'POST' },
    ),

  unlinkActivity: (
    topicId: string,
    activityId: string,
  ) =>
    apiRequest<void>(
      '/topics/' +
        encodeURIComponent(topicId) +
        '/activities/' +
        encodeURIComponent(activityId),
      { method: 'DELETE' },
    ),

  createActivity: (topicId: string, request: TopicActivityRequest) =>
    apiRequest<TopicActivityResponse>(`/topics/${topicId}/activities`, {
      method: 'POST',
      ...jsonBody(request),
    }),

  getActiveActivities: () =>
    apiRequest<TopicActivityTimerResponse[]>('/activities/active'),

  startActivity: (activityId: string) =>
    apiRequest<TopicActivityTimerResponse>(`/activities/${activityId}/start`, {
      method: 'POST',
    }),

  stopActivity: (activityId: string) =>
    apiRequest<TopicActivityTimerResponse>(`/activities/${activityId}/stop`, {
      method: 'POST',
    }),
};

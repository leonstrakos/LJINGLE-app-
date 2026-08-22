import type { HistoryQuery, HistorySessionPage } from '../types/history';
import { apiRequest } from './apiClient';

function localZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Zagreb';
  } catch {
    return 'Europe/Zagreb';
  }
}

export const historyApi = {
  getSessions: ({
    page = 0,
    size = 30,
    date,
    zone = localZone(),
  }: HistoryQuery = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
    });

    if (date) {
      params.set('date', date);
      params.set('zone', zone);
    }

    return apiRequest<HistorySessionPage>(`/history/sessions?${params.toString()}`);
  },
};

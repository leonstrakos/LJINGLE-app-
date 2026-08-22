import type { DailyTimeResponse } from '../types/stats';
import { apiRequest } from './apiClient';

function localZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Zagreb';
  } catch {
    return 'Europe/Zagreb';
  }
}

export const statsApi = {
  getDaily: (date?: string, zone = localZone()) => {
    const params = [
      date ? `date=${encodeURIComponent(date)}` : null,
      `zone=${encodeURIComponent(zone)}`,
    ]
      .filter((value): value is string => value !== null)
      .join('&');

    return apiRequest<DailyTimeResponse>(`/stats/daily?${params}`);
  },
};

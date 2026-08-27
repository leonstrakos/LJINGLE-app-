// forkK6ActiveContextV1

import { activityApi } from '../services/activityApi';
import type {
  ActivityTimerResponse,
  SessionContextReference,
} from '../types/activity';

export type QuietActiveContext = {
  timers: ActivityTimerResponse[];
  singleTimer: ActivityTimerResponse | null;
  sessionContexts: SessionContextReference[];
  bookContext: {
    bookId: string;
    sessionId: string;
  } | null;
};

export type QuietContextIntent =
  | { kind: 'BOOK_PAGE'; page: number }
  | { kind: 'STOP_ACTIVE' }
  | { kind: 'LINK_ACTIVE'; query: string };

function uniqueTimers(timers: ActivityTimerResponse[]) {
  const seen = new Set<string>();
  const output: ActivityTimerResponse[] = [];

  for (const timer of timers) {
    if (!timer.running || !timer.activeSessionId) continue;
    const key = timer.activityId || timer.activeSessionId;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(timer);
  }

  return output;
}

export async function loadQuietActiveContext(): Promise<QuietActiveContext> {
  const [regular, global] = await Promise.all([
    activityApi.getActive().catch(() => []),
    activityApi.getGlobal().catch(() => null),
  ]);

  const timers = uniqueTimers([
    ...regular,
    ...(global?.running ? [global] : []),
  ]);

  const singleTimer = timers.length === 1 ? timers[0] ?? null : null;
  let sessionContexts: SessionContextReference[] = [];

  if (singleTimer?.activeSessionId) {
    sessionContexts = await activityApi
      .getSessionContexts(singleTimer.activeSessionId)
      .catch(() => []);
  }

  const bookIds = new Set<string>();
  if (singleTimer?.bookId) bookIds.add(singleTimer.bookId);
  for (const context of sessionContexts) {
    if (context.entityType === 'BOOK') bookIds.add(context.entityId);
  }

  const onlyBookId = bookIds.size === 1 ? [...bookIds][0] ?? null : null;

  return {
    timers,
    singleTimer,
    sessionContexts,
    bookContext:
      singleTimer?.activeSessionId && onlyBookId
        ? {
            bookId: onlyBookId,
            sessionId: singleTimer.activeSessionId,
          }
        : null,
  };
}

export function parseQuietContextIntent(value: string): QuietContextIntent | null {
  const clean = value.trim();
  if (!clean || clean.startsWith(':')) return null;

  const page = clean.match(
    /^(?:page|pg|p\.?|stranica|str\.?|na\s+stranici)\s*#?\s*(\d{1,5})$/i,
  );

  if (page) {
    const parsed = Number(page[1]);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 100000) {
      return { kind: 'BOOK_PAGE', page: parsed };
    }
  }

  if (/^(?:stop|stop\s+timer|zaustavi|zaustavi\s+timer|stani)$/i.test(clean)) {
    return { kind: 'STOP_ACTIVE' };
  }

  const linkPatterns = [
    /^(?:connect|link)\s+this\s+to\s+(.+)$/i,
    /^(?:connect|link)\s+session\s+to\s+(.+)$/i,
    /^pove[zž]i\s+ovo\s+(?:s|sa)\s+(.+)$/i,
    /^pove[zž]i\s+sesiju\s+(?:s|sa)\s+(.+)$/i,
  ];

  for (const pattern of linkPatterns) {
    const match = clean.match(pattern);
    const query = (match?.[1] ?? '').trim();
    if (query) return { kind: 'LINK_ACTIVE', query };
  }

  return null;
}

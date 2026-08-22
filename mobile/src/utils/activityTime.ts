import type { ActivityTimerResponse } from '../types/activity';

function safeSeconds(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function safeNow(now: number) {
  return Number.isFinite(now) ? now : Date.now();
}

export function getActiveSessionSeconds(timer: ActivityTimerResponse, now = Date.now()) {
  if (!timer.running || !timer.activeStartedAt) {
    return 0;
  }

  const startedAt = Date.parse(timer.activeStartedAt);
  if (!Number.isFinite(startedAt)) {
    return 0;
  }

  return Math.max(0, Math.floor((safeNow(now) - startedAt) / 1000));
}

export function getLiveTotalSeconds(timer: ActivityTimerResponse, now = Date.now()) {
  if (!timer.running) {
    return safeSeconds(timer.totalSeconds);
  }

  if (!timer.activeStartedAt || !Number.isFinite(Date.parse(timer.activeStartedAt))) {
    return safeSeconds(timer.totalSeconds);
  }

  return safeSeconds(timer.completedSeconds) + getActiveSessionSeconds(timer, now);
}

export function formatDuration(seconds: number) {
  const safeValue = safeSeconds(seconds);
  const hours = Math.floor(safeValue / 3600);
  const minutes = Math.floor((safeValue % 3600) / 60);
  const remainingSeconds = safeValue % 60;

  return [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

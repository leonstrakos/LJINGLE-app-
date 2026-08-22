import type { TopicActivityTimerResponse } from '../types/topic';

function safeSeconds(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function getTopicSessionSeconds(
  timer: TopicActivityTimerResponse,
  now = Date.now(),
) {
  if (!timer.running || !timer.activeStartedAt || !Number.isFinite(now)) return 0;

  const startedAt = Date.parse(timer.activeStartedAt);
  if (!Number.isFinite(startedAt)) return 0;

  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

export function getTopicTotalSeconds(
  timer: TopicActivityTimerResponse,
  now = Date.now(),
) {
  if (!timer.running) return safeSeconds(timer.totalSeconds);
  return safeSeconds(timer.completedSeconds) + getTopicSessionSeconds(timer, now);
}

export function formatTopicDuration(seconds: number) {
  const value = safeSeconds(seconds);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainingSeconds = value % 60;

  return [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

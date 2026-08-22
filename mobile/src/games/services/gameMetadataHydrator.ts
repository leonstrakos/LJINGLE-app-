import type { GameMetadataResult, GameResponse } from '../types/game';
import { gameApi } from './gameApi';

type HydrateOptions = {
  priority?: boolean;
};

type Job = {
  item: GameResponse;
  resolve: (value: GameResponse | null) => void;
};

const attempted = new Set<string>();
const queuedPromises = new Map<string, Promise<GameResponse | null>>();
const inFlight = new Map<string, Promise<GameResponse | null>>();
const queue: Job[] = [];

const MAX_BACKGROUND_QUEUE = 6;
const MIN_REQUEST_GAP_MS = 1250;
let running = false;
let lastRequestStartedAt = 0;
let onlineLookupPaused = false;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function canonical(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function bestMatch(item: GameResponse, results: GameMetadataResult[]) {
  const wanted = canonical(item.title);
  if (!wanted) return null;

  const exact = results.filter(
    (candidate) => canonical(candidate.title) === wanted && Boolean(candidate.coverUrl),
  );
  if (exact.length === 0) return null;

  if (item.releaseYear) {
    const compatible = exact
      .map((candidate) => ({
        candidate,
        diff: candidate.releaseYear == null
          ? 99
          : Math.abs(candidate.releaseYear - item.releaseYear!),
      }))
      .filter(({ diff }) => diff <= 1)
      .sort((a, b) => a.diff - b.diff);
    return compatible[0]?.candidate ?? null;
  }

  // Same-name reboots/remasters are common. Without a local year we refuse
  // to guess if the online catalogue returns more than one exact title.
  return exact.length === 1 ? exact[0] : null;
}

function resolveQueuedAsNull() {
  while (queue.length > 0) {
    const job = queue.shift();
    if (!job) continue;
    queuedPromises.delete(job.item.gameId);
    job.resolve(null);
  }
}

async function perform(item: GameResponse): Promise<GameResponse | null> {
  if (onlineLookupPaused) return null;

  const elapsed = Date.now() - lastRequestStartedAt;
  if (elapsed < MIN_REQUEST_GAP_MS) await sleep(MIN_REQUEST_GAP_MS - elapsed);
  lastRequestStartedAt = Date.now();

  try {
    const results = await gameApi.searchMetadata(item.title);
    const match = bestMatch(item, results);
    if (!match?.coverUrl) return null;

    return await gameApi.patchMetadata(item.gameId, {
      developer: match.developer,
      releaseYear: match.releaseYear,
      igdbId: match.igdbId,
      coverUrl: match.coverUrl,
    });
  } catch {
    // Lazy art must never break or stall catalogue use. One unavailable online
    // lookup pauses background hydration until the next app restart.
    onlineLookupPaused = true;
    resolveQueuedAsNull();
    return null;
  }
}

function pump() {
  if (running || onlineLookupPaused) return;
  const job = queue.shift();
  if (!job) return;

  running = true;
  attempted.add(job.item.gameId);
  queuedPromises.delete(job.item.gameId);

  const promise = perform(job.item);
  inFlight.set(job.item.gameId, promise);

  void promise
    .then(job.resolve)
    .finally(() => {
      inFlight.delete(job.item.gameId);
      running = false;
      pump();
    });
}

export function hydrateGameMetadata(
  item: GameResponse,
  options: HydrateOptions = {},
): Promise<GameResponse | null> {
  if (item.coverUrl || onlineLookupPaused) return Promise.resolve(null);

  const active = inFlight.get(item.gameId);
  if (active) return active;

  const queued = queuedPromises.get(item.gameId);
  if (queued) return queued;

  if (attempted.has(item.gameId)) return Promise.resolve(null);

  if (!options.priority && queue.length >= MAX_BACKGROUND_QUEUE) {
    return Promise.resolve(null);
  }

  const promise = new Promise<GameResponse | null>((resolve) => {
    const job: Job = { item, resolve };
    if (options.priority) queue.unshift(job);
    else queue.push(job);
  });

  queuedPromises.set(item.gameId, promise);
  pump();
  return promise;
}

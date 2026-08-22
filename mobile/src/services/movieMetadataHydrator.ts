import type { MediaResponse, TmdbMediaResponse } from '../types/media';
import { mediaApi } from './mediaApi';

type HydrateOptions = {
  priority?: boolean;
};

type Job = {
  item: MediaResponse;
  resolve: (value: MediaResponse | null) => void;
};

const attempted = new Set<string>();
const queuedPromises = new Map<string, Promise<MediaResponse | null>>();
const inFlight = new Map<string, Promise<MediaResponse | null>>();
const queue: Job[] = [];

const MAX_BACKGROUND_QUEUE = 6;
const MIN_REQUEST_GAP_MS = 1100;
let running = false;
let lastRequestStartedAt = 0;

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

function candidateScore(item: MediaResponse, result: TmdbMediaResponse) {
  if (result.mediaType !== 'MOVIE') return -1;
  const wanted = canonical(item.title);
  const title = canonical(result.title);
  const original = canonical(result.originalTitle);

  // No fuzzy guessing. We would rather leave a placeholder than save a wrong poster.
  const exactTitle = wanted !== '' && (wanted === title || wanted === original);
  if (!exactTitle) return -1;

  let score = 100;
  if (result.posterPath || result.posterUrl) score += 40;
  if (item.releaseYear && result.releaseYear) {
    const diff = Math.abs(item.releaseYear - result.releaseYear);
    if (diff === 0) score += 35;
    else if (diff === 1) score += 15;
    else if (diff >= 3) score -= 30;
  }
  return score;
}

function bestMatch(item: MediaResponse, results: TmdbMediaResponse[]) {
  let best: TmdbMediaResponse | null = null;
  let bestScore = -1;
  for (const result of results) {
    const score = candidateScore(item, result);
    if (score > bestScore) {
      best = result;
      bestScore = score;
    }
  }
  return bestScore >= 100 ? best : null;
}

async function perform(item: MediaResponse): Promise<MediaResponse | null> {
  const elapsed = Date.now() - lastRequestStartedAt;
  if (elapsed < MIN_REQUEST_GAP_MS) await sleep(MIN_REQUEST_GAP_MS - elapsed);
  lastRequestStartedAt = Date.now();

  try {
    const response = await mediaApi.searchTmdb(item.title, 'MOVIE', 1);
    const match = bestMatch(item, response.results);
    if (!match || (!match.posterPath && !match.posterUrl)) return null;

    return await mediaApi.patchMetadata(item.mediaId, {
      originalTitle: match.originalTitle,
      overview: match.overview,
      posterPath: match.posterPath ?? match.posterUrl,
      backdropPath: match.backdropPath ?? match.backdropUrl,
      releaseYear: match.releaseYear,
    });
  } catch {
    // Lazy enrichment must never break browsing. Failed movies simply keep their placeholder.
    return null;
  }
}

function pump() {
  if (running) return;
  const job = queue.shift();
  if (!job) return;

  running = true;
  attempted.add(job.item.mediaId);
  queuedPromises.delete(job.item.mediaId);

  const promise = perform(job.item);
  inFlight.set(job.item.mediaId, promise);

  void promise
    .then(job.resolve)
    .finally(() => {
      inFlight.delete(job.item.mediaId);
      running = false;
      pump();
    });
}

export function hydrateMovieMetadata(
  item: MediaResponse,
  options: HydrateOptions = {},
): Promise<MediaResponse | null> {
  if (item.mediaType !== 'MOVIE' || item.posterPath) return Promise.resolve(null);

  const active = inFlight.get(item.mediaId);
  if (active) return active;

  const queued = queuedPromises.get(item.mediaId);
  if (queued) return queued;

  if (attempted.has(item.mediaId)) return Promise.resolve(null);

  if (!options.priority && queue.length >= MAX_BACKGROUND_QUEUE) {
    return Promise.resolve(null);
  }

  const promise = new Promise<MediaResponse | null>((resolve) => {
    const job: Job = { item, resolve };
    if (options.priority) queue.unshift(job);
    else queue.push(job);
  });

  queuedPromises.set(item.mediaId, promise);
  pump();
  return promise;
}

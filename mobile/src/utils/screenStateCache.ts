// screenStatePreservationV1
//
// Ephemeral navigation-state memory.
//
// This intentionally does NOT use SQLite or persistent storage.
// It survives navigation while the app process is alive and
// disappears naturally after a full app restart.
//
// Screens will opt into this individually later.

export type ScreenStateKey = string;

type CacheEntry<T> = {
  value: T;
  updatedAt: number;
};

const cache = new Map<
  ScreenStateKey,
  CacheEntry<unknown>
>();

export function saveScreenState<T>(
  key: ScreenStateKey,
  value: T,
) {
  cache.set(key, {
    value,
    updatedAt: Date.now(),
  });
}

export function readScreenState<T>(
  key: ScreenStateKey,
): T | undefined {
  const entry = cache.get(key);

  return entry?.value as T | undefined;
}

export function mergeScreenState<
  T extends Record<string, unknown>
>(
  key: ScreenStateKey,
  patch: Partial<T>,
): T {
  const current =
    readScreenState<T>(key) ?? ({} as T);

  const next = {
    ...current,
    ...patch,
  };

  saveScreenState(key, next);

  return next;
}

export function clearScreenState(
  key: ScreenStateKey,
) {
  cache.delete(key);
}

export function clearAllScreenState() {
  cache.clear();
}

export function hasScreenState(
  key: ScreenStateKey,
) {
  return cache.has(key);
}

export function getScreenStateAge(
  key: ScreenStateKey,
): number | undefined {
  const entry = cache.get(key);

  if (!entry) {
    return undefined;
  }

  return Date.now() - entry.updatedAt;
}


// ----------------------------------------------------------
// Common catalogue state
// ----------------------------------------------------------

export type CatalogueScreenState<
  Filter = string
> = {
  filter?: Filter;
  secondaryFilter?: string;
  query?: string;
  scrollOffset?: number;
};


// ----------------------------------------------------------
// Stable key helpers
//
// Examples:
//   catalogue:media
//   catalogue:books
//   catalogue:games
//   collection:abc123
// ----------------------------------------------------------

export function catalogueStateKey(
  catalogue:
    | 'media'
    | 'books'
    | 'games'
    | 'collections'
    | 'home',
) {
  return `catalogue:${catalogue}`;
}

export function collectionStateKey(
  collectionId: string,
) {
  return `collection:${collectionId}`;
}


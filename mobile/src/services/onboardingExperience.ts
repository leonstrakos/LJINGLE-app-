// ljingleOnboardingPlayerV1
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { getDatabase } from '../storage/database';

const TUTORIAL_VERSION = 1;
const WEB_KEY = 'ljingle_onboarding_experience_v1';
const FILE_NAME = 'ljingle-onboarding-experience-v1.json';

const DEMO = {
  mediaId: 'ljingle-demo-v1-media-marty-supreme',
  entryId: 'ljingle-demo-v1-entry-purpose',
  trackId: 'ljingle-demo-v1-frequency-forever-young',
  soundtrackId: 'ljingle-demo-v1-soundtrack-purpose',
  collectionId: 'ljingle-demo-v1-collection-first-signal',
  mediaItemId: 'ljingle-demo-v1-item-media',
  entryItemId: 'ljingle-demo-v1-item-entry',
  frequencyItemId: 'ljingle-demo-v1-item-frequency',
  entryFrequencyLinkId: 'ljingle-demo-v1-link-entry-frequency',
  frequencyMediaLinkId: 'ljingle-demo-v1-link-frequency-media',
} as const;

type OnboardingState = {
  seenVersion: number;
  exampleEverInstalled: boolean;
};

const EMPTY_STATE: OnboardingState = {
  seenVersion: 0,
  exampleEverInstalled: false,
};

let cachedState: OnboardingState | null = null;

function normalizeState(value: unknown): OnboardingState {
  const candidate = value as Partial<OnboardingState> | null;
  return {
    seenVersion:
      typeof candidate?.seenVersion === 'number'
        ? Math.max(0, Math.floor(candidate.seenVersion))
        : 0,
    exampleEverInstalled: candidate?.exampleEverInstalled === true,
  };
}

async function readState(): Promise<OnboardingState> {
  if (cachedState) return cachedState;

  try {
    if (Platform.OS === 'web') {
      const raw = globalThis.localStorage?.getItem(WEB_KEY);
      cachedState = raw ? normalizeState(JSON.parse(raw)) : EMPTY_STATE;
      return cachedState;
    }

    const raw = await new File(Paths.document, FILE_NAME).text();
    cachedState = normalizeState(JSON.parse(raw));
    return cachedState;
  } catch {
    cachedState = EMPTY_STATE;
    return cachedState;
  }
}

async function writeState(state: OnboardingState) {
  cachedState = state;
  const raw = JSON.stringify(state);

  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(WEB_KEY, raw);
    return;
  }

  const file = new File(Paths.document, FILE_NAME);
  file.create({ overwrite: true, intermediates: true });
  file.write(raw);
}

async function prepareDemoAudio() {
  const asset = Asset.fromModule(
    require('../assets/onboarding/alphaville-forever-young.mp3'),
  );
  await asset.downloadAsync();

  const sourceUri = asset.localUri ?? asset.uri;
  if (Platform.OS === 'web') return sourceUri;

  const directory = new Directory(Paths.document, 'ljingle-audio');
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(
    directory,
    'ljingle-tutorial-forever-young.mp3',
  );

  if (!destination.exists) {
    new File(sourceUri).copy(destination);
  }

  return destination.uri;
}

async function installExample() {
  const state = await readState();
  if (state.exampleEverInstalled) return false;

  const fileUri = await prepareDemoAudio();
  const database = await getDatabase();
  const now = new Date().toISOString();

  const insert = async (target: typeof database) => {
    await target.runAsync(
      `INSERT OR IGNORE INTO media_items
       (media_id, media_type, tmdb_id, title, original_title, overview,
        poster_path, backdrop_path, release_year, watch_status, progress,
        enjoyment, favourite, started_on, completed_on, created_at, modified_at)
       VALUES (?, 'MOVIE', NULL, ?, NULL, ?, NULL, NULL, 2025, 'WATCHLIST',
               0, NULL, 0, NULL, NULL, ?, ?)`,
      DEMO.mediaId,
      'Marty Supreme',
      'Tutorial primjer: film povezan s citatom i osobnom frekvencijom.',
      now,
      now,
    );

    await target.runAsync(
      `INSERT OR IGNORE INTO entries
       (entry_id, title, content, entry_type, book_id, topic_id, activity_id,
        created_at, modified_at)
       VALUES (?, ?, ?, 'QUOTE', NULL, NULL, NULL, ?, ?)`,
      DEMO.entryId,
      'A purpose',
      "I have a purpose. You don't. If you think that's some kind of blessing, it's not. It puts me at a huge life disadvantage. It means I have an obligation to see a very specific thing through. And with obligation comes sacrifice, okay",
      now,
      now,
    );

    await target.runAsync(
      `INSERT OR IGNORE INTO audio_tracks
       (track_id, title, artist, file_uri, original_name, mime_type,
        waveform_seed, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, 'audio/mpeg', ?, ?, ?)`,
      DEMO.trackId,
      'Forever Young',
      'Alphaville',
      fileUri,
      'Alphaville - Forever Young.mp3',
      DEMO.trackId,
      now,
      now,
    );

    await target.runAsync(
      `INSERT OR IGNORE INTO entry_soundtracks
       (link_id, entry_id, track_id, anchor_text, clip_start_seconds,
        clip_end_seconds, created_at)
       VALUES (?, ?, ?, NULL, 0, NULL, ?)`,
      DEMO.soundtrackId,
      DEMO.entryId,
      DEMO.trackId,
      now,
    );

    await target.runAsync(
      `INSERT OR IGNORE INTO entity_links
       (link_id, source_type, source_id, target_type, target_id,
        relation_type, note, created_at, modified_at)
       VALUES (?, 'ENTRY', ?, 'FREQUENCY', ?, 'REMEMBERED_WITH', NULL, ?, ?)`,
      DEMO.entryFrequencyLinkId,
      DEMO.entryId,
      DEMO.trackId,
      now,
      now,
    );

    await target.runAsync(
      `INSERT OR IGNORE INTO entity_links
       (link_id, source_type, source_id, target_type, target_id,
        relation_type, note, created_at, modified_at)
       VALUES (?, 'FREQUENCY', ?, 'MEDIA', ?, 'REMEMBERED_WITH', NULL, ?, ?)`,
      DEMO.frequencyMediaLinkId,
      DEMO.trackId,
      DEMO.mediaId,
      now,
      now,
    );

    await target.runAsync(
      `INSERT OR IGNORE INTO collections
       (collection_id, name, description, symbol, position, created_at, modified_at)
       VALUES (?, ?, ?, '✦',
        (SELECT COALESCE(MAX(position) + 1, 0) FROM collections), ?, ?)`,
      DEMO.collectionId,
      'First Signal · A Purpose',
      'Memory Box tutorial: film, citat i frekvencija. U Memory Radiju ista kolekcija radi i kao playlist.',
      now,
      now,
    );

    const items = [
      [DEMO.mediaItemId, 'MEDIA', DEMO.mediaId, 0],
      [DEMO.entryItemId, 'ENTRY', DEMO.entryId, 1],
      [DEMO.frequencyItemId, 'FREQUENCY', DEMO.trackId, 2],
    ] as const;

    for (const [itemId, entityType, entityId, position] of items) {
      await target.runAsync(
        `INSERT OR IGNORE INTO collection_items
         (item_id, collection_id, entity_type, entity_id, position,
          created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        itemId,
        DEMO.collectionId,
        entityType,
        entityId,
        position,
        now,
        now,
      );
    }
  };

  if (Platform.OS === 'web') {
    await insert(database);
  } else {
    await database.withExclusiveTransactionAsync(insert);
  }

  await writeState({
    ...state,
    exampleEverInstalled: true,
  });
  return true;
}

export async function shouldShowFirstRunTutorial() {
  return (await readState()).seenVersion < TUTORIAL_VERSION;
}

export async function getOnboardingState() {
  return readState();
}

export async function finishOnboarding(options: { installExample: boolean }) {
  const before = await readState();
  let exampleInstalledNow = false;

  if (options.installExample && !before.exampleEverInstalled) {
    exampleInstalledNow = await installExample();
  }

  const after = await readState();
  await writeState({
    seenVersion: TUTORIAL_VERSION,
    exampleEverInstalled: after.exampleEverInstalled,
  });

  return { exampleInstalledNow };
}


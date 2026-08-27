import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { gameApi } from '../games/services/gameApi';
import type { GameResponse } from '../games/types/game';
import { bookApi } from '../services/bookApi';
import { mediaApi } from '../services/mediaApi';
import {
  paletteOnlineApi,
  type PaletteCreatedTarget,
  type PaletteOnlineKind,
  type PaletteOnlineResult,
} from '../services/paletteOnlineApi';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import { entityLinksApi } from '../services/entityLinksApi';
import { collectionApi } from '../services/collectionApi';
import type { CollectionSummary, EntityReference } from '../types/collection';
import { entryApi } from '../services/entryApi';
import { memoryRadioApi } from '../services/memoryRadioApi';
import type { Entry } from '../types/entry';
import type { MemoryTrack } from '../types/memoryRadio';
import type { BookResponse } from '../types/book';
import type { MediaResponse } from '../types/media';
import { topicApi } from '../services/topicApi';
import { createdFeedback } from '../utils/crudFeedback';
import type { EntryType } from '../types/entry';
import type { TopicResponse } from '../types/topic';
import { runCloudSync } from '../services/cloudSync';
import { semanticFeedback } from '../utils/semanticFeedback';
import { isPaletteInteractionLocked } from '../utils/paletteInteractionLock';
// forkLCollectionsMemoryBoxV2
import { semanticSearch } from '../intelligence/semanticIndex';
import { rememberContextAlias } from '../intelligence/contextAliasMemory';
import { planQuietSearch } from '../intelligence/quietIntent';
import { activityApi } from '../services/activityApi';
import { saveBookReadingPage, saveSessionNote } from '../services/sessionNotes';
import {
  loadQuietActiveContext,
  parseQuietContextIntent,
  type QuietActiveContext,
  type QuietContextIntent,
} from '../intelligence/activeContext';
import {
  activeBookKey,
  activeEntityKey,
  parseContextualVerbIntent,
  type ContextualVerbIntent,
} from '../intelligence/contextualLanguage';
import {
  routeLJingleIntent,
  toContextualVerbIntent,
  toQuietContextIntent,
  type LJingleIntent,
} from '../intelligence/intentRouter';
import {
  routeWithLocalLanguageModel,
  shouldAskLocalLanguageModel,
} from '../intelligence/languageModel/languageRouter';
import type { LocalLanguagePlanResult, RawModelIntent } from '../intelligence/languageModel/types';
import {
  compoundPlanCanExecute,
  isLikelyCompoundLanguage,
  planCompoundLanguage,
} from '../intelligence/languageModel/compoundIntentPlanner';
import {
  resolveReferent,
  type ReferentResolution,
  type ResolvableEntity,
} from '../intelligence/languageModel/referentResolver';
import {
  getDiscourseState,
  parseDiscourseCorrection,
  rememberAction,
  rememberReferent,
} from '../intelligence/languageModel/discourseMemory';
import {
  deleteLocalLanguageBrain,
  disableLocalLanguageBrain,
  enableLocalLanguageBrain,
  getLocalLanguageBrainStatus,
  isLocalLanguageBrainEnabled,
} from '../intelligence/languageModel/modelManager';
import {
  commandHelpForInput,
  isCommandShapedInput,
  isExplicitSearchInput,
  parseNaturalPaletteNote,
  shouldRememberAsSearch,
} from '../intelligence/paletteIntentGate';
import {
  collapseSpokenRepeats,
  fuzzyTextIncludes,
  fuzzyWord,
  parseNaturalCreateCommand,
} from '../intelligence/deterministicLanguage';
// forkK15BrainlessContextualLanguageV1
import { celestial, celestialAlpha } from '../theme/celestial';
// forkK5QuietIntelligenceV1
// forkK6ActiveContextV1
// forkK7ContextualVerbsV1
// forkK8IntentRouterV1
// forkK9LocalLanguageBrainV1
// forkK10ReferentialResolutionV1
// forkK11CompoundIntentPlannerV1
// forkK12DiscourseMemoryV1

// forkN1CelestialHomeCommandBellV1
const celestialMode = activeVisualSkinId === 'classic';

// forkK14_1IntentFirstPaletteBrainUiV1
// forkK14_1_1BrainPolishCommandOwnershipV1
import {
  mutationSourcePhrase,
  mutationTargetPhrase,
  parseDeterministicMutationCommand,
  type DeterministicMutationCommand,
  type EntityPhrase,
} from '../intelligence/deterministicMutation';
import { saveBookReadingPageDirect } from '../services/sessionNotes';


import {
  setUiSoundEffectsEnabled,
} from '../audio/uiSoundPreference';
import {
  sharePortableCollection,
  sharePortableEntity,
} from '../services/portableExport';

// paletteEnterOwnershipFastIntentsV1_1

type PaletteFastIntent =
  | {
      kind: 'UPDATE_BOOK_PAGE';
      subject: string;
      page: number;
      implicitBook: boolean;
    }
  | {
      kind: 'ADD_TO_COLLECTION';
      subject: string;
      destination: string;
    }
  | {
      kind: 'ADD_TO_TOPIC';
      subject: string;
      destination: string;
    }
  | {
      kind: 'CREATE_NOTE_TO_COLLECTION';
      content: string;
      destination: string;
    }
  | {
      kind: 'CREATE_NOTE_TO_TOPIC';
      content: string;
      destination: string;
    }
  | {
      kind: 'CREATE_BOOK_DESTINATION';
      title: string;
      destinationKind: 'COLLECTION' | 'TOPIC';
      destination: string;
    };

function paletteFastNorm(
  value: unknown,
) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function parsePaletteFastIntent(
  value: string,
): PaletteFastIntent | null {
  const clean =
    value
      .trim()
      .replace(/\s+/g, ' ');

  if (!clean) return null;

  // str 50 / page 50
  const barePage =
    clean.match(
      /^(?:str(?:anica|anici)?\.?|page)\s*#?\s*(\d{1,6})$/i,
    );

  if (barePage) {
    return {
      kind: 'UPDATE_BOOK_PAGE',
      subject: 'current book',
      page: Number(barePage[1]),
      implicitBook: true,
    };
  }

  // dune str 50 / update dune str 44 / zadnja knjiga str 50
  const namedPage =
    clean.match(
      /^(?:(?:update|set|postavi|azuriraj|ažuriraj|promijeni|promeni)\s+)?(.+?)\s+(?:na\s+|to\s+)?(?:str(?:anica|anici)?\.?|page)\s*#?\s*(\d{1,6})$/i,
    );

  if (namedPage) {
    const subject =
      String(namedPage[1] ?? '')
        .trim();

    const implicitBook =
      /^(?:zadnja|zadnji|zadnje|posljednja|poslednja|last|latest|recent|current|ova|this)\s+(?:knjiga|book)$/i.test(
        subject,
      );

    return {
      kind: 'UPDATE_BOOK_PAGE',
      subject,
      page: Number(namedPage[2]),
      implicitBook,
    };
  }

  // note haha#winter / biljeska haha @jung
  const noteDestination =
    clean.match(
      /^(?:note|biljeska|bilješka)\s+([\s\S]+?)\s*([#@])\s*(?:"([^"]+)"|(.+))$/i,
    );

  if (noteDestination) {
    const content =
      String(
        noteDestination[1] ??
          '',
      ).trim();

    const sigil =
      noteDestination[2];

    const destination =
      String(
        noteDestination[3] ??
          noteDestination[4] ??
          '',
      ).trim();

    if (
      content &&
      destination
    ) {
      return sigil === '#'
        ? {
            kind:
              'CREATE_NOTE_TO_COLLECTION',
            content,
            destination,
          }
        : {
            kind:
              'CREATE_NOTE_TO_TOPIC',
            content,
            destination,
          };
    }
  }

  // new book haha@topux / nova knjiga haha #winter
  const createBookDestination =
    clean.match(
      /^(?:new\s+book|nova\s+knjiga|novu\s+knjigu|create\s+book|napravi\s+knjigu|stvori\s+knjigu)\s+([\s\S]+?)\s*([#@])\s*(?:"([^"]+)"|(.+))$/i,
    );

  if (createBookDestination) {
    const title =
      String(
        createBookDestination[1] ??
          '',
      ).trim();

    const sigil =
      createBookDestination[2];

    const destination =
      String(
        createBookDestination[3] ??
          createBookDestination[4] ??
          '',
      ).trim();

    if (
      title &&
      destination
    ) {
      return {
        kind:
          'CREATE_BOOK_DESTINATION',
        title,
        destinationKind:
          sigil === '#'
            ? 'COLLECTION'
            : 'TOPIC',
        destination,
      };
    }
  }

  // dodaj/stavi/ubaci dune #winter
  // dodaj/stavi dune u @lynch
  const addDestination =
    clean.match(
      /^(?:dodaj|stavi|ubaci|add|put)\s+([\s\S]+?)(?:\s+(?:u|in|into|to))?\s*([#@])\s*(?:"([^"]+)"|(.+))$/i,
    );

  if (addDestination) {
    const subject =
      String(
        addDestination[1] ??
          '',
      ).trim();

    const sigil =
      addDestination[2];

    const destination =
      String(
        addDestination[3] ??
          addDestination[4] ??
          '',
      ).trim();

    if (
      subject &&
      destination
    ) {
      return sigil === '#'
        ? {
            kind:
              'ADD_TO_COLLECTION',
            subject,
            destination,
          }
        : {
            kind:
              'ADD_TO_TOPIC',
            subject,
            destination,
          };
    }
  }

  return null;
}

function paletteCommandRunsOnEnter(
  command: PaletteCommand,
) {
  return (
    command.kindLabel === 'AKCIJA' ||
    command.kindLabel === 'POTVRDA' ||
    command.kindLabel ===
      'PLAN · POTVRDA'
  );
}

function paletteFastCandidates(
  entities: SearchEntity[],
  subject: string,
  options?: {
    kind?: SearchEntity['kind'];
    current?: SearchEntity | null;
    implicit?: boolean;
  },
) {
  const pool =
    options?.kind
      ? entities.filter(
          (entity) =>
            entity.kind ===
            options.kind,
        )
      : entities;

  if (
    options?.implicit &&
    options.current &&
    (
      !options.kind ||
      options.current.kind ===
        options.kind
    )
  ) {
    return [
      options.current,
    ];
  }

  const q =
    paletteFastNorm(
      subject,
    );

  if (!q) return [];

  if (
    /^(?:ovo|to|this|that|it|current|trenutno|trenutna|zadnje|zadnja|zadnji|last|latest|recent)$/.test(
      q,
    ) &&
    options?.current &&
    (
      !options.kind ||
      options.current.kind ===
        options.kind
    )
  ) {
    return [
      options.current,
    ];
  }

  const exact =
    pool.filter(
      (entity) =>
        paletteFastNorm(
          entity.title,
        ) === q,
    );

  if (exact.length > 0) {
    return exact.slice(0, 6);
  }

  const prefix =
    pool.filter((entity) => {
      const title =
        paletteFastNorm(
          entity.title,
        );

      return (
        title.startsWith(q) ||
        q.startsWith(title)
      );
    });

  if (prefix.length === 1) {
    return prefix;
  }

  const fuzzy =
    pool.filter((entity) => {
      const hay =
        paletteFastNorm(
          [
            entity.title,
            entity.meta,
            entity.typeLabel,
          ].join(' '),
        );

      return hay.includes(q);
    });

  return fuzzy.length <= 6
    ? fuzzy
    : fuzzy.slice(0, 6);
}

type Props = {
  navigation: any;
  openSignal?: number;
};

type SearchEntity = {
  key: string;
  kind: 'BOOK' | 'MEDIA' | 'GAME' | 'TOPIC' | 'ENTRY' | 'FREQUENCY';
  id: string;
  title: string;
  typeLabel: string;
  meta: string;
  favourite: boolean;
};

// forkCCommandSemanticLabelsV1
type PaletteCommand = {
  key: string;
  label: string;
  detail: string;
  aliases: string;
  kindLabel?: 'OTVORI' | 'AKCIJA' | 'POTVRDA' | 'KONTEKST' | 'PLAN' | 'PLAN · POTVRDA';
  action: () => void | Promise<void>;
};

type PaletteItem =
  | {
      itemType: 'command';
      command: PaletteCommand;
    }
  | {
      itemType: 'entity';
      entity: SearchEntity;
    }
  | {
      itemType: 'online';
      result: PaletteOnlineResult;
    };

function normalize(value: unknown) {
  return String(value ?? '')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

type QuickCreateCommand =
  | { kind: 'ENTRY'; type: EntryType; content: string; label: string }
  | { kind: 'BOOK'; title: string }
  | { kind: 'TOPIC'; name: string };

function parseQuickCreateCommand(value: string): QuickCreateCommand | null {
  const clean = value.trim();

  const newBook = clean.match(
    /^:new\s+book\s+([\s\S]+)$/i,
  );

  if (newBook) {
    const title = (newBook[1] ?? '').trim();
    return title
      ? { kind: 'BOOK', title }
      : null;
  }

  const match = clean.match(/^:([a-z]+)\s+([\s\S]+)$/i);
  if (!match) return null;

  const command = (match[1] ?? '').toLocaleLowerCase();
  const payload = (match[2] ?? '').trim();
  if (!payload) return null;

  if (command === 'note') {
    return { kind: 'ENTRY', type: 'NOTE', content: payload, label: 'Bilješka' };
  }

  if (command === 'quote') {
    return { kind: 'ENTRY', type: 'QUOTE', content: payload, label: 'Citat' };
  }

  if (command === 'obs' || command === 'observation') {
    return { kind: 'ENTRY', type: 'OBSERVATION', content: payload, label: 'Opažanje' };
  }

  if (command === 'review') {
    return { kind: 'ENTRY', type: 'REVIEW', content: payload, label: 'Osvrt' };
  }

  if (command === 'topic') {
    return { kind: 'TOPIC', name: payload };
  }

  return null;
}

type OnlineSearchCommand = {
  kind: PaletteOnlineKind;
  query: string;
  command: ':movie' | ':tv' | ':book' | ':game';
};

function cleanOnlinePayload(value: string) {
  const clean = value.trim();

  if (
    clean.length >= 2 &&
    ((clean.startsWith('"') && clean.endsWith('"')) ||
      (clean.startsWith('“') && clean.endsWith('”')))
  ) {
    return clean.slice(1, -1).trim();
  }

  return clean;
}

function parseOnlineSearchCommand(
  value: string,
): OnlineSearchCommand | null {
  const match = value
    .trim()
    .match(/^:(movie|tv|book|game)(?:\s+([\s\S]*))?$/i);

  if (!match) return null;

  const command =
    ':' +
    (match[1] ?? '').toLocaleLowerCase();

  const query = cleanOnlinePayload(
    match[2] ?? '',
  );

  const kind: PaletteOnlineKind =
    command === ':movie'
      ? 'MOVIE'
      : command === ':tv'
        ? 'TV'
        : command === ':book'
          ? 'BOOK'
          : 'GAME';

  return {
    kind,
    query,
    command: command as
      | ':movie'
      | ':tv'
      | ':book'
      | ':game',
  };
}

type BrainCommand = 'STATUS' | 'ENABLE' | 'DISABLE' | 'DELETE';

function parseBrainCommand(value: string): BrainCommand | null {
  const clean = value.trim().toLocaleLowerCase();
  if (clean === ':brain') return 'STATUS';
  if (clean === ':brain on' || clean === ':brain enable') return 'ENABLE';
  if (clean === ':brain off' || clean === ':brain disable') return 'DISABLE';
  if (clean === ':brain delete' || clean === ':brain remove') return 'DELETE';
  return null;
}

type PaletteActionCommand =
  | { kind: 'TIMER'; query: string }
  | { kind: 'STOP'; query: string }
  | { kind: 'JINGLE_MODE' }
  | { kind: 'RANDOM'; target: 'BOOK' | 'GAME' | 'JINGLE' }
  | { kind: 'HELP' }
  | { kind: 'SYNC' };

function parsePaletteActionCommand(value: string): PaletteActionCommand | null {
  const clean = value.trim();
  const simple = clean.match(/^:(jingle|help|sync)$/i);

  if (simple) {
    const command = (simple[1] ?? '').toLocaleLowerCase();
    if (command === 'jingle') return { kind: 'JINGLE_MODE' };
    if (command === 'help') return { kind: 'HELP' };
    if (command === 'sync') return { kind: 'SYNC' };
  }

  const random = clean.match(/^:random\s+(book|game|jingle)$/i);
  if (random) {
    return {
      kind: 'RANDOM',
      target: (random[1] ?? '').toLocaleUpperCase() as 'BOOK' | 'GAME' | 'JINGLE',
    };
  }

  const timed = clean.match(/^:(timer|stop)(?:\s+([\s\S]+))?$/i);
  if (!timed) return null;

  const command = (timed[1] ?? '').toLocaleLowerCase();
  const payload = (timed[2] ?? '').trim();

  if (command === 'stop') return { kind: 'STOP', query: payload };
  if (command === 'timer' && payload) return { kind: 'TIMER', query: payload };

  return null;
}

function pickBestByText<T>(
  items: T[],
  value: string,
  getText: (item: T) => string,
): T | null {
  const needle = normalize(value.trim());
  if (!needle) return null;

  const exact = items.filter((item) => normalize(getText(item)) === needle);
  if (exact.length === 1) return exact[0] ?? null;

  const starts = items.filter((item) => normalize(getText(item)).startsWith(needle));
  if (starts.length === 1) return starts[0] ?? null;

  const contains = items.filter((item) => normalize(getText(item)).includes(needle));
  return contains.length === 1 ? contains[0] ?? null : null;
}

function splitTopicSuffix(value: string) {
  const clean = value.trim();
  const at = clean.lastIndexOf('@');

  if (at <= 0) {
    return { content: clean, topicQuery: '' };
  }

  const before = clean.slice(0, at).trim();
  const after = clean.slice(at + 1).trim();

  if (!before || !after) {
    return { content: clean, topicQuery: '' };
  }

  return {
    content: before,
    topicQuery: after,
  };
}

// commandPaletteRecentsV2
const RECENT_SEARCHES_KEY = 'tracking_command_palette_recent_searches';
const RECENT_ITEMS_KEY = 'tracking_command_palette_recent_items';

function readStoredArray<T>(key: string): T[] {
  if (Platform.OS !== 'web') return [];

  try {
    const raw = (globalThis as any).localStorage?.getItem(key);

    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredArray(
  key: string,
  value: unknown[],
) {
  if (Platform.OS !== 'web') return;

  try {
    (globalThis as any).localStorage?.setItem(
      key,
      JSON.stringify(value),
    );
  } catch {
    // Recents are optional; palette must keep working.
  }
}

const BRAIN_PINK = '#FF4FA3';
const BRAIN_LIME = '#C7F22B';

function brainColorDistance(first: string, second: string) {
  const parse = (value: string) => {
    const hex = /^#[0-9A-F]{6}$/i.test(value) ? value.slice(1) : '000000';
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ];
  };
  const a = parse(first);
  const b = parse(second);
  const dr = (a[0] ?? 0) - (b[0] ?? 0);
  const dg = (a[1] ?? 0) - (b[1] ?? 0);
  const db = (a[2] ?? 0) - (b[2] ?? 0);
  return dr * dr + dg * dg + db * db;
}

function pickBrainContrastColor(accent: string) {
  return brainColorDistance(accent, BRAIN_PINK) >= brainColorDistance(accent, BRAIN_LIME)
    ? BRAIN_PINK
    : BRAIN_LIME;
}

function BrainGlyph({
  color,
  enabled,
  loaded,
}: {
  color: string;
  enabled: boolean;
  loaded: boolean;
}) {
  const activeColor = enabled ? color : '#8B8B91';
  const opacity = loaded ? 1 : enabled ? 0.72 : 0.34;
  const stroke = 1.45;

  return (
    <View
      style={{
        width: 25,
        height: 22,
        position: 'relative',
        opacity,
      }}
    >
      {/* left hemisphere */}
      <View
        style={{
          position: 'absolute',
          left: 2,
          top: 2,
          width: 10.5,
          height: 18,
          borderWidth: stroke,
          borderRightWidth: stroke * 0.65,
          borderColor: activeColor,
          borderTopLeftRadius: 7,
          borderBottomLeftRadius: 7,
          borderTopRightRadius: 4,
          borderBottomRightRadius: 4,
        }}
      />

      {/* right hemisphere */}
      <View
        style={{
          position: 'absolute',
          right: 2,
          top: 2,
          width: 10.5,
          height: 18,
          borderWidth: stroke,
          borderLeftWidth: stroke * 0.65,
          borderColor: activeColor,
          borderTopRightRadius: 7,
          borderBottomRightRadius: 7,
          borderTopLeftRadius: 4,
          borderBottomLeftRadius: 4,
        }}
      />

      {/* central sulcus */}
      <View
        style={{
          position: 'absolute',
          left: 12,
          top: 4,
          width: 1,
          height: 14,
          borderRadius: 1,
          backgroundColor: activeColor,
          opacity: 0.72,
        }}
      />

      {/* gyri — short quiet strokes instead of six circles */}
      <View style={{ position: 'absolute', left: 4.5, top: 6, width: 5, height: 1.3, borderRadius: 2, backgroundColor: activeColor }} />
      <View style={{ position: 'absolute', left: 5.5, top: 11, width: 4, height: 1.3, borderRadius: 2, backgroundColor: activeColor }} />
      <View style={{ position: 'absolute', left: 4.5, top: 15.5, width: 5, height: 1.3, borderRadius: 2, backgroundColor: activeColor }} />

      <View style={{ position: 'absolute', right: 4.5, top: 6, width: 5, height: 1.3, borderRadius: 2, backgroundColor: activeColor }} />
      <View style={{ position: 'absolute', right: 5.5, top: 11, width: 4, height: 1.3, borderRadius: 2, backgroundColor: activeColor }} />
      <View style={{ position: 'absolute', right: 4.5, top: 15.5, width: 5, height: 1.3, borderRadius: 2, backgroundColor: activeColor }} />

      {/* loaded = actually resident in memory */}
      {loaded ? (
        <View
          style={{
            position: 'absolute',
            right: -1,
            top: 0,
            width: 4.5,
            height: 4.5,
            borderRadius: 3,
            backgroundColor: color,
          }}
        />
      ) : null}
    </View>
  );
}

export function CommandPalette({
  navigation,
  openSignal = 0,
}: Props) {
  // commandPaletteV1
  // commandPalettePeekGestureV1
  const inputRef = useRef<TextInput>(null);

  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const [books, setBooks] = useState<BookResponse[]>([]);
  const [media, setMedia] = useState<MediaResponse[]>([]);
  const [games, setGames] = useState<GameResponse[]>([]);
  const [topics, setTopics] = useState<TopicResponse[]>([]);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [frequencies, setFrequencies] = useState<MemoryTrack[]>([]);

  const [loading, setLoading] = useState(false);
  const [quickCommandBusy, setQuickCommandBusy] = useState(false);
  const [quickCommandError, setQuickCommandError] = useState<string | null>(null);
  const [jingleMode, setJingleMode] = useState(false);

  // forkHCommandPaletteV2
  const [onlineResults, setOnlineResults] =
    useState<PaletteOnlineResult[]>([]);
  const [onlineLoading, setOnlineLoading] =
    useState(false);
  const [onlineSearched, setOnlineSearched] =
    useState(false);
  const [onlineError, setOnlineError] =
    useState<string | null>(null);

  // brutusPaletteExtendedEntitiesV1
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    void Promise.all([
      entryApi.getAll(),
      memoryRadioApi.getAll(),
    ])
      .then(([nextEntries, nextFrequencies]) => {
        if (cancelled) return;
        setEntries(nextEntries);
        setFrequencies(nextFrequencies);
      })
      .catch(() => {
        // Extended search is additive. Existing palette stays usable.
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const [recentSearches, setRecentSearches] =
    useState<string[]>([]);

  const [recentEntities, setRecentEntities] =
    useState<SearchEntity[]>([]);
  const [quietSemanticEntities, setQuietSemanticEntities] =
    useState<SearchEntity[]>([]);
  const [activeContext, setActiveContext] =
    useState<QuietActiveContext | null>(null);
  const [contextLinkTarget, setContextLinkTarget] =
    useState<SearchEntity | null>(null);
  const [contextualTarget, setContextualTarget] =
    useState<SearchEntity | null>(null);
  const [localLanguageIntent, setLocalLanguageIntent] =
    useState<LJingleIntent | null>(null);
  const [localLanguageRaw, setLocalLanguageRaw] =
    useState<RawModelIntent | null>(null);
  const [localReferentResolution, setLocalReferentResolution] =
    useState<ReferentResolution | null>(null);
  
  const [k15MutationSourceResolution, setK15MutationSourceResolution] =
    useState<Awaited<ReturnType<typeof resolveReferent>> | null>(null);
  const [k15MutationTargetResolution, setK15MutationTargetResolution] =
    useState<Awaited<ReturnType<typeof resolveReferent>> | null>(null);
const [localLanguagePlan, setLocalLanguagePlan] =
    useState<LocalLanguagePlanResult | null>(null);
  const [localLanguageLoading, setLocalLanguageLoading] =
    useState(false);
  const [brainStatus, setBrainStatus] = useState({
    enabled: false,
    downloaded: false,
    loaded: false,
  });
  const brainAccentColor = useMemo(
    () =>
      Math.random() < 0.5
        ? BRAIN_PINK
        : BRAIN_LIME,
    [visible],
  );

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void getLocalLanguageBrainStatus()
      .then((status) => {
        if (!cancelled) {
          setBrainStatus({
            enabled: status.enabled,
            downloaded: status.downloaded,
            loaded: status.loaded,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const [jingleGraph, setJingleGraph] =
    useState<EntityReference[]>([]);

  useEffect(() => {
    if (!visible) {
      setActiveContext(null);
      setContextLinkTarget(null);
      return;
    }

    let cancelled = false;

    void loadQuietActiveContext()
      .then((context) => {
        if (!cancelled) setActiveContext(context);
      })
      .catch(() => {
        if (!cancelled) setActiveContext(null);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  // brutusJingleGraphV2
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    void entityLinksApi
      .jingleReferences()
      .then((items) => {
        if (!cancelled) setJingleGraph(items);
      })
      .catch(() => {
        if (!cancelled) setJingleGraph([]);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (openSignal <= 0) return;
    if (isPaletteInteractionLocked()) return;

    setVisible(true);
  }, [openSignal]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    setRecentSearches(
      readStoredArray<string>(RECENT_SEARCHES_KEY)
        .slice(0, 4)
    );

    setRecentEntities(
      readStoredArray<SearchEntity>(RECENT_ITEMS_KEY)
        .slice(0, 5)
    );
  }, []);

  const rememberSearch = (value: string) => {
    const clean = value.trim();

    if (!clean || !shouldRememberAsSearch(clean)) return;

    setRecentSearches((current) => {
      const next = [
        clean,
        ...current.filter(
          (item) =>
            normalize(item) !== normalize(clean)
        ),
      ].slice(0, 4);

      writeStoredArray(
        RECENT_SEARCHES_KEY,
        next,
      );

      return next;
    });
  };

  const rememberEntity = (
    entity: SearchEntity,
  ) => {
    setRecentEntities((current) => {
      const next = [
        entity,
        ...current.filter(
          (item) => item.key !== entity.key
        ),
      ].slice(0, 5);

      writeStoredArray(
        RECENT_ITEMS_KEY,
        next,
      );

      return next;
    });
  };

  const close = () => {
    setVisible(false);
    setQuery('');
    setSelectedIndex(-1);
    setQuickCommandError(null);
    setJingleMode(false);
    setOnlineResults([]);
    setOnlineLoading(false);
    setOnlineSearched(false);
    setOnlineError(null);
  };

  const navigate = (
    route: string,
    params?: unknown,
  ) => {
    if (!navigation?.isReady?.()) return;

    if (params === undefined) {
      navigation.navigate(route);
    } else {
      navigation.navigate(route, params);
    }

    close();
  };

  const openEntity = (entity: SearchEntity) => {
    rememberEntity(entity);
    rememberSearch(query);
    rememberContextAlias(entity.key, query);

    if (entity.kind === 'BOOK') {
      navigate('BookDetails', {
        bookId: entity.id,
      });
      return;
    }

    if (entity.kind === 'MEDIA') {
      navigate('Media', {
        screen: 'MediaDetails',
        params: {
          mediaId: entity.id,
        },
      });
      return;
    }

    if (entity.kind === 'TOPIC') {
      navigate('TopicDetails', {
        topicId: entity.id,
      });
      return;
    }

    if (entity.kind === 'ENTRY') {
      navigate('EntryForm', {
        entryId: entity.id,
      });
      return;
    }

    if (entity.kind === 'FREQUENCY') {
      navigate('MemoryRadio');
      return;
    }

    navigate('Games', {
      screen: 'GameDetails',
      params: {
        gameId: entity.id,
      },
    });
  };

  const openCreatedTarget = (
    target: PaletteCreatedTarget,
  ) => {
    if (target.kind === 'BOOK') {
      navigate('BookDetails', {
        bookId: target.id,
      });
      return;
    }

    if (target.kind === 'MEDIA') {
      navigate('Media', {
        screen: 'MediaDetails',
        params: {
          mediaId: target.id,
        },
      });
      return;
    }

    navigate('Games', {
      screen: 'GameDetails',
      params: {
        gameId: target.id,
      },
    });
  };

  const runOnlineImport = async (
    result: PaletteOnlineResult,
  ) => {
    if (quickCommandBusy) return;

    setQuickCommandBusy(true);
    setQuickCommandError(null);

    try {
      const target =
        await paletteOnlineApi.create(result);

      rememberSearch(query);
      createdFeedback();
      openCreatedTarget(target);
    } catch (caught) {
      setQuickCommandError(
        caught instanceof Error
          ? caught.message
          : 'Online rezultat nije moguće dodati.',
      );
    } finally {
      setQuickCommandBusy(false);
    }
  };

  const runManualOnlineCreate = async (
    kind: PaletteOnlineKind,
    title: string,
  ) => {
    if (quickCommandBusy) return;

    setQuickCommandBusy(true);
    setQuickCommandError(null);

    try {
      const target =
        await paletteOnlineApi.createManual(
          kind,
          title,
        );

      rememberSearch(query);
      createdFeedback();
      openCreatedTarget(target);
    } catch (caught) {
      setQuickCommandError(
        caught instanceof Error
          ? caught.message
          : 'Ručno dodavanje nije uspjelo.',
      );
    } finally {
      setQuickCommandBusy(false);
    }
  };

  const toggleEntityJingle = async (entity: SearchEntity) => {
    if (
      entity.kind !== 'BOOK' &&
      entity.kind !== 'MEDIA' &&
      entity.kind !== 'GAME'
    ) {
      throw new Error('Jingle toggle trenutno podržava knjige, filmove/serije i igre.');
    }

    const next = !entity.favourite;

    if (entity.kind === 'MEDIA') {
      await mediaApi.setFavourite(entity.id, next);
      setMedia((current) =>
        current.map((item) =>
          item.mediaId === entity.id ? { ...item, favourite: next } : item,
        ),
      );
    } else if (entity.kind === 'BOOK') {
      const current = await bookApi.getById(entity.id);
      const { bookId, ...payload } = current;
      await bookApi.update(bookId, { ...payload, favourite: next });
      setBooks((items) =>
        items.map((item) =>
          item.bookId === entity.id ? { ...item, favourite: next } : item,
        ),
      );
    } else {
      const current = await gameApi.getById(entity.id);
      const { gameId, playingActivityId, dnf, ...payload } = current;
      await gameApi.update(gameId, { ...payload, favourite: next });
      setGames((items) =>
        items.map((item) =>
          item.gameId === entity.id ? { ...item, favourite: next } : item,
        ),
      );
    }

    void semanticFeedback.jingle(next);
  };

  const resolveTopic = async (queryValue: string) => {
    const clean = queryValue.trim();
    const source = topics.length > 0 ? topics : await topicApi.getAll();

    const exact = source.filter(
      (topic) => normalize(topic.name) === normalize(clean),
    );

    if (exact.length === 1) return exact[0] ?? null;
    if (exact.length > 1) return null;

    const fuzzy = pickBestByText(source, clean, (topic) => topic.name);
    if (fuzzy) return fuzzy;

    const created = await topicApi.create({ name: clean });
    setTopics((current) => {
      const exists = current.some((topic) => topic.topicId === created.topicId);
      return exists ? current : [created, ...current];
    });
    return created;
  };

  const runQuickCreate = async (command: QuickCreateCommand) => {
    if (quickCommandBusy) return;

    setQuickCommandBusy(true);
    setQuickCommandError(null);

    try {
      if (command.kind === 'ENTRY') {
        const linked = splitTopicSuffix(command.content);
        let topicId: string | null = null;

        if (linked.topicQuery) {
          const topic = await resolveTopic(linked.topicQuery);
          if (!topic) {
            throw new Error(
              'Tema @' + linked.topicQuery + ' postoji više puta i nije jednoznačna.',
            );
          }
          topicId = topic.topicId;
        }

        if (!linked.content) {
          throw new Error('Sadržaj zapisa ne smije biti prazan.');
        }

        await entryApi.create({
          title: null,
          content: linked.content,
          type: command.type,
          bookId: null,
          topicId,
          activityId: null,
        });
      } else if (command.kind === 'BOOK') {
        await bookApi.create({
          title: command.title,
          author: '',
          isbn: '',
          publishedYear: 0,
          readingStatus: 'LATER',
          progress: 0,
          enjoyment: null,
          favourite: false,
          startedOn: null,
          finishedOn: null,
        });
      } else {
        await topicApi.create({ name: command.name });
      }

      createdFeedback();
      close();
    } catch (caught) {
      setQuickCommandError(
        caught instanceof Error ? caught.message : 'Naredba nije uspjela.',
      );
    } finally {
      setQuickCommandBusy(false);
    }
  };

  const runActionCommand = async (command: PaletteActionCommand) => {
    if (quickCommandBusy) return;

    setQuickCommandBusy(true);
    setQuickCommandError(null);

    try {
      if (command.kind === 'SYNC') {
        const result = await runCloudSync({ reason: 'MANUAL' });
        if (result.outcome === 'error') {
          throw new Error(result.state.lastError || 'Cloud Sync nije uspio.');
        }
        close();
        return;
      }

      if (command.kind === 'JINGLE_MODE') {
        setJingleMode(true);
        setQuery('');
        setSelectedIndex(-1);
        setQuickCommandBusy(false);
        return;
      }

      if (command.kind === 'HELP') {
        setQuery(':');
        setSelectedIndex(-1);
        setQuickCommandBusy(false);
        return;
      }

      if (command.kind === 'RANDOM') {
        let pool: SearchEntity[] = [];

        if (command.target === 'BOOK') {
          pool = entities.filter(
            (entity) =>
              entity.kind === 'BOOK' &&
              books.some(
                (book) =>
                  book.bookId === entity.id &&
                  book.readingStatus !== 'COMPLETED' &&
                  book.readingStatus !== 'DROPPED',
              ),
          );
        } else if (command.target === 'GAME') {
          pool = entities.filter(
            (entity) =>
              entity.kind === 'GAME' &&
              games.some(
                (game) =>
                  game.gameId === entity.id &&
                  game.gameStatus !== 'COMPLETED' &&
                  game.gameStatus !== 'DROPPED' &&
                  game.gameStatus !== 'QUIT' &&
                  game.gameStatus !== 'PLAYED_BEFORE',
              ),
          );
        } else {
          pool = entities.filter((entity) => entity.favourite);
        }

        const picked =
          pool[Math.floor(Math.random() * pool.length)] ?? null;

        if (!picked) {
          throw new Error(
            command.target === 'BOOK'
              ? 'Nema nepročitanih knjiga za random izbor.'
              : command.target === 'GAME'
                ? 'Nema nezavršenih igara za random izbor.'
                : 'Nema Jingle itema za random izbor.',
          );
        }

        void semanticFeedback.randomPick();
        openEntity(picked);
        return;
      }

      if (command.kind === 'STOP') {
        const active = await topicApi.getActiveActivities();
        const activeItems = active as Array<{ activityId?: string | null; label?: string | null }>;

        let match: { activityId?: string | null; label?: string | null } | null = null;

        if (!command.query) {
          match = activeItems.length === 1 ? activeItems[0] ?? null : null;
          if (!match) {
            throw new Error(
              activeItems.length === 0
                ? 'Nema aktivnog timera.'
                : 'Aktivno je više timera — napiši :stop <naziv>.',
            );
          }
        } else {
          match = pickBestByText(
            activeItems,
            command.query,
            (item) => item.label ?? '',
          );
          if (!match) {
            throw new Error(
              'Ne mogu jednoznačno pronaći aktivni timer “' + command.query + '”.',
            );
          }
        }

        if (!match.activityId) throw new Error('Aktivni timer nema activityId.');
        await topicApi.stopActivity(match.activityId);
        void semanticFeedback.timerStop();
        close();
        return;
      }

      // TIMER
      const allTopics = topics.length > 0 ? topics : await topicApi.getAll();
      const groups = await Promise.all(
        allTopics.map(async (topic) => ({
          topic,
          activities: await topicApi.getActivities(topic.topicId),
        })),
      );

      const flat = groups.flatMap(({ topic, activities }) =>
        activities.map((activity) => ({
          topic,
          activity,
          search:
            activity.label +
            ' ' +
            topic.name,
        })),
      );

      let picked = pickBestByText(flat, command.query, (item) => item.activity.label);

      if (!picked) {
        const topic = pickBestByText(allTopics, command.query, (item) => item.name);
        if (topic) {
          const group = groups.find((item) => item.topic.topicId === topic.topicId);
          if (group?.activities.length === 1) {
            const activity = group.activities[0];
            if (activity) picked = { topic, activity, search: activity.label + ' ' + topic.name };
          } else if ((group?.activities.length ?? 0) > 1) {
            throw new Error(
              'Tema “' + topic.name + '” ima više aktivnosti — napiši naziv aktivnosti.',
            );
          }
        }
      }

      if (!picked) {
        picked = pickBestByText(flat, command.query, (item) => item.search);
      }

      if (!picked) {
        throw new Error('Ne mogu jednoznačno pronaći aktivnost “' + command.query + '”.');
      }

      await topicApi.startActivity(picked.activity.activityId);
      void semanticFeedback.timerStart();
      close();
    } catch (caught) {
      setQuickCommandError(
        caught instanceof Error ? caught.message : 'Naredba nije uspjela.',
      );
    } finally {
      setQuickCommandBusy(false);
    }
  };

  const runBrainCommand = async (command: BrainCommand) => {
    if (quickCommandBusy) return;
    setQuickCommandBusy(true);
    setQuickCommandError(null);

    try {
      if (command === 'ENABLE') {
        const status = await enableLocalLanguageBrain();
        setBrainStatus({ enabled: status.enabled, downloaded: status.downloaded, loaded: status.loaded });
        createdFeedback();
        close();
        return;
      }
      if (command === 'DISABLE') {
        const status = await disableLocalLanguageBrain();
        setBrainStatus({ enabled: status.enabled, downloaded: status.downloaded, loaded: status.loaded });
        close();
        return;
      }
      if (command === 'DELETE') {
        const status = await deleteLocalLanguageBrain();
        setBrainStatus({ enabled: status.enabled, downloaded: status.downloaded, loaded: status.loaded });
        close();
        return;
      }
      setQuery(':brain on');
    } catch (caught) {
      setQuickCommandError(
        caught instanceof Error ? caught.message : 'Local Brain nije uspio.',
      );
    } finally {
      setQuickCommandBusy(false);
    }
  };

  const runQuietContextAction = async (intent: QuietContextIntent) => {
    if (quickCommandBusy) return;

    setQuickCommandBusy(true);
    setQuickCommandError(null);

    try {
      if (intent.kind === 'BOOK_PAGE') {
        const book = activeContext?.bookContext;
        if (!book) {
          throw new Error('Ne mogu jednoznačno odrediti aktivnu knjigu.');
        }

        await saveBookReadingPage(
          book.sessionId,
          book.bookId,
          intent.page,
        );
        createdFeedback();
        close();
        return;
      }

      if (intent.kind === 'STOP_ACTIVE') {
        const timer = activeContext?.singleTimer;
        if (!timer?.activeSessionId || !timer.activityId) {
          throw new Error(
            (activeContext?.timers.length ?? 0) > 1
              ? 'Aktivno je više timera — napiši naziv ili koristi :stop <naziv>.'
              : 'Nema aktivnog timera.',
          );
        }

        if (timer.activityType === 'GLOBAL') {
          await activityApi.stopGlobal();
        } else {
          await activityApi.stop(timer.activityId);
        }

        void semanticFeedback.timerStop();
        close();
        return;
      }

      const timer = activeContext?.singleTimer;
      if (!timer?.activeSessionId) {
        throw new Error(
          (activeContext?.timers.length ?? 0) > 1
            ? 'Aktivno je više sesija — neću pogađati što znači “ovo”.'
            : 'Nema aktivne sesije za povezivanje.',
        );
      }

      if (!contextLinkTarget) {
        throw new Error('Ne mogu jednoznačno pronaći stvar koju želiš povezati.');
      }

      if (
        contextLinkTarget.kind === 'BOOK' &&
        timer.bookId === contextLinkTarget.id
      ) {
        close();
        return;
      }

      await activityApi.addSessionContext(
        timer.activeSessionId,
        contextLinkTarget.kind,
        contextLinkTarget.id,
      );
      createdFeedback();
      close();
    } catch (caught) {
      setQuickCommandError(
        caught instanceof Error
          ? caught.message
          : 'Kontekstualna radnja nije uspjela.',
      );
    } finally {
      setQuickCommandBusy(false);
    }
  };

  const runContextualVerbAction = async (
    intent: ContextualVerbIntent,
    confirmedEntity?: SearchEntity | null,
  ) => {
    if (quickCommandBusy) return;

    setQuickCommandBusy(true);
    setQuickCommandError(null);

    try {
      const currentKey = activeEntityKey(activeContext);
      const bookKey = activeBookKey(activeContext);
      const currentEntity = currentKey
        ? entities.find((entity) => entity.key === currentKey) ?? null
        : null;
      const activeBook = bookKey
        ? entities.find((entity) => entity.key === bookKey) ?? null
        : null;

      if (intent.kind === 'OPEN_CURRENT') {
        if (!currentEntity) throw new Error('Ne mogu jednoznačno odrediti što znači “ovo”.');
        openEntity(currentEntity);
        rememberAction({ action: 'OPEN', referent: currentEntity });
        return;
      }

      if (intent.kind === 'OPEN_CURRENT_BOOK') {
        if (!activeBook) throw new Error('Nema jednoznačne aktivne knjige.');
        openEntity(activeBook);
        rememberAction({ action: 'OPEN', referent: activeBook });
        return;
      }

      if (intent.kind === 'NOTE_ACTIVE') {
        const sessionId = activeContext?.singleTimer?.activeSessionId;
        if (!sessionId) {
          throw new Error(
            (activeContext?.timers.length ?? 0) > 1
              ? 'Aktivno je više sesija — neću pogađati kojoj pripada bilješka.'
              : 'Nema aktivne sesije za bilješku.',
          );
        }

        await saveSessionNote(sessionId, intent.note);
        if (currentEntity) rememberReferent(currentEntity);
        rememberAction({ action: 'NOTE', referent: currentEntity ?? activeBook ?? null });
        createdFeedback();
        close();
        return;
      }

      if (intent.kind === 'ADD_CURRENT_TO_COLLECTION') {
        const highResolved =
          localReferentResolution?.level === 'HIGH'
            ? entities.find(entity => entity.key === localReferentResolution.candidates[0]?.entity.key) ?? null
            : null;
        const sourceEntity = confirmedEntity ?? highResolved ?? currentEntity;
        if (!sourceEntity) throw new Error('Ne mogu jednoznačno odrediti što znači referenca u ovoj naredbi.');

        const target = resolveCollectionTarget(collections, intent.collectionQuery);
        if (!target) throw new Error('Ne mogu jednoznačno pronaći kolekciju “' + intent.collectionQuery + '”.');

        await collectionApi.addItem(target.collectionId, sourceEntity.kind, sourceEntity.id);
        rememberContextAlias(sourceEntity.key, query);
        rememberAction({
          action: 'ADD_TO_COLLECTION',
          referent: sourceEntity,
          destination: target.name,
        });
        createdFeedback();
        close();
        return;
      }

      if (intent.kind === 'LINK_CURRENT_ENTITY') {
        const highResolved =
          localReferentResolution?.level === 'HIGH'
            ? entities.find(
                (entity) =>
                  entity.key ===
                  localReferentResolution.candidates[0]?.entity.key,
              ) ?? null
            : null;

        const sourceEntity =
          confirmedEntity ??
          highResolved ??
          currentEntity;

        if (!sourceEntity) {
          throw new Error(
            'Ne mogu jednoznačno odrediti izvor veze.',
          );
        }

        if (!contextualTarget) {
          throw new Error(
            'Ne mogu jednoznačno pronaći cilj veze.',
          );
        }

        if (
          sourceEntity.key ===
          contextualTarget.key
        ) {
          close();
          return;
        }

        await entityLinksApi.create({
          sourceType: sourceEntity.kind,
          sourceId: sourceEntity.id,
          targetType: contextualTarget.kind,
          targetId: contextualTarget.id,
          relationType: 'RELATED',
        });

        rememberContextAlias(
          sourceEntity.key,
          query,
        );

        createdFeedback();
        close();
        return;
      }

      if (intent.kind === 'START_READING') {
        if (!contextualTarget || contextualTarget.kind !== 'BOOK') {
          throw new Error('Ne mogu jednoznačno pronaći knjigu “' + intent.query + '”.');
        }

        await activityApi.startReading(contextualTarget.id);
        void semanticFeedback.timerStart();
        close();
      }
    } catch (caught) {
      setQuickCommandError(
        caught instanceof Error
          ? caught.message
          : 'Kontekstualna radnja nije uspjela.',
      );
    } finally {
      setQuickCommandBusy(false);
    }
  };

  function resolveCollectionTarget(
    source: CollectionSummary[],
    queryValue: string,
  ): CollectionSummary | null {
    const needle = normalize(queryValue);
    if (!needle) return null;

    const exact = source.filter((item) => normalize(item.name) === needle);
    if (exact.length === 1) return exact[0] ?? null;

    const starts = source.filter((item) => normalize(item.name).startsWith(needle));
    if (starts.length === 1) return starts[0] ?? null;

    const contains = source.filter((item) => normalize(item.name).includes(needle));
    return contains.length === 1 ? contains[0] ?? null : null;
  }
  const runK15Mutation = async (
    command: DeterministicMutationCommand,
    sourceEntity?: SearchEntity | null,
    targetEntity?: SearchEntity | null,
  ) => {
    if (quickCommandBusy) return;
    setQuickCommandBusy(true);
    setQuickCommandError(null);

    const pickCollection = (name: string) => {
      const exact = collections.find((item) => normalize(item.name) === normalize(name));
      if (exact) return exact;
      const fuzzy = collections.filter((item) => fuzzyTextIncludes(item.name, name));
      return fuzzy.length === 1 ? fuzzy[0] ?? null : null;
    };

    const pickTopic = (name: string) => {
      const exact = topics.find((item) => normalize(item.name) === normalize(name));
      if (exact) return exact;
      const fuzzy = topics.filter((item) => fuzzyTextIncludes(item.name, name));
      return fuzzy.length === 1 ? fuzzy[0] ?? null : null;
    };

    try {
      if (command.kind === 'UPDATE_BOOK_PAGE') {
        if (!sourceEntity || sourceEntity.kind !== 'BOOK') throw new Error('Ne mogu jednoznačno odrediti knjigu.');
        await saveBookReadingPageDirect(sourceEntity.id, command.page);
        close();
        return;
      }

      if (command.kind === 'ADD_TO_COLLECTION') {
        if (!sourceEntity) throw new Error('Ne mogu jednoznačno odrediti što dodaješ.');
        let collection = pickCollection(command.collectionQuery);
        let createdCollectionId: string | null = null;
        if (!collection) {
          collection = await collectionApi.create({
            name: command.collectionQuery,
            description: null,
            symbol: '◇',
          });
          createdCollectionId = collection.collectionId;
        }
        try {
          const detail = await collectionApi.getById(collection.collectionId);
          const exists = detail.items.some((item) =>
            item.entityType === sourceEntity.kind && item.entityId === sourceEntity.id,
          );
          if (!exists) await collectionApi.addItem(collection.collectionId, sourceEntity.kind, sourceEntity.id);
        } catch (caught) {
          if (createdCollectionId) await collectionApi.remove(createdCollectionId).catch(() => undefined);
          throw caught;
        }
        createdFeedback();
        close();
        return;
      }

      if (command.kind === 'ADD_TO_TOPIC') {
        if (!sourceEntity) throw new Error('Ne mogu jednoznačno odrediti što povezuješ.');
        let topic = pickTopic(command.topicQuery);
        let createdTopicId: string | null = null;
        if (!topic) {
          topic = await topicApi.create({ name: command.topicQuery });
          createdTopicId = topic.topicId;
        }
        try {
          await entityLinksApi.create({
            sourceType: sourceEntity.kind,
            sourceId: sourceEntity.id,
            targetType: 'TOPIC',
            targetId: topic.topicId,
            relationType: 'RELATED',
          });
        } catch (caught) {
          if (createdTopicId) await topicApi.remove(createdTopicId).catch(() => undefined);
          throw caught;
        }
        createdFeedback();
        close();
        return;
      }

      if (command.kind === 'CREATE_NOTE_TO_COLLECTION') {
        let collection = pickCollection(command.collectionQuery);
        let createdCollectionId: string | null = null;
        let createdEntryId: string | null = null;
        try {
          if (!collection) {
            collection = await collectionApi.create({
              name: command.collectionQuery,
              description: null,
              symbol: '◇',
            });
            createdCollectionId = collection.collectionId;
          }
          const entry = await entryApi.create({
            title: null,
            content: command.content,
            type: 'NOTE',
            bookId: null,
            topicId: null,
            activityId: null,
          });
          createdEntryId = entry.entryId;
          await collectionApi.addItem(collection.collectionId, 'ENTRY', entry.entryId);
        } catch (caught) {
          if (createdEntryId) await entryApi.remove(createdEntryId).catch(() => undefined);
          if (createdCollectionId) await collectionApi.remove(createdCollectionId).catch(() => undefined);
          throw caught;
        }
        createdFeedback();
        close();
        return;
      }

      if (command.kind === 'CREATE_NOTE_TO_TOPIC') {
        let topic = pickTopic(command.topicQuery);
        let createdTopicId: string | null = null;
        let createdEntryId: string | null = null;
        try {
          if (!topic) {
            topic = await topicApi.create({ name: command.topicQuery });
            createdTopicId = topic.topicId;
          }
          const entry = await entryApi.create({
            title: null,
            content: command.content,
            type: 'NOTE',
            bookId: null,
            topicId: topic.topicId,
            activityId: null,
          });
          createdEntryId = entry.entryId;
        } catch (caught) {
          if (createdEntryId) await entryApi.remove(createdEntryId).catch(() => undefined);
          if (createdTopicId) await topicApi.remove(createdTopicId).catch(() => undefined);
          throw caught;
        }
        createdFeedback();
        close();
        return;
      }

      if (command.kind === 'LINK') {
        if (!sourceEntity) throw new Error('Ne mogu jednoznačno odrediti izvor veze.');
        let resolvedTarget = targetEntity ?? null;
        let createdTopicId: string | null = null;
        if (!resolvedTarget && command.createTargetIfMissing && command.target.kindHint === 'TOPIC') {
          let topic = pickTopic(command.target.query);
          if (!topic) {
            topic = await topicApi.create({ name: command.target.query });
            createdTopicId = topic.topicId;
          }
          resolvedTarget = {
            key: 'TOPIC:' + topic.topicId,
            kind: 'TOPIC',
            id: topic.topicId,
            title: topic.name,
            typeLabel: 'Tema',
            meta: topic.description?.trim() || '',
            favourite: false,
          };
        }
        if (!resolvedTarget) throw new Error('Ne mogu jednoznačno odrediti cilj veze.');
        if (resolvedTarget.key === sourceEntity.key) { close(); return; }
        try {
          await entityLinksApi.create({
            sourceType: sourceEntity.kind,
            sourceId: sourceEntity.id,
            targetType: resolvedTarget.kind,
            targetId: resolvedTarget.id,
            relationType: 'RELATED',
          });
        } catch (caught) {
          if (createdTopicId) await topicApi.remove(createdTopicId).catch(() => undefined);
          throw caught;
        }
        createdFeedback();
        close();
      }
    } catch (caught) {
      setQuickCommandError(caught instanceof Error ? caught.message : 'Akcija nije uspjela.');
    } finally {
      setQuickCommandBusy(false);
    }
  };


  const commands = useMemo<PaletteCommand[]>(
    () => [
      {
        key: 'catalogue',
        label: 'Katalog',
        detail: 'Otvori cijeli katalog',
        aliases: 'catalogue katalog library biblioteka',
        kindLabel: 'OTVORI',
        action: () => navigate('Catalogue'),
      },
      {
        key: 'collections',
        label: 'Kolekcije',
        detail: 'Playliste, memory boxevi i zbirke',
        aliases:
          'collections collection kolekcije playlist memory box memorabilia box zbirka',
        kindLabel: 'OTVORI',
        action: () => navigate('Collections'),
      },
      {
        key: 'entries',
        label: 'Zapisi',
        detail: 'Otvori i pretraži spremljene zapise',
        aliases: 'zapisi entries biljeske bilješke citati notes',
        kindLabel: 'OTVORI',
        action: () => navigate('Entries'),
      },
      {
        key: 'new-entry',
        label: 'Novi zapis',
        detail: 'Dodaj novi zapis',
        aliases: 'zapis entry note dodaj novi',
        kindLabel: 'AKCIJA',
        action: () => navigate('EntryForm'),
      },
      {
        key: 'today',
        label: 'Danas / Timeri',
        detail: 'Vrati se na početni ekran i aktivnosti',
        aliases: 'danas today timer activity aktivnost',
        kindLabel: 'OTVORI',
        action: () => navigate('Today'),
      },
      {
        key: 'history',
        label: 'Povijest',
        detail: 'Otvori povijest aktivnosti',
        aliases: 'history povijest sessions aktivnosti',
        kindLabel: 'OTVORI',
        action: () => navigate('History'),
      },
      {
        key: 'stats',
        label: 'Statistika',
        detail: 'Otvori statistiku',
        aliases: 'stats statistics statistika',
        kindLabel: 'OTVORI',
        action: () => navigate('Stats'),
      },
      {
        key: 'radio',
        label: 'Memory Radio',
        detail: 'Otvori Memory Radio',
        aliases: 'radio memory audio glazba',
        kindLabel: 'OTVORI',
        action: () => navigate('MemoryRadio'),
      },
      {
        key: 'settings',
        label: 'Postavke',
        detail: 'Izgled, boje i postavke',
        aliases: 'settings postavke theme tema izgled',
        kindLabel: 'OTVORI',
        action: () => navigate('ThemePicker'),
      },
      {
        key: 'jingle',
        label: 'Jingle',
        detail: 'Prikaži sve Jingle naslove',
        aliases: 'jingle favourite favorite bell zvono',
        kindLabel: 'AKCIJA',
        action: () => {
          setQuery('jingle');
          setSelectedIndex(-1);
        },
      },
    ],
    [navigation],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const target = globalThis as any;

    const onKeyDown = (event: any) => {
      const key = String(event.key ?? '').toLocaleLowerCase();

      if (
        (event.ctrlKey || event.metaKey) &&
        key === 'k'
      ) {
        event.preventDefault();

        if (isPaletteInteractionLocked()) {
          return;
        }

        setVisible((current) => !current);
        return;
      }

      if (!visible) return;

      if (key === 'escape') {
        event.preventDefault();
        close();
      }
    };

    target.addEventListener?.('keydown', onKeyDown);

    return () => {
      target.removeEventListener?.('keydown', onKeyDown);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 30);

    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    setLoading(true);

    Promise.all([
      bookApi.getAll(),
      mediaApi.getAll(),
      gameApi.getAll(),
      topicApi.getAll(),
      collectionApi.getAll(),
    ])
      .then(([loadedBooks, loadedMedia, loadedGames, loadedTopics, loadedCollections]) => {
        if (cancelled) return;

        setBooks(loadedBooks);
        setMedia(loadedMedia);
        setGames(loadedGames);
        setTopics(loadedTopics);
        setCollections(loadedCollections);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const onlineIntent =
    useMemo(
      () => parseOnlineSearchCommand(query),
      [query],
    );

  useEffect(() => {
    if (
      !visible ||
      !onlineIntent ||
      !onlineIntent.query
    ) {
      setOnlineResults([]);
      setOnlineLoading(false);
      setOnlineSearched(false);
      setOnlineError(null);
      return;
    }

    let cancelled = false;

    setOnlineLoading(true);
    setOnlineSearched(false);
    setOnlineError(null);

    const timer = setTimeout(() => {
      void paletteOnlineApi
        .search(
          onlineIntent.kind,
          onlineIntent.query,
          8,
        )
        .then((results) => {
          if (cancelled) return;

          setOnlineResults(results);
          setOnlineSearched(true);
        })
        .catch((caught) => {
          if (cancelled) return;

          setOnlineResults([]);
          setOnlineSearched(true);
          setOnlineError(
            caught instanceof Error
              ? caught.message
              : 'Online pretraga nije uspjela.',
          );
        })
        .finally(() => {
          if (!cancelled) {
            setOnlineLoading(false);
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    onlineIntent?.kind,
    onlineIntent?.query,
    visible,
  ]);

  const jingleGraphKeys = new Set(
    jingleGraph.map(
      (item) =>
        item.entityType + ':' + item.entityId,
    ),
  );

  const entities = useMemo<SearchEntity[]>(
    () => [
      ...books.map((book) => ({
        key: 'BOOK:' + book.bookId,
        kind: 'BOOK' as const,
        id: book.bookId,
        title: book.title,
        typeLabel: 'Knjiga',
        meta: [
          book.author,
          book.publishedYear,
        ]
          .filter(Boolean)
          .join(' · '),
        favourite: Boolean(book.favourite),
      })),

      ...media.map((item) => ({
        key: 'MEDIA:' + item.mediaId,
        kind: 'MEDIA' as const,
        id: item.mediaId,
        title: item.title,
        typeLabel:
          item.mediaType === 'MOVIE'
            ? 'Film'
            : 'Serija',
        meta: [
          item.originalTitle &&
          item.originalTitle !== item.title
            ? item.originalTitle
            : null,
          item.releaseYear,
        ]
          .filter(Boolean)
          .join(' · '),
        favourite: Boolean(item.favourite),
      })),

      ...games.map((game) => ({
        key: 'GAME:' + game.gameId,
        kind: 'GAME' as const,
        id: game.gameId,
        title: game.title,
        typeLabel: 'Igra',
        meta: [
          game.platform,
          game.developer,
          game.releaseYear,
        ]
          .filter(Boolean)
          .join(' · '),
        favourite: Boolean(game.favourite),
      })),
      ...topics.map((topic) => ({
        key: 'TOPIC:' + topic.topicId,
        kind: 'TOPIC' as const,
        id: topic.topicId,
        title: topic.name,
        typeLabel: 'Tema',
        meta: topic.description?.trim() || '',
        favourite: false,
      })),
      ...entries.map((entry) => ({
        key: 'ENTRY:' + entry.entryId,
        kind: 'ENTRY' as const,
        id: entry.entryId,
        title:
          entry.title?.trim() ||
          entry.content.replace(/\s+/g, ' ').trim().slice(0, 64) ||
          'Zapis',
        typeLabel: 'Zapis',
        meta: entry.content.replace(/\s+/g, ' ').trim().slice(0, 140),
        favourite:
          jingleGraphKeys.has(
            'ENTRY:' + entry.entryId,
          ),
      })),
      ...frequencies.map((frequency) => ({
        key: 'FREQUENCY:' + frequency.trackId,
        kind: 'FREQUENCY' as const,
        id: frequency.trackId,
        title: frequency.trackTitle || 'Frekvencija',
        typeLabel: 'Frekvencija',
        meta: [
          frequency.artist,
          'Memory Radio',
          frequency.linkId ? 'Povezano' : 'Nepovezano',
        ]
          .filter(Boolean)
          .join(' · '),
        favourite:
          jingleGraphKeys.has(
            'FREQUENCY:' + frequency.trackId,
          ),
      })),
    ],
    [books, games, media, topics, entries, frequencies, jingleGraph],
  );

  useEffect(() => {
    if (!visible || isLikelyCompoundLanguage(query) || !shouldAskLocalLanguageModel(query)) {
      setLocalLanguageIntent(null);
      setLocalLanguageRaw(null);
      setLocalReferentResolution(null);
      setLocalLanguageLoading(false);
      return;
    }

    // K8 deterministic parser always wins; the LLM is fallback only.
    if (routeLJingleIntent(query)) {
      setLocalLanguageIntent(null);
      setLocalLanguageRaw(null);
      setLocalReferentResolution(null);
      setLocalLanguageLoading(false);
      return;
    }

    const currentKey = activeEntityKey(activeContext);
    const bookKey = activeBookKey(activeContext);
    const currentEntity = currentKey
      ? entities.find((entity) => entity.key === currentKey) ?? null
      : null;
    const currentBook = bookKey
      ? entities.find((entity) => entity.key === bookKey) ?? null
      : null;

    let cancelled = false;
    const timer = setTimeout(() => {
      void isLocalLanguageBrainEnabled()
        .then((enabled) => {
          if (cancelled || !enabled) {
            if (!cancelled) {
              setLocalLanguageIntent(null);
              setLocalLanguageLoading(false);
            }
            return null;
          }

          setLocalLanguageLoading(true);
          return routeWithLocalLanguageModel(query, {
            activeTimerCount: activeContext?.timers.length ?? 0,
            activeTimerLabel: activeContext?.singleTimer?.label ?? null,
            currentEntity: currentEntity
              ? { kind: currentEntity.kind, title: currentEntity.title }
              : null,
            currentBook: currentBook ? { title: currentBook.title } : null,
          });
        })
        .then((result) => {
          if (!cancelled && result) {
            setLocalLanguageIntent(result.intent);
            setLocalLanguageRaw(result.raw);
          }
        })
        .catch(() => {
          if (!cancelled) setLocalLanguageIntent(null);
        })
        .finally(() => {
          if (!cancelled) setLocalLanguageLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, query, activeContext, entities]);

  useEffect(() => {
    if (!visible || !isLikelyCompoundLanguage(query)) {
      setLocalLanguagePlan(null);
      return;
    }

    const currentKey = activeEntityKey(activeContext);
    const bookKey = activeBookKey(activeContext);
    const currentEntity = currentKey
      ? entities.find((entity) => entity.key === currentKey) ?? null
      : null;
    const currentBook = bookKey
      ? entities.find((entity) => entity.key === bookKey) ?? null
      : null;

    let cancelled = false;
    const timer = setTimeout(() => {
      setLocalLanguageLoading(true);
      void planCompoundLanguage(query, {
        activeTimerCount: activeContext?.timers.length ?? 0,
        activeTimerLabel: activeContext?.singleTimer?.label ?? null,
        currentEntity: currentEntity
          ? { kind: currentEntity.kind, title: currentEntity.title }
          : null,
        currentBook: currentBook ? { title: currentBook.title } : null,
      })
        .then((result) => {
          if (!cancelled) setLocalLanguagePlan(result);
        })
        .catch(() => {
          if (!cancelled) setLocalLanguagePlan(null);
        })
        .finally(() => {
          if (!cancelled) setLocalLanguageLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, query, activeContext, entities]);

  useEffect(() => {
    const subjectQuery = localLanguageRaw?.subjectQuery?.trim() || '';
    if (!visible || !subjectQuery) {
      setLocalReferentResolution(null);
      return;
    }

    const currentKey = activeEntityKey(activeContext);
    const current = currentKey
      ? entities.find(entity => entity.key === currentKey) ?? null
      : null;
    let cancelled = false;
    const timer = setTimeout(() => {
      const discourse = getDiscourseState();
      const discourseEntity = discourse.lastReferent
        ? entities.find(entity => entity.key === discourse.lastReferent?.key) ?? null
        : null;
      void resolveReferent(
        subjectQuery,
        entities as ResolvableEntity[],
        current as ResolvableEntity | null,
        discourseEntity as ResolvableEntity | null,
      ).then(result => {
        if (!cancelled) setLocalReferentResolution(result);
      }).catch(() => {
        if (!cancelled) setLocalReferentResolution(null);
      });
    }, 35);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [visible, localLanguageRaw, activeContext, entities]);


  useEffect(() => {
    const routedIntent = routeLJingleIntent(query) ?? localLanguageIntent;
    const intent =
      toQuietContextIntent(routedIntent) ??
      parseQuietContextIntent(query);

    if (
      !visible ||
      intent?.kind !== 'LINK_ACTIVE' ||
      !activeContext?.singleTimer?.activeSessionId
    ) {
      setContextLinkTarget(null);
      return;
    }

    const direct = pickBestByText(
      entities,
      intent.query,
      (entity) => [entity.title, entity.meta, entity.typeLabel].filter(Boolean).join(' '),
    );

    if (direct) {
      setContextLinkTarget(direct);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void semanticSearch(intent.query, {
        limit: 3,
        entityTypes: ['BOOK', 'MEDIA', 'GAME', 'TOPIC', 'ENTRY', 'FREQUENCY'],
        minimumScore: 0.18,
      })
        .then((matches) => {
          if (cancelled) return;
          const first = matches[0];
          const second = matches[1];
          if (!first) {
            setContextLinkTarget(null);
            return;
          }

          // Do not guess when the two best semantic matches are too close.
          if (second && first.score - second.score < 0.025) {
            setContextLinkTarget(null);
            return;
          }

          const target = entities.find((entity) => entity.key === first.key) ?? null;
          setContextLinkTarget(target);
        })
        .catch(() => {
          if (!cancelled) setContextLinkTarget(null);
        });
    }, 140);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeContext, entities, query, visible, localLanguageIntent]);

  useEffect(() => {
    const routedIntent = routeLJingleIntent(query) ?? localLanguageIntent;
    const intent =
      toContextualVerbIntent(routedIntent) ??
      parseContextualVerbIntent(query);
    const targetQuery =
      intent?.kind === 'LINK_CURRENT_ENTITY' || intent?.kind === 'START_READING'
        ? intent.query
        : '';

    if (!visible || !targetQuery) {
      setContextualTarget(null);
      return;
    }

    const allowedKinds = intent?.kind === 'START_READING' ? new Set<string>(['BOOK']) : null;
    const direct = pickBestByText(
      entities.filter((entity) => !allowedKinds || allowedKinds.has(entity.kind)),
      targetQuery,
      (entity) => [entity.title, entity.meta, entity.typeLabel].filter(Boolean).join(' '),
    );

    if (direct) {
      setContextualTarget(direct);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void semanticSearch(targetQuery, {
        limit: 3,
        entityTypes: intent?.kind === 'START_READING'
          ? ['BOOK']
          : ['BOOK', 'MEDIA', 'GAME', 'TOPIC', 'ENTRY', 'FREQUENCY'],
        minimumScore: 0.18,
      })
        .then((matches) => {
          if (cancelled) return;
          const first = matches[0];
          const second = matches[1];
          if (!first || (second && first.score - second.score < 0.025)) {
            setContextualTarget(null);
            return;
          }

          setContextualTarget(entities.find((entity) => entity.key === first.key) ?? null);
        })
        .catch(() => {
          if (!cancelled) setContextualTarget(null);
        });
    }, 140);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [entities, query, visible, localLanguageIntent]);

  useEffect(() => {
    if (!visible) {
      setQuietSemanticEntities([]);
      return;
    }

    const languageSearchQuery =
      localReferentResolution?.level === 'LOW' && localLanguageRaw?.subjectQuery
        ? localLanguageRaw.subjectQuery
        : localLanguageIntent?.action === 'SEARCH'
          ? localLanguageIntent.query
          : query;
    const plan = planQuietSearch(languageSearchQuery);
    if (!plan) {
      setQuietSemanticEntities([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void semanticSearch(plan.query, {
        limit: 12,
        entityTypes: plan.entityTypes,
        minimumScore: 0.14,
      })
        .then((semantic) => {
          if (cancelled) return;
          const byKey = new Map(entities.map((item) => [item.key, item]));
          setQuietSemanticEntities(
            semantic
              .map((item) => byKey.get(item.key))
              .filter((item): item is SearchEntity => Boolean(item)),
          );
        })
        .catch(() => {
          if (!cancelled) setQuietSemanticEntities([]);
        });
    }, 160);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [entities, query, visible, localLanguageIntent]);

  const runCompoundLanguagePlan = async (plan: LocalLanguagePlanResult) => {
    if (quickCommandBusy || !plan.fullyValid || !compoundPlanCanExecute(plan.intents)) return;

    const contextual = plan.intents.map(toContextualVerbIntent);
    if (contextual.some((intent) => !intent)) {
      setQuickCommandError('Ovaj višestruki zahtjev još nije sigurno izvršiv kao jedna cjelina.');
      return;
    }

    // Atomic in the language/safety sense: nothing runs until every child is
    // valid and executable. Existing domain APIs remain the mutation boundary.
    // We intentionally execute in user order.
    for (const intent of contextual) {
      if (!intent) return;
      await runContextualVerbAction(intent);
    }
  };

  useEffect(() => {
    const mutation = parseDeterministicMutationCommand(query);

    if (!visible || !mutation) {
      setK15MutationSourceResolution(null);
      setK15MutationTargetResolution(null);
      return;
    }

    const sourcePhrase = mutationSourcePhrase(mutation);
    const targetPhrase = mutationTargetPhrase(mutation);
    const currentKey = activeEntityKey(activeContext);
    const currentEntity = currentKey
      ? entities.find((entity) => entity.key === currentKey) ?? null
      : null;

    let cancelled = false;
    const timer = setTimeout(() => {
      const resolvePhrase = (phrase: EntityPhrase | null) => {
        if (!phrase) return Promise.resolve(null);
        const pool = phrase.kindHint
          ? entities.filter((entity) => entity.kind === phrase.kindHint)
          : entities;
        const current = currentEntity && (!phrase.kindHint || currentEntity.kind === phrase.kindHint)
          ? currentEntity
          : null;
        return resolveReferent(phrase.query, pool as any, current as any);
      };

      void Promise.all([
        resolvePhrase(sourcePhrase),
        resolvePhrase(targetPhrase),
      ]).then(([source, target]) => {
        if (cancelled) return;
        setK15MutationSourceResolution(source);
        setK15MutationTargetResolution(target);
      }).catch(() => {
        if (cancelled) return;
        setK15MutationSourceResolution(null);
        setK15MutationTargetResolution(null);
      });
    }, 55);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeContext, entities, query, visible]);

  const runPaletteFastIntent = async (
    intent: PaletteFastIntent,
    sourceEntity?: SearchEntity | null,
  ) => {
    if (quickCommandBusy) return;

    setQuickCommandBusy(true);
    setQuickCommandError(null);

    let createdCollectionId:
      string | null = null;
    let createdTopicId:
      string | null = null;
    let createdEntryId:
      string | null = null;
    let createdBookId:
      string | null = null;

    const normalizeName = (
      value: string,
    ) =>
      paletteFastNorm(value);

    const ensureCollection =
      async (name: string) => {
        const all =
          await collectionApi.getAll();

        const exact =
          all.find(
            (item) =>
              normalizeName(
                item.name,
              ) ===
              normalizeName(name),
          );

        if (exact) return exact;

        const fuzzy =
          all.filter(
            (item) =>
              normalizeName(
                item.name,
              ).includes(
                normalizeName(name),
              ) ||
              normalizeName(
                name,
              ).includes(
                normalizeName(
                  item.name,
                ),
              ),
          );

        if (fuzzy.length === 1) {
          return fuzzy[0]!;
        }

        const created =
          await collectionApi.create({
            name,
            description: null,
            symbol: '◇',
          });

        createdCollectionId =
          created.collectionId;

        return created;
      };

    const ensureTopic =
      async (name: string) => {
        const all =
          await topicApi.getAll();

        const exact =
          all.find(
            (item) =>
              normalizeName(
                item.name,
              ) ===
              normalizeName(name),
          );

        if (exact) return exact;

        const fuzzy =
          all.filter(
            (item) =>
              normalizeName(
                item.name,
              ).includes(
                normalizeName(name),
              ) ||
              normalizeName(
                name,
              ).includes(
                normalizeName(
                  item.name,
                ),
              ),
          );

        if (fuzzy.length === 1) {
          return fuzzy[0]!;
        }

        const created =
          await topicApi.create({
            name,
          });

        createdTopicId =
          created.topicId;

        return created;
      };

    try {
      if (
        intent.kind ===
          'UPDATE_BOOK_PAGE'
      ) {
        if (
          !sourceEntity ||
          sourceEntity.kind !== 'BOOK'
        ) {
          throw new Error(
            'Ne mogu jednoznačno odrediti knjigu.',
          );
        }

        await saveBookReadingPageDirect(
          sourceEntity.id,
          intent.page,
        );

        // The canonical reading-page service owns current_page/progress.
        // BookResponse intentionally does not expose those internal fields.
        createdFeedback();
        close();
        return;
      }

      if (
        intent.kind ===
          'ADD_TO_COLLECTION'
      ) {
        if (!sourceEntity) {
          throw new Error(
            'Ne mogu jednoznačno odrediti što dodaješ.',
          );
        }

        const collection =
          await ensureCollection(
            intent.destination,
          );

        const detail =
          await collectionApi.getById(
            collection.collectionId,
          );

        const exists =
          detail.items.some(
            (item) =>
              item.entityType ===
                sourceEntity.kind &&
              item.entityId ===
                sourceEntity.id,
          );

        if (!exists) {
          await collectionApi.addItem(
            collection.collectionId,
            sourceEntity.kind,
            sourceEntity.id,
          );
        }

        createdFeedback();
        close();
        return;
      }

      if (
        intent.kind ===
          'ADD_TO_TOPIC'
      ) {
        if (!sourceEntity) {
          throw new Error(
            'Ne mogu jednoznačno odrediti što povezuješ.',
          );
        }

        const topic =
          await ensureTopic(
            intent.destination,
          );

        await entityLinksApi.create({
          sourceType:
            sourceEntity.kind,
          sourceId:
            sourceEntity.id,
          targetType: 'TOPIC',
          targetId:
            topic.topicId,
          relationType:
            'RELATED',
        });

        createdFeedback();
        close();
        return;
      }

      if (
        intent.kind ===
          'CREATE_NOTE_TO_COLLECTION'
      ) {
        const collection =
          await ensureCollection(
            intent.destination,
          );

        const entry =
          await entryApi.create({
            title: null,
            content:
              intent.content,
            type: 'NOTE',
            bookId: null,
            topicId: null,
            activityId: null,
          });

        createdEntryId =
          entry.entryId;

        await collectionApi.addItem(
          collection.collectionId,
          'ENTRY',
          entry.entryId,
        );

        createdFeedback();
        close();
        return;
      }

      if (
        intent.kind ===
          'CREATE_NOTE_TO_TOPIC'
      ) {
        const topic =
          await ensureTopic(
            intent.destination,
          );

        const entry =
          await entryApi.create({
            title: null,
            content:
              intent.content,
            type: 'NOTE',
            bookId: null,
            topicId:
              topic.topicId,
            activityId: null,
          });

        createdEntryId =
          entry.entryId;

        createdFeedback();
        close();
        return;
      }

      if (
        intent.kind ===
          'CREATE_BOOK_DESTINATION'
      ) {
        const book =
          await bookApi.create({
            title: intent.title,
            author: '',
            isbn: '',
            publishedYear: 0,
            readingStatus: 'LATER',
            progress: 0,
            enjoyment: null,
            favourite: false,
            startedOn: null,
            finishedOn: null,
          });

        createdBookId =
          book.bookId;

        if (
          intent.destinationKind ===
            'COLLECTION'
        ) {
          const collection =
            await ensureCollection(
              intent.destination,
            );

          await collectionApi.addItem(
            collection.collectionId,
            'BOOK',
            book.bookId,
          );
        } else {
          const topic =
            await ensureTopic(
              intent.destination,
            );

          await entityLinksApi.create({
            sourceType: 'BOOK',
            sourceId:
              book.bookId,
            targetType: 'TOPIC',
            targetId:
              topic.topicId,
            relationType:
              'RELATED',
          });
        }

        createdFeedback();
        close();
        return;
      }
    } catch (caught) {
      // Roll back only objects this fast transaction created.
      if (createdEntryId) {
        await entryApi
          .remove(
            createdEntryId,
          )
          .catch(
            () => undefined,
          );
      }

      if (createdBookId) {
        await bookApi
          .remove(
            createdBookId,
          )
          .catch(
            () => undefined,
          );
      }

      if (createdCollectionId) {
        await collectionApi
          .remove(
            createdCollectionId,
          )
          .catch(
            () => undefined,
          );
      }

      if (createdTopicId) {
        await topicApi
          .remove(
            createdTopicId,
          )
          .catch(
            () => undefined,
          );
      }

      setQuickCommandError(
        caught instanceof Error
          ? caught.message
          : 'Akcija nije uspjela.',
      );
    } finally {
      setQuickCommandBusy(false);
    }
  };

  const items = useMemo<PaletteItem[]>(() => {
    const utilityQuery =
      query.trim();

    const soundMatch =
      utilityQuery.match(
        /^:sound(?:\s+(on|off))?\s*$/i,
      );

    if (soundMatch) {
      const requested =
        soundMatch[1]
          ?.toLocaleLowerCase();

      const soundCommand = (
        enabled: boolean,
      ): PaletteItem => ({
        itemType: 'command',
        command: {
          key:
            'direct-sound-' +
            (
              enabled
                ? 'on'
                : 'off'
            ),
          label:
            enabled
              ? ':sound on'
              : ':sound off',
          detail:
            enabled
              ? 'Uključi UI zvučne efekte'
              : 'Isključi UI zvučne efekte · haptics ostaju',
          aliases:
            enabled
              ? ':sound on'
              : ':sound off',
          kindLabel: 'AKCIJA',
          action: async () => {
            await setUiSoundEffectsEnabled(
              enabled,
            );
            close();
          },
        },
      });

      if (requested === 'on') {
        return [soundCommand(true)];
      }

      if (requested === 'off') {
        return [soundCommand(false)];
      }

      return [
        soundCommand(true),
        soundCommand(false),
      ];
    }

    const yearMatch =
      utilityQuery.match(
        /^:year(?:\s+(\d{4}))?\s*$/i,
      );

    if (yearMatch) {
      const yearText =
        yearMatch[1] ?? '';

      if (!yearText) {
        return [{
          itemType: 'command',
          command: {
            key:
              'direct-year-help',
            label:
              ':year <YYYY>',
            detail:
              'Otvori rekonstrukciju cijele godine · npr. :year 2025',
            aliases:
              ':year godina year',
            kindLabel: 'KONTEKST',
            action: () =>
              setQuery(':year '),
          },
        }];
      }

      const targetYear =
        Number(yearText);

      if (
        !Number.isInteger(targetYear) ||
        targetYear < 1900 ||
        targetYear > 2200
      ) {
        return [];
      }

      return [{
        itemType: 'command',
        command: {
          key:
            'direct-year:' +
            targetYear,
          label:
            'Otvori ' +
            targetYear,
          detail:
            'Rekonstrukcija cijele godine',
          aliases:
            ':year ' +
            targetYear,
          kindLabel: 'OTVORI',
          action: () =>
            navigate(
              'Reconstruction',
              {
                year:
                  targetYear,
              },
            ),
        },
      }];
    }

    const shareMatch =
      utilityQuery.match(
        /^:share(?:\s+([\s\S]+))?$/i,
      );

    if (shareMatch) {
      const shareQuery =
        (
          shareMatch[1] ??
          ''
        ).trim();

      if (!shareQuery) {
        return [
          {
            itemType: 'command',
            command: {
              key:
                'direct-share-help-entity',
              label:
                ':share <stvar>',
              detail:
                'Podijeli knjigu, film, igru, zapis ili frekvenciju',
              aliases:
                ':share',
              kindLabel: 'KONTEKST',
              action: () =>
                setQuery(':share '),
            },
          },
          {
            itemType: 'command',
            command: {
              key:
                'direct-share-help-topic',
              label:
                ':share @Tema',
              detail:
                'Podijeli temu',
              aliases:
                ':share @',
              kindLabel: 'KONTEKST',
              action: () =>
                setQuery(':share @'),
            },
          },
          {
            itemType: 'command',
            command: {
              key:
                'direct-share-help-collection',
              label:
                ':share #Kolekcija',
              detail:
                'Podijeli kolekciju / memory box',
              aliases:
                ':share #',
              kindLabel: 'KONTEKST',
              action: () =>
                setQuery(':share #'),
            },
          },
        ];
      }

      if (shareQuery.startsWith('#')) {
        const collectionQuery =
          shareQuery
            .slice(1)
            .trim();

        const matches =
          collections
            .filter(
              (collection) =>
                fuzzyTextIncludes(
                  collection.name,
                  collectionQuery,
                ),
            )
            .slice(0, 8);

        return matches.map(
          (collection): PaletteItem => ({
            itemType: 'command',
            command: {
              key:
                'direct-share-collection:' +
                collection.collectionId,
              label:
                'Podijeli #' +
                collection.name,
              detail:
                'Portable LJingle kolekcija',
              aliases:
                ':share #' +
                collection.name,
              kindLabel: 'AKCIJA',
              action: async () => {
                setQuickCommandBusy(true);
                setQuickCommandError(null);

                try {
                  await sharePortableCollection(
                    collection.collectionId,
                  );
                } catch (caught) {
                  setQuickCommandError(
                    caught instanceof Error
                      ? caught.message
                      : 'Dijeljenje nije uspjelo.',
                  );
                } finally {
                  setQuickCommandBusy(false);
                }
              },
            },
          }),
        );
      }

      const topicOnly =
        shareQuery.startsWith('@');

      const cleanShareQuery =
        topicOnly
          ? shareQuery.slice(1).trim()
          : shareQuery;

      const matches =
        entities
          .filter(
            (entity) =>
              (
                !topicOnly ||
                entity.kind === 'TOPIC'
              ) &&
              fuzzyTextIncludes(
                [
                  entity.title,
                  entity.meta,
                  entity.typeLabel,
                ].join(' '),
                cleanShareQuery,
              ),
          )
          .slice(0, 8);

      return matches.map(
        (entity): PaletteItem => ({
          itemType: 'command',
          command: {
            key:
              'direct-share-entity:' +
              entity.key,
            label:
              'Podijeli ' +
              entity.title,
            detail:
              entity.typeLabel +
              (
                entity.meta
                  ? ' · ' +
                    entity.meta
                  : ''
              ),
            aliases:
              ':share ' +
              entity.title,
            kindLabel: 'AKCIJA',
            action: async () => {
              setQuickCommandBusy(true);
              setQuickCommandError(null);

              try {
                await sharePortableEntity(
                  entity.kind,
                  entity.id,
                );
              } catch (caught) {
                setQuickCommandError(
                  caught instanceof Error
                    ? caught.message
                    : 'Dijeljenje nije uspjelo.',
                );
              } finally {
                setQuickCommandBusy(false);
              }
            },
          },
        }),
      );
    }


    const grammarQuery =
      query.trim();

    const grammarNormalized =
      paletteFastNorm(
        grammarQuery,
      );

    const wantsGrammarHelp =
      grammarQuery === ':' ||
      grammarQuery === ':help' ||
      grammarQuery === ':h' ||
      grammarQuery === '?' ||
      grammarNormalized === 'help' ||
      grammarNormalized === 'pomoc';

    if (wantsGrammarHelp) {
      return [
        {
          itemType: 'command',
          command: {
            key:
              'palette-help-search',
            label:
              'Traži bilo što',
            detail:
              'Samo piši: dune · jung · severance · fuzzy lokalna pretraga',
            aliases:
              'help search trazi traži',
            kindLabel: 'KONTEKST',
            action: () =>
              setQuery('dune'),
          },
        },
        {
          itemType: 'command',
          command: {
            key:
              'palette-help-topic',
            label:
              '@Tema',
            detail:
              '@lynch = samo teme · stavi dune u @lynch = poveži s temom',
            aliases:
              '@ topic tema help',
            kindLabel: 'KONTEKST',
            action: () =>
              setQuery('@'),
          },
        },
        {
          itemType: 'command',
          command: {
            key:
              'palette-help-collection',
            label:
              '#Kolekcija',
            detail:
              '#winter = samo kolekcije · dodaj dune #winter = membership + POTVRDA',
            aliases:
              '# collection kolekcija help',
            kindLabel: 'KONTEKST',
            action: () =>
              setQuery('#'),
          },
        },
        {
          itemType: 'command',
          command: {
            key:
              'palette-help-create',
            label:
              'Stvori prirodnim jezikom',
            detail:
              'nova knjiga Dune · novi film Dune · note moj tekst',
            aliases:
              'new create nova novi note',
            kindLabel: 'KONTEKST',
            action: () =>
              setQuery('nova knjiga '),
          },
        },
        {
          itemType: 'command',
          command: {
            key:
              'palette-help-update',
            label:
              'Update + kontekst',
            detail:
              'dune str 44 · zadnja knjiga str 44 · dodaj zadnje #winter',
            aliases:
              'update context recent zadnje',
            kindLabel: 'KONTEKST',
            action: () =>
              setQuery('dune str '),
          },
        },
        {
          itemType: 'command',
          command: {
            key:
              'palette-help-link',
            label:
              'Poveži stvari',
            detail:
              'stavi dune u @lynch · note haha@jung · new book haha@topux',
            aliases:
              'link povezi poveži @ topic',
            kindLabel: 'KONTEKST',
            action: () =>
              setQuery('stavi dune u @'),
          },
        },
        {
          itemType: 'command',
          command: {
            key:
              'palette-help-online',
            label:
              ':movie · :tv · :book · :game',
            detail:
              'Online metadata pretraga · npr. :movie dune',
            aliases:
              ':movie :tv :book :game online',
            kindLabel: 'KONTEKST',
            action: () =>
              setQuery(':movie '),
          },
        },
        {
          itemType: 'command',
          command: {
            key:
              'palette-help-tools',
            label:
              ':sound · :share · :year',
            detail:
              ':sound off · :share dune · :year 2025',
            aliases:
              ':sound :share :year tools',
            kindLabel: 'KONTEKST',
            action: () =>
              setQuery(':'),
          },
        },
      ] satisfies PaletteItem[];
    }

    // Bare # is its own mini help surface, symmetrical with @ topics.
    if (grammarQuery === '#') {
      const collectionHelp:
        PaletteItem[] = [
        {
          itemType: 'command',
          command: {
            key:
              'palette-hash-help',
            label:
              '#<kolekcija>',
            detail:
              'Pretraži samo kolekcije · primjer: #winter',
            aliases:
              '# kolekcija collection',
            kindLabel: 'KONTEKST',
            action: () =>
              setQuery(':help'),
          },
        },
        {
          itemType: 'command',
          command: {
            key:
              'palette-hash-add-help',
            label:
              'dodaj <stvar> #Kolekcija',
            detail:
              'Primjer: dodaj dune #winter · uvijek ide kroz POTVRDA',
            aliases:
              '# dodaj add collection',
            kindLabel: 'KONTEKST',
            action: () =>
              setQuery(
                'dodaj dune #',
              ),
          },
        },
        {
          itemType: 'command',
          command: {
            key:
              'palette-hash-note-help',
            label:
              'note <tekst>#Kolekcija',
            detail:
              'Primjer: note odličan kraj#winter',
            aliases:
              '# note biljeska bilješka',
            kindLabel: 'KONTEKST',
            action: () =>
              setQuery('note '),
          },
        },
      ];

      const collectionRows =
        collections
          .slice(0, 8)
          .map(
            (
              collection,
            ): PaletteItem => ({
              itemType: 'command',
              command: {
                key:
                  'palette-hash-current:' +
                  collection.collectionId,
                label:
                  '#' +
                  collection.name,
                detail:
                  'Kolekcija · tapni za otvaranje',
                aliases:
                  '#' +
                  collection.name,
                kindLabel: 'OTVORI',
                action: () =>
                  navigate(
                    'CollectionDetails',
                    {
                      collectionId:
                        collection.collectionId,
                    },
                  ),
              },
            }),
          );

      return [
        ...collectionHelp,
        ...collectionRows,
      ];
    }


    const fastIntent =
      parsePaletteFastIntent(
        query,
      );

    if (fastIntent) {
      const currentRoute =
        navigation?.getCurrentRoute?.();

      let currentRouteKey:
        string | null = null;

      if (
        currentRoute?.name ===
          'BookDetails' &&
        currentRoute.params?.bookId
      ) {
        currentRouteKey =
          'BOOK:' +
          String(
            currentRoute.params.bookId,
          );
      } else if (
        currentRoute?.name ===
          'TopicDetails' &&
        currentRoute.params?.topicId
      ) {
        currentRouteKey =
          'TOPIC:' +
          String(
            currentRoute.params.topicId,
          );
      } else if (
        (
          currentRoute?.name ===
            'EntryForm' ||
          currentRoute?.name ===
            'EntryDetails'
        ) &&
        currentRoute.params?.entryId
      ) {
        currentRouteKey =
          'ENTRY:' +
          String(
            currentRoute.params.entryId,
          );
      } else if (
        currentRoute?.name ===
          'MediaDetails' &&
        currentRoute.params?.mediaId
      ) {
        currentRouteKey =
          'MEDIA:' +
          String(
            currentRoute.params.mediaId,
          );
      } else if (
        currentRoute?.name ===
          'GameDetails' &&
        currentRoute.params?.gameId
      ) {
        currentRouteKey =
          'GAME:' +
          String(
            currentRoute.params.gameId,
          );
      }

      const routeEntity =
        currentRouteKey
          ? entities.find(
              (entity) =>
                entity.key ===
                currentRouteKey,
            ) ?? null
          : null;

      const activeBookId =
        activeContext
          ?.bookContext
          ?.bookId ??
        null;

      const activeBook =
        activeBookId
          ? entities.find(
              (entity) =>
                entity.key ===
                'BOOK:' +
                  activeBookId,
            ) ?? null
          : null;

      const currentContext =
        routeEntity ??
        activeBook ??
        null;

      if (
        fastIntent.kind ===
          'CREATE_NOTE_TO_COLLECTION'
      ) {
        const target =
          collections.find(
            (item) =>
              paletteFastNorm(
                item.name,
              ) ===
              paletteFastNorm(
                fastIntent.destination,
              ),
          ) ??
          null;

        return [{
          itemType: 'command',
          command: {
            key:
              'palette-fast-note-collection:' +
              fastIntent.destination,
            label:
              'Potvrdi: note “' +
              fastIntent.content +
              '” → #' +
              fastIntent.destination,
            detail:
              target
                ? 'Stvori bilješku i dodaj je u postojeću kolekciju'
                : 'Stvori bilješku + novu kolekciju #' +
                  fastIntent.destination,
            aliases: query,
            kindLabel: 'POTVRDA',
            action: () =>
              runPaletteFastIntent(
                fastIntent,
              ),
          },
        }];
      }

      if (
        fastIntent.kind ===
          'CREATE_NOTE_TO_TOPIC'
      ) {
        const target =
          topics.find(
            (item) =>
              paletteFastNorm(
                item.name,
              ) ===
              paletteFastNorm(
                fastIntent.destination,
              ),
          ) ??
          null;

        return [{
          itemType: 'command',
          command: {
            key:
              'palette-fast-note-topic:' +
              fastIntent.destination,
            label:
              'Potvrdi: note “' +
              fastIntent.content +
              '” → @' +
              fastIntent.destination,
            detail:
              target
                ? 'Stvori bilješku povezanu s postojećom temom'
                : 'Stvori bilješku + novu temu @' +
                  fastIntent.destination,
            aliases: query,
            kindLabel: 'POTVRDA',
            action: () =>
              runPaletteFastIntent(
                fastIntent,
              ),
          },
        }];
      }

      if (
        fastIntent.kind ===
          'CREATE_BOOK_DESTINATION'
      ) {
        const sigil =
          fastIntent.destinationKind ===
            'COLLECTION'
            ? '#'
            : '@';

        return [{
          itemType: 'command',
          command: {
            key:
              'palette-fast-create-book-destination:' +
              fastIntent.title +
              ':' +
              sigil +
              fastIntent.destination,
            label:
              'Potvrdi: nova knjiga “' +
              fastIntent.title +
              '” → ' +
              sigil +
              fastIntent.destination,
            detail:
              fastIntent.destinationKind ===
                'COLLECTION'
                ? 'Stvori knjigu i dodaj je u kolekciju'
                : 'Stvori knjigu i poveži je s temom',
            aliases: query,
            kindLabel: 'POTVRDA',
            action: () =>
              runPaletteFastIntent(
                fastIntent,
              ),
          },
        }];
      }

      const pageIntent =
        fastIntent.kind ===
          'UPDATE_BOOK_PAGE';

      const subject =
        pageIntent
          ? fastIntent.subject
          : fastIntent.subject;

      const currentForIntent =
        pageIntent
          ? (
              routeEntity?.kind ===
                'BOOK'
                ? routeEntity
                : activeBook
            )
          : currentContext;

      const candidates =
        paletteFastCandidates(
          entities,
          subject,
          {
            kind:
              pageIntent
                ? 'BOOK'
                : undefined,
            current:
              currentForIntent,
            implicit:
              pageIntent
                ? fastIntent.implicitBook
                : /^(?:ovo|to|this|that|it|zadnje|zadnja|zadnji|last|latest|recent)$/i.test(
                    subject.trim(),
                  ),
          },
        );

      if (
        candidates.length === 0
      ) {
        return [{
          itemType: 'command',
          command: {
            key:
              'palette-fast-unresolved:' +
              query,
            label:
              'Treba mi točnija stavka',
            detail:
              'Ne mogu sigurno odrediti “' +
              subject +
              '” · ništa neće biti promijenjeno',
            aliases: query,
            kindLabel: 'KONTEKST',
            action: () => undefined,
          },
        }];
      }

      if (pageIntent) {
        return candidates.map(
          (entity): PaletteItem => ({
            itemType: 'command',
            command: {
              key:
                'palette-fast-page:' +
                entity.key +
                ':' +
                fastIntent.page,
              label:
                'Potvrdi: ' +
                entity.title +
                ' → str. ' +
                fastIntent.page,
              detail:
                candidates.length > 1
                  ? entity.typeLabel +
                    ' · odaberi točnu knjigu'
                  : 'Ažuriraj stvarnu stranicu · ništa se ne mijenja prije potvrde',
              aliases: query,
              kindLabel: 'POTVRDA',
              action: () =>
                runPaletteFastIntent(
                  fastIntent,
                  entity,
                ),
            },
          }),
        );
      }

      if (
        fastIntent.kind ===
          'ADD_TO_COLLECTION'
      ) {
        const target =
          collections.find(
            (item) =>
              paletteFastNorm(
                item.name,
              ) ===
              paletteFastNorm(
                fastIntent.destination,
              ),
          ) ??
          null;

        return candidates.map(
          (entity): PaletteItem => ({
            itemType: 'command',
            command: {
              key:
                'palette-fast-collection:' +
                entity.key +
                ':' +
                fastIntent.destination,
              label:
                'Potvrdi: ' +
                entity.title +
                ' — ' +
                entity.typeLabel +
                ' → #' +
                fastIntent.destination,
              detail:
                target
                  ? 'Dodaj u postojeću kolekciju'
                  : 'Kolekcija ne postoji · stvorit će se tek nakon potvrde',
              aliases: query,
              kindLabel: 'POTVRDA',
              action: () =>
                runPaletteFastIntent(
                  fastIntent,
                  entity,
                ),
            },
          }),
        );
      }

      if (
        fastIntent.kind ===
          'ADD_TO_TOPIC'
      ) {
        const target =
          topics.find(
            (item) =>
              paletteFastNorm(
                item.name,
              ) ===
              paletteFastNorm(
                fastIntent.destination,
              ),
          ) ??
          null;

        return candidates.map(
          (entity): PaletteItem => ({
            itemType: 'command',
            command: {
              key:
                'palette-fast-topic:' +
                entity.key +
                ':' +
                fastIntent.destination,
              label:
                'Potvrdi: ' +
                entity.title +
                ' — ' +
                entity.typeLabel +
                ' ↔ @' +
                fastIntent.destination,
              detail:
                target
                  ? 'Poveži s postojećom temom'
                  : 'Tema ne postoji · stvorit će se tek nakon potvrde',
              aliases: query,
              kindLabel: 'POTVRDA',
              action: () =>
                runPaletteFastIntent(
                  fastIntent,
                  entity,
                ),
            },
          }),
        );
      }
    }

    const routedIntent = routeLJingleIntent(query) ?? localLanguageIntent;
    const discourseCorrection = parseDiscourseCorrection(query);
    if (discourseCorrection) {
      const remembered = entities.find(entity => entity.key === discourseCorrection.referentKey) ?? null;
      if (remembered) {
        return [{
          itemType: 'command',
          command: {
            key: 'discourse-correction:' + remembered.key,
            label: 'Ispravak: ' + remembered.title + ' → ' + discourseCorrection.destination,
            detail: 'K12 pamti prethodnu radnju · promjena još zahtijeva sigurnu domensku zamjenu',
            aliases: query,
            kindLabel: 'KONTEKST',
            action: () => undefined,
          },
        }];
      }
    }

    if (localLanguagePlan?.fullyValid && localLanguagePlan.intents.length >= 2) {
      const executable = compoundPlanCanExecute(localLanguagePlan.intents);
      const labels = localLanguagePlan.intents.map((intent) => intent.action).join(' → ');
      return [{
        itemType: 'command',
        command: {
          key: 'compound-language-plan',
          label: executable
            ? 'Izvrši ' + localLanguagePlan.intents.length + ' povezane radnje'
            : 'Razumijem ' + localLanguagePlan.intents.length + ' radnje',
          detail: executable
            ? labels + ' · potvrda prije izvršenja'
            : labels + ' · još nije sigurno izvršivo kao jedna cjelina',
          aliases: query,
          kindLabel: executable ? 'PLAN · POTVRDA' : 'PLAN',
          action: executable
            ? () => runCompoundLanguagePlan(localLanguagePlan)
            : () => undefined,
        },
      }];
    }

    if (localLanguagePlan && !localLanguagePlan.fullyValid && localLanguagePlan.raw.length >= 2) {
      // One bad child invalidates the whole plan. Never partially mutate.
      return [];
    }

    const contextualIntent =
      toContextualVerbIntent(routedIntent) ??
      parseContextualVerbIntent(query);
    const contextIntent =
      toQuietContextIntent(routedIntent) ??
      parseQuietContextIntent(query);
    const contextSearchQuery =
      contextIntent?.kind === 'LINK_ACTIVE'
        ? contextIntent.query
        : routedIntent?.action === 'SEARCH'
          ? routedIntent.query
          : query;
    const quietPlan = planQuietSearch(contextSearchQuery);
    const normalizedQuery = normalize(quietPlan?.query ?? contextSearchQuery.trim());
    const actionCommand = parsePaletteActionCommand(query);
    const quickCreate = parseQuickCreateCommand(query);
    const naturalNote = parseNaturalPaletteNote(query);
    const naturalCreate = parseNaturalCreateCommand(query);
    const deterministicMutation =
      parseDeterministicMutationCommand(query);
    const brainCommand = parseBrainCommand(query);
    const onlineCommand =
      parseOnlineSearchCommand(query);

    if (naturalNote) {
      if (naturalNote.kind === 'PROMPT') {
        return [{
          itemType: 'command',
          command: {
            key: 'natural-note-prompt',
            label: 'Nova bilješka',
            detail: 'Nastavi pisati sadržaj bilješke',
            aliases: query,
            kindLabel: 'AKCIJA',
            action: () => {
              setQuery(':note ');
              setSelectedIndex(-1);
            },
          },
        }];
      }

      return [{
        itemType: 'command',
        command: {
          key: 'natural-note-create',
          label: 'Spremi bilješku',
          detail: naturalNote.content,
          aliases: query,
          kindLabel: 'AKCIJA',
          action: () => runQuickCreate({
            kind: 'ENTRY',
            type: 'NOTE',
            content: naturalNote.content,
            label: 'Bilješka',
          }),
        },
      }];
    }

    if (deterministicMutation) {
      const sourceKey = k15MutationSourceResolution?.candidates[0]?.entity.key;
      const sourceEntity = sourceKey
        ? entities.find((entity) => entity.key === sourceKey) ?? null
        : null;
      const targetKey = k15MutationTargetResolution?.candidates[0]?.entity.key;
      const targetEntity = targetKey
        ? entities.find((entity) => entity.key === targetKey) ?? null
        : null;
      const sourceResolved = Boolean(sourceEntity) && (
        k15MutationSourceResolution?.level === 'HIGH' ||
        k15MutationSourceResolution?.level === 'MEDIUM'
      );
      const targetResolved = Boolean(targetEntity) && (
        k15MutationTargetResolution?.level === 'HIGH' ||
        k15MutationTargetResolution?.level === 'MEDIUM'
      );
      const pickCollection = (name: string) => {
        const exact = collections.find((item) => normalize(item.name) === normalize(name));
        if (exact) return exact;
        const fuzzy = collections.filter((item) => fuzzyTextIncludes(item.name, name));
        return fuzzy.length === 1 ? fuzzy[0] ?? null : null;
      };
      const pickTopic = (name: string) => {
        const exact = topics.find((item) => normalize(item.name) === normalize(name));
        if (exact) return exact;
        const fuzzy = topics.filter((item) => fuzzyTextIncludes(item.name, name));
        return fuzzy.length === 1 ? fuzzy[0] ?? null : null;
      };

      if (deterministicMutation.kind === 'UPDATE_BOOK_PAGE') {
        if (!sourceResolved || sourceEntity?.kind !== 'BOOK') return [];
        return [{
          itemType: 'command',
          command: {
            key: 'k15-confirm-page:' + sourceEntity.id + ':' + deterministicMutation.page,
            label: 'Potvrdi: ' + sourceEntity.title + ' → str. ' + deterministicMutation.page,
            detail: 'Ažuriraj stvarnu stranicu · ništa se ne mijenja prije potvrde',
            aliases: query,
            kindLabel: 'POTVRDA',
            action: () => runK15Mutation(deterministicMutation, sourceEntity),
          },
        }];
      }

      if (deterministicMutation.kind === 'ADD_TO_COLLECTION') {
        if (!sourceResolved || !sourceEntity) return [];
        const collection = pickCollection(deterministicMutation.collectionQuery);
        return [{
          itemType: 'command',
          command: {
            key: 'k15-confirm-collection:' + sourceEntity.key + ':' + deterministicMutation.collectionQuery,
            label: collection
              ? 'Potvrdi: ' + sourceEntity.title + ' → #' + collection.name
              : 'Potvrdi: stvori #' + deterministicMutation.collectionQuery + ' + dodaj ' + sourceEntity.title,
            detail: collection
              ? 'Dodavanje u postojeću kolekciju'
              : 'Kolekcija ne postoji · stvorit će se tek nakon potvrde',
            aliases: query,
            kindLabel: 'POTVRDA',
            action: () => runK15Mutation(deterministicMutation, sourceEntity),
          },
        }];
      }

      if (deterministicMutation.kind === 'ADD_TO_TOPIC') {
        if (!sourceResolved || !sourceEntity) return [];
        const topic = pickTopic(deterministicMutation.topicQuery);
        return [{
          itemType: 'command',
          command: {
            key: 'k15-confirm-topic:' + sourceEntity.key + ':' + deterministicMutation.topicQuery,
            label: topic
              ? 'Potvrdi: ' + sourceEntity.title + ' ↔ @' + topic.name
              : 'Potvrdi: stvori @' + deterministicMutation.topicQuery + ' + poveži ' + sourceEntity.title,
            detail: topic
              ? 'Poveži s postojećom temom'
              : 'Tema ne postoji · stvorit će se tek nakon potvrde',
            aliases: query,
            kindLabel: 'POTVRDA',
            action: () => runK15Mutation(deterministicMutation, sourceEntity),
          },
        }];
      }

      if (deterministicMutation.kind === 'CREATE_NOTE_TO_COLLECTION') {
        const collection = pickCollection(deterministicMutation.collectionQuery);
        return [{
          itemType: 'command',
          command: {
            key: 'k15-confirm-note-collection:' + deterministicMutation.collectionQuery,
            label: 'Potvrdi: note “' + deterministicMutation.content + '” → #' + deterministicMutation.collectionQuery,
            detail: collection
              ? 'Stvori bilješku i dodaj je u postojeću kolekciju'
              : 'Stvori bilješku + novu kolekciju #' + deterministicMutation.collectionQuery,
            aliases: query,
            kindLabel: 'POTVRDA',
            action: () => runK15Mutation(deterministicMutation),
          },
        }];
      }

      if (deterministicMutation.kind === 'CREATE_NOTE_TO_TOPIC') {
        const topic = pickTopic(deterministicMutation.topicQuery);
        return [{
          itemType: 'command',
          command: {
            key: 'k15-confirm-note-topic:' + deterministicMutation.topicQuery,
            label: 'Potvrdi: note “' + deterministicMutation.content + '” → @' + deterministicMutation.topicQuery,
            detail: topic
              ? 'Stvori bilješku povezanu s postojećom temom'
              : 'Stvori bilješku + novu temu @' + deterministicMutation.topicQuery,
            aliases: query,
            kindLabel: 'POTVRDA',
            action: () => runK15Mutation(deterministicMutation),
          },
        }];
      }

      if (deterministicMutation.kind === 'LINK') {
        if (!sourceResolved || !sourceEntity) return [];
        const canCreateTopic = !targetResolved &&
          deterministicMutation.createTargetIfMissing &&
          deterministicMutation.target.kindHint === 'TOPIC';
        if (!targetResolved && !canCreateTopic) return [];
        const targetTitle = targetEntity?.title ?? ('@' + deterministicMutation.target.query);
        return [{
          itemType: 'command',
          command: {
            key: 'k15-confirm-link:' + sourceEntity.key + ':' + targetTitle,
            label: 'Potvrdi: ' + sourceEntity.title + ' ↔ ' + targetTitle,
            detail: canCreateTopic
              ? 'Tema ne postoji · stvorit će se tek nakon potvrde'
              : 'Poveži dvije postojeće stavke',
            aliases: query,
            kindLabel: 'POTVRDA',
            action: () => runK15Mutation(deterministicMutation, sourceEntity, targetEntity),
          },
        }];
      }
    }

    if (naturalCreate) {
      const label =
        naturalCreate.kind === 'BOOK'
          ? 'Stvori knjigu “' + naturalCreate.query + '”'
          : naturalCreate.kind === 'TOPIC'
            ? 'Stvori temu “' + naturalCreate.query + '”'
            : naturalCreate.kind === 'MOVIE'
              ? 'Pretraži film “' + naturalCreate.query + '”'
              : naturalCreate.kind === 'SERIES'
                ? 'Pretraži seriju “' + naturalCreate.query + '”'
                : 'Pretraži igru “' + naturalCreate.query + '”';

      const detail =
        naturalCreate.kind === 'BOOK'
          ? 'Lokalna knjiga · potvrdi akciju'
          : naturalCreate.kind === 'TOPIC'
            ? 'Lokalna tema · potvrdi akciju'
            : 'Online metadata search · odaberi pravi rezultat prije dodavanja';

      return [{
        itemType: 'command',
        command: {
          key: 'k15-natural-create',
          label,
          detail,
          aliases: query,
          kindLabel: 'POTVRDA',
          action: () => {
            if (naturalCreate.kind === 'BOOK') {
              void runQuickCreate({
                kind: 'BOOK',
                title: naturalCreate.query,
              });
              return;
            }

            if (naturalCreate.kind === 'TOPIC') {
              void runQuickCreate({
                kind: 'TOPIC',
                name: naturalCreate.query,
              });
              return;
            }

            const prefix =
              naturalCreate.kind === 'MOVIE'
                ? ':movie '
                : naturalCreate.kind === 'SERIES'
                  ? ':tv '
                  : ':game ';

            setQuery(
              prefix +
                naturalCreate.query,
            );
            setSelectedIndex(-1);
          },
        },
      }];
    }

    if (brainCommand) {
      return [{
        itemType: 'command',
        command: {
          key: 'ljingle-intelligence-status',
          label: 'LJingle Intelligence · active',
          detail:
            'Deterministic · fuzzy · contextual · no local language model',
          aliases:
            ':brain intelligence fuzzy context deterministic',
          kindLabel: 'KONTEKST',
          action: () => undefined,
        },
      }];
    }

    const currentContextKey = activeEntityKey(activeContext);
    const currentContextEntity = currentContextKey
      ? entities.find((entity) => entity.key === currentContextKey) ?? null
      : null;
    const currentBookKey = activeBookKey(activeContext);
    const currentBookEntity = currentBookKey
      ? entities.find((entity) => entity.key === currentBookKey) ?? null
      : null;

    if (contextualIntent?.kind === 'OPEN_CURRENT' && currentContextEntity) {
      return [{
        itemType: 'command',
        command: {
          key: 'contextual-open-current',
          label: 'Otvori ' + currentContextEntity.title,
          detail: currentContextEntity.typeLabel,
          aliases: query,
          kindLabel: 'AKCIJA',
          action: () => runContextualVerbAction(contextualIntent),
        },
      }];
    }

    if (contextualIntent?.kind === 'OPEN_CURRENT_BOOK' && currentBookEntity) {
      return [{
        itemType: 'command',
        command: {
          key: 'contextual-open-book',
          label: 'Otvori ' + currentBookEntity.title,
          detail: 'Aktivna knjiga',
          aliases: query,
          kindLabel: 'AKCIJA',
          action: () => runContextualVerbAction(contextualIntent),
        },
      }];
    }

    if (
      contextualIntent?.kind === 'NOTE_ACTIVE' &&
      activeContext?.singleTimer?.activeSessionId
    ) {
      return [{
        itemType: 'command',
        command: {
          key: 'contextual-note-active',
          label: contextualIntent.note,
          detail: 'Zapiši uz ' + activeContext.singleTimer.label,
          aliases: query,
          kindLabel: 'AKCIJA',
          action: () => runContextualVerbAction(contextualIntent),
        },
      }];
    }

    if (contextualIntent?.kind === 'ADD_CURRENT_TO_COLLECTION') {
      const collectionTarget = resolveCollectionTarget(
        collections,
        contextualIntent.collectionQuery,
      );
      const resolvedKey = localReferentResolution?.candidates[0]?.entity.key;
      const resolvedEntity = resolvedKey
        ? entities.find(entity => entity.key === resolvedKey) ?? null
        : null;

      if (collectionTarget && localLanguageRaw?.subjectQuery) {
        if (localReferentResolution?.level === 'HIGH' && resolvedEntity) {
          return [{
            itemType: 'command',
            command: {
              key: 'resolved-collection:' + collectionTarget.collectionId + ':' + resolvedEntity.key,
              label: 'Dodaj u ' + collectionTarget.name,
              detail: resolvedEntity.title + ' · sigurna referenca',
              aliases: query,
              kindLabel: 'AKCIJA',
              action: () => runContextualVerbAction(contextualIntent),
            },
          }];
        }

        if (localReferentResolution?.level === 'MEDIUM' && resolvedEntity) {
          const second = localReferentResolution.candidates[1]?.entity;
          return [{
            itemType: 'command',
            command: {
              key: 'confirm-collection:' + resolvedEntity.key,
              label: 'Potvrdi: ' + resolvedEntity.title + ' → ' + collectionTarget.name,
              detail: second ? 'Drugi mogući rezultat: ' + second.title : 'Potvrdi referencu prije promjene',
              aliases: query,
              kindLabel: 'POTVRDA',
              action: () => runContextualVerbAction(contextualIntent, resolvedEntity),
            },
          }];
        }

        // LOW confidence: never mutate. Search/results remain visible below.
        if (localReferentResolution?.level === 'LOW') return [];
      }

      if (collectionTarget && currentContextEntity) {
        return [{
          itemType: 'command',
          command: {
            key: 'contextual-collection:' + collectionTarget.collectionId,
            label: 'Dodaj u ' + collectionTarget.name,
            detail: currentContextEntity.title,
            aliases: query,
            kindLabel: 'AKCIJA',
            action: () => runContextualVerbAction(contextualIntent),
          },
        }];
      }
    }

    if (
      contextualIntent?.kind === 'LINK_CURRENT_ENTITY' &&
      contextualTarget
    ) {
      const resolvedKey =
        localReferentResolution?.candidates[0]?.entity.key;

      const resolvedEntity =
        resolvedKey
          ? entities.find(
              (entity) =>
                entity.key === resolvedKey,
            ) ?? null
          : null;

      const sourceEntity =
        localLanguageRaw?.subjectQuery
          ? resolvedEntity
          : currentContextEntity;

      if (
        sourceEntity &&
        (
          !localLanguageRaw?.subjectQuery ||
          localReferentResolution?.level === 'HIGH' ||
          localReferentResolution?.level === 'MEDIUM'
        )
      ) {
        return [{
          itemType: 'command',
          command: {
            key:
              'k15-link:' +
              sourceEntity.key +
              ':' +
              contextualTarget.key,
            label:
              'Poveži ' +
              sourceEntity.title +
              ' s ' +
              contextualTarget.title,
            detail:
              localLanguageRaw?.subjectQuery
                ? 'Potvrdi kontekstualnu referencu'
                : 'Trenutni kontekst',
            aliases: query,
            kindLabel: 'POTVRDA',
            action: () =>
              runContextualVerbAction(
                contextualIntent,
                sourceEntity,
              ),
          },
        }];
      }
    }

    if (
      contextualIntent?.kind === 'START_READING' &&
      contextualTarget?.kind === 'BOOK'
    ) {
      return [{
        itemType: 'command',
        command: {
          key: 'contextual-start-reading:' + contextualTarget.id,
          label: 'Počni čitati ' + contextualTarget.title,
          detail: 'Pokreni timer čitanja',
          aliases: query,
          kindLabel: 'AKCIJA',
          action: () => runContextualVerbAction(contextualIntent),
        },
      }];
    }

    if (contextualIntent) {
      // Recognized natural-language action, but context/target is not safely
      // resolvable yet. Stay quiet rather than falling through to noisy search.
      return [];
    }

    if (contextIntent?.kind === 'BOOK_PAGE' && activeContext?.bookContext) {
      const bookTitle =
        activeContext.singleTimer?.label?.replace(/^Čitanje\s*[—-]\s*/i, '') ||
        'aktivna knjiga';

      return [
        {
          itemType: 'command',
          command: {
            key: 'quiet-context-page',
            label: 'Stranica ' + contextIntent.page,
            detail: bookTitle,
            aliases: query,
            kindLabel: 'AKCIJA',
            action: () => runQuietContextAction(contextIntent),
          },
        },
      ];
    }

    if (
      contextIntent?.kind === 'STOP_ACTIVE' &&
      activeContext?.singleTimer
    ) {
      return [
        {
          itemType: 'command',
          command: {
            key: 'quiet-context-stop',
            label: 'Zaustavi ' + activeContext.singleTimer.label,
            detail: 'Aktivni timer',
            aliases: query,
            kindLabel: 'AKCIJA',
            action: () => runQuietContextAction(contextIntent),
          },
        },
      ];
    }

    if (
      contextIntent?.kind === 'LINK_ACTIVE' &&
      activeContext?.singleTimer &&
      contextLinkTarget
    ) {
      return [
        {
          itemType: 'command',
          command: {
            key: 'quiet-context-link:' + contextLinkTarget.key,
            label: 'Poveži s ' + contextLinkTarget.title,
            detail: activeContext.singleTimer.label,
            aliases: contextIntent.query,
            kindLabel: 'AKCIJA',
            action: () => runQuietContextAction(contextIntent),
          },
        },
      ];
    }

    if (onlineCommand) {
      if (!onlineCommand.query) {
        const label =
          onlineCommand.kind === 'MOVIE'
            ? ':movie <naslov>'
            : onlineCommand.kind === 'TV'
              ? ':tv <naslov>'
              : onlineCommand.kind === 'BOOK'
                ? ':book <naslov>'
                : ':game <naslov>';

        const source =
          onlineCommand.kind === 'BOOK'
            ? 'Google Books'
            : onlineCommand.kind === 'GAME'
              ? 'IGDB'
              : 'TMDB';

        return [
          {
            itemType: 'command',
            command: {
              key: 'online-search-hint',
              label,
              detail:
                'Online pretraga · ' +
                source,
              aliases: label,
              kindLabel: 'AKCIJA',
              action: () =>
                setQuery(
                  onlineCommand.command + ' ',
                ),
            },
          },
        ];
      }

      if (onlineResults.length > 0) {
        return onlineResults.map(
          (result): PaletteItem => ({
            itemType: 'online',
            result,
          }),
        );
      }

      if (
        onlineSearched &&
        !onlineLoading
      ) {
        return [
          {
            itemType: 'command',
            command: {
              key: 'online-manual-create',
              label:
                'Dodaj “' +
                onlineCommand.query +
                '” ručno',
              detail: onlineError
                ? 'Online izvor nije dostupan · napravi lokalni item'
                : 'Nema online rezultata · napravi lokalni item',
              aliases:
                onlineCommand.query,
              kindLabel: 'AKCIJA',
              action: () =>
                runManualOnlineCreate(
                  onlineCommand.kind,
                  onlineCommand.query,
                ),
            },
          },
        ];
      }

      return [];
    }

    if (actionCommand) {
      const detail =
        actionCommand.kind === 'SYNC'
          ? 'Pokreni Cloud Sync'
          : actionCommand.kind === 'JINGLE_MODE'
            ? 'Uđi u Jingle mode — klik na rezultat togglea Jingle'
            : actionCommand.kind === 'HELP'
              ? 'Prikaži sve Palette naredbe'
              : actionCommand.kind === 'RANDOM'
                ? actionCommand.target === 'BOOK'
                  ? 'Otvori nasumičnu nepročitanu knjigu'
                  : actionCommand.target === 'GAME'
                    ? 'Otvori nasumičnu nezavršenu igru'
                    : 'Otvori nasumični Jingle item'
                : actionCommand.kind === 'STOP'
                  ? actionCommand.query
                    ? 'Zaustavi timer “' + actionCommand.query + '”'
                    : 'Zaustavi jedini aktivni timer'
                  : 'Pokreni timer “' + actionCommand.query + '”';

      return [
        {
          itemType: 'command',
          command: {
            key: 'palette-action',
            label: query.trim(),
            detail,
            aliases: query.trim(),
            action: () => runActionCommand(actionCommand),
          },
        },
      ];
    }

    if (quickCreate) {
      const detail =
        quickCreate.kind === 'BOOK'
          ? `Odmah stvori knjigu “${quickCreate.title}”`
          : quickCreate.kind === 'TOPIC'
            ? `Odmah stvori temu “${quickCreate.name}”`
            : `Odmah stvori ${quickCreate.label.toLocaleLowerCase()}`;

      return [
        {
          itemType: 'command',
          command: {
            key: 'quick-create',
            label: query.trim(),
            detail,
            aliases: query.trim(),
            action: () => runQuickCreate(quickCreate),
          },
        },
      ];
    }

    if (query.trim() === ':') {
      const helpCommands: PaletteCommand[] = [
        {
          key: 'help-note',
          label: ':note <tekst> @Tema',
          detail: 'Napravi bilješku odmah; tema se po potrebi automatski kreira',
          aliases: ':note',
          action: () => setQuery(':note '),
        },
        {
          key: 'help-quote',
          label: ':quote <tekst> @Tema',
          detail: 'Napravi citat odmah',
          aliases: ':quote',
          action: () => setQuery(':quote '),
        },
        {
          key: 'help-obs',
          label: ':obs <tekst> @Tema',
          detail: 'Napravi opažanje odmah',
          aliases: ':obs',
          action: () => setQuery(':obs '),
        },
        {
          key: 'help-review',
          label: ':review <tekst> @Tema',
          detail: 'Napravi osvrt odmah',
          aliases: ':review',
          action: () => setQuery(':review '),
        },
        {
          key: 'help-movie-online',
          label: ':movie <naslov>',
          detail: 'Pretraži filmove online preko TMDB-a',
          aliases: ':movie',
          action: () => setQuery(':movie '),
        },
        {
          key: 'help-tv-online',
          label: ':tv <naslov>',
          detail: 'Pretraži TV serije online preko TMDB-a',
          aliases: ':tv',
          action: () => setQuery(':tv '),
        },
        {
          key: 'help-book-online',
          label: ':book <naslov>',
          detail: 'Pretraži knjige online preko Google Booksa',
          aliases: ':book',
          action: () => setQuery(':book '),
        },
        {
          key: 'help-game-online',
          label: ':game <naslov>',
          detail: 'Pretraži igre online preko IGDB-a',
          aliases: ':game',
          action: () => setQuery(':game '),
        },
        {
          key: 'help-new-book',
          label: ':new book <naslov>',
          detail: 'Napravi minimalnu lokalnu knjigu bez online pretrage',
          aliases: ':new book',
          action: () => setQuery(':new book '),
        },
        {
          key: 'help-topic',
          label: ':topic <naziv>',
          detail: 'Napravi temu odmah',
          aliases: ':topic',
          action: () => setQuery(':topic '),
        },
        {
          key: 'help-jingle',
          label: ':jingle',
          detail: 'Jingle mode: zatim search + klik za toggle',
          aliases: ':jingle',
          action: () => setQuery(':jingle'),
        },
        {
          key: 'help-random-book',
          label: ':random book',
          detail: 'Nasumična nepročitana knjiga',
          aliases: ':random book',
          action: () => setQuery(':random book'),
        },
        {
          key: 'help-random-game',
          label: ':random game',
          detail: 'Nasumična nezavršena igra',
          aliases: ':random game',
          action: () => setQuery(':random game'),
        },
        {
          key: 'help-random-jingle',
          label: ':random jingle',
          detail: 'Nasumični Jingle item',
          aliases: ':random jingle',
          action: () => setQuery(':random jingle'),
        },
        {
          key: 'help-timer',
          label: ':timer <aktivnost>',
          detail: 'Pokreni timer aktivnosti',
          aliases: ':timer',
          action: () => setQuery(':timer '),
        },
        {
          key: 'help-stop',
          label: ':stop <aktivnost>',
          detail: 'Zaustavi aktivni timer',
          aliases: ':stop',
          action: () => setQuery(':stop '),
        },
        {
          key: 'help-sync',
          label: ':sync',
          detail: 'Pokreni Cloud Sync',
          aliases: ':sync',
          action: () => setQuery(':sync'),
        },
      ];

      return helpCommands.map(
        (command): PaletteItem => ({
          itemType: 'command',
          command,
        }),
      );
    }

    if (
      normalizedQuery.length > 0 &&
      isCommandShapedInput(query) &&
      !isExplicitSearchInput(query) &&
      !routedIntent &&
      !isLikelyCompoundLanguage(query)
    ) {
      return [{
        itemType: 'command',
        command: {
          key: 'intent-first-unresolved',
          label: brainStatus.enabled
            ? 'Nisam sigurno razumio naredbu'
            : 'Naredba · Local Brain je isključen',
          detail:
            commandHelpForInput(query) ??
            (brainStatus.enabled
              ? 'Preformuliraj naredbu · ništa nije izvršeno ni spremljeno kao pretraga'
              : 'Uključi Local Brain za neuredan prirodni jezik · ništa nije izvršeno'),
          aliases: query,
          kindLabel: 'KONTEKST',
          action: brainStatus.enabled
            ? () => undefined
            : () => {
                setQuery(':brain on');
                setSelectedIndex(-1);
              },
        },
      }];
    }

    if (normalizedQuery.length === 0) {
      const recentSearchCommands =
        recentSearches.map(
          (value): PaletteCommand => ({
            key: 'recent-search:' + value,
            label: value,
            detail: 'Nedavna pretraga',
            aliases: value,
            action: () => {
              setQuery(value);
              setSelectedIndex(-1);
            },
          }),
        );

      const compactRecents: PaletteItem[] = [
        ...recentEntities
          .slice(0, 3)
          .map(
            (entity): PaletteItem => ({
              itemType: 'entity',
              entity,
            }),
          ),

        ...recentSearchCommands
          .slice(0, 2)
          .map(
            (command): PaletteItem => ({
              itemType: 'command',
              command,
            }),
          ),
      ];

      if (compactRecents.length > 0) {
        return compactRecents;
      }

      return [
        {
          itemType: 'command',
          command: {
            key: 'palette-starter',
            label:
              ':movie · :tv · :book · :game',
            detail:
              'Online katalog · upiši : za sve naredbe',
            aliases:
              'movie tv book game online',
            kindLabel: 'AKCIJA',
            action: () => setQuery(':'),
          },
        },
      ];
    }
    const tokens = normalizedQuery
      .split(/\s+/)
      .filter(Boolean);

    const jingleOnly = tokens.includes('jingle');

    const textTerms = tokens.filter(
      (token) => token !== 'jingle'
    );

    const commandResults =
      quietPlan?.naturalLanguage
        ? []
        : commands.filter((command) => {
            const haystack = normalize(
              command.label +
                ' ' +
                command.detail +
                ' ' +
                command.aliases
            );

            return textTerms.length > 0
              ? textTerms.every((term) =>
                  fuzzyTextIncludes(haystack, term)
                )
              : false;
          });

    const allowedEntityKinds = quietPlan?.entityTypes
      ? new Set(quietPlan.entityTypes)
      : null;

    // aeroSearchQuoteTimerHygieneV3:SearchRanking
    const entityMatchRank = (
      entity: SearchEntity,
    ) => {
      if (
        textTerms.length === 0
      ) {
        return 5;
      }

      const title =
        normalize(entity.title);

      const haystack =
        normalize(
          [
            entity.title,
            entity.typeLabel,
            entity.meta,
          ].join(' '),
        );

      // Exact saved title must always win before any fuzzy/semantic result.
      if (
        normalizedQuery &&
        title === normalizedQuery
      ) {
        return 0;
      }

      if (
        normalizedQuery &&
        title.startsWith(
          normalizedQuery,
        )
      ) {
        return 1;
      }

      if (
        normalizedQuery &&
        title.includes(
          normalizedQuery,
        )
      ) {
        return 2;
      }

      // Normal direct metadata/type match remains useful.
      if (
        textTerms.every(
          (term) =>
            haystack.includes(term),
        )
      ) {
        return 3;
      }

      // Typo tolerance is deliberately title-scoped.
      // Example: "severamce" -> "Severance".
      // We do NOT use fuzzyTextIncludes here because its reverse-substring
      // behavior can make a long query match an unrelated one-letter word.
      const titleWords =
        title
          .split(/\s+/)
          .filter(Boolean);

      if (
        textTerms.every(
          (term) =>
            fuzzyWord(
              term,
              titleWords,
            ),
        )
      ) {
        return 4;
      }

      return null;
    };

    const entityMatches =
      entities
        .filter((entity) => {
          if (
            allowedEntityKinds &&
            !allowedEntityKinds.has(
              entity.kind,
            )
          ) {
            return false;
          }

          if (
            jingleMode &&
            entity.kind !== 'BOOK' &&
            entity.kind !== 'MEDIA' &&
            entity.kind !== 'GAME'
          ) {
            return false;
          }

          if (
            jingleOnly &&
            !entity.favourite
          ) {
            return false;
          }

          return true;
        })
        .map((entity, index) => ({
          entity,
          index,
          rank:
            entityMatchRank(
              entity,
            ),
        }))
        .filter(
          (
            row,
          ): row is {
            entity: SearchEntity;
            index: number;
            rank: number;
          } =>
            row.rank !== null,
        )
        .sort(
          (left, right) =>
            left.rank -
              right.rank ||
            left.index -
              right.index,
        )
        .slice(0, 20);

    const entityResults =
      entityMatches.map(
        (row) => row.entity,
      );

    const lexicalKeys = new Set(entityResults.map((item) => item.key));
    const semanticFallback = quietSemanticEntities
      .filter((entity) => !lexicalKeys.has(entity.key))
      .filter((entity) => !allowedEntityKinds || allowedEntityKinds.has(entity.kind))
      .filter((entity) => !jingleOnly || entity.favourite)
      .filter((entity) =>
        !jingleMode ||
        entity.kind === 'BOOK' ||
        entity.kind === 'MEDIA' ||
        entity.kind === 'GAME',
      )
      .slice(0, Math.max(0, 20 - entityResults.length));

    const commandItems =
      commandResults.map(
        (command): PaletteItem => ({
          itemType: 'command',
          command,
        }),
      );

    const entityItems =
      entityResults.map(
        (entity): PaletteItem => ({
          itemType: 'entity',
          entity,
        }),
      );

    const semanticItems =
      semanticFallback.map(
        (entity): PaletteItem => ({
          itemType: 'entity',
          entity,
        }),
      );

    const catalogueHitFirst =
      entityMatches.length > 0;

    return catalogueHitFirst
      ? [
          ...entityItems,
          ...semanticItems,
          ...commandItems,
        ]
      : [
          ...commandItems,
          ...semanticItems,
        ];
  }, [
    commands,
    entities,
    query,
    recentEntities,
    recentSearches,
    quickCommandBusy,
    jingleMode,
    onlineError,
    onlineLoading,
    onlineResults,
    onlineSearched,
    quietSemanticEntities,
    activeContext,
    contextLinkTarget,
    contextualTarget,
    collections,
    localLanguageIntent,
    localLanguageRaw,
    localReferentResolution,
    localLanguagePlan,
    brainStatus,
    k15MutationSourceResolution,
    k15MutationTargetResolution,
    topics,
  ]);

  useEffect(() => {
    // paletteEnterOwnershipFastIntentsV1_1
    // Any async rerank invalidates keyboard selection.
    setSelectedIndex(-1);
  }, [query, items]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;

    const target = globalThis as any;

    const onKeyDown = (event: any) => {
      const key = String(event.key ?? '').toLocaleLowerCase();

      if (key === 'arrowdown') {
        event.preventDefault();

        setSelectedIndex((current) =>
          items.length === 0
            ? -1
            : current < 0
              ? 0
              : (current + 1) % items.length
        );

        return;
      }

      if (key === 'arrowup') {
        event.preventDefault();

        setSelectedIndex((current) =>
          items.length === 0
            ? -1
            : current < 0
              ? items.length - 1
              : (current - 1 + items.length) %
                items.length
        );

        return;
      }

            if (key === 'enter') {
        event.preventDefault();

        if (selectedIndex >= 0) {
          const selected =
            items[selectedIndex];

          if (
            !selected ||
            selected.itemType !== 'command' ||
            !paletteCommandRunsOnEnter(
              selected.command,
            )
          ) {
            return;
          }

          rememberSearch(query);
          void selected.command.action();
          return;
        }

        const executable =
          items.filter(
            (
              item,
            ): item is Extract<
              PaletteItem,
              { itemType: 'command' }
            > =>
              item.itemType ===
                'command' &&
              paletteCommandRunsOnEnter(
                item.command,
              ),
          );

        if (executable.length !== 1) {
          return;
        }

        rememberSearch(query);
        void executable[0]!.command.action();
      }
    };

    target.addEventListener?.('keydown', onKeyDown);

    return () => {
      target.removeEventListener?.('keydown', onKeyDown);
    };
  }, [items, selectedIndex, visible]);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Zatvori command palette"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.palette, celestialMode && styles.celestialPaletteN1]}>
          {celestialMode ? (
            <View pointerEvents="none" style={styles.celestialPaletteStarsN1}>
              <Text style={[styles.celestialPaletteStarN1, { left: 18, top: 9 }]}>✦</Text>
              <Text style={[styles.celestialPaletteStarN1, { left: '31%', top: 19, opacity: 0.18 }]}>·</Text>
              <Text style={[styles.celestialPaletteStarN1, { right: '24%', top: 11 }]}>✧</Text>
              <Text style={[styles.celestialPaletteStarN1, { right: 16, top: 30, opacity: 0.18 }]}>✦</Text>
            </View>
          ) : null}
          <View style={[styles.searchRow, celestialMode && styles.celestialSearchRowN1]}>
            <Text style={styles.searchIcon}>
              ⌕
            </Text>

            <TextInput
              ref={inputRef}
              accessibilityLabel="Pretraži ili pokreni akciju"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => {
                setQuery(value);
                setQuickCommandError(null);
              }}
              onSubmitEditing={() => {
                if (Platform.OS === 'web') {
                  return;
                }

                const executable =
                  items.filter(
                    (
                      item,
                    ): item is Extract<
                      PaletteItem,
                      { itemType: 'command' }
                    > =>
                      item.itemType ===
                        'command' &&
                      paletteCommandRunsOnEnter(
                        item.command,
                      ),
                  );

                // No guessing:
                // 0 commands = nothing to execute.
                // 2+ confirmations = user must tap the intended row.
                if (executable.length !== 1) {
                  return;
                }

                rememberSearch(query);
                void executable[0]!.command.action();
              }}
              returnKeyType="go"
              placeholder=":help · @tema · #kolekcija · traži…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={query}
            />


            <Pressable

              accessibilityRole="button"

              accessibilityLabel={

                brainStatus.loaded

                  ? 'LJingle Intelligence active'

                  : brainStatus.enabled

                    ? 'Local Brain on'

                    : 'Local Brain off'

              }

              hitSlop={8}

              onPress={() => {

                setQuery(':brain');

                setSelectedIndex(-1);

              }}

              style={({ pressed }) => ({

                width: 38,

                height: 38,

                alignItems: 'center',

                justifyContent: 'center',

                marginLeft: 4,

                opacity: pressed ? 0.58 : 1,

              })}

            >

              <BrainGlyph

                color={brainAccentColor}

                enabled={brainStatus.enabled}

                loaded={brainStatus.loaded}

              />

            </Pressable>

            {Platform.OS === 'web' ? (
              <View style={styles.shortcut}>
                <Text style={styles.shortcutText}>
                  ESC
                </Text>
              </View>
            ) : null}
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.results}
          >
            {quickCommandError ? (
              <Text style={styles.commandError}>{quickCommandError}</Text>
            ) : null}
            {onlineError ? (
              <Text style={styles.onlineError}>{onlineError}</Text>
            ) : null}
            {quickCommandBusy ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.textMuted} size="small" />
                <Text style={styles.loadingText}>
                  {parseBrainCommand(query) === 'ENABLE'
                    ? 'Preuzimam i pokrećem lokalni model...'
                    : 'Izvršavam akciju...'}
                </Text>
              </View>
            ) : localLanguageLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.textMuted} size="small" />
                <Text style={styles.loadingText}>Razumijem...</Text>
              </View>
            ) : onlineLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.textMuted} size="small" />
                <Text style={styles.loadingText}>Pretražujem online katalog...</Text>
              </View>
            ) : loading && !onlineIntent ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator
                  color={colors.textMuted}
                  size="small"
                />
                <Text style={styles.loadingText}>
                  Učitavam katalog...
                </Text>
              </View>
            ) : items.length === 0 ? (
              <Text style={styles.empty}>
                Nema rezultata.
              </Text>
            ) : (
              items.map((item, index) => {
                const selected =
                  selectedIndex === index;

                // paletteRecentVisualV3
                const isRecentSearch =
                  item.itemType === 'command' &&
                  item.command.key.startsWith('recent-search:');

                if (item.itemType === 'command') {
                  return (
                    <Pressable
                      key={'command:' + item.command.key}
                      accessibilityRole="button"
                      onPress={() => {
                        rememberSearch(query);
                        void item.command.action();
                      }}
                      onHoverIn={() =>
                        setSelectedIndex(index)
                      }
                      style={[
                        styles.row,
                        isRecentSearch && styles.recentSearchRow,
                        selected && styles.rowSelected,
                      ]}
                    >
                      <View
                        style={[
                          styles.commandMark,
                          isRecentSearch && styles.recentSearchMark,
                        ]}
                      >
                        <Text
                          style={[
                            styles.commandMarkText,
                            isRecentSearch &&
                              styles.recentSearchMarkText,
                          ]}
                        >
                          {isRecentSearch ? '↺' : '›'}
                        </Text>
                      </View>

                      <View style={styles.copy}>
                        <Text style={styles.title}>
                          {item.command.label}
                        </Text>

                        <Text style={styles.meta}>
                          {item.command.detail}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.kind,
                          isRecentSearch &&
                            styles.recentSearchKind,
                        ]}
                      >
                        {isRecentSearch ? 'NEDAVNO' : item.command.kindLabel ?? 'AKCIJA'}
                      </Text>
                    </Pressable>
                  );
                }

                if (item.itemType === 'online') {
                  return (
                    <Pressable
                      key={'online:' + item.result.key}
                      accessibilityRole="button"
                      onPress={() =>
                        void runOnlineImport(
                          item.result,
                        )
                      }
                      onHoverIn={() =>
                        setSelectedIndex(index)
                      }
                      style={[
                        styles.row,
                        styles.onlineRow,
                        selected && styles.rowSelected,
                      ]}
                    >
                      <View style={styles.onlineMark}>
                        <Text style={styles.onlineMarkText}>
                          +
                        </Text>
                      </View>

                      <View style={styles.copy}>
                        <Text
                          numberOfLines={1}
                          style={styles.title}
                        >
                          {item.result.title}
                        </Text>

                        <Text
                          numberOfLines={1}
                          style={styles.meta}
                        >
                          {item.result.meta}
                        </Text>
                      </View>

                      <Text style={styles.onlineKind}>
                        {item.result.sourceLabel}
                      </Text>
                    </Pressable>
                  );
                }

                return (
                  <Pressable
                    key={item.entity.key}
                    accessibilityRole="button"
                    onPress={() => {
                      if (jingleMode) {
                        void toggleEntityJingle(item.entity).catch((caught) => {
                          setQuickCommandError(
                            caught instanceof Error ? caught.message : 'Jingle nije uspio.',
                          );
                        });
                        return;
                      }

                      openEntity(item.entity);
                    }}
                    onHoverIn={() =>
                      setSelectedIndex(index)
                    }
                    style={[
                      styles.row,
                      selected && styles.rowSelected,
                    ]}
                  >
                    <View style={styles.copy}>
                      <Text
                        numberOfLines={1}
                        style={styles.title}
                      >
                        {item.entity.title}
                      </Text>

                      <Text
                        numberOfLines={1}
                        style={styles.meta}
                      >
                        {item.entity.meta ||
                          item.entity.typeLabel}
                      </Text>
                    </View>

                    {item.entity.favourite ? (
                      <Text style={styles.jingle}>
                        ♫
                      </Text>
                    ) : null}

                    <Text style={styles.kind}>
                      {query.trim()
                        ? item.entity.typeLabel.toLocaleUpperCase()
                        : 'NEDAVNO · ' +
                          item.entity.typeLabel.toLocaleUpperCase()}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {Platform.OS === 'web' ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                ↑ ↓ odabir
              </Text>

              <Text style={styles.footerText}>
                ENTER otvori
              </Text>

              <Text style={styles.footerText}>
                ESC zatvori
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // forkN1CelestialHomeCommandBellV1
  celestialPaletteN1: {
    position: 'relative',
    backgroundColor: celestial.night,
    borderColor: celestialAlpha(celestial.gold, 0.44),
    borderWidth: 1.25,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.52,
    shadowRadius: 38,
    elevation: 14,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: `0 26px 70px ${celestialAlpha(celestial.shadow, 0.58)}, inset 0 1px 0 ${celestialAlpha(celestial.gold, 0.12)}` } as any)
      : {}),
  },
  celestialPaletteStarsN1: {
    ...StyleSheet.absoluteFillObject,
    height: 70,
    overflow: 'hidden',
  },
  celestialPaletteStarN1: {
    position: 'absolute',
    color: celestial.gold,
    opacity: 0.32,
    fontSize: 12,
  },
  celestialPaletteBrandN1: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: celestialAlpha(celestial.gold, 0.16),
  },
  celestialPaletteBrandTextN1: {
    color: celestial.gold,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2.0,
  },
  celestialSearchRowN1: {
    borderBottomColor: celestialAlpha(celestial.gold, 0.22),
    backgroundColor: celestialAlpha(celestial.night, 0.84),
  },

  recentSearchRow: {
    backgroundColor: 'rgba(214,154,32,0.055)',
  
    // forkN1CelestialHomeCommandBellV1_recentSearchRow
    ...(celestialMode ? { backgroundColor: celestialAlpha(celestial.gold, 0.07) } : {}),
  },
  recentSearchMark: {
    backgroundColor: 'rgba(214,154,32,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(214,154,32,0.24)',
  
    // forkN1CelestialHomeCommandBellV1_recentSearchMark
    ...(celestialMode ? { backgroundColor: celestialAlpha(celestial.gold, 0.10), borderColor: celestialAlpha(celestial.gold, 0.26) } : {}),
  },
  recentSearchMarkText: {
    color: '#A46D00',
    fontSize: 15,
  
    // forkN1CelestialHomeCommandBellV1_recentSearchMarkText
    ...(celestialMode ? { color: celestial.gold } : {}),
  },
  recentSearchKind: {
    color: '#A46D00',
  
    // forkN1CelestialHomeCommandBellV1_recentSearchKind
    ...(celestialMode ? { color: celestial.gold } : {}),
  },

  onlineRow: {
    minHeight: 64,
  },

  onlineMark: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.black,
    marginRight: 11,
  
    // forkN1CelestialHomeCommandBellV1_onlineMark
    ...(celestialMode ? { backgroundColor: celestial.gold, borderWidth: 1, borderColor: celestial.goldBright } : {}),
  },

  onlineMarkText: {
    color: colors.white,
    fontSize: 21,
    lineHeight: 24,
    fontWeight: '700',
  
    // forkN1CelestialHomeCommandBellV1_onlineMarkText
    ...(celestialMode ? { color: celestial.onAccent } : {}),
  },

  onlineKind: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.65,
    marginLeft: 10,
  
    // forkN1CelestialHomeCommandBellV1_onlineKind
    ...(celestialMode ? { color: celestial.gold } : {}),
  },

  onlineError: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginHorizontal: 6,
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
  },

  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 18,
    paddingTop:
      Platform.OS === 'web'
        ? 104
        : 92,
    backgroundColor: celestialAlpha(celestial.shadow, 0.34),
  
    // forkN1CelestialHomeCommandBellV1_backdrop
    ...(celestialMode ? { backgroundColor: celestialAlpha(celestial.night, 0.72) } : {}),
  },

  palette: {
    width:
      Platform.OS === 'web'
        ? '100%'
        : '94%',
    maxWidth: 620,
    maxHeight:
      Platform.OS === 'web'
        ? 560
        : '76%',
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },

  searchRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },

  searchIcon: {
    color: colors.textMuted,
    fontSize: 23,
    marginRight: 10,
  
    // forkN1CelestialHomeCommandBellV1_searchIcon
    ...(celestialMode ? { color: celestial.gold } : {}),
  },

  input: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 17,
    paddingVertical: 14,
  
    // forkN1CelestialHomeCommandBellV1_input
    ...(celestialMode ? { color: celestial.ivory } : {}),
  },

  shortcut: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: colors.fill,
  
    // forkN1CelestialHomeCommandBellV1_shortcut
    ...(celestialMode ? { backgroundColor: celestialAlpha(celestial.gold, 0.08), borderWidth: 1, borderColor: celestialAlpha(celestial.gold, 0.18) } : {}),
  },

  shortcutText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
  
    // forkN1CelestialHomeCommandBellV1_shortcutText
    ...(celestialMode ? { color: celestial.gold } : {}),
  },

  results: {
    maxHeight: 465,
    padding: 8,
  
    // forkN1CelestialHomeCommandBellV1_results
    ...(celestialMode ? { backgroundColor: 'transparent' } : {}),
  },

  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 13,
  
    // forkN1CelestialHomeCommandBellV1_row
    ...(celestialMode ? { backgroundColor: celestialAlpha(celestial.night, 0.94), borderColor: celestialAlpha(celestial.gold, 0.20) } : {}),
  },

  rowSelected: {
    backgroundColor: colors.fill,
  
    // forkN1CelestialHomeCommandBellV1_rowSelected
    ...(celestialMode ? { backgroundColor: celestialAlpha(celestial.gold, 0.13), borderWidth: 1, borderColor: celestialAlpha(celestial.gold, 0.30) } : {}),
  },

  commandMark: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.fillStrong,
    marginRight: 10,
  
    // forkN1CelestialHomeCommandBellV1_commandMark
    ...(celestialMode ? { backgroundColor: celestialAlpha(celestial.gold, 0.09), borderWidth: 1, borderColor: celestialAlpha(celestial.gold, 0.22) } : {}),
  },

  commandMarkText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  
    // forkN1CelestialHomeCommandBellV1_commandMarkText
    ...(celestialMode ? { color: celestial.gold } : {}),
  },

  copy: {
    flex: 1,
    minWidth: 0,
  },

  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  
    // forkN1CelestialHomeCommandBellV1_title
    ...(celestialMode ? { color: celestial.ivory } : {}),
  },

  meta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  
    // forkN1CelestialHomeCommandBellV1_meta
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.58) } : {}),
  },

  kind: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginLeft: 10,
  
    // forkN1CelestialHomeCommandBellV1_kind
    ...(celestialMode ? { color: celestial.gold } : {}),
  },

  jingle: {
    color: colors.text,
    fontSize: 14,
    marginLeft: 8,
  
    // forkN1CelestialHomeCommandBellV1_jingle
    ...(celestialMode ? { color: celestial.gold } : {}),
  },

  loadingRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  loadingText: {
    color: colors.textMuted,
    fontSize: 12,
  
    // forkN1CelestialHomeCommandBellV1_loadingText
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.58) } : {}),
  },

  commandError: {
    marginHorizontal: 14,
    marginTop: 10,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    padding: 24,
    textAlign: 'center',
  
    // forkN1CelestialHomeCommandBellV1_empty
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.58) } : {}),
  },

  footer: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  
    // forkN1CelestialHomeCommandBellV1_footer
    ...(celestialMode ? { borderTopColor: celestialAlpha(celestial.gold, 0.18), backgroundColor: celestialAlpha(celestial.night, 0.88) } : {}),
  },

  footerText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  
    // forkN1CelestialHomeCommandBellV1_footerText
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.58) } : {}),
  },
});

// k15ReferentialUpdatesPostSessionV1

// paletteHelpSearchSpeedV2

// paletteDirectUtilitiesV1_1

// aeroSearchQuoteTimerHygieneV3

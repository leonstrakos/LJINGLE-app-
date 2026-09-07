import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  } from 'react-native';
import { useFocusEffect,
  useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AeroAtmosphere } from '../components/AeroAtmosphere';

import { useMemoryAudio } from '../audio/MemoryAudioProvider';
import { MemoryPlayer } from '../components/MemoryPlayer';
import { EntryMarkup } from '../components/EntryMarkup';
import { JingleRadioAttachPanel } from '../components/JingleRadioAttachPanel';
import { FrequencyLinksPanel } from '../components/FrequencyLinksPanel';
import { FrequencyCollectionsPanel } from '../components/FrequencyCollectionsPanel';
import { ClipEditor } from '../components/ClipEditor';
import { entryApi } from '../services/entryApi';
import { memoryRadioApi,
  pickLocalAudio } from '../services/memoryRadioApi';
import { entityLinksApi } from '../services/entityLinksApi';
import {
  getFrequencyCoverMap,
  pickFrequencyCover,
  removeFrequencyCover,
  saveFrequencyCover,
  type PendingFrequencyCover,
} from '../services/frequencyCovers';
// forkBFrequencyCoversV1
// memoryRadioContextModesV1
import {
  loadMemoryRadioContexts,
  type MemoryRadioContext,
  } from '../storage/memoryRadioContext';
import {
  buildMemoryRadioStation,
  memoryRadioModes,
  type MemoryRadioMode,
  setMemoryRadioJingleTrackIds,
} from '../intelligence/memoryRadioModes';

// memoryArchaeologyV1
import {
  loadLostSignal,
  type LostSignal,
} from '../storage/memoryArchaeology';
import { colors } from '../theme/colors';
import { CelestialAtmosphere } from '../components/CelestialAtmosphere';
import { activeVisualSkinId } from '../theme/visualSkins';
import { CelestialMotionLayer } from '../components/CelestialMotionLayer';
import { ReactiveAmbientField } from '../components/ReactiveAmbientField';

// forkN4CelestialArchiveVisualV12
// Classic-only celestial archive skin.
// IMPORTANT: celestial *language* is fixed, but its palette stays driven by
// ThemePicker semantic colors. Pixel + Aero (Meadow/Frutiger) stay untouched.
const n4Celestial = (activeVisualSkinId === 'classic' || activeVisualSkinId === 'classic-ljingle');
const N4_NIGHT = colors.background;
const N4_PANEL = colors.surface;
const N4_PANEL_RAISED = colors.fillStrong;
const N4_BLUE = colors.fill;
const N4_GOLD = colors.navy;
const N4_GOLD_SOFT = colors.goldSoft;
const N4_GOLD_LINE = colors.separator;
const N4_IVORY = colors.text;
const N4_MUTED = colors.textMuted;

import type { Entry } from '../types/entry';
import type { EntityReference } from '../types/collection';
import type { ImportedAudio, MemoryTrack } from '../types/memoryRadio';

// ljingleOnboardingPlayerV1

const n4Dust = [
  ['7%', 34, 2, 0.32], ['18%', 112, 1, 0.22], ['31%', 64, 2, 0.42],
  ['48%', 138, 1, 0.26], ['63%', 48, 2, 0.34], ['78%', 105, 1, 0.25],
  ['91%', 56, 2, 0.38], ['12%', 248, 1, 0.22], ['39%', 292, 2, 0.28],
  ['70%', 236, 1, 0.24], ['86%', 328, 2, 0.30], ['24%', 430, 1, 0.20],
] as const;

function N4CelestialDust() {
  if (!n4Celestial) return null;
  return (
    <View pointerEvents="none" style={styles.n4Dust}>
      {n4Dust.map(([left, top, size, opacity], index) => (
        <View
          key={String(index)}
          style={[
            styles.n4DustPoint,
            { left: left as any, top, width: size, height: size, opacity },
          ]}
        />
      ))}
      <Text style={[styles.n4Star, { left: '10%' as any, top: 78 }]}>✦</Text>
      <Text style={[styles.n4StarSmall, { right: '9%' as any, top: 164 }]}>✧</Text>
      <Text style={[styles.n4StarSmall, { left: '53%' as any, top: 376 }]}>✦</Text>
    </View>
  );
}

function N4CelestialRule() {
  if (!n4Celestial) return null;
  return (
    <View pointerEvents="none" style={styles.n4Rule}>
      <View style={styles.n4RuleLine} />
      <Text style={styles.n4RuleStar}>✦</Text>
      <View style={styles.n4RuleLine} />
    </View>
  );
}

function boldFragments(content: string) {
  const found = content.match(/\*\*[^*]+\*\*/g) ?? [];
  return [...new Set(found.map((item) => item.slice(2, -2).trim()).filter(Boolean))];
}

function entryLabel(entry: Entry) {
  return entry.title?.trim() || entry.content.replace(/[\n*=[\]>-]+/g, ' ').trim().slice(0, 42) || 'Zapis';
}

function blurWebFrequencyEditor() {
  if (
    Platform.OS !== 'web' ||
    typeof document === 'undefined'
  ) {
    return;
  }

  const active =
    document.activeElement;

  if (
    active &&
    active instanceof HTMLElement
  ) {
    active.blur();
  }
}

// frequencyEditorUiFixV1
export function MemoryRadioScreen() {
  const audio = useMemoryAudio();
  const route = useRoute();
  const requestedTrackId = (
    route.params as
      | { trackId?: string }
      | undefined
  )?.trackId;
  const radioScrollRef = useRef<ScrollView>(null);
  const frequencyRowY =
    useRef<Record<string, number>>({});
  const [memories, setMemories] = useState<MemoryTrack[]>([]);
  const [mode, setMode] = useState<MemoryRadioMode>('MEMORY');

  // memoryArchaeologyV1
  const [lostSignal, setLostSignal] =
    useState<LostSignal | null>(null);

  const [
    lostSignalLoading,
    setLostSignalLoading,
  ] = useState(false);
  const [memoryContexts, setMemoryContexts] =
    useState<Map<string, MemoryRadioContext>>(new Map());
  const [
    jingleReferences,
    setJingleReferences,
  ] = useState<EntityReference[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  // ljingleRadioEntrySearchPickerR2
  const [entrySearchQuery, setEntrySearchQuery] =
    useState('');
  const [anchorText, setAnchorText] = useState<string | null>(null);
  const [picked, setPicked] = useState<ImportedAudio | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // memoryRadioUnlinkDeleteV3
  const [busyTrackId, setBusyTrackId] = useState<string | null>(null);
  const [confirmDeleteTrackId, setConfirmDeleteTrackId] = useState<string | null>(null);

  // memoryFrequencyEditV2
  const [editingTrackId, setEditingTrackId] =
    useState<string | null>(null);

  const [editTrackTitle, setEditTrackTitle] =
    useState('');

  const [editTrackArtist, setEditTrackArtist] =
    useState('');

  const [savingTrackMetadata, setSavingTrackMetadata] =
    useState(false);

  const [frequencyCovers, setFrequencyCovers] =
    useState<Record<string, string>>({});
  const [editPendingCover, setEditPendingCover] =
    useState<PendingFrequencyCover | null>(null);
  const [editRemoveCover, setEditRemoveCover] =
    useState(false);

  const [frequenciesOpen, setFrequenciesOpen] =
    useState(false);

  const [error, setError] = useState<string | null>(null);
  const bass = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        nextMemories,
        nextEntries,
        nextContexts,
        nextJingleReferences,
      ] = await Promise.all([
        memoryRadioApi.getAll(),
        entryApi.getAll(),
        loadMemoryRadioContexts(),
        entityLinksApi.jingleReferences(),
      ]);

      setMemories(nextMemories);
      setFrequencyCovers(
        await getFrequencyCoverMap(
          nextMemories.map((memory) => memory.trackId),
        ),
      );
      setEntries(nextEntries);
      setMemoryContexts(nextContexts);
      setJingleReferences(
        nextJingleReferences,
      );
      // radioStandaloneAddR1
      // Zapis is optional. Never silently attach a new song to the first note.
      setSelectedEntryId((current) =>
        current &&
        nextEntries.some(
          (entry) =>
            entry.entryId === current,
        )
          ? current
          : null,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Memory Radio se nije učitao.');
    } finally {
      setLoading(false);
    }
  }, []);

  // memoryArchaeologyV1
  const refreshLostSignal =
    useCallback(async () => {
      if (lostSignalLoading) {
        return;
      }

      setLostSignalLoading(true);

      try {
        setLostSignal(
          await loadLostSignal(),
        );
      } catch (caught) {
        console.warn(
          'Lost Signal archaeology unavailable',
          caught,
        );

        setLostSignal(null);
      } finally {
        setLostSignalLoading(false);
      }
    }, [lostSignalLoading]);

  useEffect(() => {
    void refreshLostSignal();
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const selectedEntry = entries.find((entry) => entry.entryId === selectedEntryId) ?? null;

  const entrySearchResults = useMemo(() => {
    const normalizeEntrySearch = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const query =
      normalizeEntrySearch(entrySearchQuery);

    const terms =
      query.split(/\s+/).filter(Boolean);

    const selectedFirst =
      selectedEntryId
        ? [
            ...entries.filter(
              (entry) =>
                entry.entryId === selectedEntryId,
            ),
            ...entries.filter(
              (entry) =>
                entry.entryId !== selectedEntryId,
            ),
          ]
        : entries;

    if (terms.length === 0) {
      return selectedFirst.slice(0, 12);
    }

    return selectedFirst
      .filter((entry) => {
        const haystack =
          normalizeEntrySearch(
            [
              entry.title,
              entry.content,
            ]
              .filter(Boolean)
              .join(' '),
          );

        return terms.every((term) =>
          haystack.includes(term),
        );
      })
      .slice(0, 24);
  }, [
    entries,
    entrySearchQuery,
    selectedEntryId,
  ]);
  const anchors = useMemo(
    () => selectedEntry ? boldFragments(selectedEntry.content) : [],
    [selectedEntry],
  );
  // jingleRadioDirectGraphV1
  const directJingleTrackIds = new Set(
    jingleReferences
      .filter(
        (item) =>
          item.entityType === 'FREQUENCY',
      )
      .map((item) => item.entityId),
  );

  setMemoryRadioJingleTrackIds(
    directJingleTrackIds,
  );

  const baseStation =
    buildMemoryRadioStation({
      mode,
      memories,
      contexts: memoryContexts,
      currentTrackId:
        audio.current?.trackId ?? null,
    });

  const station = useMemo(() => {
    if (
      mode !== 'LOST_SIGNAL'
    ) {
      return baseStation;
    }

    const allowed =
      new Set(
        lostSignal?.nearbyTrackIds ??
        [],
      );

    const pool =
      memories.filter(
        (memory) =>
          allowed.has(
            memory.trackId,
          ),
      );

    return {
      ...baseStation,

      pool,

      count:
        pool.length,

      contextLabel:
        lostSignal
          ? lostSignal.item.dormantDays +
            ' dana bez signala'
          : null,

      emptyText:
        lostSignal
          ? 'Arheološki signal je pronađen, ali uz taj period nema spremljene audio frekvencije.'
          : 'Još nema dovoljno stare aktivnosti za Lost Signal.',
    };
  }, [
    baseStation,
    lostSignal,
    memories,
    mode,
  ]);

  // archaeologyTypeFixV1
  const lostSignalTrack =
    station.pool[0] ?? null;

  const stationTrackIds = useMemo(
    () =>
      new Set(
        station.pool.map(
          (memory) => memory.trackId
        ),
      ),
    [station.pool],
  );

  // memoryRadioOnePlayerV1
  // One physical/global player; tabs only filter what can be tuned next.
  const currentBelongsToSelectedStation =
    Boolean(
      audio.current &&
        stationTrackIds.has(
          audio.current.trackId,
        ),
    );

  const featured =
    audio.current ??
    station.pool.find(
      (memory) =>
        memory.linkId !== null,
    ) ??
    lostSignalTrack ??
    null;

  const featuredIsFromAnotherStation =
    Boolean(
      audio.current &&
        !currentBelongsToSelectedStation,
    );

  const bassActive = Boolean(
    featured &&
    audio.current?.trackId === featured.trackId &&
    audio.playing,
  );

  useEffect(() => {
    if (!bassActive) {
      bass.stopAnimation();
      Animated.spring(bass, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start();
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bass, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(bass, { toValue: 0.18, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(bass, { toValue: 0.62, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(bass, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bass, bassActive]);

  const chooseFile = async () => {
    setError(null);
    try {
      const next = await pickLocalAudio();
      if (!next) return;
      setPicked(next);
      setTitle(next.title);
      setArtist(next.artist);
      setClipStart(0);
      setClipEnd(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Audio se nije mogao otvoriti.');
    }
  };

  const save = async () => {
    if (!picked || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (selectedEntryId) {
        await memoryRadioApi.attach({
          ...picked,
          title: title.trim() || picked.title,
          artist: artist.trim(),
          entryId: selectedEntryId,
          anchorText,
          clipStartSeconds: clipStart,
          clipEndSeconds: clipEnd,
        });
      } else {
        // Standalone frequency: audio_tracks only, no fake/forced Zapis.
        await memoryRadioApi.createStandalone({
          ...picked,
          title:
            title.trim() ||
            picked.title,
          artist:
            artist.trim(),
        });
      }
      setPicked(null);
      setTitle('');
      setArtist('');
      setAnchorText(null);
      setClipStart(0);
      setClipEnd(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pjesma se nije spremila.');
    } finally {
      setSaving(false);
    }
  };

  const unlinkMemory = async (memory: MemoryTrack) => {
    if (!memory.linkId || busyTrackId) return;
    setBusyTrackId(memory.trackId);
    setConfirmDeleteTrackId(null);
    setError(null);
    try {
      if (audio.current?.trackId === memory.trackId) audio.clear();
      await memoryRadioApi.unlink(memory.linkId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Veza se nije mogla ukloniti.');
    } finally {
      setBusyTrackId(null);
    }
  };

  const relinkMemory = async (memory: MemoryTrack) => {
    if (!selectedEntryId || busyTrackId) {
      if (!selectedEntryId) setError('Odaberi Zapis prije povezivanja frekvencije.');
      return;
    }
    setBusyTrackId(memory.trackId);
    setConfirmDeleteTrackId(null);
    setError(null);
    try {
      await memoryRadioApi.linkExisting({
        trackId: memory.trackId,
        entryId: selectedEntryId,
        anchorText,
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Frekvencija se nije mogla povezati.');
    } finally {
      setBusyTrackId(null);
    }
  };

  // memoryFrequencyEditV2
  const beginEditFrequency = (
    memory: MemoryTrack,
  ) => {
    setConfirmDeleteTrackId(null);

    setEditingTrackId(
      memory.trackId
    );

    setEditTrackTitle(
      memory.trackTitle
    );

    setEditTrackArtist(
      memory.artist ?? ''
    );

    setEditPendingCover(null);
    setEditRemoveCover(false);
  };

  const cancelEditFrequency = () => {
    if (savingTrackMetadata) {
      return;
    }

    blurWebFrequencyEditor();

    setEditingTrackId(null);
    setEditTrackTitle('');
    setEditTrackArtist('');
    setEditPendingCover(null);
    setEditRemoveCover(false);
  };

  const chooseFrequencyCover = async () => {
    if (savingTrackMetadata) return;

    setError(null);

    try {
      const next = await pickFrequencyCover();
      if (!next) return;

      setEditPendingCover(next);
      setEditRemoveCover(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Cover se nije mogao odabrati.',
      );
    }
  };

  const saveFrequencyMetadata =
    async (
      memory: MemoryTrack,
    ) => {
      if (savingTrackMetadata) {
        return;
      }

      const nextTitle =
        editTrackTitle.trim();

      const nextArtist =
        editTrackArtist.trim();

      if (!nextTitle) {
        setError(
          'Naziv frekvencije ne može biti prazan.',
        );

        return;
      }

      setSavingTrackMetadata(true);
      setError(null);

      try {
        await memoryRadioApi.updateTrackMetadata({
          trackId:
            memory.trackId,
          title:
            nextTitle,
          artist:
            nextArtist || null,
        });

        if (editRemoveCover) {
          await removeFrequencyCover(
            memory.trackId,
          );
        } else if (editPendingCover) {
          await saveFrequencyCover(
            memory.trackId,
            editPendingCover,
          );
        }

        audio.updateMetadata(
          memory.trackId,
          nextTitle,
          nextArtist || null,
        );

        setMemories((current) =>
          current.map((item) =>
            item.trackId === memory.trackId
              ? {
                  ...item,
                  trackTitle: nextTitle,
                  artist:
                    nextArtist || null,
                }
              : item
          )
        );

        blurWebFrequencyEditor();

        setEditingTrackId(null);
        setEditTrackTitle('');
        setEditTrackArtist('');
        setEditPendingCover(null);
        setEditRemoveCover(false);

        await load();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Frekvencija se nije mogla urediti.',
        );
      } finally {
        setSavingTrackMetadata(false);
      }
    };

  const deleteFrequency = async (memory: MemoryTrack) => {
    if (busyTrackId) return;
    if (confirmDeleteTrackId !== memory.trackId) {
      setConfirmDeleteTrackId(memory.trackId);
      return;
    }

    setBusyTrackId(memory.trackId);
    setConfirmDeleteTrackId(null);
    setError(null);
    try {
      if (audio.current?.trackId === memory.trackId) audio.clear();
      await memoryRadioApi.deleteTrack(memory.trackId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Frekvencija se nije mogla obrisati.');
    } finally {
      setBusyTrackId(null);
    }
  };



  const shuffle = () => {
    if (station.pool.length === 0) return;

    const choices =
      station.pool.filter(
        (memory) =>
          memory.trackId !==
          audio.current?.trackId,
      );

    const pool =
      choices.length > 0
        ? choices
        : station.pool;

    const next =
      pool[
        Math.floor(
          Math.random() *
            pool.length
        )
      ];

    if (next) {
      audio.play(next, station.pool);
    }
  };

  if (loading && memories.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <AeroAtmosphere variant="radio" />
        <View style={styles.center}><ActivityIndicator color={colors.navy} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      {/* ljingleSemanticAliveR1:radio */}
      <ReactiveAmbientField mode="radio" active={Boolean(audio.current && audio.playing)} />
      <AeroAtmosphere variant="radio" />
      <N4CelestialDust />
        <ScrollView ref={radioScrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {/* ljingleCelestialMotionLanguageR1:radio */}
          <CelestialMotionLayer preset="radio" active={Boolean(audio.current && audio.playing)} />
          <CelestialAtmosphere variant="radio" />
          {n4Celestial ? <Text style={styles.n4HeroConstellation}>✦ · ✧ · ✦</Text> : null}
          <Text style={styles.kicker}>LJINGLE 2001. FM</Text>
          <Text style={styles.heading}>Memory Radio</Text>
          <Text style={styles.intro}>Misli koje si spremio vraćaju se sa zvukom koji im pripada.</Text>
          <N4CelestialRule />
        </View>

        {/* memoryRadioContextModesV1 */}
        <View style={styles.stationPanel}>
          {n4Celestial ? <Text style={styles.n4CornerSigil}>✧</Text> : null}
          <Text style={styles.stationEyebrow}>
            TUNE THE ARCHIVE
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stationChips}
          >
            {memoryRadioModes.map((candidate) => {
              const active =
                candidate.id === mode;

              return (
                <Pressable
                  key={candidate.id}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: active,
                  }}
                  onPress={() =>
                    setMode(candidate.id)
                  }
                  style={({ pressed }) => [
                    styles.stationChip,
                    active &&
                      styles.stationChipActive,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.stationChipText,
                      active &&
                        styles.stationChipTextActive,
                    ]}
                  >
                    {candidate.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.stationInfo}>
            <View style={styles.stationInfoCopy}>
              <Text style={styles.stationDescription}>
                {station.description}
              </Text>

              {station.contextLabel ? (
                <Text style={styles.stationContext}>
                  {station.contextLabel}
                </Text>
              ) : null}
            </View>

            <View style={styles.stationCount}>
              <Text style={styles.stationCountValue}>
                {station.count}
              </Text>
              <Text style={styles.stationCountLabel}>
                SIGNAL
              </Text>
            </View>
          </View>
        </View>

        {mode === 'LOST_SIGNAL' ? (
          <View style={styles.archaeologyCard}>
            <Text style={styles.archaeologyKicker}>
              LOST SIGNAL / ARCHAEOLOGY
            </Text>

            {lostSignalLoading &&
            !lostSignal ? (
              <View style={styles.archaeologyLoading}>
                <ActivityIndicator
                  color={colors.navy}
                />
                <Text style={styles.archaeologyMuted}>
                  Kopam po starim slojevima…
                </Text>
              </View>
            ) : lostSignal ? (
              <>
                <Text style={styles.archaeologyAge}>
                  PRONAENO NAKON{' '}
                  {lostSignal.item.dormantDays}{' '}
                  DANA
                </Text>

                <Text style={styles.archaeologyTitle}>
                  {lostSignal.item.title}
                </Text>

                <Text style={styles.archaeologyMeta}>
                  {lostSignal.item.kind}
                  {' · '}
                  signal{' '}
                  {lostSignal.item.forgottenScore}
                  /100
                </Text>

                {lostSignal.item.reasons
                  .slice(0, 2)
                  .map((reason, index) => (
                    <Text
                      key={
                        reason +
                        String(index)
                      }
                      style={styles.archaeologyReason}
                    >
                      {reason}
                    </Text>
                  ))}

                {lostSignal.jingleReason ? (
                  <View style={styles.archaeologyMeaning}>
                    <Text style={styles.archaeologyMeaningLabel}>
                      ZATO JE ZNAILO
                    </Text>

                    <Text style={styles.archaeologyMeaningText}>
                      “{lostSignal.jingleReason}”
                    </Text>
                  </View>
                ) : null}

                {(lostSignal.nearbyTitles.length >
                  0 ||
                  lostSignal.reconstructionLines.length >
                    0) ? (
                  <View style={styles.archaeologyAround}>
                    <Text style={styles.archaeologyAroundLabel}>
                      AROUND THAT TIME
                    </Text>

                    {lostSignal.nearbyTitles
                      .slice(0, 4)
                      .map((title) => (
                        <Text
                          key={title}
                          style={styles.archaeologyAroundItem}
                        >
                          · {title}
                        </Text>
                      ))}

                    {lostSignal.reconstructionLines
                      .slice(0, 3)
                      .map((line) => (
                        <Text
                          key={line}
                          style={styles.archaeologyContext}
                        >
                          {line}
                        </Text>
                      ))}
                  </View>
                ) : null}

                <View style={styles.archaeologyActions}>
                  {lostSignalTrack ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        audio.play(
                          lostSignalTrack,
                          station.pool,
                        )
                      }
                      style={({ pressed }) => [
                        styles.archaeologyTune,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      <Text style={styles.archaeologyTuneText}>
                        TUNE IN
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    disabled={
                      lostSignalLoading
                    }
                    onPress={() =>
                      void refreshLostSignal()
                    }
                    style={({ pressed }) => [
                      styles.archaeologyNext,
                      pressed &&
                        styles.pressed,
                      lostSignalLoading &&
                        styles.disabled,
                    ]}
                  >
                    <Text style={styles.archaeologyNextText}>
                      {lostSignalLoading
                        ? 'TRAIM…'
                        : 'DRUGI SIGNAL'}
                    </Text>
                  </Pressable>
                </View>

                {lostSignal.nearbyTrackIds.length >
                0 ? (
                  <Text style={styles.archaeologyAudioMeta}>
                    {
                      lostSignal.nearbyTrackIds
                        .length
                    } audio frekvencija pronađeno u tom sloju.
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.archaeologyTitle}>
                  Još nema izgubljenog signala
                </Text>

                <Text style={styles.archaeologyMuted}>
                  Lost Signal traži stvari koje nisu aktivne najmanje 60 dana i za koje postoji dokaz da su nekad stvarno zauzimale vrijeme ili značenje.
                </Text>

                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    void refreshLostSignal()
                  }
                  style={({ pressed }) => [
                    styles.archaeologyNext,
                    styles.archaeologySoloButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Text style={styles.archaeologyNextText}>
                    POKUAJ PONOVNO
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}

        <View style={styles.broadcast}>
          {n4Celestial ? <Text style={styles.n4BroadcastSigil}>✦</Text> : null}
          <Animated.View
            style={[
              styles.broadcastGlow,
              {
                opacity: bass.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.22] }),
                transform: [{ scale: bass.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) }],
              },
            ]}
          />
          <Text style={styles.broadcastLabel}>
            {featured
              ? featuredIsFromAnotherStation
                ? 'NOW PLAYING'
                : station.eyebrow
              : 'RADIO IS QUIET'}
          </Text>
          {featured ? (
            <>
              <Text style={styles.memoryTitle}>{featured.entryTitle || featured.trackTitle}</Text>
              {/* memoryRadioEntryMarkupV1 */}
              {featured.linkId &&
              !featured.anchorText &&
              featured.entryContent ? (
                <View style={styles.memoryMarkupWrap}>
                  <EntryMarkup
                    content={featured.entryContent}
                    numberOfLines={4}
                  />
                </View>
              ) : (
                <Text numberOfLines={4} style={styles.memoryText}>
                  {featuredIsFromAnotherStation
                ? 'Ovo je frekvencija koja trenutno svira. Memory Radio ima jedan player kroz sve kanale.'
                : featured.linkId
                  ? (featured.anchorText
                      ? `“${featured.anchorText}”`
                      : featured.entryContent)
                  : mode === 'JINGLE' &&
                    directJingleTrackIds.has(
                      featured.trackId,
                    )
                  ? 'Jingle frekvencija — povezana je s Jingle stavkom.'
                  : 'Nepovezana frekvencija — audio je sačuvan, ali nije vezan uz Zapis.'}
                </Text>
              )}
              <View style={styles.playerGap}>
                <MemoryPlayer
                  memory={featured}
                  queue={
                    featuredIsFromAnotherStation
                      ? memories
                      : station.pool
                  }
                />
              </View>
              <Pressable onPress={shuffle} style={({ pressed }) => [styles.shuffle, pressed && styles.pressed]}>
                <Text style={styles.shuffleText}>Pronađi drugo sjećanje</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.emptyBroadcast}>
              {memories.length === 0
                ? 'Dodaj prvu pjesmu i radio će se probuditi.'
                : station.emptyText}
            </Text>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {mode === 'JINGLE'
              ? 'Dodaj zvuk Jingleu'
              : 'Dodaj zvuk sjećanju'}
          </Text>
          <Text style={styles.sectionCopy}>
            {mode === 'JINGLE'
              ? 'Odaberi Jingle stvar i poveži joj lokalni zvuk.'
              : 'Audio ostaje lokalno na ovom uređaju.'}
          </Text>
        </View>

        {mode === 'JINGLE' ? (
          <JingleRadioAttachPanel
            items={jingleReferences}
            onSaved={load}
          />
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>Zapis · neobavezno</Text>

            <View style={styles.entrySearchWrap}>
              <TextInput
                accessibilityLabel="Pretraži zapise za Radio"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setEntrySearchQuery}
                placeholder="Pretraži naslov ili tekst Zapisa…"
                placeholderTextColor={colors.textMuted}
                style={styles.entrySearchInput}
                value={entrySearchQuery}
              />

              {entrySearchQuery ? (
                <Pressable
                  accessibilityLabel="Očisti pretragu Zapisa"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setEntrySearchQuery('')}
                  style={({ pressed }) => [
                    styles.entrySearchClear,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.entrySearchClearText}>
                    ×
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.entrySearchMeta}>
              {entrySearchQuery.trim()
                ? `${entrySearchResults.length}${
                    entrySearchResults.length === 24 ? '+' : ''
                  } rezultata`
                : entries.length === 0
                  ? 'Nema Zapisa · pjesmu možeš spremiti samostalno'
                  : `Nedavni Zapisi · ${entries.length} ukupno`}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSelectedEntryId(null);
                  setAnchorText(null);
                }}
                style={[
                  styles.chip,
                  selectedEntryId === null &&
                    styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedEntryId === null &&
                      styles.chipTextActive,
                  ]}
                >
                  Bez Zapisa
                </Text>
              </Pressable>
              {entrySearchResults.map((entry) => (
                <Pressable
                  key={entry.entryId}
                  onPress={() => { setSelectedEntryId(entry.entryId); setAnchorText(null); }}
                  style={[styles.chip, selectedEntryId === entry.entryId && styles.chipActive]}
                >
                  <Text numberOfLines={1} style={[styles.chipText, selectedEntryId === entry.entryId && styles.chipTextActive]}>
                    {entryLabel(entry)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {selectedEntryId ? (
              <>
              <Text style={styles.label}>Veza</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Pressable onPress={() => setAnchorText(null)} style={[styles.chip, anchorText === null && styles.chipActive]}>
                  <Text style={[styles.chipText, anchorText === null && styles.chipTextActive]}>Cijeli zapis</Text>
                </Pressable>
                {anchors.map((anchor) => (
                  <Pressable key={anchor} onPress={() => setAnchorText(anchor)} style={[styles.chip, anchorText === anchor && styles.chipActive]}>
                    <Text numberOfLines={1} style={[styles.chipText, anchorText === anchor && styles.chipTextActive]}>{anchor}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              </>
            ) : null}

            <Pressable onPress={() => void chooseFile()} style={({ pressed }) => [styles.fileButton, pressed && styles.pressed]}>
              <Text style={styles.fileButtonTitle}>{picked ? picked.originalName : 'Odaberi audio datoteku'}</Text>
              <Text style={styles.fileButtonCopy}>{picked ? 'Datoteka je spremna za Memory Radio.' : 'MP3, M4A, WAV ili drugi format koji uređaj podržava'}</Text>
            </Pressable>

            {picked ? (
              <>
                <Text style={styles.label}>Naslov pjesme</Text>
                <TextInput value={title} onChangeText={setTitle} placeholder="Naslov" placeholderTextColor={colors.textMuted} style={styles.input} />
                <Text style={styles.label}>Izvođač</Text>
                <TextInput value={artist} onChangeText={setArtist} placeholder="Neobavezno" placeholderTextColor={colors.textMuted} style={styles.input} />
                {selectedEntryId ? (
                  <ClipEditor
                    uri={picked.fileUri}
                    start={clipStart}
                    end={clipEnd}
                    onChange={(start, end) => { setClipStart(start); setClipEnd(end); }}
                  />
                ) : (
                  <Text style={styles.sectionCopy}>
                    Bez Zapisa sprema se cijela pjesma. Zapis možeš povezati kasnije.
                  </Text>
                )}
                <Pressable disabled={saving} onPress={() => void save()} style={({ pressed }) => [styles.save, pressed && styles.pressed, saving && styles.disabled]}>
                  <Text style={styles.saveText}>{saving
                    ? 'Spremanje...'
                    : selectedEntryId
                      ? 'Spremi i poveži'
                      : 'Spremi u Memory Radio'}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {memories.length > 0 ? (
          <View style={styles.library}>
            <N4CelestialRule />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Otvori ili zatvori frekvenciju"
              accessibilityState={{ expanded: frequenciesOpen }}
              onPress={() => setFrequenciesOpen((current) => !current)}
              style={({ pressed }) => [styles.frequencyLibraryHeader, pressed && styles.pressed]}
            >
              <View>
                <Text style={styles.sectionTitle}>Frekvencije</Text>
                <Text style={styles.sectionCopy}>{memories.length} spremljenih frekvencija</Text>
              </View>
              <Text style={styles.frequencyLibraryChevron}>
                {frequenciesOpen ? '−' : '+'}
              </Text>
            </Pressable>
            {frequenciesOpen ? (
              <View style={styles.frequencyLibraryItems}>
                <Text style={styles.sectionCopy}>Odveži zadržava audio. Obriši uklanja frekvenciju i njezinu lokalnu kopiju.</Text>
            {memories.map((memory) => {
              const busy = busyTrackId === memory.trackId;
              const confirming = confirmDeleteTrackId === memory.trackId;
              const coverUri =
                frequencyCovers[memory.trackId] ?? null;
              const editorCoverUri =
                editingTrackId === memory.trackId
                  ? editPendingCover?.sourceUri ??
                    (editRemoveCover ? null : coverUri)
                  : coverUri;
              return (
                <View
                    key={memory.trackId}
                    onLayout={(event) => {
                      const y =
                        event.nativeEvent.layout.y;

                      frequencyRowY.current[
                        memory.trackId
                      ] = y;

                      if (
                        requestedTrackId ===
                        memory.trackId
                      ) {
                        setTimeout(() => {
                          radioScrollRef.current?.scrollTo({
                            y: Math.max(0, y - 24),
                            animated: false,
                          });
                        }, 0);
                      }
                    }}
                    style={[
                      styles.memoryRow,
                      requestedTrackId === memory.trackId &&
                        styles.memoryRowFocused,
                    ]}
                  >
                  <View style={styles.frequencyHeader}>
                  <Pressable
                    disabled={busy}
                    onPress={() => audio.play(memory, memories)}
                    style={({ pressed }) => [styles.memoryRowCopy, pressed && styles.pressed]}
                  >
                    <Text
                        numberOfLines={1}
                        style={styles.rowTitle}
                      >
                        {memory.trackTitle}
                      </Text>

                      {memory.artist ? (
                        <Text
                          numberOfLines={1}
                          style={styles.rowArtist}
                        >
                          {memory.artist}
                        </Text>
                      ) : null}
                    <Text numberOfLines={1} style={styles.rowCopy}>
                      {memory.linkId
                        ? `${memory.entryTitle || 'Bez naslova'}${memory.anchorText ? ` · ${memory.anchorText}` : ''}`
                        : 'Nije povezano sa zapisom'}
                    </Text>
                  </Pressable>

                  {coverUri ? (
                    <Image
                      accessibilityLabel="Frequency cover"
                      source={{ uri: coverUri }}
                      style={styles.frequencyCover}
                    />
                  ) : null}

                </View>
                {/* portableFrequencyVisualPolishV1 */}

                  {editingTrackId === memory.trackId ? (
                    <View style={styles.frequencyEditor}>
                      <Text style={styles.frequencyEditLabel}>
                        NAZIV FREKVENCIJE
                      </Text>

                      <TextInput
                        value={editTrackTitle}
                        onChangeText={setEditTrackTitle}
                        placeholder="Naziv"
                        placeholderTextColor={colors.textMuted}
                        style={styles.frequencyEditInput}
                      />

                      <Text style={styles.frequencyEditLabel}>
                        AUTOR / IZVOA
                      </Text>

                      <TextInput
                        value={editTrackArtist}
                        onChangeText={setEditTrackArtist}
                        placeholder="Neobavezno"
                        placeholderTextColor={colors.textMuted}
                        style={styles.frequencyEditInput}
                      />

                      <Text style={styles.frequencyEditLabel}>
                        COVER
                      </Text>

                      <View style={styles.frequencyCoverEditor}>
                        {editorCoverUri ? (
                          <Image
                            source={{ uri: editorCoverUri }}
                            style={styles.frequencyCoverPreview}
                          />
                        ) : (
                          <View style={styles.frequencyCoverEmpty}>
                            <Text style={styles.frequencyCoverEmptyMark}>♫</Text>
                          </View>
                        )}

                        <View style={styles.frequencyCoverActions}>
                          <Pressable
                            disabled={savingTrackMetadata}
                            onPress={() => void chooseFrequencyCover()}
                            style={({ pressed }) => [
                              styles.frequencyCoverButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text style={styles.frequencyCoverButtonText}>
                              {editorCoverUri ? 'PROMIJENI COVER' : 'DODAJ COVER'}
                            </Text>
                          </Pressable>

                          {editorCoverUri ? (
                            <Pressable
                              disabled={savingTrackMetadata}
                              onPress={() => {
                                setEditPendingCover(null);
                                setEditRemoveCover(true);
                              }}
                              style={({ pressed }) => [
                                styles.frequencyCoverRemove,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Text style={styles.frequencyCoverRemoveText}>UKLONI</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.frequencyEditActions}>
                        <Pressable
                          disabled={savingTrackMetadata}
                          onPress={() =>
                            void saveFrequencyMetadata(
                              memory
                            )
                          }
                          style={({ pressed }) => [
                            styles.frequencyEditSave,
                            pressed && styles.pressed,
                            savingTrackMetadata &&
                              styles.disabled,
                          ]}
                        >
                          <Text style={styles.frequencyEditSaveText}>
                            {savingTrackMetadata
                              ? 'SPREMAM…'
                              : 'SPREMI'}
                          </Text>
                        </Pressable>

                        <Pressable
                          disabled={savingTrackMetadata}
                          onPress={cancelEditFrequency}
                          style={({ pressed }) => [
                            styles.frequencyEditCancel,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.frequencyEditCancelText}>
                            ODUSTANI
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  {editingTrackId !== memory.trackId ? (
                    <View style={styles.rowActions}>
                                          <Pressable disabled={busy} onPress={() => audio.play(memory, memories)} style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}>
                      <Text style={styles.rowPlay}>PLAY</Text>
                    </Pressable>

                    <Pressable
                      disabled={
                        busy ||
                        savingTrackMetadata
                      }
                      onPress={() =>
                        beginEditFrequency(memory)
                      }
                      style={({ pressed }) => [
                        styles.rowAction,
                        editingTrackId ===
                          memory.trackId &&
                          styles.rowActionActive,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      <Text style={styles.rowActionText}>
                        UREDI
                      </Text>
                    </Pressable>
                    {memory.linkId ? (
                      <Pressable disabled={busy} onPress={() => void unlinkMemory(memory)} style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}>
                        <Text style={styles.rowActionText}>{busy ? '...' : 'ODVEŽI'}</Text>
                      </Pressable>
                    ) : (
                      <Pressable disabled={busy} onPress={() => void relinkMemory(memory)} style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}>
                        <Text style={styles.rowActionText}>{busy ? '...' : 'POVEŽI'}</Text>
                      </Pressable>
                    )}
                    <Pressable
                      disabled={busy}
                      onPress={() => void deleteFrequency(memory)}
                      style={({ pressed }) => [styles.rowAction, styles.rowDeleteAction, pressed && styles.pressed]}
                    >
                      <Text style={styles.rowDeleteText}>{confirming ? 'POTVRDI' : 'OBRIŠI'}</Text>
                    </Pressable>
                  </View>
                  ) : null}

                  <FrequencyLinksPanel
                    frequency={memory}
                  />
                </View>
              );
            })}
              </View>
            ) : null}
          </View>
        ) : null}
              <FrequencyCollectionsPanel
          memories={memories}
          onPlay={(memory, queue) =>
            audio.play(memory, queue)
          }
        />

</ScrollView>

      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // forkN4CelestialArchiveVisualV12
  n4Dust: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  n4DustPoint: { position: 'absolute', borderRadius: 99, backgroundColor: N4_GOLD },
  n4Star: { position: 'absolute', color: N4_GOLD, fontSize: 16, opacity: 0.72 },
  n4StarSmall: { position: 'absolute', color: N4_GOLD, fontSize: 10, opacity: 0.52 },
  n4Rule: { marginTop: 17, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: 0.72 },
  n4RuleLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: N4_GOLD_LINE },
  n4RuleStar: { color: N4_GOLD, fontSize: 11 },
  n4HeroConstellation: { color: N4_GOLD, fontSize: 11, letterSpacing: 5, opacity: 0.72 },
  n4CornerSigil: { position: 'absolute', right: 16, top: 12, color: N4_GOLD, fontSize: 14, opacity: 0.64 },
  n4BroadcastSigil: { position: 'absolute', right: 22, top: 18, color: N4_GOLD, fontSize: 28, opacity: 0.46 },

  memoryMarkupWrap: {
    marginTop: 10,
    maxWidth: 620,
  },


  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 860, alignSelf: 'center', padding: 22, paddingBottom: 70 },
  hero: { paddingVertical: 20 },
  kicker: { color: n4Celestial ? N4_GOLD : colors.navy, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  heading: { marginTop: 7, color: n4Celestial ? N4_IVORY : colors.text, fontSize: 43, fontWeight: n4Celestial ? '700' : '900', fontFamily: n4Celestial ? 'serif' : undefined, letterSpacing: n4Celestial ? 0.6 : -1.6 },
  intro: { marginTop: 10, maxWidth: 570, color: n4Celestial ? N4_MUTED : colors.textMuted, fontSize: 16, lineHeight: 24 },
  broadcast: { overflow: 'hidden', borderWidth: 1, borderColor: n4Celestial ? N4_GOLD_LINE : colors.border, borderRadius: 32, backgroundColor: n4Celestial ? N4_PANEL : colors.surface, padding: 25 },
  broadcastGlow: { position: 'absolute', top: -90, right: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: colors.navy },
  broadcastLabel: { color: n4Celestial ? N4_GOLD : colors.navy, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  memoryTitle: { marginTop: 20, color: n4Celestial ? N4_IVORY : colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.7 },
  memoryText: { marginTop: 10, color: n4Celestial ? N4_IVORY : colors.text, fontSize: 18, lineHeight: 27 },
  emptyBroadcast: { marginTop: 18, maxWidth: 440, color: n4Celestial ? N4_MUTED : colors.textMuted, fontSize: 17, lineHeight: 25 },
  playerGap: { marginTop: 23 },
  shuffle: { marginTop: 15, alignSelf: 'flex-start', borderRadius: 999, backgroundColor: n4Celestial ? N4_GOLD : colors.navy, paddingHorizontal: 17, paddingVertical: 11 },
  shuffleText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  sectionHeader: { marginTop: 34, marginBottom: 13 },
  sectionTitle: { color: n4Celestial ? N4_IVORY : colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  sectionCopy: { marginTop: 4, color: n4Celestial ? N4_MUTED : colors.textMuted, fontSize: 12 },
  card: { borderWidth: 1, borderColor: n4Celestial ? N4_GOLD_LINE : colors.separator, borderRadius: 28, backgroundColor: n4Celestial ? N4_PANEL : colors.surface, padding: 22 },
  label: { marginTop: 17, marginBottom: 8, color: n4Celestial ? N4_IVORY : colors.text, fontSize: 12, fontWeight: '800' },
  entrySearchWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  entrySearchInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingLeft: 14,
    paddingRight: 44,
    color: colors.text,
    fontSize: 14,
  },
  entrySearchClear: {
    position: 'absolute',
    right: 4,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entrySearchClearText: {
    color: colors.textMuted,
    fontSize: 22,
    fontWeight: '500',
  },
  entrySearchMeta: {
    marginTop: 7,
    marginBottom: 8,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  chips: { paddingRight: 12 },
  chip: { maxWidth: 230, marginRight: 8, borderWidth: 1, borderColor: n4Celestial ? N4_GOLD_LINE : colors.border, borderRadius: 999, backgroundColor: n4Celestial ? N4_PANEL : colors.surface, paddingHorizontal: 14, paddingVertical: 10 },
  chipActive: { borderColor: colors.navy, backgroundColor: colors.navy },
  chipText: { color: n4Celestial ? N4_IVORY : colors.text, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.onAccent },
  fileButton: { marginTop: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.navy, borderRadius: 19, backgroundColor: n4Celestial ? N4_BLUE : colors.fill, padding: 18 },
  fileButtonTitle: { color: n4Celestial ? N4_IVORY : colors.text, fontSize: 16, fontWeight: '900' },
  fileButtonCopy: { marginTop: 5, color: n4Celestial ? N4_MUTED : colors.textMuted, fontSize: 12, lineHeight: 18 },
  input: { minHeight: 55, borderWidth: 1, borderColor: n4Celestial ? N4_GOLD_LINE : colors.border, borderRadius: 16, backgroundColor: n4Celestial ? N4_PANEL : colors.surface, paddingHorizontal: 15, color: n4Celestial ? N4_IVORY : colors.text, fontSize: 15 },
  save: { marginTop: 21, alignItems: 'center', borderRadius: 17, backgroundColor: n4Celestial ? N4_GOLD : colors.navy, padding: 16 },
  saveText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  error: { marginTop: 14, borderRadius: 14, backgroundColor: colors.dangerSoft, padding: 13, color: colors.danger, fontSize: 13 },
  library: { marginTop: 35 },
  frequencyLibraryHeader: {
    minHeight: 64,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  frequencyLibraryChevron: {
    color: n4Celestial ? N4_GOLD : colors.navy,
    fontSize: 25,
    fontWeight: '500',
  },
  frequencyLibraryItems: {
    marginTop: 2,
  },
  memoryRow: {
    marginTop: 11,
    borderWidth: 1,
    borderColor: n4Celestial ? N4_GOLD_LINE : colors.separator,
    borderRadius: 20,
    backgroundColor: n4Celestial ? N4_PANEL : colors.surface,
    padding: 17,
  },
  frequencyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  frequencyCover: {
    width: 66,
    height: 66,
    borderRadius: 15,
    backgroundColor: n4Celestial ? N4_BLUE : colors.fill,
  },
  frequencyShare: {
    width: 30,
    height: 30,
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  frequencyShareText: {
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  memoryRowFocused: {
    borderColor: colors.black,
    borderWidth: 1.5,
  },
  memoryRowCopy: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 4,
    paddingRight: 12,
  },
  rowTitle: {
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 16,
    fontWeight: '900',
  },

  rowArtist: {
    marginTop: 2,
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  frequencyEditor: {
    width: '100%',
    minWidth: 0,
    marginTop: 14,
    marginBottom: 12,
    paddingTop: 14,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor:
      colors.separator,
  },

  frequencyEditLabel: {
    marginTop: 8,
    marginBottom: 6,
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  frequencyEditInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: n4Celestial ? N4_GOLD_LINE : colors.separator,
    borderRadius: 12,
    backgroundColor: n4Celestial ? N4_BLUE : colors.fill,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 14,
  },

  frequencyCoverEditor: {
    minHeight: 88,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: n4Celestial ? N4_GOLD_LINE : colors.separator,
    borderRadius: 14,
    backgroundColor: n4Celestial ? N4_BLUE : colors.fill,
  },
  frequencyCoverPreview: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: n4Celestial ? N4_PANEL : colors.surface,
  },
  frequencyCoverEmpty: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: n4Celestial ? N4_PANEL : colors.surface,
  },
  frequencyCoverEmptyMark: {
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 24,
    fontWeight: '800',
  },
  frequencyCoverActions: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  frequencyCoverButton: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: n4Celestial ? N4_PANEL : colors.surface,
  },
  frequencyCoverButtonText: {
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  frequencyCoverRemove: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.dangerSoft,
  },
  frequencyCoverRemoveText: {
    color: colors.danger,
    fontSize: 9,
    fontWeight: '900',
  },
  frequencyEditActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },

  frequencyEditSave: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: n4Celestial ? N4_GOLD : colors.navy,
    paddingHorizontal: 16,
  },

  frequencyEditSaveText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },

  frequencyEditCancel: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: n4Celestial ? N4_BLUE : colors.fill,
    paddingHorizontal: 16,
  },

  frequencyEditCancelText: {
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
  },

  rowActionActive: {
    backgroundColor: n4Celestial ? N4_PANEL_RAISED : colors.fillStrong,
  },
  rowCopy: { marginTop: 4, color: n4Celestial ? N4_MUTED : colors.textMuted, fontSize: 12 },
  rowActions: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  rowAction: { minHeight: 34, justifyContent: 'center', borderRadius: 10, backgroundColor: n4Celestial ? N4_BLUE : colors.fill, paddingHorizontal: 10 },
  rowActionText: { color: n4Celestial ? N4_MUTED : colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.45 },
  rowDeleteAction: { backgroundColor: colors.dangerSoft },
  rowDeleteText: { color: colors.danger, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  rowPlay: { color: n4Celestial ? N4_GOLD : colors.navy, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  emptyText: { color: n4Celestial ? N4_MUTED : colors.textMuted, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  archaeologyCard: {
    marginBottom: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: n4Celestial ? N4_GOLD_LINE : colors.separator,
    borderRadius: 26,
    backgroundColor: n4Celestial ? N4_PANEL : colors.surface,
  },

  archaeologyKicker: {
    color: n4Celestial ? N4_GOLD : colors.navy,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.25,
  },

  archaeologyLoading: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  archaeologyAge: {
    marginTop: 15,
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  archaeologyTitle: {
    marginTop: 7,
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -0.6,
  },

  archaeologyMeta: {
    marginTop: 5,
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  archaeologyReason: {
    marginTop: 8,
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 12,
    lineHeight: 18,
  },

  archaeologyMeaning: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: n4Celestial ? N4_PANEL_RAISED : colors.fillStrong,
  },

  archaeologyMeaningLabel: {
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.9,
  },

  archaeologyMeaningText: {
    marginTop: 6,
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },

  archaeologyAround: {
    marginTop: 17,
    paddingTop: 15,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor:
      colors.separator,
  },

  archaeologyAroundLabel: {
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.9,
  },

  archaeologyAroundItem: {
    marginTop: 7,
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 12,
    fontWeight: '700',
  },

  archaeologyContext: {
    marginTop: 6,
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
  },

  archaeologyActions: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  archaeologyTune: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: n4Celestial ? N4_GOLD : colors.navy,
    paddingHorizontal: 16,
  },

  archaeologyTuneText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  archaeologyNext: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: n4Celestial ? N4_BLUE : colors.fill,
    paddingHorizontal: 16,
  },

  archaeologySoloButton: {
    alignSelf: 'flex-start',
    marginTop: 16,
  },

  archaeologyNextText: {
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.45,
  },

  archaeologyAudioMeta: {
    marginTop: 10,
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 10,
  },

  archaeologyMuted: {
    marginTop: 9,
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },

  stationPanel: {
    marginBottom: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: n4Celestial ? N4_GOLD_LINE : colors.separator,
    borderRadius: 22,
    backgroundColor: n4Celestial ? N4_PANEL : colors.surface,
  },

  stationEyebrow: {
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.25,
  },

  stationChips: {
    paddingTop: 12,
    paddingRight: 10,
  },

  stationChip: {
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: n4Celestial ? N4_GOLD_LINE : colors.separator,
    borderRadius: 999,
    backgroundColor: n4Celestial ? N4_PANEL : colors.surface,
  },

  stationChipActive: {
    borderColor: colors.navy,
    backgroundColor: n4Celestial ? N4_GOLD : colors.navy,
  },

  stationChipText: {
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 11,
    fontWeight: '800',
  },

  stationChipTextActive: {
    color: colors.white,
  },

  stationInfo: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },

  stationInfoCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 14,
  },

  stationDescription: {
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },

  stationContext: {
    marginTop: 3,
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
  },

  stationCount: {
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 13,
    backgroundColor: n4Celestial ? N4_PANEL_RAISED : colors.fillStrong,
  },

  stationCountValue: {
    color: n4Celestial ? N4_IVORY : colors.text,
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },

  stationCountLabel: {
    marginTop: 1,
    color: n4Celestial ? N4_MUTED : colors.textMuted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  pressed: { opacity: 0.72 },
});

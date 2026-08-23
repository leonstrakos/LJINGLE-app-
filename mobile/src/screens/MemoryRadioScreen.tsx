import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMemoryAudio } from '../audio/MemoryAudioProvider';
import { MemoryPlayer } from '../components/MemoryPlayer';
import { ClipEditor } from '../components/ClipEditor';
import { entryApi } from '../services/entryApi';
import { memoryRadioApi, pickLocalAudio } from '../services/memoryRadioApi';
// memoryRadioContextModesV1
import {
  loadMemoryRadioContexts,
  type MemoryRadioContext,
} from '../storage/memoryRadioContext';
import {
  buildMemoryRadioStation,
  memoryRadioModes,
  type MemoryRadioMode,
} from '../intelligence/memoryRadioModes';

// memoryArchaeologyV1
import {
  loadLostSignal,
  type LostSignal,
} from '../storage/memoryArchaeology';
import { colors } from '../theme/colors';
import type { Entry } from '../types/entry';
import type { ImportedAudio, MemoryTrack } from '../types/memoryRadio';

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
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
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
      ] = await Promise.all([
        memoryRadioApi.getAll(),
        entryApi.getAll(),
        loadMemoryRadioContexts(),
      ]);

      setMemories(nextMemories);
      setEntries(nextEntries);
      setMemoryContexts(nextContexts);
      setSelectedEntryId((current) => current ?? nextEntries[0]?.entryId ?? null);
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
  const anchors = useMemo(
    () => selectedEntry ? boldFragments(selectedEntry.content) : [],
    [selectedEntry],
  );
  const baseStation = useMemo(
    () =>
      buildMemoryRadioStation({
        mode,
        memories,
        contexts: memoryContexts,
        currentTrackId: audio.current?.trackId ?? null,
      }),
    [
      audio.current?.trackId,
      memories,
      memoryContexts,
      mode,
    ],
  );

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

  const featured =
    audio.current &&
    stationTrackIds.has(audio.current.trackId)
      ? audio.current
      : station.pool.find(
          (memory) => memory.linkId !== null,
        ) ??
        lostSignalTrack ??
        null;

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
    if (!picked || !selectedEntryId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await memoryRadioApi.attach({
        ...picked,
        title: title.trim() || picked.title,
        artist: artist.trim(),
        entryId: selectedEntryId,
        anchorText,
        clipStartSeconds: clipStart,
        clipEndSeconds: clipEnd,
      });
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
  };

  const cancelEditFrequency = () => {
    if (savingTrackMetadata) {
      return;
    }

    blurWebFrequencyEditor();

    setEditingTrackId(null);
    setEditTrackTitle('');
    setEditTrackArtist('');
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
      audio.play(next);
    }
  };

  if (loading && memories.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.center}><ActivityIndicator color={colors.navy} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>LJINGLE 2001. FM</Text>
          <Text style={styles.heading}>Memory Radio</Text>
          <Text style={styles.intro}>Misli koje si spremio vraćaju se sa zvukom koji im pripada.</Text>
        </View>

        {/* memoryRadioContextModesV1 */}
        <View style={styles.stationPanel}>
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
                          lostSignalTrack
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
            {featured ? station.eyebrow : 'RADIO IS QUIET'}
          </Text>
          {featured ? (
            <>
              <Text style={styles.memoryTitle}>{featured.entryTitle || featured.trackTitle}</Text>
              <Text numberOfLines={4} style={styles.memoryText}>
                {featured.linkId
                  ? (featured.anchorText ? `“${featured.anchorText}”` : featured.entryContent)
                  : 'Nepovezana frekvencija — audio je sačuvan, ali nije vezan uz Zapis.'}
              </Text>
              <View style={styles.playerGap}><MemoryPlayer memory={featured} /></View>
              <Pressable onPress={shuffle} style={({ pressed }) => [styles.shuffle, pressed && styles.pressed]}>
                <Text style={styles.shuffleText}>Pronađi drugo sjećanje</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.emptyBroadcast}>
              {memories.length === 0
                ? 'Poveži prvu pjesmu sa zapisom i radio će se probuditi.'
                : station.emptyText}
            </Text>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dodaj zvuk sjećanju</Text>
          <Text style={styles.sectionCopy}>Audio ostaje lokalno na ovom uređaju.</Text>
        </View>

        {entries.length === 0 ? (
          <View style={styles.card}><Text style={styles.emptyText}>Prvo napravi barem jedan Zapis.</Text></View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>Zapis</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {entries.map((entry) => (
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

            <Pressable onPress={() => void chooseFile()} style={({ pressed }) => [styles.fileButton, pressed && styles.pressed]}>
              <Text style={styles.fileButtonTitle}>{picked ? picked.originalName : 'Odaberi audio datoteku'}</Text>
              <Text style={styles.fileButtonCopy}>{picked ? 'Datoteka je spremna za povezivanje.' : 'MP3, M4A, WAV ili drugi format koji uređaj podržava'}</Text>
            </Pressable>

            {picked ? (
              <>
                <Text style={styles.label}>Naslov pjesme</Text>
                <TextInput value={title} onChangeText={setTitle} placeholder="Naslov" placeholderTextColor={colors.textMuted} style={styles.input} />
                <Text style={styles.label}>Izvođač</Text>
                <TextInput value={artist} onChangeText={setArtist} placeholder="Neobavezno" placeholderTextColor={colors.textMuted} style={styles.input} />
                <ClipEditor
                  uri={picked.fileUri}
                  start={clipStart}
                  end={clipEnd}
                  onChange={(start, end) => { setClipStart(start); setClipEnd(end); }}
                />
                <Pressable disabled={saving} onPress={() => void save()} style={({ pressed }) => [styles.save, pressed && styles.pressed, saving && styles.disabled]}>
                  <Text style={styles.saveText}>{saving ? 'Spremanje...' : 'Poveži sjećanje i pjesmu'}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {memories.length > 0 ? (
          <View style={styles.library}>
            <Text style={styles.sectionTitle}>Frekvencije</Text>
            <Text style={styles.sectionCopy}>Odveži zadržava audio. Obriši uklanja frekvenciju i njezinu lokalnu kopiju.</Text>
            {memories.map((memory) => {
              const busy = busyTrackId === memory.trackId;
              const confirming = confirmDeleteTrackId === memory.trackId;
              return (
                <View key={memory.trackId} style={styles.memoryRow}>
                  <Pressable
                    disabled={busy}
                    onPress={() => audio.play(memory)}
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
                    <Pressable disabled={busy} onPress={() => audio.play(memory)} style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}>
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
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 860, alignSelf: 'center', padding: 22, paddingBottom: 70 },
  hero: { paddingVertical: 20 },
  kicker: { color: colors.navy, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  heading: { marginTop: 7, color: colors.text, fontSize: 43, fontWeight: '900', letterSpacing: -1.6 },
  intro: { marginTop: 10, maxWidth: 570, color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  broadcast: { overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: 32, backgroundColor: colors.surface, padding: 25 },
  broadcastGlow: { position: 'absolute', top: -90, right: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: colors.navy },
  broadcastLabel: { color: colors.navy, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  memoryTitle: { marginTop: 20, color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.7 },
  memoryText: { marginTop: 10, color: colors.text, fontSize: 18, lineHeight: 27 },
  emptyBroadcast: { marginTop: 18, maxWidth: 440, color: colors.textMuted, fontSize: 17, lineHeight: 25 },
  playerGap: { marginTop: 23 },
  shuffle: { marginTop: 15, alignSelf: 'flex-start', borderRadius: 999, backgroundColor: colors.navy, paddingHorizontal: 17, paddingVertical: 11 },
  shuffleText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  sectionHeader: { marginTop: 34, marginBottom: 13 },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  sectionCopy: { marginTop: 4, color: colors.textMuted, fontSize: 12 },
  card: { borderWidth: 1, borderColor: colors.separator, borderRadius: 28, backgroundColor: colors.surface, padding: 22 },
  label: { marginTop: 17, marginBottom: 8, color: colors.text, fontSize: 12, fontWeight: '800' },
  chips: { paddingRight: 12 },
  chip: { maxWidth: 230, marginRight: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 10 },
  chipActive: { borderColor: colors.navy, backgroundColor: colors.navy },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  fileButton: { marginTop: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.navy, borderRadius: 19, backgroundColor: colors.fill, padding: 18 },
  fileButtonTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  fileButtonCopy: { marginTop: 5, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  input: { minHeight: 55, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, paddingHorizontal: 15, color: colors.text, fontSize: 15 },
  save: { marginTop: 21, alignItems: 'center', borderRadius: 17, backgroundColor: colors.navy, padding: 16 },
  saveText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  error: { marginTop: 14, borderRadius: 14, backgroundColor: colors.dangerSoft, padding: 13, color: colors.danger, fontSize: 13 },
  library: { marginTop: 35 },
  memoryRow: { marginTop: 11, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.separator, borderRadius: 20, backgroundColor: colors.surface, padding: 17 },
  memoryRowCopy: { flex: 1, minWidth: 0, marginRight: 12, paddingVertical: 4 },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },

  rowArtist: {
    marginTop: 2,
    color: colors.textMuted,
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
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  frequencyEditInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 12,
    backgroundColor: colors.fill,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
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
    backgroundColor: colors.navy,
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
    backgroundColor: colors.fill,
    paddingHorizontal: 16,
  },

  frequencyEditCancelText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
  },

  rowActionActive: {
    backgroundColor: colors.fillStrong,
  },
  rowCopy: { marginTop: 4, color: colors.textMuted, fontSize: 12 },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexShrink: 1,
  },
  rowAction: { minHeight: 34, justifyContent: 'center', borderRadius: 10, backgroundColor: colors.fill, paddingHorizontal: 10 },
  rowActionText: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.45 },
  rowDeleteAction: { backgroundColor: colors.dangerSoft },
  rowDeleteText: { color: colors.danger, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  rowPlay: { color: colors.navy, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  archaeologyCard: {
    marginBottom: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 26,
    backgroundColor: colors.surface,
  },

  archaeologyKicker: {
    color: colors.navy,
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
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  archaeologyTitle: {
    marginTop: 7,
    color: colors.text,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -0.6,
  },

  archaeologyMeta: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  archaeologyReason: {
    marginTop: 8,
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
  },

  archaeologyMeaning: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.fillStrong,
  },

  archaeologyMeaningLabel: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.9,
  },

  archaeologyMeaningText: {
    marginTop: 6,
    color: colors.text,
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
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.9,
  },

  archaeologyAroundItem: {
    marginTop: 7,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },

  archaeologyContext: {
    marginTop: 6,
    color: colors.textMuted,
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
    backgroundColor: colors.navy,
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
    backgroundColor: colors.fill,
    paddingHorizontal: 16,
  },

  archaeologySoloButton: {
    alignSelf: 'flex-start',
    marginTop: 16,
  },

  archaeologyNextText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.45,
  },

  archaeologyAudioMeta: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 10,
  },

  archaeologyMuted: {
    marginTop: 9,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },

  stationPanel: {
    marginBottom: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },

  stationEyebrow: {
    color: colors.textMuted,
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
    borderColor: colors.separator,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },

  stationChipActive: {
    borderColor: colors.navy,
    backgroundColor: colors.navy,
  },

  stationChipText: {
    color: colors.text,
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
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },

  stationContext: {
    marginTop: 3,
    color: colors.textMuted,
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
    backgroundColor: colors.fillStrong,
  },

  stationCountValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },

  stationCountLabel: {
    marginTop: 1,
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  pressed: { opacity: 0.72 },
});

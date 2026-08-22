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

export function MemoryRadioScreen() {
  const audio = useMemoryAudio();
  const [memories, setMemories] = useState<MemoryTrack[]>([]);
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
  const [error, setError] = useState<string | null>(null);
  const bass = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextMemories, nextEntries] = await Promise.all([
        memoryRadioApi.getAll(),
        entryApi.getAll(),
      ]);
      setMemories(nextMemories);
      setEntries(nextEntries);
      setSelectedEntryId((current) => current ?? nextEntries[0]?.entryId ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Memory Radio se nije učitao.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const selectedEntry = entries.find((entry) => entry.entryId === selectedEntryId) ?? null;
  const anchors = useMemo(
    () => selectedEntry ? boldFragments(selectedEntry.content) : [],
    [selectedEntry],
  );
  const featured = audio.current ?? memories.find((memory) => memory.linkId !== null) ?? memories[0] ?? null;
  const bassActive = Boolean(featured && audio.current?.trackId === featured.trackId && audio.playing);

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
    if (memories.length === 0) return;
    const choices = memories.filter((memory) => memory.trackId !== audio.current?.trackId);
    const pool = choices.length > 0 ? choices : memories;
    const next = pool[Math.floor(Math.random() * pool.length)];
    if (next) audio.play(next);
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
          <Text style={styles.broadcastLabel}>{featured ? 'NOW REMEMBERING' : 'RADIO IS QUIET'}</Text>
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
            <Text style={styles.emptyBroadcast}>Poveži prvu pjesmu sa zapisom i radio će se probuditi.</Text>
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
                    <Text numberOfLines={1} style={styles.rowTitle}>{memory.trackTitle}</Text>
                    <Text numberOfLines={1} style={styles.rowCopy}>
                      {memory.linkId
                        ? `${memory.entryTitle || 'Bez naslova'}${memory.anchorText ? ` · ${memory.anchorText}` : ''}`
                        : 'Nije povezano sa zapisom'}
                    </Text>
                  </Pressable>

                  <View style={styles.rowActions}>
                    <Pressable disabled={busy} onPress={() => audio.play(memory)} style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}>
                      <Text style={styles.rowPlay}>PLAY</Text>
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
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  rowCopy: { marginTop: 4, color: colors.textMuted, fontSize: 12 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowAction: { minHeight: 34, justifyContent: 'center', borderRadius: 10, backgroundColor: colors.fill, paddingHorizontal: 10 },
  rowActionText: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.45 },
  rowDeleteAction: { backgroundColor: colors.dangerSoft },
  rowDeleteText: { color: colors.danger, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  rowPlay: { color: colors.navy, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
});

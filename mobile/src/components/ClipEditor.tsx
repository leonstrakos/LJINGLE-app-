import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { useMemoryAudio } from '../audio/MemoryAudioProvider';
import { claimAudioFocus, listenForAudioFocus } from '../audio/audioFocus';
import { colors } from '../theme/colors';

type Props = {
  uri: string;
  start: number;
  end: number | null;
  onChange: (start: number, end: number | null) => void;
};

function stamp(value: number) {
  const safe = Math.max(0, Math.floor(value || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function parseStamp(value: string) {
  const parts = value.trim().split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 1) return parts[0] ?? null;
  if (parts.length === 2) {
    return (parts[0] ?? 0) * 60 + Math.min(59, parts[1] ?? 0);
  }
  return null;
}

export function ClipEditor({ uri, start, end, onChange }: Props) {
  const player = useAudioPlayer(uri, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const radio = useMemoryAudio();
  const [width, setWidth] = useState(1);
  const [webDuration, setWebDuration] = useState(0);
  const initialized = useRef(false);
  const timeline = useRef<View>(null);
  const duration = Math.max(0, status.duration || webDuration || 0);
  const stop = end ?? duration;

  useEffect(() => {
    player.replace(uri);
    initialized.current = false;
    return () => player.pause();
  }, [player, uri]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const element = new Audio(uri);
    element.preload = 'metadata';
    const loaded = () => {
      if (Number.isFinite(element.duration)) setWebDuration(element.duration);
    };
    element.addEventListener('loadedmetadata', loaded);
    element.load();
    return () => {
      element.removeEventListener('loadedmetadata', loaded);
      element.src = '';
    };
  }, [uri]);

  useEffect(() => listenForAudioFocus((owner) => {
    if (owner !== 'clip-preview') player.pause();
  }), [player]);

  useEffect(() => {
    if (!initialized.current && duration > 0) {
      initialized.current = true;
      onChange(Math.min(start, duration), end ?? duration);
    }
  }, [duration, end, onChange, start]);

  useEffect(() => {
    if (!status.playing || !stop || status.currentTime < stop) return;
    player.pause();
    void player.seekTo(start);
  }, [player, start, status.currentTime, status.playing, stop]);

  const preview = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    radio.pause();
    claimAudioFocus('clip-preview');
    void player.seekTo(start).then(() => player.play());
  };

  const choosePoint = (locationX: number) => {
    if (!duration) return;
    const point = Math.max(0, Math.min(duration, (locationX / width) * duration));
    const safeStop = stop || duration;
    if (Math.abs(point - start) <= Math.abs(point - safeStop)) {
      onChange(Math.min(point, safeStop - 0.5), end);
    } else {
      onChange(start, Math.max(point, start + 0.5));
    }
  };

  const chooseFromPress = (pageX: number, fallbackX?: number) => {
    if (Number.isFinite(fallbackX)) {
      choosePoint(fallbackX as number);
      return;
    }
    timeline.current?.measureInWindow((x) => choosePoint(pageX - x));
  };

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width || 1);
  const left = duration ? (start / duration) * width : 0;
  const stopLeft = duration ? (stop / duration) * width : width;
  const selectedWidth = Math.max(0, stopLeft - left);

  return (
    <View style={styles.shell}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.kicker}>CLIP STOP</Text>
          <Text style={styles.title}>Odaberi dio sjećanja</Text>
        </View>
        <Pressable onPress={preview} style={({ pressed }) => [styles.preview, pressed && styles.pressed]}>
          <Text style={styles.previewText}>{status.playing ? 'PAUSE' : 'PREVIEW'}</Text>
        </Pressable>
      </View>

      <Pressable
        ref={timeline}
        onLayout={onLayout}
        onPress={(event) => {
          const native = event.nativeEvent as typeof event.nativeEvent & { offsetX?: number };
          const local = Number.isFinite(native.locationX) ? native.locationX : native.offsetX;
          chooseFromPress(native.pageX, local);
        }}
        style={styles.timeline}
      >
        <View style={styles.rail} />
        <View style={[styles.selection, { left, width: selectedWidth }]} />
        <View style={[styles.marker, { left }]} />
        <View style={[styles.marker, { left: stopLeft }]} />
      </Pressable>
      <Text style={styles.help}>
        {duration > 0 ? 'Klikni timeline — pomaknut će se najbliži rez.' : 'Klikni PREVIEW da učitamo trajanje pjesme.'}
      </Text>

      <View style={styles.cuts}>
        <CutInput
          label="START"
          value={start}
          onCommit={(value) =>
            onChange(Math.max(0, Math.min(stop - 0.5, value)), end)
          }
        />
        <CutInput
          label="STOP"
          value={stop}
          onCommit={(value) =>
            onChange(start, Math.max(start + 0.5, Math.min(duration, value)))
          }
        />
      </View>
    </View>
  );
}

function CutInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(stamp(value));

  useEffect(() => setDraft(stamp(value)), [value]);

  const commit = () => {
    const parsed = parseStamp(draft);

    if (parsed === null) {
      setDraft(stamp(value));
      return;
    }

    onCommit(parsed);
  };

  return (
    <View style={styles.cut}>
      <Text style={styles.cutLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={`${label} vrijeme`}
        inputMode="numeric"
        value={draft}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        selectTextOnFocus
        style={styles.cutTime}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { marginTop: 18, borderRadius: 22, backgroundColor: colors.fill, padding: 18 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: colors.navy, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 4, color: colors.text, fontSize: 17, fontWeight: '900' },
  preview: { borderRadius: 999, backgroundColor: colors.navy, paddingHorizontal: 16, paddingVertical: 11 },
  previewText: { color: colors.white, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  timeline: { height: 44, justifyContent: 'center', marginTop: 17 },
  rail: { height: 8, borderRadius: 999, backgroundColor: colors.border },
  selection: { position: 'absolute', height: 12, borderRadius: 999, backgroundColor: colors.navy },
  marker: { position: 'absolute', width: 4, height: 28, marginLeft: -2, borderRadius: 4, backgroundColor: colors.text },
  help: { color: colors.textMuted, fontSize: 10 },
  cuts: { marginTop: 16, flexDirection: 'row', gap: 12 },
  cut: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 13 },
  cutLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cutTime: { marginTop: 3, padding: 0, color: colors.text, fontSize: 22, fontWeight: '900' },
  pressed: { opacity: 0.68 },
});

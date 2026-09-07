import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMemoryAudio } from '../audio/MemoryAudioProvider';
import { colors } from '../theme/colors';
import type { MemoryTrack } from '../types/memoryRadio';
import { MemoryWaveform } from './MemoryWaveform';

function time(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

// ljingleOnboardingPlayerV1
export function MemoryPlayer({
  memory,
  queue,
}: {
  memory: MemoryTrack;
  queue?: MemoryTrack[];
}) {
  const audio = useMemoryAudio();
  // memoryRadioUnlinkDeleteV3
  const active = audio.current?.trackId === memory.trackId;
  const progress = active && audio.duration > 0 ? audio.currentTime / audio.duration : 0;

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>{memory.trackTitle}</Text>
          <Text numberOfLines={1} style={styles.artist}>
            {memory.artist || 'Unknown artist'}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={active && audio.playing ? 'Pauziraj' : 'Pusti'}
          accessibilityRole="button"
          onPress={() => audio.toggle(memory, queue)}
          style={({ pressed }) => [styles.play, pressed && styles.pressed]}
        >
          {active && audio.playing ? (
            <View style={styles.pauseIcon}>
              <View style={styles.pauseBar} />
              <View style={styles.pauseBar} />
            </View>
          ) : <View style={styles.playTriangle} />}
        </Pressable>
      </View>
      <View style={styles.waveRow}>
        <MemoryWaveform progress={progress} seed={memory.waveformSeed} />
        <Text style={styles.time}>{active ? time(audio.currentTime) : '0:00'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 22,
    backgroundColor: colors.fill,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    marginRight: 14,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  artist: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
  },
  play: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.navy,
  },
  playTriangle: {
    width: 0,
    height: 0,
    marginLeft: 4,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderLeftWidth: 15,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.white,
  },
  pauseIcon: { flexDirection: 'row', gap: 5 },
  pauseBar: { width: 5, height: 19, borderRadius: 2, backgroundColor: colors.white },
  waveRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    width: 42,
    marginLeft: 8,
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'right',
  },
  pressed: {
    opacity: 0.72,
  },
});

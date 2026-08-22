import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { MediaTimerResponse } from '../types/media';
import { PrimaryButton } from './PrimaryButton';

type Props = {
  timer: MediaTimerResponse;
  loading: boolean;
  errorMessage: string | null;
  onToggle: () => void;
};

function liveTotal(timer: MediaTimerResponse, now: number) {
  if (!timer.running || !timer.activeStartedAt) return timer.totalSeconds;
  const started = Date.parse(timer.activeStartedAt);
  if (!Number.isFinite(started)) return timer.totalSeconds;
  return timer.completedSeconds + Math.max(0, Math.floor((now - started) / 1000));
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  return [hours, minutes, remainder]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

export function WatchTimerCard({ timer, loading, errorMessage, onToggle }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (!timer.running) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [timer.activeStartedAt, timer.running]);

  return (
    <View style={[styles.card, timer.running && styles.runningCard]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, timer.running && styles.runningMuted]}>
            Vrijeme gledanja
          </Text>
          <Text numberOfLines={2} style={[styles.title, timer.running && styles.runningText]}>
            {timer.label}
          </Text>
        </View>
        <View style={[styles.dot, timer.running && styles.activeDot]} />
      </View>
      <Text style={[styles.time, timer.running && styles.runningText]}>
        {formatDuration(liveTotal(timer, now))}
      </Text>
      <Text style={[styles.caption, timer.running && styles.runningMuted]}>
        {timer.running
          ? 'Aktivna sesija nastavlja se i nakon zatvaranja aplikacije.'
          : timer.activityId
            ? 'Ukupno vrijeme svih spremljenih sesija gledanja.'
            : 'Pokrenite prvu sesiju gledanja.'}
      </Text>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      <View style={styles.button}>
        <PrimaryButton
          label={timer.running ? 'Zaustavi i spremi' : 'Započni gledanje'}
          loading={loading}
          onPress={onToggle}
          variant={timer.running ? 'secondary' : 'primary'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  runningCard: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: { flex: 1 },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    marginTop: 5,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.separator,
    marginTop: 4,
  },
  activeDot: { backgroundColor: colors.success },
  time: {
    color: colors.text,
    fontSize: 42,
    lineHeight: 52,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginTop: 22,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  runningText: { color: colors.white },
  runningMuted: { color: '#AEAEB2' },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginTop: 12,
  },
  button: { marginTop: 18 },
});

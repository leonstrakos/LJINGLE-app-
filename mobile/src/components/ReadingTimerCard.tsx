import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { ActivityTimerResponse } from '../types/activity';
import { PrimaryButton } from './PrimaryButton';

type Props = {
  timer: ActivityTimerResponse;
  loading: boolean;
  errorMessage: string | null;
  onToggle: () => void;
};

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function currentTotal(timer: ActivityTimerResponse, now: number) {
  if (!timer.running || !timer.activeStartedAt) {
    return timer.totalSeconds;
  }

  const startedAt = Date.parse(timer.activeStartedAt);
  if (Number.isNaN(startedAt)) {
    return timer.totalSeconds;
  }

  return timer.completedSeconds + Math.max(0, Math.floor((now - startedAt) / 1000));
}

export function ReadingTimerCard({ timer, loading, errorMessage, onToggle }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (!timer.running) return undefined;

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [timer.running, timer.activeStartedAt]);

  const total = currentTotal(timer, now);

  return (
    <View style={[styles.card, timer.running && styles.runningCard]}>
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text style={styles.eyebrow}>
            Vrijeme čitanja
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {timer.label}
          </Text>
        </View>
        <View style={[styles.dot, timer.running && styles.activeDot]} />
      </View>

      <Text
        accessibilityLabel={`Ukupno praćeno vrijeme ${formatDuration(total)}`}
        style={styles.time}
      >
        {formatDuration(total)}
      </Text>

      <Text style={styles.status}>
        {timer.running
          ? 'Sesija je aktivna i nastavlja se i kada zatvoriš aplikaciju.'
          : timer.activityId
            ? 'Ukupno vrijeme svih spremljenih sesija.'
            : 'Pokreni prvu sesiju za ovu knjigu.'}
      </Text>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.buttonWrap}>
        <PrimaryButton
          label={timer.running ? 'Zaustavi i spremi sesiju' : 'Započni čitanje'}
          onPress={onToggle}
          loading={loading}
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
    backgroundColor: colors.surface,
    borderColor: colors.black,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headingText: {
    flex: 1,
  },
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
    marginTop: 4,
    borderRadius: 5,
    backgroundColor: colors.separator,
  },
  activeDot: {
    backgroundColor: colors.black,
  },
  time: {
    color: colors.text,
    fontSize: 42,
    lineHeight: 52,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginTop: 22,
  },
  status: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  runningText: {
    color: colors.onAccent,
  },
  runningMuted: {
    color: '#AEAEB2',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  buttonWrap: {
    marginTop: 18,
  },
});

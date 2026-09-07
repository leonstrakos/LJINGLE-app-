import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import type { ActivityTimerResponse } from '../types/activity';

const aeroMode = activeVisualSkinId === 'aero';
import {
  formatDuration,
  getActiveSessionSeconds,
  getLiveTotalSeconds,
} from '../utils/activityTime';

type Props = {
  timer: ActivityTimerResponse;
  now: number;
  stopping: boolean;
  onOpen?: () => void;
  onStop: () => void;
};

export function ActiveTimerCard({ timer, now, stopping, onOpen, onStop }: Props) {
  const sessionSeconds = getActiveSessionSeconds(timer, now);
  const totalSeconds = getLiveTotalSeconds(timer, now);

  return (
    <View style={[styles.card, aeroMode && styles.aeroCard]}>
      <Pressable
        accessibilityRole={onOpen ? 'button' : undefined}
        accessibilityLabel={onOpen ? `Otvori ${timer.label}` : undefined}
        disabled={!onOpen}
        onPress={onOpen}
        style={({ pressed }) => [styles.cardBody, pressed && onOpen && styles.pressed]}
      >
        <View style={styles.headingRow}>
          <View style={styles.statusRow}>
            <View style={styles.liveDot} />
            <Text style={styles.eyebrow}>Aktivno sada</Text>
          </View>
          {onOpen ? <Text style={styles.openHint}>Otvori  ›</Text> : null}
        </View>

        <Text style={styles.label} numberOfLines={2}>
          {timer.label}
        </Text>

        <Text
          accessibilityLabel={`Trajanje aktivne sesije ${formatDuration(sessionSeconds)}`}
          style={styles.time}
        >
          {formatDuration(sessionSeconds)}
        </Text>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Ukupno praćeno</Text>
          <Text style={styles.totalValue}>{formatDuration(totalSeconds)}</Text>
        </View>
      </Pressable>

      <View style={styles.divider} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Zaustavi ${timer.label}`}
        disabled={stopping}
        onPress={onStop}
        style={({ pressed }) => [
          styles.stopButton,
          pressed && !stopping && styles.stopPressed,
          stopping && styles.stopDisabled,
        ]}
      >
        {stopping ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <View style={styles.stopIcon} />
            <Text style={styles.stopLabel}>Zaustavi i spremi sesiju</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
    borderRadius: 22,
    backgroundColor: colors.black,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 5,
  },
  aeroCard: {
    backgroundColor: '#087CB8',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#087CB8',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cardBody: {
    paddingHorizontal: 20,
    paddingTop: 19,
    paddingBottom: 17,
  },
  pressed: {
    opacity: 0.78,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: colors.success,
  },
  eyebrow: {
    color: '#C7C7CC',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  openHint: {
    color: '#AEAEB2',
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    marginTop: 12,
    color: colors.white,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  time: {
    marginTop: 17,
    color: colors.white,
    fontSize: 45,
    lineHeight: 53,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.2,
  },
  totalRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: '#8E8E93',
    fontSize: 12,
  },
  totalValue: {
    color: '#C7C7CC',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
    backgroundColor: '#38383A',
  },
  stopButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  stopPressed: {
    backgroundColor: '#1C1C1E',
  },
  stopDisabled: {
    opacity: 0.55,
  },
  stopIcon: {
    width: 10,
    height: 10,
    marginRight: 9,
    borderRadius: 2,
    backgroundColor: colors.white,
  },
  stopLabel: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});

// forkDTopicsV1
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import {
  activityTypeLabels,
  type TopicActivityResponse,
  type TopicActivityTimerResponse,
} from '../types/topic';
import {
  formatTopicDuration,
  getTopicSessionSeconds,
  getTopicTotalSeconds,
} from '../utils/topicActivityTime';

import { celestial, celestialAlpha } from '../theme/celestial';
// forkN2CelestialCollectionsTopicsV2
const celestialMode = activeVisualSkinId === 'classic';
const CELESTIAL_GOLD = celestial.gold;

type Props = {
  activity: TopicActivityResponse;
  timer?: TopicActivityTimerResponse;
  now: number;
  busy: boolean;
  onToggle: () => void;
};

export function TopicActivityCard({ activity, timer, now, busy, onToggle }: Props) {
  const running = timer?.running === true;
  const sessionSeconds = timer ? getTopicSessionSeconds(timer, now) : 0;
  const totalSeconds = timer ? getTopicTotalSeconds(timer, now) : 0;

  return (
    <View
      style={[
        styles.card,
        celestialMode && styles.cardCelestial,
        running && styles.cardRunning,
        celestialMode && running && styles.cardRunningCelestial,
      ]}
    >
      {celestialMode ? <Text pointerEvents="none" style={styles.cardStar}>✦</Text> : null}
      <View style={styles.headingCopy}>
        <Text style={[styles.type, celestialMode && styles.typeCelestial]}>
          {activityTypeLabels[activity.activityType]}
        </Text>
        <Text numberOfLines={2} style={styles.label}>
          {activity.label}
        </Text>
      </View>

      {running ? (
        <View style={styles.timerBlock}>
          <Text style={styles.timerLabel}>Ova sesija</Text>
          <Text
            accessibilityLabel={`Trajanje sesije ${formatTopicDuration(sessionSeconds)}`}
            style={styles.timer}
          >
            {formatTopicDuration(sessionSeconds)}
          </Text>
          <Text style={styles.total}>
            Ukupno {formatTopicDuration(totalSeconds)}
          </Text>
        </View>
      ) : timer && totalSeconds > 0 ? (
        <Text style={styles.idleTotal}>
          Ukupno praćeno {formatTopicDuration(totalSeconds)}
        </Text>
      ) : (
        <Text style={styles.idleHint}>
          Pokreni kada započneš ovu aktivnost.
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${running ? 'Zaustavi' : 'Pokreni'} ${activity.label}`}
        disabled={busy}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.button,
          celestialMode && styles.buttonCelestial,
          running && styles.stopButton,
          pressed && !busy && styles.buttonPressed,
          busy && styles.buttonDisabled,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={running ? colors.text : colors.white} />
        ) : (
          <Text style={[styles.buttonText, running && styles.stopButtonText]}>
            {running ? 'Zaustavi i spremi' : 'Pokreni aktivnost'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 13,
    padding: 17,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  cardRunning: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  headingCopy: {
    minWidth: 0,
  },
  type: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  label: {
    marginTop: 3,
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  timerBlock: {
    marginTop: 18,
    paddingTop: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  timerLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  timer: {
    marginTop: 2,
    color: colors.text,
    fontSize: 36,
    lineHeight: 43,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
  },
  total: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  idleHint: {
    marginTop: 16,
    color: colors.textMuted,
    fontSize: 13,
  },
  idleTotal: {
    marginTop: 16,
    color: colors.textMuted,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  button: {
    minHeight: 47,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.black,
  },
  stopButton: {
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  buttonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  stopButtonText: {
    color: colors.text,
  },
  cardCelestial: {
    position: 'relative',
    overflow: 'hidden',
    borderColor: celestialAlpha(celestial.gold, 0.36),
    shadowColor: celestial.night,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1,
  },
  cardRunningCelestial: {
    borderColor: CELESTIAL_GOLD,
  },
  cardStar: {
    position: 'absolute',
    top: 10,
    right: 12,
    color: CELESTIAL_GOLD,
    fontSize: 9,
    opacity: 0.66,
  },
  typeCelestial: {
    color: CELESTIAL_GOLD,
    letterSpacing: 1.15,
  },
  buttonCelestial: {
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.68),
  },
});

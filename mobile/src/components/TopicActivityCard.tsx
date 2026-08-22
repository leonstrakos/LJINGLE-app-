import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import {
  activityTypeLabels,
  activityTypeMarks,
  type TopicActivityResponse,
  type TopicActivityTimerResponse,
} from '../types/topic';
import {
  formatTopicDuration,
  getTopicSessionSeconds,
  getTopicTotalSeconds,
} from '../utils/topicActivityTime';

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
    <View style={[styles.card, running && styles.cardRunning]}>
      <View style={styles.topRow}>
        <View style={[styles.mark, running && styles.markRunning]}>
          <Text style={[styles.markText, running && styles.markTextRunning]}>
            {activityTypeMarks[activity.activityType]}
          </Text>
        </View>

        <View style={styles.headingCopy}>
          <Text style={[styles.type, running && styles.typeRunning]}>
            {activityTypeLabels[activity.activityType]}
          </Text>
          <Text numberOfLines={2} style={[styles.label, running && styles.labelRunning]}>
            {activity.label}
          </Text>
        </View>

        <View style={[styles.stateBadge, running && styles.stateBadgeRunning]}>
          {running ? <View style={styles.liveDot} /> : null}
          <Text style={[styles.stateText, running && styles.stateTextRunning]}>
            {running ? 'Aktivno' : 'Spremno'}
          </Text>
        </View>
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
          <Text style={styles.total}>Ukupno {formatTopicDuration(totalSeconds)}</Text>
        </View>
      ) : timer && totalSeconds > 0 ? (
        <Text style={styles.idleTotal}>Ukupno praćeno {formatTopicDuration(totalSeconds)}</Text>
      ) : (
        <Text style={styles.idleHint}>Pokreni kada započneš ovu aktivnost.</Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${running ? 'Zaustavi' : 'Pokreni'} ${activity.label}`}
        disabled={busy}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.button,
          running && styles.stopButton,
          pressed && !busy && styles.buttonPressed,
          busy && styles.buttonDisabled,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={running ? colors.black : colors.white} />
        ) : (
          <>
            <View style={[styles.buttonIcon, running && styles.stopIcon]} />
            <Text style={[styles.buttonText, running && styles.stopButtonText]}>
              {running ? 'Zaustavi i spremi' : 'Pokreni aktivnost'}
            </Text>
          </>
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
    borderColor: colors.black,
    backgroundColor: colors.black,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mark: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.fillStrong,
  },
  markRunning: {
    backgroundColor: '#2C2C2E',
  },
  markText: {
    color: colors.black,
    fontSize: 21,
    fontWeight: '600',
  },
  markTextRunning: {
    color: colors.white,
  },
  headingCopy: {
    flex: 1,
    paddingHorizontal: 12,
  },
  type: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  typeRunning: {
    color: '#8E8E93',
  },
  label: {
    marginTop: 3,
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  labelRunning: {
    color: colors.white,
  },
  stateBadge: {
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: colors.fill,
  },
  stateBadgeRunning: {
    backgroundColor: '#1C1C1E',
  },
  liveDot: {
    width: 7,
    height: 7,
    marginRight: 6,
    borderRadius: 4,
    backgroundColor: '#30D158',
  },
  stateText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  stateTextRunning: {
    color: '#D1D1D6',
  },
  timerBlock: {
    marginTop: 19,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
  },
  timerLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
  },
  timer: {
    marginTop: 2,
    color: colors.white,
    fontSize: 36,
    lineHeight: 43,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
  },
  total: {
    marginTop: 2,
    color: '#AEAEB2',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.black,
  },
  stopButton: {
    backgroundColor: colors.white,
  },
  buttonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonIcon: {
    width: 0,
    height: 0,
    marginRight: 9,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.white,
  },
  stopIcon: {
    width: 10,
    height: 10,
    borderWidth: 0,
    borderRadius: 2,
    backgroundColor: colors.black,
  },
  buttonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  stopButtonText: {
    color: colors.black,
  },
});

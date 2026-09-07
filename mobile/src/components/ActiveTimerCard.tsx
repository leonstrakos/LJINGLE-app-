import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import { useReducedMotion } from '../utils/useReducedMotion';
import type { ActivityTimerResponse } from '../types/activity';

const aeroMode = activeVisualSkinId === 'aero';
import {
  formatDuration,
  getActiveSessionSeconds,
  getLiveTotalSeconds,
} from '../utils/activityTime';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

type Props = {
  timer: ActivityTimerResponse;
  now: number;
  stopping: boolean;
  onOpen?: () => void;
  onStop: () => void;
};


// ljingleCelestialActiveNowSeamlessR12:human-time
const celestialActiveTimeFont =
  Platform.select({
    ios: 'Georgia',
    android: 'serif',
    web: 'Georgia, Times New Roman, serif',
    default: undefined,
  });

function celestialHumanTime(
  seconds: number,
) {
  const safe = Math.max(
    0,
    Math.floor(
      Number.isFinite(seconds)
        ? seconds
        : 0,
    ),
  );

  const hours =
    Math.floor(safe / 3600);

  const minutes =
    Math.floor(
      (safe % 3600) / 60,
    );

  const remainder =
    safe % 60;

  if (hours > 0) {
    return (
      hours +
      ' h ' +
      minutes +
      ' min ' +
      remainder +
      ' sec'
    );
  }

  if (minutes > 0) {
    return (
      minutes +
      ' min ' +
      remainder +
      ' sec'
    );
  }

  return safe + ' sec';
}

function CelestialActiveTime({
  seconds,
}: {
  seconds: number;
}) {
  const reduceMotion =
    useReducedMotion();

  const nextText =
    celestialHumanTime(seconds);

  const [shown, setShown] =
    useState(nextText);

  const settle =
    useRef(
      new Animated.Value(1),
    ).current;

  useEffect(() => {
    if (nextText === shown) return;

    settle.stopAnimation();

    if (reduceMotion) {
      settle.setValue(1);
      setShown(nextText);
      return;
    }

    settle.setValue(0);
    setShown(nextText);

    Animated.timing(
      settle,
      {
        toValue: 1,
        duration: 180,
        easing:
          Easing.out(
            Easing.cubic,
          ),
        useNativeDriver: true,
      },
    ).start();
  }, [
    nextText,
    reduceMotion,
    settle,
    shown,
  ]);

  const opacity =
    settle.interpolate({
      inputRange: [0, 0.45, 1],
      outputRange: [0.78, 0.97, 1],
    });

  const translateY =
    settle.interpolate({
      inputRange: [0, 1],
      outputRange: [1.5, 0],
    });

  const scale =
    settle.interpolate({
      inputRange: [0, 1],
      outputRange: [0.994, 1],
    });

  return (
    <Animated.Text
      accessibilityLabel={
        'Trajanje aktivne sesije ' +
        nextText
      }
      style={[
        styles.celestialSeamlessTime,
        {
          opacity:
            reduceMotion
              ? 1
              : opacity,
          transform:
            reduceMotion
              ? []
              : [
                  { translateY },
                  { scale },
                ],
        },
      ]}
    >
      {shown}
    </Animated.Text>
  );
}

export function ActiveTimerCard({ timer, now, stopping, onOpen, onStop }: Props) {
  const sessionSeconds = getActiveSessionSeconds(timer, now);
  const totalSeconds = getLiveTotalSeconds(timer, now);

  const celestialMode =
    activeVisualSkinId === 'classic';

  // ljingleCelestialActiveNowSeamlessR12:branch
  if (celestialMode) {
    // ljingleCelestialActiveTypeLabelSplitR1:split
    const celestialLabelSeparator =
      ' — ';

    const celestialLabelIndex =
      timer.label.indexOf(
        celestialLabelSeparator,
      );

    const celestialActivityKind =
      celestialLabelIndex > 0
        ? timer.label
            .slice(
              0,
              celestialLabelIndex,
            )
            .trim()
        : null;

    const celestialActivityTitle =
      celestialLabelIndex > 0
        ? timer.label
            .slice(
              celestialLabelIndex +
                celestialLabelSeparator.length,
            )
            .trim()
        : timer.label;

    return (
      <View
        style={
          styles.celestialSeamlessRoot
        }
      >
        <Pressable
          accessibilityRole={
            onOpen
              ? 'button'
              : undefined
          }
          accessibilityLabel={
            onOpen
              ? `Otvori ${timer.label}`
              : undefined
          }
          disabled={!onOpen}
          onPress={onOpen}
          style={({ pressed }) => [
            styles.celestialSeamlessBody,
            pressed &&
              onOpen &&
              styles.celestialSeamlessPressed,
          ]}
        >
          <View
            style={
              styles.celestialSeamlessHeading
            }
          >
            <View
              style={
                styles.celestialSeamlessTitleGroup
              }
            >
              {celestialActivityKind ? (
                <Text
                  numberOfLines={1}
                  style={
                    styles.celestialSeamlessKind
                  }
                >
                  {celestialActivityKind}
                </Text>
              ) : null}

              <Text
                numberOfLines={2}
                style={
                  styles.celestialSeamlessLabel
                }
              >
                {celestialActivityTitle}
              </Text>
            </View>

            {onOpen ? (
              <Text
                style={
                  styles.celestialSeamlessOpen
                }
              >
                Otvori  ›
              </Text>
            ) : null}
          </View>

          <CelestialActiveTime
            seconds={sessionSeconds}
          />

          <View
            style={
              styles.celestialSeamlessTotalRow
            }
          >
            <Text
              style={
                styles.celestialSeamlessTotalLabel
              }
            >
              Ukupno praćeno
            </Text>

            <Text
              style={
                styles.celestialSeamlessTotalValue
              }
            >
              {celestialHumanTime(
                totalSeconds,
              )}
            </Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            `Zaustavi ${timer.label}`
          }
          disabled={stopping}
          hitSlop={18}
          onPress={onStop}
          style={({ pressed }) => [
            styles.celestialSeamlessStop,
            pressed &&
              !stopping &&
              styles.celestialSeamlessStopPressed,
            stopping &&
              styles.celestialSeamlessStopDisabled,
          ]}
        >
          {stopping ? (
            <ActivityIndicator
              color={colors.text}
              size="small"
            />
          ) : (
            <Text
              style={
                styles.celestialSeamlessStopText
              }
            >
              Zaustavi i spremi sesiju
            </Text>
          )}
        </Pressable>
      </View>
    );
  }

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
  // ljingleCelestialActiveNowSeamlessR12:styles
  celestialSeamlessRoot: {
    marginBottom: 18,
    backgroundColor: 'transparent',
  },

  celestialSeamlessBody: {
    // ljingleCelestialTimerSmallerActionHitAreasR2:active-inset
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },

  celestialSeamlessPressed: {
    opacity: 0.72,
  },

  celestialSeamlessHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },

  celestialSeamlessTitleGroup: {
    flex: 1,
    minWidth: 0,
  },

  celestialSeamlessKind: {
    // ljingleCelestialActiveTypeLabelSplitR1:kind
    marginBottom: 1,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '500',
    letterSpacing: 0.35,
    opacity: 0.62,
  },

  celestialSeamlessLabel: {
    // ljingleCelestialActiveTypographyHierarchyR1:title
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
    letterSpacing: -0.35,
  },

  celestialSeamlessOpen: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    opacity: 0.7,
  },

  celestialSeamlessTime: {
    // ljingleCelestialActiveTypographyHierarchyR1:time
    marginTop: 11,
    marginLeft: 12,
    color: colors.text,
    fontFamily: celestialActiveTimeFont,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '400',
    fontVariant: ['oldstyle-nums'],
    letterSpacing: -0.3,
  },

  celestialSeamlessTotalRow: {
    // ljingleCelestialActiveTypographyHierarchyR1:total
    marginTop: 5,
    marginLeft: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },

  celestialSeamlessTotalLabel: {
    color: colors.textMuted,
    fontFamily: celestialActiveTimeFont,
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '400',
    fontStyle: 'italic',
    opacity: 0.58,
  },

  celestialSeamlessTotalValue: {
    color: colors.textMuted,
    fontFamily: celestialActiveTimeFont,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '400',
    fontVariant: ['oldstyle-nums'],
    opacity: 0.62,
  },

  celestialSeamlessStop: {
    // ljingleCelestialTimerSmallerActionHitAreasR2:active-stop
    alignSelf: 'flex-start',
    minHeight: 52,
    minWidth: 156,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },

  celestialSeamlessStopText: {
    color: colors.textMuted,
    fontFamily: celestialActiveTimeFont,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '400',
    fontStyle: 'italic',
    opacity: 0.6,
  },

  celestialSeamlessStopPressed: {
    opacity: 0.42,
  },

  celestialSeamlessStopDisabled: {
    opacity: 0.36,
  },

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
    backgroundColor: colors.navySoft,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.94)',
    shadowColor: colors.navySoft,
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
    color: colors.onAccent,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  time: {
    marginTop: 17,
    color: colors.onAccent,
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

// ljingleCelestialActiveNowSeamlessR12

// ljingleCelestialTimerFitRecentContinueTargetR1:active

// ljingleCelestialTimerSmallerActionHitAreasR2:active

// ljingleCelestialActiveTypographyHierarchyR1

// ljingleCelestialActiveTypeLabelSplitR1

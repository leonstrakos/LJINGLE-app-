import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { colors } from '../theme/colors';
import { LivingSandglass } from './LivingSandglass';

type Props = {
  accentColor: string;
  busy: boolean;
  running: boolean;
  seconds: number;
  onToggle: () => void;
};

type RollingNumberProps = {
  value: string;
  accentColor: string;
  large?: boolean;
  reduceMotion: boolean;
};

function useReducedMotion() {
  const [reduceMotion, setReduceMotion] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo
      .isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => undefined);

    const subscription =
      AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        setReduceMotion,
      );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

function RollingNumber({
  value,
  accentColor,
  large = false,
  reduceMotion,
}: RollingNumberProps) {
  const [current, setCurrent] =
    useState(value);

  const settle =
    useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (value === current) return;

    /*
     * ljingleLivingTimerCalmNumeralsR1
     *
     * There is no previous-number layer anymore.
     * A new tick replaces the old digit immediately and gets one very short
     * ease-out settle. stopAnimation() means an unexpected fast update can
     * never queue visual work or "catch up" afterward.
     */
    settle.stopAnimation();

    if (reduceMotion) {
      settle.setValue(1);
      setCurrent(value);
      return;
    }

    settle.setValue(0);
    setCurrent(value);

    Animated.timing(settle, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [
    current,
    reduceMotion,
    settle,
    value,
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

  const textStyle =
    large
      ? styles.largeNumber
      : styles.smallNumber;

  return (
    <View
      accessible={false}
      style={[
        styles.numberStack,
        large
          ? styles.numberStackLarge
          : styles.numberStackSmall,
      ]}
    >
      <Animated.Text
        style={[
          textStyle,
          {
            color: accentColor,
            opacity: reduceMotion
              ? 1
              : opacity,
            transform: reduceMotion
              ? []
              : [
                  { translateY },
                  { scale },
                ],
          },
        ]}
      >
        {current}
      </Animated.Text>
    </View>
  );
}

export function LivingTimerDisplay({
  accentColor,
  busy,
  running,
  seconds,
  onToggle,
}: Props) {
  const reduceMotion =
    useReducedMotion();
  const pulse =
    useRef(new Animated.Value(0)).current;
  const entrance =
    useRef(
      new Animated.Value(running ? 1 : 0),
    ).current;

  // ljinglePersistentSandglassLayoutSlideR1:persistent-follower
  const sandglassX =
    useRef(new Animated.Value(0)).current;
  const sandglassY =
    useRef(new Animated.Value(0)).current;
  const sandglassReadyRef =
    useRef(false);
  const [sandglassReady, setSandglassReady] =
    useState(false);

  const safeSeconds =
    Math.max(
      0,
      Math.floor(
        Number.isFinite(seconds)
          ? seconds
          : 0,
      ),
    );

  // Never show a stopwatch-like leading zero after Start.
  // The first visual beat is "1", then real elapsed seconds take over.
  const livingSeconds =
    running
      ? Math.max(1, safeSeconds)
      : 0;

  const hours =
    Math.floor(livingSeconds / 3600);
  const minutes =
    Math.floor(
      (livingSeconds % 3600) / 60,
    );
  const secondPart =
    livingSeconds % 60;

  useEffect(() => {
    if (!running) {
      entrance.stopAnimation();
      entrance.setValue(0);
      return;
    }

    if (reduceMotion) {
      entrance.stopAnimation();
      entrance.setValue(1);
      return;
    }

    entrance.stopAnimation();
    entrance.setValue(0);

    Animated.timing(entrance, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [
    entrance,
    reduceMotion,
    running,
  ]);

  useEffect(() => {
    if (!running || reduceMotion) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }

    pulse.stopAnimation();
    pulse.setValue(0);

    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: 330,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    livingSeconds,
    pulse,
    reduceMotion,
    running,
  ]);

  const pulseScale =
    pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.45],
    });

  const pulseOpacity =
    pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.38, 0.78],
    });

  const entranceOpacity =
    entrance.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

  const entranceY =
    entrance.interpolate({
      inputRange: [0, 1],
      outputRange: [5, 0],
    });

  const handleSandglassAnchorLayout = (
    event: LayoutChangeEvent,
  ) => {
    const { x, y } =
      event.nativeEvent.layout;

    sandglassX.stopAnimation();
    sandglassY.stopAnimation();

    if (
      !sandglassReadyRef.current ||
      reduceMotion
    ) {
      sandglassX.setValue(x);
      sandglassY.setValue(y);

      if (!sandglassReadyRef.current) {
        sandglassReadyRef.current = true;
        setSandglassReady(true);
      }

      return;
    }

    Animated.parallel([
      Animated.timing(sandglassX, {
        toValue: x,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sandglassY, {
        toValue: y,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const toggle = (event: {
    stopPropagation: () => void;
  }) => {
    event.stopPropagation();
    if (!busy) onToggle();
  };

  return (
    <View
      accessibilityLabel={
        running
          ? 'Timer je aktivan'
          : 'Timer nije pokrenut'
      }
      style={styles.root}
    >
      <View
        pointerEvents="none"
        style={styles.trace}
      >
        <View
          style={[
            styles.traceLine,
            {
              backgroundColor: accentColor,
            },
          ]}
        />
        <View
          style={[
            styles.tracePoint,
            {
              backgroundColor: accentColor,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.tracePulse,
            {
              borderColor: accentColor,
              opacity: pulseOpacity,
              transform: [
                { scale: pulseScale },
              ],
            },
          ]}
        />
      </View>

      <Text style={styles.eyebrow}>
        TIMER
      </Text>

      {!running ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pokreni timer"
          disabled={busy}
          onPress={toggle}
          style={({ pressed }) => [
            styles.idleAction,
            pressed &&
              !busy &&
              styles.pressed,
            busy &&
              styles.disabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator
              color={accentColor}
              size="small"
            />
          ) : (
            <Text
              style={[
                styles.start,
                {
                  color: accentColor,
                },
              ]}
            >
              {'Start\u00A0'}
            </Text>
          )}
        </Pressable>
      ) : (
        <Animated.View
          style={[
            styles.runningBody,
            {
              opacity:
                reduceMotion
                  ? 1
                  : entranceOpacity,
              transform: [
                {
                  translateY:
                    reduceMotion
                      ? 0
                      : entranceY,
                },
              ],
            },
          ]}
        >
          <View style={styles.timeStage}>
          {hours === 0 &&
          minutes === 0 ? (
            <View style={styles.timeRow}>
              <RollingNumber
                accentColor={accentColor}
                large
                reduceMotion={reduceMotion}
                value={String(
                  livingSeconds,
                )}
              />
              <Text style={styles.unit}>
                sec
              </Text>
              <View
                onLayout={
                  handleSandglassAnchorLayout
                }
                style={styles.sandglassAnchor}
              />
            </View>
          ) : hours === 0 ? (
            <View style={styles.timeRow}>
              <Text
                style={[
                  styles.primaryNumber,
                  {
                    color: accentColor,
                  },
                ]}
              >
                {minutes}
              </Text>
              <Text style={styles.unit}>
                min
              </Text>
              <RollingNumber
                accentColor={accentColor}
                reduceMotion={reduceMotion}
                value={String(
                  secondPart,
                )}
              />
              <Text style={styles.secondsUnit}>
                sec
              </Text>
              <View
                onLayout={
                  handleSandglassAnchorLayout
                }
                style={styles.sandglassAnchor}
              />
            </View>
          ) : (
            <View style={styles.timeRow}>
              <Text
                style={[
                  styles.primaryNumber,
                  {
                    color: accentColor,
                  },
                ]}
              >
                {hours}
              </Text>
              <Text style={styles.unit}>
                h
              </Text>
              <Text
                style={[
                  styles.secondaryNumber,
                  {
                    color: accentColor,
                  },
                ]}
              >
                {minutes}
              </Text>
              <Text style={styles.unit}>
                min
              </Text>
              <RollingNumber
                accentColor={accentColor}
                reduceMotion={reduceMotion}
                value={String(
                  secondPart,
                )}
              />
              <Text style={styles.secondsUnit}>
                sec
              </Text>
              <View
                onLayout={
                  handleSandglassAnchorLayout
                }
                style={styles.sandglassAnchor}
              />
            </View>
          )}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.sandglassFollower,
                {
                  opacity:
                    sandglassReady ? 1 : 0,
                  transform: [
                    {
                      translateX:
                        sandglassX,
                    },
                    {
                      translateY:
                        sandglassY,
                    },
                  ],
                },
              ]}
            >
              <LivingSandglass
                accentColor={accentColor}
                reduceMotion={reduceMotion}
                seconds={livingSeconds}
              />
            </Animated.View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zaustavi timer"
            disabled={busy}
            onPress={toggle}
            style={({ pressed }) => [
              styles.stopAction,
              pressed &&
                !busy &&
                styles.pressed,
              busy &&
                styles.disabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator
                color={accentColor}
                size="small"
              />
            ) : (
              <Text
                style={[
                  styles.stop,
                  {
                    color: accentColor,
                  },
                ]}
              >
                Stop
              </Text>
            )}
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const sandglassFont =
  Platform.select({
    ios: 'Georgia',
    android: 'serif',
    web: 'Georgia, Times New Roman, serif',
    default: 'serif',
  });

// ljingleLivingTimerSandglassRadioCleanR1:timer
const styles =
  StyleSheet.create({
    root: {
      minHeight: 116,
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingHorizontal: 3,
      paddingVertical: 5,
    },

    trace: {
      height: 14,
      minWidth: 112,
      marginBottom: 7,
      justifyContent: 'center',
    },

    traceLine: {
      width: 92,
      height: StyleSheet.hairlineWidth,
      opacity: 0.24,
    },

    tracePoint: {
      position: 'absolute',
      left: 88,
      width: 5,
      height: 5,
      borderRadius: 3,
      opacity: 0.62,
    },

    tracePulse: {
      position: 'absolute',
      left: 84.5,
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 1,
    },

    eyebrow: {
      color: colors.textMuted,
      fontFamily: sandglassFont,
      fontSize: 8,
      lineHeight: 11,
      fontWeight: '400',
      fontStyle: 'italic',
      letterSpacing: 0.85,
      opacity: 0.48,
    },

    idleAction: {
      minHeight: 50,
      minWidth: 92,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },

    start: {
      fontFamily: sandglassFont,
      fontSize: 27,
      lineHeight: 34,
      fontWeight: '400',
      fontStyle: 'italic',
      letterSpacing: 0.15,
    },

    runningBody: {
      minHeight: 70,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },

    // ljinglePersistentSandglassLayoutSlideR1:layout
    timeStage: {
      position: 'relative',
      alignSelf: 'flex-start',
      minHeight: 50,
      overflow: 'visible',
    },

    /*
     * LivingSandglass itself is 28px wide with marginLeft:11.
     * 39px preserves its old outer row footprint without rendering it here.
     */
    sandglassAnchor: {
      width: 39,
      height: 38,
      marginBottom: 3,
      alignSelf: 'center',
      flexShrink: 0,
    },

    sandglassFollower: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 39,
      height: 41,
      zIndex: 2,
    },

    timeRow: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'baseline',
    },

    numberStack: {
      justifyContent: 'center',
      overflow: 'visible',
    },

    numberStackLarge: {
      // ljingleLivingTimerSandglassAnchorR1: large seconds occupy one stable slot
      width: 56,
      minHeight: 48,
      flexShrink: 0,
    },

    numberStackSmall: {
      // ljingleLivingTimerSandglassAnchorR1: small seconds occupy one stable slot
      width: 28,
      minHeight: 32,
      marginLeft: 8,
      flexShrink: 0,
    },

    numberLayer: {
      position: 'absolute',
      left: 0,
      top: 0,
    },

    largeNumber: {
      fontFamily: sandglassFont,
      fontSize: 46,
      lineHeight: 52,
      fontWeight: '400',
      fontVariant: ['oldstyle-nums'],
      letterSpacing: -0.65,
    },

    smallNumber: {
      fontFamily: sandglassFont,
      fontSize: 21,
      lineHeight: 29,
      fontWeight: '400',
      fontVariant: ['oldstyle-nums'],
      letterSpacing: 0,
    },

    primaryNumber: {
      fontFamily: sandglassFont,
      fontSize: 40,
      lineHeight: 47,
      fontWeight: '400',
      fontVariant: ['oldstyle-nums'],
      letterSpacing: -0.5,
    },

    secondaryNumber: {
      marginLeft: 8,
      fontFamily: sandglassFont,
      fontSize: 25,
      lineHeight: 33,
      fontWeight: '400',
      fontVariant: ['oldstyle-nums'],
      letterSpacing: -0.1,
    },

    unit: {
      marginLeft: 4,
      color: colors.textMuted,
      fontFamily: sandglassFont,
      fontSize: 10,
      lineHeight: 16,
      fontWeight: '400',
      fontStyle: 'italic',
      letterSpacing: 0.2,
      opacity: 0.7,
    },

    secondsUnit: {
      marginLeft: 3,
      color: colors.textMuted,
      fontFamily: sandglassFont,
      fontSize: 9,
      lineHeight: 13,
      fontWeight: '400',
      fontStyle: 'italic',
      letterSpacing: 0.15,
      opacity: 0.48,
    },

    stopAction: {
      minHeight: 31,
      minWidth: 62,
      marginTop: 1,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },

    stop: {
      fontFamily: sandglassFont,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '400',
      fontStyle: 'italic',
      letterSpacing: 0.15,
      opacity: 0.68,
    },

    pressed: {
      opacity: 0.48,
      transform: [
        { scale: 0.985 },
      ],
    },

    disabled: {
      opacity: 0.45,
    },
  });

// ljingleLivingConstellationTimerR1

// ljingleLivingTimerLegacyStartCleanR11:timer

// ljingleLivingSandglassQuickTimerCleanR11:timer

// ljingleLivingTimerCalmNumeralsR1

// ljingleLivingTimerSandglassAnchorR1

// ljinglePersistentSandglassLayoutSlideR1

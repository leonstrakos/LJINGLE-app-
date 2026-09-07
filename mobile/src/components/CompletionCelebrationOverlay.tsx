// ljingleStarSystemR1
// completionCelebrationStarsOnlyR3
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import {
  LjingleStar,
} from './LjingleStar';

import {
  subscribeCompletionCelebration,
} from '../services/completionCelebration';

import {
  activeAccentColor,
  colors,
} from '../theme/colors';

import {
  useReducedMotion,
} from '../utils/useReducedMotion';

const STARS = [
  {
    dx: -142,
    dy: -138,
    size: 25,
    delay: 0.00,
    tone: 'accent',
    variant: 'spark',
  },
  {
    dx: -54,
    dy: -172,
    size: 17,
    delay: 0.03,
    tone: 'soft',
    variant: 'glint',
  },
  {
    dx: 34,
    dy: -158,
    size: 29,
    delay: 0.01,
    tone: 'accent',
    variant: 'spark',
  },
  {
    dx: 132,
    dy: -126,
    size: 18,
    delay: 0.05,
    tone: 'soft',
    variant: 'glint',
  },
  {
    dx: 164,
    dy: -44,
    size: 24,
    delay: 0.02,
    tone: 'soft',
    variant: 'spark',
  },
  {
    dx: 148,
    dy: 72,
    size: 16,
    delay: 0.06,
    tone: 'soft',
    variant: 'glint',
  },
  {
    dx: 82,
    dy: 150,
    size: 25,
    delay: 0.04,
    tone: 'accent',
    variant: 'spark',
  },
  {
    dx: -6,
    dy: 170,
    size: 17,
    delay: 0.07,
    tone: 'soft',
    variant: 'glint',
  },
  {
    dx: -104,
    dy: 142,
    size: 27,
    delay: 0.02,
    tone: 'soft',
    variant: 'spark',
  },
  {
    dx: -162,
    dy: 66,
    size: 16,
    delay: 0.05,
    tone: 'soft',
    variant: 'glint',
  },
  {
    dx: -174,
    dy: -34,
    size: 23,
    delay: 0.01,
    tone: 'accent',
    variant: 'spark',
  },
  {
    dx: 78,
    dy: 58,
    size: 18,
    delay: 0.08,
    tone: 'soft',
    variant: 'glint',
  },
] as const;

export function CompletionCelebrationOverlay() {
  const reducedMotion =
    useReducedMotion();

  const [
    eventId,
    setEventId,
  ] =
    useState<number | null>(
      null,
    );

  const progress =
    useRef(
      new Animated.Value(0),
    ).current;

  const currentId =
    useRef(0);

  useEffect(() => {
    const unsubscribe =
      subscribeCompletionCelebration(
        (next) => {
          currentId.current =
            next.id;

          setEventId(
            next.id,
          );

          progress.stopAnimation();
          progress.setValue(0);

          Animated.timing(
            progress,
            {
              toValue: 1,
              duration:
                reducedMotion
                  ? 420
                  : 920,
              easing:
                Easing.out(
                  Easing.cubic,
                ),
              useNativeDriver:
                Platform.OS !==
                'web',
            },
          ).start(
            ({ finished }) => {
              if (
                finished &&
                currentId.current ===
                  next.id
              ) {
                setEventId(
                  null,
                );
              }
            },
          );
        },
      );

    return () => {
      unsubscribe();
    };
  }, [
    progress,
    reducedMotion,
  ]);

  if (eventId === null) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={styles.overlay}
    >
      <View style={styles.origin}>
        {STARS.map(
          (star, index) => {
            const start =
              Math.max(
                0.001,
                star.delay,
              );

            const burst =
              Math.min(
                0.26,
                start + 0.14,
              );

            const opacity =
              progress.interpolate({
                inputRange: [
                  0,
                  start,
                  burst,
                  0.72,
                  1,
                ],
                outputRange: [
                  0,
                  0,
                  1,
                  star.tone ===
                  'accent'
                    ? 0.92
                    : 0.62,
                  0,
                ],
              });

            const translateX =
              reducedMotion
                ? 0
                : progress.interpolate(
                    {
                      inputRange: [
                        0,
                        burst,
                        1,
                      ],
                      outputRange: [
                        0,
                        star.dx *
                          0.32,
                        star.dx,
                      ],
                    },
                  );

            const translateY =
              reducedMotion
                ? 0
                : progress.interpolate(
                    {
                      inputRange: [
                        0,
                        burst,
                        1,
                      ],
                      outputRange: [
                        0,
                        star.dy *
                          0.32,
                        star.dy,
                      ],
                    },
                  );

            const scale =
              progress.interpolate({
                inputRange: [
                  0,
                  start,
                  burst,
                  0.46,
                  0.76,
                  1,
                ],
                outputRange: [
                  0.14,
                  0.14,
                  1.52,
                  1.08,
                  0.96,
                  0.68,
                ],
              });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.star,
                  {
                    left:
                      -star.size /
                      2,
                    top:
                      -star.size /
                      2,
                    width:
                      star.size,
                    height:
                      star.size,
                    opacity,
                    transform:
                      reducedMotion
                        ? [
                            {
                              scale,
                            },
                          ]
                        : [
                            {
                              translateX,
                            },
                            {
                              translateY,
                            },
                            {
                              scale,
                            },
                          ],
                  },
                ]}
              >
                <LjingleStar
                  size={star.size}
                  variant={
                    star.variant
                  }
                  color={
                    star.tone ===
                    'accent'
                      ? activeAccentColor
                      : colors.text
                  }
                  opacity={
                    star.tone ===
                    'accent'
                      ? 1
                      : 0.72
                  }
                />
              </Animated.View>
            );
          },
        )}
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 100000,
      elevation: 100000,
      alignItems: 'center',
      justifyContent: 'center',
    },

    origin: {
      width: 1,
      height: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    star: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

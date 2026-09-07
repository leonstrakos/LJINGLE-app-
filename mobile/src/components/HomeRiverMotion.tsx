// ljingleHomeRiverMotionR2
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  LjingleStar,
} from './LjingleStar';

import {
  colors,
} from '../theme/colors';

type RiverParticle = {
  left: string;
  top: number;
  size: number;
  opacity: number;
  driftX: number;
  driftY: number;
  duration: number;
  delay: number;
  variant: 'spark' | 'dot';
  bright: boolean;
};

const RIVER_PARTICLES:
  RiverParticle[] = [
    {
      left: '2%',
      top: 22,
      size: 4,
      opacity: 0.25,
      driftX: 58,
      driftY: 102,
      duration: 13600,
      delay: 500,
      variant: 'spark',
      bright: false,
    },
    {
      left: '11%',
      top: 62,
      size: 2,
      opacity: 0.18,
      driftX: 74,
      driftY: 126,
      duration: 16700,
      delay: 3200,
      variant: 'dot',
      bright: false,
    },
    {
      left: '20%',
      top: 14,
      size: 8,
      opacity: 0.44,
      driftX: 52,
      driftY: 142,
      duration: 15100,
      delay: 1600,
      variant: 'spark',
      bright: true,
    },
    {
      left: '30%',
      top: 112,
      size: 5,
      opacity: 0.30,
      driftX: 86,
      driftY: 116,
      duration: 18100,
      delay: 4900,
      variant: 'spark',
      bright: false,
    },
    {
      left: '41%',
      top: 44,
      size: 2,
      opacity: 0.17,
      driftX: 68,
      driftY: 164,
      duration: 17300,
      delay: 900,
      variant: 'dot',
      bright: false,
    },
    {
      left: '49%',
      top: 135,
      size: 10,
      opacity: 0.40,
      driftX: 92,
      driftY: 128,
      duration: 18800,
      delay: 6100,
      variant: 'spark',
      bright: true,
    },
    {
      left: '60%',
      top: 30,
      size: 4,
      opacity: 0.26,
      driftX: 62,
      driftY: 174,
      duration: 15900,
      delay: 3700,
      variant: 'spark',
      bright: false,
    },
    {
      left: '72%',
      top: 88,
      size: 2,
      opacity: 0.16,
      driftX: 76,
      driftY: 148,
      duration: 17900,
      delay: 1400,
      variant: 'dot',
      bright: false,
    },
    {
      left: '82%',
      top: 38,
      size: 8,
      opacity: 0.38,
      driftX: 42,
      driftY: 132,
      duration: 14300,
      delay: 7400,
      variant: 'spark',
      bright: true,
    },
    {
      left: '5%',
      top: 188,
      size: 2,
      opacity: 0.15,
      driftX: 112,
      driftY: 134,
      duration: 19300,
      delay: 8500,
      variant: 'dot',
      bright: false,
    },
    {
      left: '25%',
      top: 228,
      size: 6,
      opacity: 0.25,
      driftX: 96,
      driftY: 120,
      duration: 17700,
      delay: 4300,
      variant: 'spark',
      bright: false,
    },
    {
      left: '45%',
      top: 264,
      size: 2,
      opacity: 0.13,
      driftX: 116,
      driftY: 106,
      duration: 20100,
      delay: 9800,
      variant: 'dot',
      bright: false,
    },
    {
      left: '65%',
      top: 205,
      size: 6,
      opacity: 0.22,
      driftX: 82,
      driftY: 145,
      duration: 18600,
      delay: 5600,
      variant: 'spark',
      bright: false,
    },
    {
      left: '15%',
      top: 330,
      size: 4,
      opacity: 0.17,
      driftX: 128,
      driftY: 102,
      duration: 20700,
      delay: 11100,
      variant: 'spark',
      bright: false,
    },
    {
      left: '55%',
      top: 352,
      size: 2,
      opacity: 0.11,
      driftX: 120,
      driftY: 92,
      duration: 21800,
      delay: 7000,
      variant: 'dot',
      bright: false,
    },
  ];

function useReducedMotionPreference() {
  const [
    reduced,
    setReduced,
  ] = useState(false);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo
      .isReduceMotionEnabled()
      .then((value) => {
        if (mounted) {
          setReduced(value);
        }
      })
      .catch(() => {});

    const subscription =
      AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        setReduced,
      );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

function RiverParticleView({
  config,
}: {
  config: RiverParticle;
}) {
  const progress =
    useRef(
      new Animated.Value(0),
    ).current;

  useEffect(() => {
    const animation =
      Animated.loop(
        Animated.sequence([
          Animated.delay(
            config.delay,
          ),

          Animated.timing(
            progress,
            {
              toValue: 1,
              duration:
                config.duration,
              easing:
                Easing.inOut(
                  Easing.ease,
                ),
              useNativeDriver:
                true,
            },
          ),
        ]),
        {
          resetBeforeIteration:
            true,
        },
      );

    animation.start();

    return () => {
      animation.stop();
      progress.stopAnimation();
    };
  }, [
    config.delay,
    config.duration,
    progress,
  ]);

  const translateX =
    progress.interpolate({
      inputRange: [
        0,
        1,
      ],
      outputRange: [
        -10,
        config.driftX,
      ],
    });

  const translateY =
    progress.interpolate({
      inputRange: [
        0,
        1,
      ],
      outputRange: [
        -14,
        config.driftY,
      ],
    });

  const opacity =
    progress.interpolate({
      inputRange: [
        0,
        0.10,
        0.30,
        0.52,
        0.74,
        0.90,
        1,
      ],
      outputRange: [
        0,
        config.opacity * 0.42,
        config.opacity,
        config.opacity * 0.58,
        config.opacity * 0.92,
        config.opacity * 0.30,
        0,
      ],
    });

  const scale =
    progress.interpolate({
      inputRange: [
        0,
        0.26,
        0.53,
        0.78,
        1,
      ],
      outputRange: [
        0.74,
        1.04,
        0.84,
        1.08,
        0.72,
      ],
    });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: config.left,
        top: config.top,
        opacity,
        transform: [
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
      }}
    >
      <LjingleStar
        variant={
          config.variant
        }
        size={
          config.size
        }
        color={
          config.bright
            ? colors.text
            : colors.textMuted
        }
        opacity={1}
      />
    </Animated.View>
  );
}

function ShootingComet() {
  const {
    width,
  } = useWindowDimensions();

  const progress =
    useRef(
      new Animated.Value(0),
    ).current;

  useEffect(() => {
    const animation =
      Animated.loop(
        Animated.sequence([
          Animated.delay(5200),

          Animated.timing(
            progress,
            {
              toValue: 1,
              duration: 1080,
              easing:
                Easing.out(
                  Easing.cubic,
                ),
              useNativeDriver:
                true,
            },
          ),

          Animated.delay(10700),
        ]),
        {
          resetBeforeIteration:
            true,
        },
      );

    animation.start();

    return () => {
      animation.stop();
      progress.stopAnimation();
    };
  }, [
    progress,
  ]);

  const translateX =
    progress.interpolate({
      inputRange: [
        0,
        1,
      ],
      outputRange: [
        -120,
        width + 140,
      ],
    });

  const translateY =
    progress.interpolate({
      inputRange: [
        0,
        1,
      ],
      outputRange: [
        76,
        228,
      ],
    });

  const opacity =
    progress.interpolate({
      inputRange: [
        0,
        0.06,
        0.16,
        0.74,
        0.94,
        1,
      ],
      outputRange: [
        0,
        0,
        0.94,
        0.78,
        0.18,
        0,
      ],
    });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.comet,
        {
          opacity,
          transform: [
            {
              translateX,
            },
            {
              translateY,
            },
            {
              rotate: '18deg',
            },
          ],
        },
      ]}
    >
      <View
        style={
          styles.cometTrailFar
        }
      />

      <View
        style={
          styles.cometTrailMid
        }
      />

      <View
        style={
          styles.cometTrailNear
        }
      />

      <View
        style={
          styles.cometHead
        }
      >
        <LjingleStar
          variant="spark"
          size={11}
          color={colors.text}
          opacity={1}
        />
      </View>
    </Animated.View>
  );
}

export function HomeRiverMotion() {
  const reducedMotion =
    useReducedMotionPreference();

  const particles =
    useMemo(
      () => RIVER_PARTICLES,
      [],
    );

  if (reducedMotion) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={styles.layer}
    >
      {particles.map(
        (
          config,
          index,
        ) => (
          <RiverParticleView
            key={
              'river-' +
              index
            }
            config={
              config
            }
          />
        ),
      )}

      <ShootingComet />
    </View>
  );
}

const styles =
  StyleSheet.create({
    layer: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },

    comet: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 116,
      height: 24,
    },

    cometTrailFar: {
      position: 'absolute',
      right: 12,
      top: 11,
      width: 98,
      height: 1,
      borderRadius: 1,
      backgroundColor:
        colors.textMuted,
      opacity: 0.10,
    },

    cometTrailMid: {
      position: 'absolute',
      right: 10,
      top: 11,
      width: 62,
      height: 1,
      borderRadius: 1,
      backgroundColor:
        colors.text,
      opacity: 0.23,
    },

    cometTrailNear: {
      position: 'absolute',
      right: 8,
      top: 10.75,
      width: 32,
      height: 1.5,
      borderRadius: 1,
      backgroundColor:
        colors.text,
      opacity: 0.52,
    },

    cometHead: {
      position: 'absolute',
      right: 0,
      top: 5.5,
      width: 13,
      height: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

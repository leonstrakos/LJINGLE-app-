// ljingleCelestialMotionLanguageR1
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
  useRef,
  useState,
} from 'react';

import {
  LjingleStar,
} from './LjingleStar';

import {
  colors,
} from '../theme/colors';

import {
  activeVisualSkinId,
} from '../theme/visualSkins';
import { resetCelestialParallax } from '../motion/celestialParallax';

export type CelestialMotionPreset =
  | 'catalogue'
  | 'books'
  | 'media'
  | 'games'
  | 'entries'
  | 'topics'
  | 'collections'
  | 'profile'
  | 'radio'
  | 'capsule';

type Props = {
  preset: CelestialMotionPreset;
  active?: boolean;
};

type DriftConfig = {
  left: string;
  top: string;
  size: number;
  opacity: number;
  dx: number;
  dy: number;
  duration: number;
  delay: number;
  variant: 'spark' | 'dot';
  bright: boolean;
};

type GatherConfig = {
  left: number;
  top: number;
  size: number;
  opacity: number;
  bright: boolean;
};

function noise(
  seed: number,
  index: number,
  salt: number,
) {
  const value =
    Math.sin(
      seed * 12.9898 +
      index * 78.233 +
      salt * 39.425,
    ) * 43758.5453;

  return (
    value -
    Math.floor(value)
  );
}

function useReducedMotionPreference() {
  const [
    reduced,
    setReduced,
  ] = useState(false);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo
      .isReduceMotionEnabled()
      .then(
        value => {
          if (mounted) {
            setReduced(value);
          }
        },
      )
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

/* =========================================================
   DRIFT GENERATORS
   ========================================================= */

function buildDrift(
  seed: number,
  count: number,
  kind:
    | 'current'
    | 'page'
    | 'projector'
    | 'game'
    | 'cosmic'
    | 'signal',
): DriftConfig[] {
  return Array.from(
    {
      length: count,
    },

    (_, index) => {
      const x =
        noise(
          seed,
          index,
          1,
        );

      const y =
        noise(
          seed,
          index,
          2,
        );

      const strength =
        noise(
          seed,
          index,
          3,
        );

      const scale =
        noise(
          seed,
          index,
          4,
        );

      const speed =
        noise(
          seed,
          index,
          5,
        );

      const tiny =
        noise(
          seed,
          index,
          6,
        ) < 0.43;

      let dx = 30;
      let dy = 25;
      let duration =
        14000;

      if (
        kind === 'current'
      ) {
        dx =
          60 +
          strength * 76;

        dy =
          -8 +
          y * 22;

        duration =
          13000 +
          speed * 8000;
      }

      if (
        kind === 'page'
      ) {
        dx =
          14 +
          strength * 34;

        dy =
          58 +
          y * 86;

        duration =
          16500 +
          speed * 9000;
      }

      if (
        kind === 'projector'
      ) {
        dx =
          72 +
          strength * 96;

        dy =
          -7 +
          y * 18;

        duration =
          15000 +
          speed * 10000;
      }

      if (
        kind === 'game'
      ) {
        dx =
          20 +
          strength * 42;

        dy =
          22 +
          y * 62;

        duration =
          14500 +
          speed * 8000;
      }

      if (
        kind === 'cosmic'
      ) {
        dx =
          28 +
          strength * 70;

        dy =
          30 +
          y * 95;

        duration =
          13500 +
          speed * 10000;
      }

      if (
        kind === 'signal'
      ) {
        dx =
          86 +
          strength * 120;

        dy =
          -5 +
          y * 16;

        duration =
          5200 +
          speed * 4400;
      }

      return {
        left:
          (
            2 +
            x * 92
          ).toFixed(2) +
          '%',

        top:
          (
            4 +
            y * 84
          ).toFixed(2) +
          '%',

        size:
          tiny
            ? 1.2 +
              scale * 1.8
            : 5 +
              scale * 8,

        opacity:
          tiny
            ? 0.10 +
              strength * 0.17
            : 0.24 +
              strength * 0.36,

        dx,
        dy,
        duration,

        delay:
          noise(
            seed,
            index,
            7,
          ) * duration,

        variant:
          tiny
            ? 'dot'
            : 'spark',

        bright:
          !tiny &&
          strength > 0.54,
      };
    },
  );
}

function buildGather(
  seed: number,
  count: number,
): GatherConfig[] {
  return Array.from(
    {
      length: count,
    },

    (_, index) => ({
      left:
        4 +
        noise(
          seed,
          index,
          1,
        ) * 92,

      top:
        7 +
        noise(
          seed,
          index,
          2,
        ) * 80,

      size:
        4 +
        noise(
          seed,
          index,
          3,
        ) * 8,

      opacity:
        0.22 +
        noise(
          seed,
          index,
          4,
        ) * 0.38,

      bright:
        noise(
          seed,
          index,
          5,
        ) > 0.63,
    }),
  );
}

const catalogueParticles =
  buildDrift(
    37,
    11,
    'current',
  );

const bookParticles =
  buildDrift(
    11,
    14,
    'page',
  );

const mediaParticles =
  buildDrift(
    23,
    7,
    'projector',
  );

const gameParticles =
  buildDrift(
    29,
    10,
    'game',
  );

const profileParticles =
  buildDrift(
    59,
    19,
    'cosmic',
  );

const radioParticles =
  buildDrift(
    47,
    11,
    'signal',
  );

const entryParticles =
  buildGather(
    17,
    11,
  );

const topicParticles =
  buildGather(
    31,
    11,
  );

const collectionParticles =
  buildGather(
    41,
    13,
  );

/* =========================================================
   BASIC DRIFT
   ========================================================= */

function DriftParticle({
  config,
}: {
  config: DriftConfig;
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
        -16,
        config.dx,
      ],
    });

  const translateY =
    progress.interpolate({
      inputRange: [
        0,
        1,
      ],

      outputRange: [
        -10,
        config.dy,
      ],
    });

  const opacity =
    progress.interpolate({
      inputRange: [
        0,
        0.12,
        0.34,
        0.62,
        0.84,
        1,
      ],

      outputRange: [
        0,
        config.opacity * 0.52,
        config.opacity,
        config.opacity * 0.62,
        config.opacity * 0.32,
        0,
      ],
    });

  const scale =
    progress.interpolate({
      inputRange: [
        0,
        0.28,
        0.53,
        0.76,
        1,
      ],

      outputRange: [
        0.76,
        1.04,
        0.88,
        1.08,
        0.74,
      ],
    });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position:
          'absolute',

        left:
          config.left,

        top:
          config.top,

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

function DriftField({
  particles,
}: {
  particles: DriftConfig[];
}) {
  return (
    <>
      {particles.map(
        (
          item,
          index,
        ) => (
          <DriftParticle
            key={
              'drift-' +
              index
            }

            config={
              item
            }
          />
        ),
      )}
    </>
  );
}

/* =========================================================
   CATALOGUE â€” CURRENT / REFLECTION WAVE
   ========================================================= */

function ReflectionWave({
  width,
}: {
  width: number;
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
            3500,
          ),

          Animated.timing(
            progress,
            {
              toValue: 1,
              duration: 5600,
              easing:
                Easing.inOut(
                  Easing.cubic,
                ),
              useNativeDriver:
                true,
            },
          ),

          Animated.delay(
            7200,
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
    progress,
  ]);

  const translateX =
    progress.interpolate({
      inputRange: [
        0,
        1,
      ],

      outputRange: [
        -90,
        width + 80,
      ],
    });

  const opacity =
    progress.interpolate({
      inputRange: [
        0,
        0.10,
        0.34,
        0.72,
        0.92,
        1,
      ],

      outputRange: [
        0,
        0.16,
        0.72,
        0.48,
        0.10,
        0,
      ],
    });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.waveCluster,
        {
          opacity,

          transform: [
            {
              translateX,
            },
          ],
        },
      ]}
    >
      <LjingleStar
        variant="spark"
        size={5}
        color={colors.textMuted}
        opacity={0.62}
        style={
          styles.waveOne
        }
      />

      <LjingleStar
        variant="spark"
        size={11}
        color={colors.text}
        opacity={0.92}
        style={
          styles.waveTwo
        }
      />

      <LjingleStar
        variant="dot"
        size={2}
        color={colors.textMuted}
        opacity={0.46}
        style={
          styles.waveThree
        }
      />

      <LjingleStar
        variant="spark"
        size={7}
        color={colors.text}
        opacity={0.68}
        style={
          styles.waveFour
        }
      />

      <LjingleStar
        variant="dot"
        size={1.5}
        color={colors.textMuted}
        opacity={0.34}
        style={
          styles.waveFive
        }
      />
    </Animated.View>
  );
}

/* =========================================================
   ENTRIES / TOPICS / COLLECTIONS â€” CONVERGE / GATHER
   ========================================================= */

function GatherParticle({
  config,
  width,
  strength,
  duration,
}: {
  config: GatherConfig;
  width: number;
  strength: number;
  duration: number;
}) {
  const progress =
    useRef(
      new Animated.Value(0),
    ).current;

  useEffect(() => {
    const animation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            progress,
            {
              toValue: 1,
              duration,
              easing:
                Easing.inOut(
                  Easing.sin,
                ),
              useNativeDriver:
                true,
            },
          ),

          Animated.timing(
            progress,
            {
              toValue: 0,
              duration:
                duration * 1.12,
              easing:
                Easing.inOut(
                  Easing.sin,
                ),
              useNativeDriver:
                true,
            },
          ),
        ]),
      );

    animation.start();

    return () => {
      animation.stop();
      progress.stopAnimation();
    };
  }, [
    duration,
    progress,
  ]);

  const towardX =
    (
      50 -
      config.left
    ) /
    100 *
    width *
    strength;

  const towardY =
    (
      50 -
      config.top
    ) *
    strength *
    0.75;

  const translateX =
    progress.interpolate({
      inputRange: [
        0,
        1,
      ],

      outputRange: [
        0,
        towardX,
      ],
    });

  const translateY =
    progress.interpolate({
      inputRange: [
        0,
        1,
      ],

      outputRange: [
        0,
        towardY,
      ],
    });

  const scale =
    progress.interpolate({
      inputRange: [
        0,
        0.54,
        1,
      ],

      outputRange: [
        0.88,
        1.07,
        0.92,
      ],
    });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position:
          'absolute',

        left:
          config.left +
          '%',

        top:
          config.top +
          '%',

        opacity:
          config.opacity,

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
        variant="spark"

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

function GatherField({
  particles,
  width,
  strength,
  duration,
}: {
  particles: GatherConfig[];
  width: number;
  strength: number;
  duration: number;
}) {
  return (
    <>
      {particles.map(
        (
          item,
          index,
        ) => (
          <GatherParticle
            key={
              'gather-' +
              index
            }

            config={
              item
            }

            width={
              width
            }

            strength={
              strength
            }

            duration={
              duration +
              index * 130
            }
          />
        ),
      )}
    </>
  );
}

/* =========================================================
   GAMES â€” SOFT SIGNAL PULSE
   ========================================================= */

function PulseDiamond({
  left,
  top,
  delay,
}: {
  left: string;
  top: string;
  delay: number;
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
            delay,
          ),

          Animated.timing(
            progress,
            {
              toValue: 1,
              duration: 2600,
              easing:
                Easing.out(
                  Easing.cubic,
                ),
              useNativeDriver:
                true,
            },
          ),

          Animated.delay(
            3700,
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
    delay,
    progress,
  ]);

  const scale =
    progress.interpolate({
      inputRange: [
        0,
        0.18,
        1,
      ],

      outputRange: [
        0.72,
        1,
        1.72,
      ],
    });

  const opacity =
    progress.interpolate({
      inputRange: [
        0,
        0.14,
        0.42,
        1,
      ],

      outputRange: [
        0,
        0.46,
        0.24,
        0,
      ],
    });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position:
          'absolute',

        left,
        top,
        opacity,

        transform: [
          {
            scale,
          },
        ],
      }}
    >
      <LjingleStar
        variant="spark"
        size={14}
        color={colors.text}
        opacity={1}
      />
    </Animated.View>
  );
}

/* =========================================================
   MEDIA / PROFILE â€” FAST STREAK
   ========================================================= */

function FastStreak({
  width,
  profile = false,
}: {
  width: number;
  profile?: boolean;
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
            profile
              ? 11800
              : 7600,
          ),

          Animated.timing(
            progress,
            {
              toValue: 1,

              duration:
                profile
                  ? 1180
                  : 820,

              easing:
                Easing.out(
                  Easing.cubic,
                ),

              useNativeDriver:
                true,
            },
          ),

          Animated.delay(
            profile
              ? 9800
              : 11200,
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
    profile,
    progress,
  ]);

  const translateX =
    progress.interpolate({
      inputRange: [
        0,
        1,
      ],

      outputRange: [
        -130,
        width + 150,
      ],
    });

  const translateY =
    progress.interpolate({
      inputRange: [
        0,
        1,
      ],

      outputRange:
        profile
          ? [
              18,
              148,
            ]
          : [
              40,
              72,
            ],
    });

  const opacity =
    progress.interpolate({
      inputRange: [
        0,
        0.07,
        0.18,
        0.78,
        0.94,
        1,
      ],

      outputRange: [
        0,
        0,
        profile
          ? 0.90
          : 0.70,
        profile
          ? 0.76
          : 0.52,
        0.15,
        0,
      ],
    });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.streak,
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
              rotate:
                profile
                  ? '17deg'
                  : '4deg',
            },
          ],
        },
      ]}
    >
      <View
        style={
          styles.streakFar
        }
      />

      <View
        style={
          styles.streakMid
        }
      />

      <View
        style={
          styles.streakNear
        }
      />

      <View
        style={
          styles.streakHead
        }
      >
        <LjingleStar
          variant="spark"
          size={
            profile
              ? 11
              : 8
          }
          color={colors.text}
          opacity={1}
        />
      </View>
    </Animated.View>
  );
}

/* =========================================================
   CAPSULE â€” SLOW CLOCK-LIKE CIRCULATION
   NO VISIBLE CIRCLE
   ========================================================= */

function CapsuleOrbit() {
  const progress =
    useRef(
      new Animated.Value(0),
    ).current;

  useEffect(() => {
    const animation =
      Animated.loop(
        Animated.timing(
          progress,
          {
            toValue: 1,
            duration: 26000,
            easing:
              Easing.linear,
            useNativeDriver:
              true,
          },
        ),
      );

    animation.start();

    return () => {
      animation.stop();
      progress.stopAnimation();
    };
  }, [
    progress,
  ]);

  const rotate =
    progress.interpolate({
      inputRange: [
        0,
        1,
      ],

      outputRange: [
        '0deg',
        '360deg',
      ],
    });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.capsuleOrbit,
        {
          transform: [
            {
              rotate,
            },
          ],
        },
      ]}
    >
      <LjingleStar
        variant="spark"
        size={4}
        color={colors.text}
        opacity={0.48}
        style={
          styles.capsuleTop
        }
      />

      <LjingleStar
        variant="dot"
        size={1.5}
        color={colors.textMuted}
        opacity={0.34}
        style={
          styles.capsuleRight
        }
      />

      <LjingleStar
        variant="spark"
        size={3}
        color={colors.textMuted}
        opacity={0.30}
        style={
          styles.capsuleBottom
        }
      />
    </Animated.View>
  );
}

/* =========================================================
   RADIO
   ========================================================= */

function RadioStatic() {
  return (
    <>
      <LjingleStar
        variant="spark"
        size={5}
        color={colors.textMuted}
        opacity={0.13}
        style={
          styles.radioStaticOne
        }
      />

      <LjingleStar
        variant="dot"
        size={1.5}
        color={colors.textMuted}
        opacity={0.12}
        style={
          styles.radioStaticTwo
        }
      />

      <LjingleStar
        variant="spark"
        size={4}
        color={colors.textMuted}
        opacity={0.11}
        style={
          styles.radioStaticThree
        }
      />

      <LjingleStar
        variant="dot"
        size={1}
        color={colors.textMuted}
        opacity={0.10}
        style={
          styles.radioStaticFour
        }
      />
    </>
  );
}

/* =========================================================
   PUBLIC COMPONENT
   ========================================================= */

export function CelestialMotionLayer({
  preset,
  active = true,
}: Props) {
  const reducedMotion =
    useReducedMotionPreference();

  // ljingleSemanticAliveR1:parallax
  useEffect(() => {
    resetCelestialParallax();
  }, []);

  const {
    width,
  } =
    useWindowDimensions();

  if (
    activeVisualSkinId !==
      'classic'
  ) {
    return null;
  }

  if (
    reducedMotion
  ) {
    return null;
  }

  if (
    preset === 'capsule'
  ) {
    return (
      <View
        pointerEvents="none"
        style={
          styles.compactLayer
        }
      >
        <CapsuleOrbit />
      </View>
    );
  }

  return (
    <View
      pointerEvents="none"
      style={styles.layer}
    >
      {preset ===
      'catalogue' ? (
        <>
          <DriftField
            particles={
              catalogueParticles
            }
          />

          <ReflectionWave
            width={width}
          />
        </>
      ) : null}

      {preset ===
      'books' ? (
        <DriftField
          particles={
            bookParticles
          }
        />
      ) : null}

      {preset ===
      'media' ? (
        <>
          <DriftField
            particles={
              mediaParticles
            }
          />

          <FastStreak
            width={width}
          />
        </>
      ) : null}

      {preset ===
      'games' ? (
        <>
          <DriftField
            particles={
              gameParticles
            }
          />

          <PulseDiamond
            left="24%"
            top="27%"
            delay={900}
          />

          <PulseDiamond
            left="72%"
            top="56%"
            delay={3500}
          />
        </>
      ) : null}

      {preset ===
      'entries' ? (
        <GatherField
          particles={
            entryParticles
          }
          width={width}
          strength={0.15}
          duration={7600}
        />
      ) : null}

      {preset ===
      'topics' ? (
        <GatherField
          particles={
            topicParticles
          }
          width={width}
          strength={0.16}
          duration={8200}
        />
      ) : null}

      {preset ===
      'collections' ? (
        <GatherField
          particles={
            collectionParticles
          }
          width={width}
          strength={0.27}
          duration={9200}
        />
      ) : null}

      {preset ===
      'profile' ? (
        <>
          <DriftField
            particles={
              profileParticles
            }
          />

          <FastStreak
            width={width}
            profile
          />
        </>
      ) : null}

      {preset ===
      'radio' ? (
        active ? (
          <>
            <DriftField
              particles={
                radioParticles
              }
            />

            <PulseDiamond
              left="68%"
              top="44%"
              delay={1400}
            />
          </>
        ) : (
          <RadioStatic />
        )
      ) : null}
    </View>
  );
}

const styles =
  StyleSheet.create({
    layer: {
      ...StyleSheet.absoluteFillObject,
      overflow:
        'hidden',
    },

    compactLayer: {
      ...StyleSheet.absoluteFillObject,
      overflow:
        'visible',
    },

    waveCluster: {
      position:
        'absolute',
      top:
        '31%',
      left: 0,
      width: 74,
      height: 42,
    },

    waveOne: {
      position:
        'absolute',
      left: 0,
      top: 18,
    },

    waveTwo: {
      position:
        'absolute',
      left: 22,
      top: 8,
    },

    waveThree: {
      position:
        'absolute',
      left: 39,
      top: 25,
    },

    waveFour: {
      position:
        'absolute',
      left: 50,
      top: 14,
    },

    waveFive: {
      position:
        'absolute',
      left: 68,
      top: 29,
    },

    streak: {
      position:
        'absolute',
      left: 0,
      top: 0,
      width: 122,
      height: 24,
    },

    streakFar: {
      position:
        'absolute',
      right: 12,
      top: 11,
      width: 104,
      height: 1,
      borderRadius: 1,
      backgroundColor:
        colors.textMuted,
      opacity: 0.09,
    },

    streakMid: {
      position:
        'absolute',
      right: 10,
      top: 11,
      width: 66,
      height: 1,
      borderRadius: 1,
      backgroundColor:
        colors.text,
      opacity: 0.20,
    },

    streakNear: {
      position:
        'absolute',
      right: 8,
      top: 10.75,
      width: 34,
      height: 1.5,
      borderRadius: 1,
      backgroundColor:
        colors.text,
      opacity: 0.48,
    },

    streakHead: {
      position:
        'absolute',
      right: 0,
      top: 5,
      width: 14,
      height: 14,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    capsuleOrbit: {
      position:
        'absolute',
      left: '50%',
      top: '50%',
      width: 46,
      height: 46,
      marginLeft: -23,
      marginTop: -23,
    },

    capsuleTop: {
      position:
        'absolute',
      left: 21,
      top: 0,
    },

    capsuleRight: {
      position:
        'absolute',
      right: 0,
      top: 22,
    },

    capsuleBottom: {
      position:
        'absolute',
      left: 8,
      bottom: 2,
    },

    radioStaticOne: {
      position:
        'absolute',
      left: '18%',
      top: '28%',
    },

    radioStaticTwo: {
      position:
        'absolute',
      left: '43%',
      top: '58%',
    },

    radioStaticThree: {
      position:
        'absolute',
      left: '70%',
      top: '34%',
    },

    radioStaticFour: {
      position:
        'absolute',
      left: '86%',
      top: '66%',
    },
  });

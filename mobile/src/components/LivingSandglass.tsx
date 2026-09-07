import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import {
  useEffect,
  useRef,
} from 'react';

type Props = {
  accentColor: string;
  seconds: number;
  reduceMotion: boolean;
};

// ljingleSandglassTrueGravity5sR11
export function LivingSandglass({
  accentColor,
  seconds,
  reduceMotion,
}: Props) {
  const safeSeconds = Math.max(
    0,
    Math.floor(
      Number.isFinite(seconds)
        ? seconds
        : 0,
    ),
  );

  const secondInMinute =
    safeSeconds % 60;

  const minuteIndex =
    Math.floor(safeSeconds / 60);

  const flipped =
    minuteIndex % 2 === 1;

  /*
   * Eleven calm transfer beats:
   *   5, 10, 15, ... 55 sec
   *
   * At 55 sec the pour is fully complete.
   * Then the glass rests for 5 sec before the minute turn.
   */
  const fiveSecondStep =
    Math.min(
      11,
      Math.floor(
        secondInMinute / 5,
      ),
    );

  const progress =
    fiveSecondStep / 11;

  /*
   * flow describes LOCAL frame occupancy:
   *
   *   flow = 0 -> local TOP full
   *   flow = 1 -> local BOTTOM full
   *
   * Upright minute: 0 -> 1.
   * Flipped minute: 1 -> 0.
   *
   * This is the gravity fix. We never counter-rotate the sand.
   */
  const targetFlow =
    flipped
      ? 1 - progress
      : progress;

  const initialFlow =
    flipped
      ? 1 - progress
      : progress;

  const flow = useRef(
    new Animated.Value(initialFlow),
  ).current;

  /*
   * Persistent physical orientation:
   *   0 -> upright
   *   1 -> whole glass rotated 180deg
   *
   * No post-flip reset.
   */
  const orientation = useRef(
    new Animated.Value(
      flipped ? 1 : 0,
    ),
  ).current;

  const grain = useRef(
    new Animated.Value(0),
  ).current;

  const lastMinute =
    useRef(minuteIndex);

  const lastDropStep =
    useRef(fiveSecondStep);

  const flipping =
    useRef(false);

  useEffect(() => {
    const minuteChanged =
      minuteIndex !==
      lastMinute.current;

    if (!minuteChanged) return;

    lastMinute.current =
      minuteIndex;

    lastDropStep.current = 0;

    grain.stopAnimation();
    grain.setValue(0);

    orientation.stopAnimation();

    const targetOrientation =
      flipped ? 1 : 0;

    if (reduceMotion) {
      orientation.setValue(
        targetOrientation,
      );

      /*
       * At a physical minute boundary the previous minute has already
       * finished at exactly the correct endpoint for the next orientation:
       *
       * upright ended at flow=1 -> flipped starts at flow=1
       * flipped ended at flow=0 -> upright starts at flow=0
       */
      flow.setValue(
        flipped ? 1 : 0,
      );

      flipping.current = false;
      return;
    }

    flipping.current = true;

    /*
     * IMPORTANT:
     * Do not alter flow here.
     * The completed reservoir travels WITH the whole glass during the turn.
     */
    Animated.timing(
      orientation,
      {
        toValue:
          targetOrientation,
        duration: 1050,
        easing: Easing.bezier(
          0.22,
          0.72,
          0.16,
          1,
        ),
        useNativeDriver: true,
      },
    ).start(({ finished }) => {
      if (finished) {
        flipping.current = false;
      }
    });
  }, [
    flipped,
    flow,
    grain,
    minuteIndex,
    orientation,
    reduceMotion,
  ]);

  useEffect(() => {
    if (flipping.current) return;

    /*
     * Grain at 5,10,15,...55 only.
     * The minute flip itself replaces a drop at 60.
     */
    const isDropBeat =
      secondInMinute > 0 &&
      secondInMinute % 5 === 0;

    if (!isDropBeat) return;

    if (
      lastDropStep.current ===
      fiveSecondStep
    ) {
      return;
    }

    lastDropStep.current =
      fiveSecondStep;

    flow.stopAnimation();
    grain.stopAnimation();

    if (reduceMotion) {
      flow.setValue(targetFlow);
      grain.setValue(0);
      return;
    }

    grain.setValue(0);

    Animated.parallel([
      Animated.timing(
        flow,
        {
          toValue: targetFlow,
          duration: 620,
          easing:
            Easing.out(
              Easing.cubic,
            ),
          useNativeDriver: true,
        },
      ),
      Animated.sequence([
        Animated.delay(90),
        Animated.timing(
          grain,
          {
            toValue: 1,
            duration: 560,
            easing:
              Easing.in(
                Easing.quad,
              ),
            useNativeDriver: true,
          },
        ),
      ]),
    ]).start(() => {
      grain.setValue(0);
    });
  }, [
    fiveSecondStep,
    flow,
    grain,
    reduceMotion,
    secondInMinute,
    targetFlow,
  ]);

  const rotation =
    orientation.interpolate({
      inputRange: [0, 1],
      outputRange: [
        '0deg',
        '180deg',
      ],
    });

  /*
   * Same hand-turned body motion you liked.
   * Because orientation now persists at either endpoint, these values are
   * zero/neutral while resting and animate only during the turn.
   */
  const liftY =
    orientation.interpolate({
      inputRange: [
        0,
        0.28,
        0.72,
        1,
      ],
      outputRange: [
        0,
        -5.5,
        -5.5,
        0,
      ],
    });

  const swayX =
    orientation.interpolate({
      inputRange: [
        0,
        0.33,
        0.68,
        1,
      ],
      outputRange: [
        0,
        2.5,
        -1.5,
        0,
      ],
    });

  const physicalScale =
    orientation.interpolate({
      inputRange: [
        0,
        0.45,
        0.55,
        1,
      ],
      outputRange: [
        1,
        0.94,
        0.94,
        1,
      ],
    });

  const topScale =
    flow.interpolate({
      inputRange: [0, 1],
      outputRange: [
        1,
        0.07,
      ],
    });

  const topOpacity =
    flow.interpolate({
      inputRange: [
        0,
        0.92,
        1,
      ],
      outputRange: [
        0.9,
        0.58,
        0.16,
      ],
    });

  const bottomScale =
    flow.interpolate({
      inputRange: [0, 1],
      outputRange: [
        0.07,
        1,
      ],
    });

  const bottomOpacity =
    flow.interpolate({
      inputRange: [
        0,
        0.08,
        1,
      ],
      outputRange: [
        0.16,
        0.58,
        0.92,
      ],
    });

  /*
   * LOCAL grain direction reverses when the whole frame is upside-down.
   *
   * Upright:
   *   local +Y == screen down.
   *
   * Flipped 180deg:
   *   local -Y == screen down.
   *
   * So the grain always obeys SCREEN gravity without any separate
   * sand-layer rotation.
   */
  const grainDistance =
    flipped ? -10 : 10;

  const grainY =
    grain.interpolate({
      inputRange: [0, 1],
      outputRange: [
        0,
        grainDistance,
      ],
    });

  const grainOpacity =
    grain.interpolate({
      inputRange: [
        0,
        0.08,
        0.86,
        1,
      ],
      outputRange: [
        0,
        0.96,
        0.96,
        0,
      ],
    });

  const grainScale =
    grain.interpolate({
      inputRange: [
        0,
        0.28,
        1,
      ],
      outputRange: [
        0.72,
        1,
        0.74,
      ],
    });

  /*
   * Hide the grain during the hand-turn.
   * Stable endpoints are fully visible.
   */
  const pourOpacity =
    orientation.interpolate({
      inputRange: [
        0,
        0.12,
        0.88,
        1,
      ],
      outputRange: [
        1,
        0,
        0,
        1,
      ],
    });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no"
      pointerEvents="none"
      style={[
        styles.root,
        {
          opacity: 0.94,
          transform: reduceMotion
            ? []
            : [
                {
                  translateX:
                    swayX,
                },
                {
                  translateY:
                    liftY,
                },
                {
                  rotate:
                    rotation,
                },
                {
                  scale:
                    physicalScale,
                },
              ],
        },
      ]}
    >
      <View
        style={[
          styles.topBar,
          {
            backgroundColor:
              accentColor,
          },
        ]}
      />

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor:
              accentColor,
          },
        ]}
      />

      <View
        style={[
          styles.railUpperLeft,
          {
            backgroundColor:
              accentColor,
          },
        ]}
      />

      <View
        style={[
          styles.railUpperRight,
          {
            backgroundColor:
              accentColor,
          },
        ]}
      />

      <View
        style={[
          styles.railLowerLeft,
          {
            backgroundColor:
              accentColor,
          },
        ]}
      />

      <View
        style={[
          styles.railLowerRight,
          {
            backgroundColor:
              accentColor,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.topSand,
          {
            backgroundColor:
              accentColor,
            opacity: reduceMotion
              ? 0.76
              : topOpacity,
            transform: [
              {
                scaleY:
                  topScale,
              },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.grain,
          {
            backgroundColor:
              accentColor,
            opacity: reduceMotion
              ? 0
              : Animated.multiply(
                  grainOpacity,
                  pourOpacity,
                ),
            transform: reduceMotion
              ? []
              : [
                  {
                    translateY:
                      grainY,
                  },
                  {
                    scale:
                      grainScale,
                  },
                ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.bottomSand,
          {
            backgroundColor:
              accentColor,
            opacity: reduceMotion
              ? 0.78
              : bottomOpacity,
            transform: [
              {
                scaleY:
                  bottomScale,
              },
            ],
          },
        ]}
      />
    </Animated.View>
  );
}

const styles =
  StyleSheet.create({
    root: {
      width: 28,
      height: 38,
      marginLeft: 11,
      marginBottom: 3,
      alignSelf: 'center',
    },

    topBar: {
      position: 'absolute',
      top: 1,
      left: 2,
      width: 24,
      height: 1.5,
      borderRadius: 2,
      opacity: 0.82,
    },

    bottomBar: {
      position: 'absolute',
      bottom: 1,
      left: 2,
      width: 24,
      height: 1.5,
      borderRadius: 2,
      opacity: 0.82,
    },

    railUpperLeft: {
      position: 'absolute',
      top: 3,
      left: 7,
      width: 1,
      height: 16,
      opacity: 0.66,
      transform: [
        {
          rotate: '-23deg',
        },
      ],
    },

    railUpperRight: {
      position: 'absolute',
      top: 3,
      right: 7,
      width: 1,
      height: 16,
      opacity: 0.66,
      transform: [
        {
          rotate: '23deg',
        },
      ],
    },

    railLowerLeft: {
      position: 'absolute',
      bottom: 3,
      left: 7,
      width: 1,
      height: 16,
      opacity: 0.66,
      transform: [
        {
          rotate: '23deg',
        },
      ],
    },

    railLowerRight: {
      position: 'absolute',
      right: 7,
      bottom: 3,
      width: 1,
      height: 16,
      opacity: 0.66,
      transform: [
        {
          rotate: '-23deg',
        },
      ],
    },

    topSand: {
      position: 'absolute',
      top: 7,
      left: 9,
      width: 10,
      height: 7,
      borderRadius: 4,
    },

    grain: {
      position: 'absolute',
      top: 15,
      left: 13,
      width: 2,
      height: 2,
      borderRadius: 1,
    },

    bottomSand: {
      position: 'absolute',
      bottom: 6,
      left: 8,
      width: 12,
      height: 8,
      borderRadius: 4,
    },
  });

import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useMemo,
  useRef,
} from 'react';

import { colors } from '../theme/colors';

type Props = {
  onOpen: () => void;
};

// commandPalettePeekGestureV2
const OPEN_THRESHOLD = 0.44;
const FLICK_THRESHOLD = 0.72;

export function CommandPaletteEdgeGesture({
  onOpen,
}: Props) {
  const progress =
    useRef(new Animated.Value(0)).current;

  const progressValue = useRef(0);
  const active = useRef(false);

  const reset = () => {
    active.current = false;
    progressValue.current = 0;
  };

  const animateBack = () => {
    Animated.spring(progress, {
      toValue: 0,
      tension: 180,
      friction: 19,
      useNativeDriver: true,
    }).start(reset);
  };

  const completeGesture = () => {
    Animated.spring(progress, {
      toValue: 1,
      tension: 210,
      friction: 20,
      useNativeDriver: true,
    }).start(() => {
      progress.setValue(0);
      reset();
      onOpen();
    });
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Important:
        // a normal tap in this small zone remains untouched.
        onStartShouldSetPanResponder: () => false,

        onMoveShouldSetPanResponder: (
          _event,
          gesture,
        ) => {
          if (Platform.OS === 'web') {
            return false;
          }

          const left = -gesture.dx;
          const up = -gesture.dy;

          // Must be a deliberate diagonal pull inward,
          // not ordinary vertical scrolling.
          return (
            left > 8 &&
            up > 8 &&
            left / Math.max(up, 1) > 0.35 &&
            up / Math.max(left, 1) > 0.28
          );
        },

        onPanResponderGrant: () => {
          active.current = true;
        },

        onPanResponderMove: (
          _event,
          gesture,
        ) => {
          if (!active.current) return;

          const left =
            Math.max(0, -gesture.dx);

          const up =
            Math.max(0, -gesture.dy);

          // Horizontal movement contributes slightly more,
          // but BOTH directions must be present.
          const horizontal = left / 108;
          const vertical = up / 82;

          const nextProgress = Math.max(
            0,
            Math.min(
              1,
              Math.min(
                horizontal,
                vertical,
              ),
            ),
          );

          progressValue.current =
            nextProgress;

          progress.setValue(
            nextProgress,
          );
        },

        onPanResponderRelease: (
          _event,
          gesture,
        ) => {
          const fastInwardFlick =
            gesture.vx < -FLICK_THRESHOLD &&
            gesture.vy < -FLICK_THRESHOLD * 0.55;

          if (
            progressValue.current >=
              OPEN_THRESHOLD ||
            fastInwardFlick
          ) {
            completeGesture();
            return;
          }

          animateBack();
        },

        onPanResponderTerminate: () => {
          animateBack();
        },

        onPanResponderTerminationRequest:
          () => false,
      }),
    [onOpen, progress],
  );

  if (Platform.OS === 'web') {
    return null;
  }

  // Most of the palette starts outside the viewport.
  // As the finger travels inward, more of it becomes visible.
  const translateX =
    progress.interpolate({
      inputRange: [0, 1],
      outputRange: [305, 0],
    });

  const translateY =
    progress.interpolate({
      inputRange: [0, 1],
      outputRange: [46, 0],
    });

  const opacity =
    progress.interpolate({
      inputRange: [0, 0.04, 0.24, 1],
      outputRange: [0, 0.18, 0.72, 1],
    });

  const scale =
    progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.94, 1],
    });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.peek,
          {
            opacity,
            transform: [
              { translateX },
              { translateY },
              { scale },
            ],
          },
        ]}
      >
        <View style={styles.peekHandle} />

        <Text style={styles.searchMark}>
          ⌕
        </Text>

        <View style={styles.copy}>
          <Text style={styles.label}>
            Pretraži
          </Text>

          <Text
            numberOfLines={1}
            style={styles.placeholder}
          >
            Katalog · naredbe · Jingle
          </Text>
        </View>
      </Animated.View>

      <View
        {...responder.panHandlers}
        collapsable={false}
        style={styles.edgeZone}
      />
    </>
  );
}

const styles = StyleSheet.create({
  edgeZone: {
    position: 'absolute',

    // Slightly inside Android's own system edge.
    right: 5,
    bottom: 30,

    width: 34,
    height: 156,

    zIndex: 9997,
  },

  peek: {
    position: 'absolute',

    right: 12,
    bottom: 44,

    width: 305,
    minHeight: 68,

    zIndex: 9996,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 17,

    overflow: 'hidden',

    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.separator,

    backgroundColor: colors.surface,
  },

  peekHandle: {
    position: 'absolute',

    left: 0,
    top: 15,
    bottom: 15,

    width: 3,

    borderRadius: 2,

    backgroundColor: colors.black,

    opacity: 0.26,
  },

  searchMark: {
    color: colors.textMuted,
    fontSize: 23,
    marginRight: 12,
  },

  copy: {
    flex: 1,
    minWidth: 0,
  },

  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },

  placeholder: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
});

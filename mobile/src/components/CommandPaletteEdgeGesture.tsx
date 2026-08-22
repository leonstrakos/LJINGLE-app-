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

const OPEN_THRESHOLD = 0.56;

export function CommandPaletteEdgeGesture({
  onOpen,
}: Props) {
  // commandPalettePeekGestureV1

  const progress =
    useRef(new Animated.Value(0)).current;

  const progressValue = useRef(0);

  const animateBack = () => {
    Animated.spring(progress, {
      toValue: 0,
      tension: 150,
      friction: 18,
      useNativeDriver: true,
    }).start();

    progressValue.current = 0;
  };

  const completeGesture = () => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 110,
      useNativeDriver: true,
    }).start(() => {
      progress.setValue(0);
      progressValue.current = 0;
      onOpen();
    });
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          Platform.OS !== 'web',

        onMoveShouldSetPanResponder: (
          _event,
          gesture,
        ) =>
          Platform.OS !== 'web' &&
          gesture.dx < -4 &&
          gesture.dy < -4,

        onPanResponderMove: (
          _event,
          gesture,
        ) => {
          const horizontal =
            Math.max(0, -gesture.dx) / 118;

          const vertical =
            Math.max(0, -gesture.dy) / 92;

          // Requires a genuinely diagonal ↖ gesture.
          const next = Math.max(
            0,
            Math.min(
              1,
              Math.min(
                horizontal,
                vertical,
              ),
            ),
          );

          progressValue.current = next;
          progress.setValue(next);
        },

        onPanResponderRelease: () => {
          if (
            progressValue.current >=
            OPEN_THRESHOLD
          ) {
            completeGesture();
          } else {
            animateBack();
          }
        },

        onPanResponderTerminate: () => {
          animateBack();
        },

        onPanResponderTerminationRequest: () =>
          false,
      }),
    [onOpen, progress],
  );

  if (Platform.OS === 'web') {
    return null;
  }

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [285, 0],
  });

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [32, 0],
  });

  const opacity = progress.interpolate({
    inputRange: [0, 0.08, 1],
    outputRange: [0, 0.45, 1],
  });

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
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
        <Text style={styles.searchMark}>
          ⌕
        </Text>

        <View style={styles.copy}>
          <Text style={styles.label}>
            Command
          </Text>

          <Text
            numberOfLines={1}
            style={styles.placeholder}
          >
            Pretraži ili pokreni naredbu...
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
  // Tiny dedicated edge area instead of
  // a global gesture listener.
  edgeZone: {
    position: 'absolute',
    right: 0,
    bottom: 28,
    width: 18,
    height: 128,
    zIndex: 9997,
  },

  peek: {
    position: 'absolute',
    right: 12,
    bottom: 42,
    width: 285,
    minHeight: 64,
    zIndex: 9996,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 16,

    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.separator,

    backgroundColor: colors.surface,
  },

  searchMark: {
    color: colors.textMuted,
    fontSize: 22,
    marginRight: 11,
  },

  copy: {
    flex: 1,
    minWidth: 0,
  },

  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },

  placeholder: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});

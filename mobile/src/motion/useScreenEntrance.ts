import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
} from 'react-native';

// useScreenEntranceV2
// Opt-in screen entrance. Self-contained on purpose so it does not depend
// on internal semanticMotion export names.
export function useScreenEntrance() {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(
    new Animated.Value(8),
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return {
    opacity,
    transform: [{ translateY }],
  } as const;
}

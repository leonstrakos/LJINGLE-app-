import {
  Animated,
  Easing,
  Platform,
} from 'react-native';

// uiMotionV1
// Central motion language for LJingle.
// This module does not modify any screen by itself.

export const motionDurations = {
  instant: 90,
  fast: 150,
  normal: 240,
  slow: 380,
} as const;

export const motionEasing = {
  enter: Easing.out(Easing.cubic),
  exit: Easing.in(Easing.cubic),
  standard: Easing.inOut(Easing.cubic),
} as const;

export function fadeSlideIn(
  opacity: Animated.Value,
  translateY: Animated.Value,
  delay = 0,
) {
  opacity.setValue(0);
  translateY.setValue(10);

  return Animated.parallel([
    Animated.timing(opacity, {
      toValue: 1,
      duration: motionDurations.normal,
      delay,
      easing: motionEasing.enter,
      useNativeDriver: true,
    }),
    Animated.timing(translateY, {
      toValue: 0,
      duration: motionDurations.normal,
      delay,
      easing: motionEasing.enter,
      useNativeDriver: true,
    }),
  ]);
}

export function softSettle(
  scale: Animated.Value,
  delay = 0,
) {
  scale.setValue(0.965);

  return Animated.spring(scale, {
    toValue: 1,
    delay,
    damping: 16,
    stiffness: 180,
    mass: 0.7,
    useNativeDriver: true,
  });
}

export function pressIn(scale: Animated.Value) {
  return Animated.spring(scale, {
    toValue: 0.975,
    damping: 18,
    stiffness: 320,
    mass: 0.45,
    useNativeDriver: true,
  });
}

export function pressOut(scale: Animated.Value) {
  return Animated.spring(scale, {
    toValue: 1,
    damping: 15,
    stiffness: 260,
    mass: 0.5,
    useNativeDriver: true,
  });
}

export function gentlePulse(scale: Animated.Value) {
  return Animated.sequence([
    Animated.timing(scale, {
      toValue: 1.025,
      duration: 110,
      easing: motionEasing.enter,
      useNativeDriver: true,
    }),
    Animated.spring(scale, {
      toValue: 1,
      damping: 13,
      stiffness: 220,
      mass: 0.5,
      useNativeDriver: true,
    }),
  ]);
}

export function staggerCards(
  animations: Animated.CompositeAnimation[],
  spacing = 45,
) {
  return Animated.stagger(spacing, animations);
}

export function meadowFloat(
  translateY: Animated.Value,
) {
  // Intentionally disabled on web: CSS/browser rendering can make
  // persistent micro-motion look noisier than on native.
  if (Platform.OS === 'web') {
    translateY.setValue(0);
    return Animated.delay(0);
  }

  return Animated.loop(
    Animated.sequence([
      Animated.timing(translateY, {
        toValue: -2,
        duration: 1800,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 1,
        duration: 2100,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 1400,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]),
  );
}

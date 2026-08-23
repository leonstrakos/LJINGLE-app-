import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';

import { jingleSwing, semanticSpring } from '../utils/semanticMotion';
import { useReducedMotion } from '../utils/useReducedMotion';

type Props = {
  active: boolean;
  inactiveOpacity?: number;
  style?: StyleProp<ImageStyle>;
};

// semanticJingleMotionV1
export function JingleBellIcon({
  active,
  inactiveOpacity = 0.5,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const previousActive = useRef(active);

  useEffect(() => {
    const becameActive =
      active && !previousActive.current;

    previousActive.current = active;

    if (!becameActive || reducedMotion) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }

    progress.stopAnimation();
    progress.setValue(0);

    Animated.spring(progress, {
      toValue: 1,
      ...semanticSpring.jingle,
      useNativeDriver: true,
    }).start();
  }, [active, progress, reducedMotion]);

  const rotate = progress.interpolate({
    inputRange: jingleSwing.inputRange,
    outputRange: jingleSwing.rotate,
  });

  const scale = progress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [1, 1.08, 1],
  });

  return (
    <Animated.Image
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      source={require('../assets/aero/fav.png')}
      style={[
        style,
        {
          opacity: active ? 1 : inactiveOpacity,
          transform: [{ rotate }, { scale }],
        },
      ]}
    />
  );
}

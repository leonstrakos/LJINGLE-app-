import { type ReactNode, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

import { semanticSpring, semanticTiming } from '../utils/semanticMotion';
import { useReducedMotion } from '../utils/useReducedMotion';

type Props = {
  active: boolean;
  children: ReactNode;
};

export function TimerMotionView({ active, children }: Props) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const previous = useRef(active);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      previous.current = active;
      return;
    }

    if (previous.current === active) return;
    previous.current = active;

    scale.stopAnimation();
    opacity.stopAnimation();

    if (reducedMotion) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }

    if (active) {
      scale.setValue(0.985);
      opacity.setValue(0.88);

      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1.018,
          ...semanticSpring.peek,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: semanticTiming.enter.duration,
          easing: semanticTiming.enter.easing,
          useNativeDriver: true,
        }),
      ]).start(() => {
        Animated.spring(scale, {
          toValue: 1,
          ...semanticSpring.press,
          useNativeDriver: true,
        }).start();
      });

      return;
    }

    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.972,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        ...semanticSpring.press,
        useNativeDriver: true,
      }),
    ]).start();
  }, [active, opacity, reducedMotion, scale]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ scale }],
      }}
    >
      {children}
    </Animated.View>
  );
}

// ljingleSemanticAliveR1
import { Animated } from 'react-native';

export const celestialParallaxY = new Animated.Value(0);
export const celestialParallaxTranslateY = celestialParallaxY.interpolate({
  inputRange: [0, 1200],
  outputRange: [0, 96],
  extrapolate: 'clamp',
});

export function updateCelestialParallax(value: number) {
  celestialParallaxY.setValue(Number.isFinite(value) ? Math.max(0, value) : 0);
}

export function resetCelestialParallax() {
  celestialParallaxY.setValue(0);
}

import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';

import { celestial, celestialAlpha } from '../theme/celestial';
// forkMCelestialSharedComponentsV1
const celestialMode = activeVisualSkinId === 'classic';

type Props = {
  onPress: () => void;
};

export function ParentBackButton({ onPress }: Props) {
  return (
    <Pressable
      accessibilityLabel="Natrag"
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.button, celestialMode && styles.celestialButton, pressed && styles.pressed]}
    >
      <Text style={[styles.symbol, celestialMode && styles.celestialSymbol]}>{'\u2190'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',

  },
  pressed: { opacity: 0.45 },
  symbol: {
    // forkKDarkBackgroundContrastV1
    color: colors.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '600',
  },
  celestialButton: {
    // finalJingleHomeCatalogueControlsV2
    width: 38,
    height: 38,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  celestialSymbol: {
    color: celestial.gold,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '500',
  },
});
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';

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
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.symbol}>{'\u2190'}</Text>
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
    color: colors.black,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '600',
  },
});
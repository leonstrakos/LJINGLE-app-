// ljingleCompletionSealReaderBookmarksR1
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';

type Props = {
  size?: 'SM' | 'MD';
  style?: StyleProp<ViewStyle>;
};

export function CompletionSeal({ size = 'SM', style }: Props) {
  const dimension = size === 'MD' ? 30 : 23;
  const starSize = size === 'MD' ? 13 : 10;

  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={[
        styles.seal,
        { width: dimension, height: dimension, borderRadius: dimension / 2 },
        style,
      ]}
    >
      <View
        style={[
          styles.innerRing,
          {
            width: dimension - 6,
            height: dimension - 6,
            borderRadius: (dimension - 6) / 2,
          },
        ]}
      />
      <Text style={[styles.star, { fontSize: starSize }]}>✦</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  seal: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.25,
    borderColor: colors.navy,
    shadowColor: colors.background,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  innerRing: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.navy,
    opacity: 0.48,
  },
  star: {
    color: colors.navy,
    fontWeight: '900',
    lineHeight: 14,
    textAlign: 'center',
  },
});

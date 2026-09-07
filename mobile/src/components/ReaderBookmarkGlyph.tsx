// ljingleCompletionSealReaderBookmarksR1
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';

type Props = {
  active?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function ReaderBookmarkGlyph({ active = false, size = 22, style }: Props) {
  const width = Math.max(10, Math.round(size * 0.68));
  const markColor = active ? colors.navy : colors.textMuted;
  const notchColor = active ? colors.background : markColor;

  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={[styles.wrap, { width, height: size }, style]}
    >
      <View
        style={[
          styles.ribbon,
          {
            width,
            height: size,
            borderColor: markColor,
            backgroundColor: active ? markColor : undefined,
          },
        ]}
      >
        <View
          style={[
            styles.notchLine,
            styles.notchLeft,
            { width: width * 0.58, backgroundColor: notchColor },
          ]}
        />
        <View
          style={[
            styles.notchLine,
            styles.notchRight,
            { width: width * 0.58, backgroundColor: notchColor },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  ribbon: {
    position: 'relative',
    borderWidth: 1.4,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    overflow: 'hidden',
  },
  notchLine: {
    position: 'absolute',
    bottom: 3,
    height: 1.5,
    borderRadius: 999,
  },
  notchLeft: {
    left: 1,
    transform: [{ rotate: '34deg' }],
  },
  notchRight: {
    right: 1,
    transform: [{ rotate: '-34deg' }],
  },
});

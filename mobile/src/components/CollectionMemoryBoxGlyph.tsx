// forkN5GlyphReorderV1
// LJingle glyph family — slightly open Memory Box with one rising star.
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  color: string;
  size?: number;
};

export function CollectionMemoryBoxGlyph({
  color,
  size = 30,
}: Props) {
  const stroke = Math.max(1.2, size * 0.055);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.root,
        {
          width: size,
          height: size,
        },
      ]}
    >
      <View
        style={{
          position: 'absolute',
          left: size * 0.13,
          right: size * 0.10,
          bottom: size * 0.11,
          height: size * 0.43,
          borderWidth: stroke,
          borderColor: color,
          borderTopWidth: stroke * 0.78,
          borderRadius: size * 0.08,
          backgroundColor: 'transparent',
        }}
      />

      <View
        style={{
          position: 'absolute',
          left: size * 0.10,
          top: size * 0.34,
          width: size * 0.76,
          height: size * 0.12,
          borderTopWidth: stroke,
          borderLeftWidth: stroke * 0.75,
          borderRightWidth: stroke * 0.75,
          borderColor: color,
          borderTopLeftRadius: size * 0.08,
          borderTopRightRadius: size * 0.08,
          transform: [{ rotate: '-8deg' }],
          opacity: 0.96,
        }}
      />

      <Text
        allowFontScaling={false}
        style={{
          position: 'absolute',
          left: size * 0.48,
          top: -size * 0.09,
          color,
          fontSize: size * 0.33,
          lineHeight: size * 0.39,
          fontWeight: '900',
        }}
      >
        ✦
      </Text>

      <View
        style={[
          styles.dot,
          {
            width: size * 0.09,
            height: size * 0.09,
            borderRadius: size,
            left: size * 0.26,
            top: size * 0.17,
            backgroundColor: color,
            opacity: 0.52,
          },
        ]}
      />

      <View
        style={[
          styles.dot,
          {
            width: size * 0.065,
            height: size * 0.065,
            borderRadius: size,
            right: size * 0.08,
            top: size * 0.24,
            backgroundColor: color,
            opacity: 0.82,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
  },
  dot: {
    position: 'absolute',
  },
});

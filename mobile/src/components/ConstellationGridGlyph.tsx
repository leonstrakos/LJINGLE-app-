// forkN5GlyphReorderV1
// LJingle glyph family — catalogue constellation grid.
// One long-pointed star + three deliberately irregular celestial points.
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  color: string;
  size?: number;
};

export function ConstellationGridGlyph({
  color,
  size = 34,
}: Props) {
  const dot = Math.max(3, Math.round(size * 0.12));

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
      <Text
        allowFontScaling={false}
        style={{
          position: 'absolute',
          left: size * 0.04,
          top: -size * 0.07,
          color,
          fontSize: size * 0.48,
          lineHeight: size * 0.56,
          fontWeight: '900',
        }}
      >
        ✦
      </Text>

      <View
        style={[
          styles.dot,
          {
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            right: size * 0.13,
            top: size * 0.17,
            backgroundColor: color,
            opacity: 0.74,
          },
        ]}
      />

      <View
        style={[
          styles.dot,
          {
            width: dot * 0.88,
            height: dot * 0.88,
            borderRadius: dot,
            left: size * 0.20,
            bottom: size * 0.13,
            backgroundColor: color,
            opacity: 0.54,
          },
        ]}
      />

      <View
        style={[
          styles.dot,
          {
            width: dot * 1.04,
            height: dot * 1.04,
            borderRadius: dot,
            right: size * 0.08,
            bottom: size * 0.04,
            backgroundColor: color,
            opacity: 0.88,
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

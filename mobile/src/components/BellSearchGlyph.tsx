// forkN5GlyphReorderV1
// finalSettingsDropdownsAstV18
// LJingle search glyph — unmistakable magnifying glass + one celestial spark.
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  color: string;
  size?: number;
};

export function BellSearchGlyph({
  color,
  size = 28,
}: Props) {
  const stroke =
    Math.max(
      1.35,
      size * 0.06,
    );

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
          left: size * 0.10,
          top: size * 0.13,
          width: size * 0.46,
          height: size * 0.46,
          borderRadius: size,
          borderWidth: stroke,
          borderColor: color,
          backgroundColor:
            'transparent',
        }}
      />

      <View
        style={{
          position: 'absolute',
          left: size * 0.50,
          top: size * 0.57,
          width: size * 0.32,
          height: stroke,
          borderRadius: stroke,
          backgroundColor: color,
          transform: [
            {
              rotate: '45deg',
            },
          ],
        }}
      />

      <Text
        allowFontScaling={false}
        style={{
          position: 'absolute',
          right: -size * 0.01,
          top: -size * 0.10,
          color,
          fontSize: size * 0.34,
          lineHeight: size * 0.40,
          fontWeight: '900',
        }}
      >
        ✦
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    root: {
      position: 'relative',
    },
  });

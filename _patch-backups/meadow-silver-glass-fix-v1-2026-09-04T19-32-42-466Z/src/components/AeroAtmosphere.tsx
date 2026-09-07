// FRUTIGER_AERO_MAX_UI_V2
import { Image, StyleSheet, View } from 'react-native';

import { activeAeroBackgroundId } from '../theme/aeroBackground';
import { activeVisualSkinId } from '../theme/visualSkins';

type AeroVariant =
  | 'home'
  | 'books'
  | 'media'
  | 'games'
  | 'entries'
  | 'topics'
  | 'catalogue'
  | 'collections'
  | 'detail'
  | 'radio'
  | 'history'
  | 'profile';

type Props = { variant?: AeroVariant };

const bubbles = [
  { left: '7%', top: 74, size: 22, opacity: 0.28 },
  { left: '83%', top: 126, size: 38, opacity: 0.18 },
  { left: '68%', top: 28, size: 14, opacity: 0.34 },
  { left: '18%', top: 224, size: 48, opacity: 0.12 },
  { left: '88%', top: 316, size: 18, opacity: 0.24 },
  { left: '45%', top: 392, size: 26, opacity: 0.14 },
] as const;

const variantTint: Record<AeroVariant, string> = {
  home: 'rgba(90,211,246,0.06)',
  books: 'rgba(106,207,107,0.06)',
  media: 'rgba(72,175,235,0.06)',
  games: 'rgba(112,215,146,0.06)',
  entries: 'rgba(118,203,237,0.05)',
  topics: 'rgba(122,215,157,0.06)',
  catalogue: 'rgba(60,187,230,0.06)',
  collections: 'rgba(120,211,132,0.06)',
  detail: 'rgba(82,193,231,0.05)',
  radio: 'rgba(80,202,227,0.07)',
  history: 'rgba(115,200,235,0.05)',
  profile: 'rgba(99,204,151,0.05)',
};

export function AeroAtmosphere({ variant = 'catalogue' }: Props) {
  if (activeVisualSkinId !== 'aero') return null;

  const meadow = activeAeroBackgroundId === 'meadow';
  const source = meadow
    ? require('../assets/aero/aero-meadow-ufo.jpeg')
    : require('../assets/aero/aero-world-bg2.webp');

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.root}
    >
      <Image
        source={source}
        resizeMode="cover"
        style={[styles.image, meadow && styles.meadowImage]}
      />
      <View style={[styles.mist, meadow && styles.meadowMist]} />
      <View style={[styles.tint, { backgroundColor: variantTint[variant] }]} />
      <View style={[styles.sunGlow, meadow && styles.meadowSunGlow]} />
      <View style={[styles.horizonGlass, meadow && styles.meadowHorizonGlass]} />
      {bubbles.map((bubble, index) => (
        <View
          key={index}
          style={[
            styles.bubble,
            meadow && styles.meadowBubble,
            {
              left: bubble.left,
              top: bubble.top + ((variant.length * 13 + index * 17) % 61),
              width: bubble.size,
              height: bubble.size,
              borderRadius: bubble.size / 2,
              opacity: bubble.opacity,
            },
          ]}
        >
          <View style={[styles.bubbleShine, meadow && styles.meadowBubbleShine]} />
        </View>
      ))}
      <View style={[styles.lowerGlass, meadow && styles.meadowLowerGlass]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.34,
  },
  meadowImage: {
    opacity: 0.48,
  },
  mist: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(221,247,255,0.28)',
  },
  meadowMist: {
    backgroundColor: 'rgba(87,118,76,0.08)',
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
  },
  sunGlow: {
    position: 'absolute',
    top: -92,
    right: -58,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderWidth: 28,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  meadowSunGlow: {
    backgroundColor: 'rgba(220,255,198,0.18)',
    borderColor: 'rgba(231,255,216,0.10)',
  },
  horizonGlass: {
    position: 'absolute',
    top: 124,
    left: -40,
    right: -40,
    height: 84,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.60)',
  },
  bubble: {
    position: 'absolute',
    backgroundColor: 'rgba(205,245,255,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#159DD0',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  bubbleShine: {
    position: 'absolute',
    top: '14%',
    left: '18%',
    width: '34%',
    height: '24%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  meadowHorizonGlass: {
    backgroundColor: 'rgba(73,111,65,0.18)',
    borderTopColor: 'rgba(229,255,216,0.54)',
  },
  meadowBubble: {
    backgroundColor: 'rgba(113,188,132,0.20)',
    borderColor: 'rgba(229,255,216,0.76)',
    shadowColor: '#356B45',
  },
  meadowBubbleShine: {
    backgroundColor: 'rgba(238,255,228,0.70)',
  },
  meadowLowerGlass: {
    backgroundColor: 'rgba(55,101,61,0.16)',
    borderTopColor: 'rgba(226,255,215,0.46)',
  },
  lowerGlass: {
    position: 'absolute',
    left: -30,
    right: -30,
    bottom: -82,
    height: 210,
    borderRadius: 110,
    backgroundColor: 'rgba(76,195,219,0.07)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.48)',
  },
});

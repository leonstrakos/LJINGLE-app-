import { StyleSheet, Text, View } from 'react-native';

import { activeVisualSkinId } from '../theme/visualSkins';

import { celestial, celestialAlpha } from '../theme/celestial';
// forkPCelestialOrnamentV1
// Decorative-only layer. It never participates in layout or touch handling.
// Classic receives the full LJingle celestial archive language.
// Pixel and Aero (including Meadow / Frutiger worlds) are intentionally untouched.

export type CelestialVariant =
  | 'home'
  | 'books'
  | 'entries'
  | 'media'
  | 'games'
  | 'topics'
  | 'catalogue'
  | 'collections'
  | 'detail'
  | 'radio'
  | 'history'
  | 'profile';

type Props = {
  variant?: CelestialVariant;
};

type Star = {
  left: `${number}%`;
  top: number;
  glyph: '✦' | '✧' | '·' | '⋆' | '⊹';
  size: number;
  opacity: number;
};

type Thread = {
  left: `${number}%`;
  top: number;
  width: number;
  rotate: `${number}deg`;
  opacity: number;
};

const GOLD = celestial.gold;
const GOLD_SOFT = celestial.goldDeep;
const INK = celestial.night;
const BLUE = celestial.celestialBlue;

const seeds: Record<CelestialVariant, number> = {
  home: 7,
  books: 11,
  entries: 17,
  media: 23,
  games: 29,
  topics: 31,
  catalogue: 37,
  collections: 41,
  detail: 43,
  radio: 47,
  history: 53,
  profile: 59,
};

const glyphs: Star['glyph'][] = ['✦', '✧', '·', '⋆', '⊹'];

function percent(value: number): `${number}%` {
  return `${Math.max(1, Math.min(98, value))}%` as `${number}%`;
}

function makeStars(seed: number): Star[] {
  return Array.from({ length: 13 }, (_, index) => {
    const n = seed * 17 + index * 37;

    return {
      left: percent(3 + ((n * 13) % 93)),
      top: 6 + ((n * 7) % 96),
      glyph: glyphs[(seed + index * 3) % glyphs.length] ?? '✦',
      size: 7 + ((seed + index * 5) % 8),
      opacity: 0.22 + ((seed + index * 11) % 42) / 100,
    };
  });
}

function makeThreads(seed: number): Thread[] {
  return [
    {
      left: percent(5 + (seed % 15)),
      top: 29 + (seed % 17),
      width: 44 + (seed % 28),
      rotate: `${-19 + (seed % 13)}deg`,
      opacity: 0.14,
    },
    {
      left: percent(66 + (seed % 14)),
      top: 17 + (seed % 23),
      width: 45 + ((seed * 3) % 23),
      rotate: `${8 + (seed % 14)}deg`,
      opacity: 0.12,
    },
    {
      left: percent(29 + (seed % 17)),
      top: 82 + (seed % 15),
      width: 38 + ((seed * 7) % 26),
      rotate: `${-8 + (seed % 17)}deg`,
      opacity: 0.09,
    },
  ];
}

const starFields = Object.fromEntries(
  (Object.keys(seeds) as CelestialVariant[]).map((variant) => [
    variant,
    makeStars(seeds[variant]),
  ]),
) as Record<CelestialVariant, Star[]>;

const constellationFields = Object.fromEntries(
  (Object.keys(seeds) as CelestialVariant[]).map((variant) => [
    variant,
    makeThreads(seeds[variant]),
  ]),
) as Record<CelestialVariant, Thread[]>;

const dither = Array.from({ length: 72 }, (_, index) => {
  const row = index % 6;
  const column = Math.floor(index / 6);
  const stagger = row % 2 === 0 ? 0 : 2.3;

  return {
    left: percent(1.5 + column * 8.25 + stagger),
    top: 2 + row * 17,
    opacity: Math.max(0.018, 0.115 - row * 0.013),
    size: index % 9 === 0 ? 1.5 : 1,
  };
});

export function CelestialAtmosphere({
  variant = 'catalogue',
}: Props) {
  if (activeVisualSkinId !== 'classic') {
    return null;
  }

  const seed = seeds[variant];

  return (
    <View
      pointerEvents="none"
      style={styles.root}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.topRule} />
      <View style={styles.bottomRule} />

      <View
        style={[
          styles.cloudArc,
          styles.cloudArcLeft,
          {
            transform: [
              { rotate: `${-5 - (seed % 5)}deg` },
            ],
          },
        ]}
      />
      <View
        style={[
          styles.cloudArc,
          styles.cloudArcRight,
          {
            transform: [
              { rotate: `${5 + (seed % 6)}deg` },
            ],
          },
        ]}
      />

      <View style={styles.orbitLarge} />
      <View style={styles.orbitSmall} />

      <View style={styles.seal}>
        <Text style={styles.sealStar}>✦</Text>
      </View>

      {dither.map((dot, index) => (
        <View
          key={`dot-${index}`}
          style={[
            styles.dot,
            {
              left: dot.left,
              top: dot.top,
              opacity: dot.opacity,
              width: dot.size,
              height: dot.size,
              borderRadius: dot.size / 2,
            },
          ]}
        />
      ))}

      {constellationFields[variant].map((thread, index) => (
        <View
          key={`thread-${index}`}
          style={[
            styles.thread,
            {
              left: thread.left,
              top: thread.top,
              width: thread.width,
              opacity: thread.opacity,
              transform: [{ rotate: thread.rotate }],
            },
          ]}
        >
          <View style={styles.threadNodeLeft} />
          <View style={styles.threadNodeRight} />
        </View>
      ))}

      {starFields[variant].map((star, index) => (
        <Text
          key={`star-${index}`}
          style={[
            styles.star,
            {
              left: star.left,
              top: star.top,
              fontSize: star.size,
              opacity: star.opacity,
            },
          ]}
        >
          {star.glyph}
        </Text>
      ))}

      <Text style={styles.cornerGlyphLeft}>✧</Text>
      <Text style={styles.cornerGlyphRight}>✦</Text>
</View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    height: 136,
    overflow: 'visible',
    zIndex: 0,
  },

  topRule: {
    position: 'absolute',
    top: 3,
    left: '10%',
    right: '10%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: GOLD,
    opacity: 0.16,
  },

  bottomRule: {
    position: 'absolute',
    left: '22%',
    right: '22%',
    bottom: 9,
    height: StyleSheet.hairlineWidth,
    backgroundColor: GOLD,
    opacity: 0.08,
  },

  dot: {
    position: 'absolute',
    backgroundColor: BLUE,
  },

  thread: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth,
    backgroundColor: GOLD_SOFT,
  },

  threadNodeLeft: {
    position: 'absolute',
    left: -1.5,
    top: -1.5,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD,
    backgroundColor: celestial.ivory,
  },

  threadNodeRight: {
    position: 'absolute',
    right: -1.5,
    top: -1.5,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD,
    backgroundColor: celestial.ivory,
  },

  star: {
    position: 'absolute',
    color: GOLD,
    lineHeight: 16,
  },

  cloudArc: {
    position: 'absolute',
    width: 155,
    height: 54,
    borderRadius: 78,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INK,
    opacity: 0.05,
  },

  cloudArcLeft: {
    left: -74,
    top: 19,
  },

  cloudArcRight: {
    right: -76,
    top: 31,
  },

  orbitLarge: {
    position: 'absolute',
    right: 24,
    top: -34,
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD,
    opacity: 0.055,
  },

  orbitSmall: {
    position: 'absolute',
    right: 47,
    top: -11,
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BLUE,
    opacity: 0.05,
  },

  seal: {
    position: 'absolute',
    right: 65,
    top: 7,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD,
    opacity: 0.22,
  },

  sealStar: {
    color: GOLD,
    fontSize: 9,
    lineHeight: 11,
  },

  cornerGlyphLeft: {
    position: 'absolute',
    left: 7,
    top: 78,
    color: GOLD,
    opacity: 0.32,
    fontSize: 10,
  },

  cornerGlyphRight: {
    position: 'absolute',
    right: 8,
    top: 89,
    color: GOLD,
    opacity: 0.26,
    fontSize: 11,
  },

  microMark: {
    position: 'absolute',
    right: 14,
    bottom: -1,
    color: INK,
    opacity: 0.13,
    fontSize: 6,
    lineHeight: 8,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
});

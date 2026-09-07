// ljingleStarSystemR1
// ljingleDiamondWaterR4
// ljingleHomeSparkleGradientR1
import {
  StyleSheet,
  View,
} from 'react-native';

import {
  LjingleStar,
  type LjingleStarVariant,
} from './LjingleStar';

import {
  colors,
} from '../theme/colors';

type BaseVariant =
  | 'books'
  | 'entries'
  | 'media'
  | 'games'
  | 'topics'
  | 'catalogue';

export type CelestialVariant =
  | BaseVariant
  | 'home'
  | 'collections'
  | 'detail'
  | 'radio'
  | 'history'
  | 'profile';

type Props = {
  variant?: CelestialVariant;
  hideBottomRule?: boolean;
  hideTopRule?: boolean;
};

type Particle = {
  left: string;
  top: number;
  size: number;
  opacity: number;
  variant: LjingleStarVariant;
  bright: boolean;
};

const seeds: Record<
  CelestialVariant,
  number
> = {
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

function noise(
  seed: number,
  index: number,
  salt: number,
) {
  const value =
    Math.sin(
      seed * 12.9898 +
      index * 78.233 +
      salt * 37.719,
    ) * 43758.5453;

  return value - Math.floor(value);
}

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

function buildParticles(
  seed: number,
  variant: CelestialVariant,
): Particle[] {
  const homeMode =
    variant === 'home';

  /*
   * Home gets a taller source field so the
   * sparkle gradient can breathe downward
   * toward the Katalog card.
   */
  const particleCount =
    homeMode
      ? 78
      : 54;

  const particles: Particle[] = [];

  for (
    let index = 0;
    index < particleCount;
    index += 1
  ) {
    const x =
      noise(seed, index, 1);

    const yRaw =
      noise(seed, index, 2);

    const shape =
      noise(seed, index, 3);

    const strength =
      noise(seed, index, 4);

    const scale =
      noise(seed, index, 5);

    const drift =
      noise(seed, index, 6) - 0.5;

    const survival =
      noise(seed, index, 7);

    /*
     * Home is strongly biased upward:
     * lots of light near the top,
     * increasingly sparse downward.
     */
    const depth =
      Math.pow(
        yRaw,
        homeMode
          ? 1.95
          : 1.55,
      );

    /*
     * Gradually remove particles with depth.
     * Near the Katalog card, only a handful
     * of faint reflections survive.
     */
    if (homeMode) {
      const keepChance =
        0.98 -
        depth * 0.68;

      if (
        survival > keepChance
      ) {
        continue;
      }
    }

    /*
     * Diamond sparkles + dust only.
     * No plus / signal / worm shapes.
     */
    const variantShape:
      LjingleStarVariant =
      shape > 0.73
        ? 'spark'
        : 'dot';

    const bright =
      variantShape === 'spark' &&
      strength > 0.34;

    /*
     * Slightly shrink sparkles as they fall
     * downward, like reflection light fading
     * into distance.
     */
    const depthScale =
      homeMode
        ? 1 - depth * 0.24
        : 1;

    const baseSize =
      (
        variantShape === 'spark'
          ? 7.5 +
            scale * 10.5
          : 1 +
            scale * 1.7
      ) * depthScale;

    const baseOpacity =
      variantShape === 'spark'
        ? 0.56 +
          strength * 0.36
        : 0.11 +
          strength * 0.17;

    /*
     * The lower we go, the wider the horizontal
     * spread becomes.
     *
     * Top: tight reflection ribbon.
     * Bottom: loose scattered diamonds.
     */
    const spread =
      homeMode
        ? 3 +
          depth * 54
        : 2 +
          depth * 18;

    /*
     * Smooth opacity gradient.
     * Home fades much more strongly downward.
     */
    const fade =
      homeMode
        ? Math.pow(
            1 - depth,
            1.42,
          )
        : 1 - depth * 0.62;

    const minimumOpacity =
      variantShape === 'spark'
        ? homeMode
          ? 0.07
          : 0.18
        : homeMode
          ? 0.018
          : 0.04;

    const opacity =
      Math.max(
        minimumOpacity,
        baseOpacity * fade,
      );

    /*
     * Wider horizontal scatter toward the bottom.
     */
    const left =
      clamp(
        4 +
          x * 92 +
          drift * spread,
        1,
        99,
      );

    /*
     * Home extends much farther downward.
     */
    const top =
      homeMode
        ? 3 +
          depth * 350
        : 3 +
          depth * 94;

    particles.push({
      left:
        left.toFixed(2) +
        '%',
      top,
      size:
        Math.max(
          1,
          baseSize,
        ),
      opacity,
      variant:
        variantShape,
      bright,
    });
  }

  return particles;
}

const cache = new Map<
  CelestialVariant,
  Particle[]
>();

function particlesFor(
  variant: CelestialVariant,
) {
  const existing =
    cache.get(variant);

  if (existing) {
    return existing;
  }

  const generated =
    buildParticles(
      seeds[variant] ??
        seeds.catalogue,
      variant,
    );

  cache.set(
    variant,
    generated,
  );

  return generated;
}

export function CelestialAtmosphere({
  variant = 'catalogue',
}: Props) {
  const particles =
    particlesFor(variant);

  const homeMode =
    variant === 'home';

  return (
    <View
      pointerEvents="none"
      style={[
        styles.root,
        homeMode &&
          styles.homeRoot,
      ]}
    >
      {particles.map(
        (particle, index) => (
          <LjingleStar
            key={
              variant +
              '-' +
              index
            }
            variant={
              particle.variant
            }
            size={
              particle.size
            }
            color={
              particle.bright
                ? colors.text
                : colors.textMuted
            }
            opacity={
              particle.opacity
            }
            style={{
              position: 'absolute',
              left: particle.left,
              top: particle.top,
            }}
          />
        ),
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    root: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 104,
      overflow: 'visible',
    },

    homeRoot: {
      height: 370,
    },
  });

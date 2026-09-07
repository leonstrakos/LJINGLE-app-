// ljingleStarSystemR1
// ljingleDiamondWaterR3
import {
  StyleSheet,
  View,
} from 'react-native';

import type {
  StyleProp,
  ViewStyle,
} from 'react-native';

import {
  activeAccentColor,
} from '../theme/colors';

export type LjingleStarVariant =
  | 'spark'
  | 'glint'
  | 'dot';

type Props = {
  size?: number;
  color?: string;
  opacity?: number;
  variant?: LjingleStarVariant;
  style?: StyleProp<ViewStyle>;
};

type DiamondProps = {
  size: number;
  color: string;
  opacity: number;
  stretchX?: number;
  stretchY?: number;
};

function Diamond({
  size,
  color,
  opacity,
  stretchX = 1,
  stretchY = 1,
}: DiamondProps) {
  return (
    <View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        backgroundColor: color,
        opacity,
        borderRadius:
          size >= 4
            ? 1
            : 0,
        transform: [
          {
            rotate: '45deg',
          },
          {
            scaleX: stretchX,
          },
          {
            scaleY: stretchY,
          },
        ],
      }}
    />
  );
}

export function LjingleStar({
  size = 14,
  color = activeAccentColor,
  opacity = 1,
  variant = 'spark',
  style,
}: Props) {
  const safeSize =
    Math.max(
      1,
      size,
    );

  if (variant === 'dot') {
    return (
      <View
        pointerEvents="none"
        style={[
          {
            width: safeSize,
            height: safeSize,
            borderRadius:
              safeSize / 2,
            backgroundColor:
              color,
            opacity,
          },
          style,
        ]}
      />
    );
  }

  const glint =
    variant === 'glint';

  const outer =
    Math.max(
      4,
      safeSize *
        (
          glint
            ? 0.48
            : 0.72
        ),
    );

  const middle =
    Math.max(
      3,
      safeSize *
        (
          glint
            ? 0.31
            : 0.43
        ),
    );

  const core =
    Math.max(
      2,
      safeSize *
        (
          glint
            ? 0.18
            : 0.23
        ),
    );

  const stretchX =
    glint
      ? 0.58
      : 1;

  const stretchY =
    glint
      ? 1.42
      : 1;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.root,
        {
          width: safeSize,
          height: safeSize,
          opacity,
        },
        style,
      ]}
    >
      <Diamond
        size={outer}
        color={color}
        opacity={
          glint
            ? 0.07
            : 0.08
        }
        stretchX={stretchX}
        stretchY={stretchY}
      />

      <Diamond
        size={middle}
        color={color}
        opacity={
          glint
            ? 0.22
            : 0.26
        }
        stretchX={stretchX}
        stretchY={stretchY}
      />

      <Diamond
        size={core}
        color={color}
        opacity={1}
        stretchX={stretchX}
        stretchY={stretchY}
      />
    </View>
  );
}

const styles =
  StyleSheet.create({
    root: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },
  });

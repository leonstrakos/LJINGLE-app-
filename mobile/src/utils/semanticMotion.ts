import type {
  EasingFunction,
} from 'react-native';

import { Easing } from 'react-native';

// semanticMotionV1
//
// Central motion language.
//
// Same principle as semanticFeedback:
// components request a meaningful motion,
// rather than inventing arbitrary animation durations.
//
// These are configuration primitives only.
// Nothing animates automatically.

export type SemanticMotionName =
  | 'ENTER'
  | 'EXIT'
  | 'SETTLE'
  | 'PRESS'
  | 'JINGLE'
  | 'TUNING'
  | 'PEEK'
  | 'UNDO';

export type TimingMotion = {
  duration: number;
  easing: EasingFunction;
};

export type SpringMotion = {
  damping: number;
  stiffness: number;
  mass: number;
};

export const semanticTiming = {
  enter: {
    duration: 220,
    easing: Easing.out(
      Easing.cubic,
    ),
  },

  exit: {
    duration: 160,
    easing: Easing.in(
      Easing.cubic,
    ),
  },

  settle: {
    duration: 260,
    easing: Easing.out(
      Easing.quad,
    ),
  },

  tuning: {
    duration: 420,
    easing: Easing.inOut(
      Easing.sin,
    ),
  },

  undo: {
    duration: 200,
    easing: Easing.out(
      Easing.cubic,
    ),
  },
} satisfies Record<
  'enter' | 'exit' | 'settle' | 'tuning' | 'undo',
  TimingMotion
>;

export const semanticSpring = {
  press: {
    damping: 18,
    stiffness: 260,
    mass: 0.7,
  },

  peek: {
    damping: 22,
    stiffness: 240,
    mass: 0.8,
  },

  jingle: {
    damping: 12,
    stiffness: 210,
    mass: 0.65,
  },
} satisfies Record<
  'press' | 'peek' | 'jingle',
  SpringMotion
>;

export const semanticScale = {
  pressed: 0.975,
  settled: 1,
};

export const jingleSwing = {
  inputRange: [0, 0.25, 0.5, 0.75, 1],

  rotate: [
    '0deg',
    '-9deg',
    '7deg',
    '-3deg',
    '0deg',
  ],
};

export const tuningMotion = {
  opacity: {
    from: 0.72,
    to: 1,
  },

  scale: {
    from: 0.985,
    to: 1,
  },
};

export const completionMotion = {
  scale: {
    from: 1,
    peak: 1.015,
    to: 1,
  },

  opacity: {
    from: 0.88,
    to: 1,
  },
};

// Respect system accessibility settings at integration time.
// Individual components should disable or simplify decorative
// movement when Reduce Motion is enabled.
export const reducedMotionFallback = {
  duration: 0,
};

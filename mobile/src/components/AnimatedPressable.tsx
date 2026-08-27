import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRef } from 'react';

import {
  pressIn,
  pressOut,
} from '../motion/uiMotion';
import {
  playUiCue,
  type UiCue,
} from '../audio/uiFeedback';

type AnimatedPressableProps = Omit<
  PressableProps,
  'style' | 'onPressIn' | 'onPressOut'
> & {
  style?: PressableProps['style'];
  pressedStyle?: StyleProp<ViewStyle>;
  cue?: UiCue | false;
  scaleTo?: number;
};

// animatedPressableV1
// Reusable physical-button feedback without changing screen layout.
export function AnimatedPressable({
  children,
  style,
  pressedStyle,
  cue = 'tap',
  scaleTo = 0.975,
  onPress,
  disabled,
  ...props
}: AnimatedPressableProps) {
  const scale = useRef(
    new Animated.Value(1),
  ).current;

  const handlePressIn = () => {
    // Keep the shared motion helper as the default physical feel.
    if (scaleTo === 0.975) {
      pressIn(scale).start();
      return;
    }

    Animated.spring(scale, {
      toValue: scaleTo,
      damping: 18,
      stiffness: 320,
      mass: 0.45,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    pressOut(scale).start();
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
      }}
    >
      <Pressable
        {...props}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={(event) => {
          if (cue) {
            void playUiCue(cue);
          }

          onPress?.(event);
        }}
        style={(state) => [
          typeof style === 'function'
            ? style(state)
            : style,
          state.pressed ? pressedStyle : null,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

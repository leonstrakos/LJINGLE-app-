import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useEffect, useRef } from 'react';

import {
  playUiCue,
  type UiCue,
} from '../audio/uiFeedback';
import { useReducedMotion } from '../utils/useReducedMotion';

type AnimatedPressableProps = Omit<
  PressableProps,
  'style' | 'onPressIn' | 'onPressOut'
> & {
  style?: PressableProps['style'];
  pressedStyle?: StyleProp<ViewStyle>;
  cue?: UiCue | false;
  scaleTo?: number;
  idleBreath?: boolean;
};

// animatedPressableV1
// Reusable physical-button feedback without changing screen layout.
export function AnimatedPressable({
  children,
  style,
  pressedStyle,
  cue = 'tap',
  scaleTo = 0.986,
  idleBreath = false,
  onPress,
  disabled,
  ...props
}: AnimatedPressableProps) {
  const scale = useRef(
    new Animated.Value(1),
  ).current;

  // ljingleSemanticAliveR1:hardware
  const reducedMotion = useReducedMotion();
  const breath = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    breath.stopAnimation();
    breath.setValue(1);
    if (!idleBreath || reducedMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue:1.004, duration:3200, useNativeDriver:true }),
      Animated.timing(breath, { toValue:1, duration:3600, useNativeDriver:true }),
    ]));
    animation.start();
    return () => { animation.stop(); breath.stopAnimation(); breath.setValue(1); };
  }, [breath, idleBreath, reducedMotion]);

  const livingScale = idleBreath && !reducedMotion ? Animated.multiply(scale, breath) : scale;

  const handlePressIn = () => {
    if (reducedMotion) return;
    scale.stopAnimation();
    Animated.spring(scale, {
      toValue: scaleTo,
      damping: 24,
      stiffness: 360,
      mass: 0.42,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reducedMotion) {
      scale.setValue(1);
      return;
    }
    scale.stopAnimation();
    Animated.spring(scale, {
      toValue: 1,
      damping: 24,
      stiffness: 360,
      mass: 0.42,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      // ljingleSemanticAliveR21Exact:living-container
      style={[
        idleBreath
          ? {
              flex: 1,
              alignSelf: 'stretch',
            }
          : null,
        {
          transform: [
            {
              scale:
                livingScale,
            },
          ],
        },
      ]}
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

// globalUndoToastV1

import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import { semanticFeedback } from '../utils/semanticFeedback';

// forkMCelestialSharedComponentsV1
const celestialMode = (activeVisualSkinId === 'classic' || activeVisualSkinId === 'classic-ljingle');
import { semanticSpring, semanticTiming } from '../utils/semanticMotion';

import {
  performUndo,
  subscribeToUndo,
  type UndoAction,
} from '../utils/undoManager';


import { celestial, celestialAlpha } from '../theme/celestial';
export function GlobalUndoToast() {
  const insets = useSafeAreaInsets();

  const [action, setAction] =
    useState<UndoAction | null>(null);

  const [busy, setBusy] =
    useState(false);

  const opacity =
    useRef(
      new Animated.Value(0),
    ).current;

  const translateY =
    useRef(
      new Animated.Value(16),
    ).current;


  useEffect(() => {
    return subscribeToUndo(
      (nextAction) => {
        setAction(nextAction);
        setBusy(false);

        if (!nextAction) {
          return;
        }

        opacity.setValue(0);
        translateY.setValue(16);

        Animated.parallel([
          Animated.timing(
            opacity,
            {
              toValue: 1,
              duration: semanticTiming.enter.duration,
              easing: semanticTiming.enter.easing,
              useNativeDriver: true,
            },
          ),

          Animated.spring(
            translateY,
            {
              toValue: 0,
              ...semanticSpring.peek,
              useNativeDriver: true,
            },
          ),
        ]).start();
      },
    );
  }, [
    opacity,
    translateY,
  ]);


  if (!action) {
    return null;
  }


  const undo = async () => {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      const undone = await performUndo(
        action.id,
      );

      if (undone) {
        // semanticUndoFeedbackV1
        void semanticFeedback.undo();
      }
    } finally {
      setBusy(false);
    }
  };


  return (
    <View
      style={[
        styles.layer,
        {
          pointerEvents:
            'box-none',
        } as any,
      ]}
    >
      <Animated.View
        style={[
          styles.toast,
          celestialMode && styles.celestialToast,
          {
            bottom:
              Math.max(
                insets.bottom,
                8,
              ) + 14,

            opacity,

            transform: [
              { translateY },
            ],
          },
        ]}
      >
        <Text
          numberOfLines={2}
          style={[styles.label, celestialMode && styles.celestialLabel]}
        >
          {action.label}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Poništi zadnju radnju"
          disabled={busy}
          hitSlop={8}
          onPress={() =>
            void undo()
          }
          style={({
            pressed,
          }) => [
            styles.undoButton,
            celestialMode && styles.celestialUndoButton,

            pressed &&
              !busy &&
              styles.undoButtonPressed,
          ]}
        >
          <Text
            style={[
              styles.undoText,
              celestialMode && styles.celestialUndoText,

              busy &&
                styles.undoTextBusy,
            ]}
          >
            {busy
              ? '...'
              : 'PONIŠTI'}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}


const styles =
  StyleSheet.create({
    layer: {
      ...StyleSheet.absoluteFillObject,

      zIndex: 9999,
      elevation: 9999,

      justifyContent: 'flex-end',
      alignItems: 'center',
    },

    toast: {
      position: 'absolute',

      width: '92%',
      maxWidth: 560,

      minHeight: 54,

      flexDirection: 'row',
      alignItems: 'center',

      paddingLeft: 16,
      paddingRight: 8,
      paddingVertical: 8,

      borderRadius: 18,

      backgroundColor:
        colors.text,

      shadowColor: '#000000',

      shadowOffset: {
        width: 0,
        height: 7,
      },

      shadowOpacity: 0.2,
      shadowRadius: 18,

      elevation: 12,
    },

    label: {
      flex: 1,

      marginRight: 12,

      color:
        colors.background,

      fontSize: 14,
      lineHeight: 19,

      fontWeight: '600',
    },

    undoButton: {
      minHeight: 38,

      alignItems: 'center',
      justifyContent: 'center',

      paddingHorizontal: 12,

      borderRadius: 12,
    },

    undoButtonPressed: {
      opacity: 0.6,
    },

    undoText: {
      color:
        colors.background,

      fontSize: 12,

      fontWeight: '900',

      letterSpacing: 0.5,
    },

    undoTextBusy: {
      opacity: 0.6,
    },
    celestialToast: {
      backgroundColor: celestial.night,
      borderWidth: 1,
      borderColor: celestialAlpha(celestial.gold, 0.66),
      shadowColor: celestial.gold,
      shadowOpacity: 0.14,
    },
    celestialLabel: { color: celestial.ivory },
    celestialUndoButton: {
      backgroundColor: celestial.gold,
      borderWidth: 1,
      borderColor: celestialAlpha(celestial.ivory, 0.34),
    },
    celestialUndoText: { color: celestial.night, letterSpacing: 0.7 },
  });

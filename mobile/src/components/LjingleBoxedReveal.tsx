// ljingleBoxedRevealV1
// boxedThemeSafeR4
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { playUiCue } from '../audio/uiFeedback';
import { CollectionMemoryBoxGlyph } from './CollectionMemoryBoxGlyph';
import {
  activeAccentColor,
  activeBackgroundColor,
  colors,
} from '../theme/colors';
import {
  themeColorWithAlpha,
  themeInkOn,
} from '../theme/themeColorUtils';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string | null;
  label?: string;
  actionLabel?: string;
  onOpened: () => void | Promise<void>;
  onRequestClose?: () => void;
};

const PARTICLES = [
  [-92, -78],
  [88, -62],
  [-112, 8],
  [112, 18],
  [-74, 84],
  [84, 92],
  [-12, -112],
  [18, 118],
] as const;

// ljingleMemoryCapsuleTrueSealR8:reveal
export function LjingleBoxedReveal({
  visible,
  title,
  subtitle,
  label = 'LJINGLE BOXED',
  actionLabel = 'OTVORI',
  onOpened,
  onRequestClose,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const [opening, setOpening] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduceMotion(value);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    setOpening(false);
  }, [progress, visible]);

  const open = () => {
    if (opening) return;
    setOpening(true);
    void playUiCue('open');

    if (reduceMotion) {
      progress.setValue(1);
      void Promise.resolve(onOpened()).finally(() => {
        setOpening(false);
      });
      return;
    }

    Animated.sequence([
      Animated.timing(progress, {
        toValue: 0.22,
        duration: 170,
        useNativeDriver: true,
      }),
      Animated.spring(progress, {
        toValue: 1,
        speed: 9,
        bounciness: 8,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        setOpening(false);
        return;
      }
      setTimeout(() => {
        void Promise.resolve(onOpened()).finally(() => {
          setOpening(false);
        });
      }, 240);
    });
  };

  const lidY = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, -2, -58],
  });
  const lidRotate = progress.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: ['0deg', '-2deg', '-10deg'],
  });
  const sealScale = progress.interpolate({
    inputRange: [0, 0.18, 0.36, 1],
    outputRange: [1, 1.2, 0.74, 0],
  });
  const boxScale = progress.interpolate({
    inputRange: [0, 0.2, 0.64, 1],
    outputRange: [1, 0.98, 1.04, 1],
  });
  const glow = progress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0.18, 0.72, 0],
  });
  const particleOpacity = progress.interpolate({
    inputRange: [0, 0.32, 0.7, 1],
    outputRange: [0, 0, 1, 0],
  });
  const particleScale = progress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0.2, 0.6, 1.35],
  });

  return (
    <Modal
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.stage}>
          <Text style={styles.eyebrow}>{label}</Text>
          <Text numberOfLines={3} style={styles.title}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={3} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}

          <View style={styles.animationArea}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.glow,
                {
                  opacity: glow,
                  transform: [{ scale: particleScale }],
                },
              ]}
            />

            {PARTICLES.map(([x, y], index) => (
              <Animated.Text
                key={String(index)}
                pointerEvents="none"
                style={[
                  styles.particle,
                  {
                    left: '50%',
                    top: '50%',
                    opacity: particleOpacity,
                    transform: [
                      { translateX: x },
                      { translateY: y },
                      { scale: particleScale },
                      { rotate: index % 2 ? '22deg' : '-16deg' },
                    ],
                  },
                ]}
              >
                {index % 3 === 0 ? '✧' : '✦'}
              </Animated.Text>
            ))}

            <Animated.View
              style={[
                styles.boxAssembly,
                { transform: [{ scale: boxScale }] },
              ]}
            >
              <View style={styles.boxBody}>
                <CollectionMemoryBoxGlyph
                  color={themeInkOn(activeAccentColor)}
                  size={68}
                />
                <Text style={styles.boxWordmark}>LJINGLE</Text>
              </View>

              <Animated.View
                style={[
                  styles.boxLid,
                  {
                    transform: [
                      { translateY: lidY },
                      { rotate: lidRotate },
                    ],
                  },
                ]}
              >
                <View style={styles.lidLine} />
              </Animated.View>

              <Animated.View
                style={[
                  styles.seal,
                  { transform: [{ scale: sealScale }] },
                ]}
              >
                <Text style={styles.sealText}>✦</Text>
              </Animated.View>
            </Animated.View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={opening}
            onPress={open}
            style={({ pressed }) => [
              styles.openButton,
              opening && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.openText}>
              {opening ? 'OTVARANJE…' : actionLabel}
            </Text>
          </Pressable>

          {onRequestClose ? (
            <Pressable
              accessibilityRole="button"
              disabled={opening}
              onPress={onRequestClose}
              style={({ pressed }) => [
                styles.notNow,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.notNowText}>NE JOŠ</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: themeColorWithAlpha(activeBackgroundColor, 0.92),
  },
  stage: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: activeAccentColor,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  eyebrow: {
    color: activeAccentColor,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  title: {
    marginTop: 10,
    color: colors.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 360,
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  animationArea: {
    width: 280,
    height: 255,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: activeAccentColor,
  },
  particle: {
    position: 'absolute',
    color: activeAccentColor,
    fontSize: 18,
    fontWeight: '900',
  },
  boxAssembly: {
    width: 152,
    height: 142,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  boxBody: {
    width: 144,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: activeAccentColor,
    backgroundColor: activeAccentColor,
  },
  boxWordmark: {
    marginTop: 5,
    color: themeInkOn(activeAccentColor),
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  boxLid: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 13,
    height: 40,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: activeAccentColor,
    backgroundColor: activeAccentColor,
  },
  lidLine: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 9,
    height: 2,
    borderRadius: 999,
    backgroundColor: themeColorWithAlpha(themeInkOn(activeAccentColor), 0.62),
  },
  seal: {
    position: 'absolute',
    top: 42,
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    borderWidth: 2,
    borderColor: activeAccentColor,
    backgroundColor: colors.surface,
  },
  sealText: {
    color: activeAccentColor,
    fontSize: 18,
    fontWeight: '900',
  },
  openButton: {
    minWidth: 190,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 17,
    backgroundColor: activeAccentColor,
  },
  openText: {
    color: themeInkOn(activeAccentColor),
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.7,
  },
  notNow: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  notNowText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
});

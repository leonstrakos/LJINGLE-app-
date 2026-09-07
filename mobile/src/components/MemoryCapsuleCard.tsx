// memoryCapsuleBoxedV1
// boxedThemeSafeR4
import { StyleSheet, Text, View } from 'react-native';

import { CollectionMemoryBoxGlyph } from './CollectionMemoryBoxGlyph';
import {
  activeAccentColor,
  colors,
} from '../theme/colors';
import {
  isMemoryCapsuleLocked,
  memoryCapsuleDateLabel,
} from '../services/memoryCapsules';
import type { MemoryCapsule } from '../types/memoryCapsule';
import { CelestialMotionLayer } from './CelestialMotionLayer';
import { ReactiveAmbientField } from './ReactiveAmbientField';
import { AnimatedPressable } from './AnimatedPressable';

type Props = {
  capsule: MemoryCapsule;
  onPress: () => void;
};

// ljingleMemoryCapsuleTrueSealR8:card
export function MemoryCapsuleCard({ capsule, onPress }: Props) {
  const sealed = Boolean(capsule.sealedAt);
  const locked = isMemoryCapsuleLocked(capsule);
  const total =
    capsule.itemCount +
    capsule.imageCount +
    capsule.collectionCount;

  const status = capsule.openedAt
    ? 'OTVORENO'
    : !sealed
      ? 'PAKIRANJE'
      : locked
        ? 'ZAPEČAĆENO · OTVARA SE ' +
          (memoryCapsuleDateLabel(capsule.openOn) || '')
        : 'SPREMNO ZA OTVARANJE';

  return (
    <AnimatedPressable
      idleBreath
      cue="tap"
      accessibilityRole="button"
      accessibilityLabel={'Memory Capsule ' + capsule.title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        sealed && locked && styles.cardLocked,
        pressed && styles.pressed,
      ]}
    >
      {/* ljingleSemanticAliveR21Exact:capsule */}
      <ReactiveAmbientField
        mode="capsule"
        active={Boolean(
          capsule.openOn &&
            Date.parse(
              capsule.openOn,
            ) >
              Date.now() &&
            Date.parse(
              capsule.openOn,
            ) -
                Date.now() <=
              7 *
                24 *
                60 *
                60 *
                1000
        )}
      />
      <View style={styles.icon}>
        {/* ljingleCelestialMotionLanguageR1:capsule-card */}
        <CelestialMotionLayer preset="capsule" />
        <View style={styles.clockBadge}>
          <View style={styles.clockCrown} />
          <View style={styles.clockFace}>
            <View style={styles.clockCenter} />
            <View style={styles.clockHandLong} />
            <View style={styles.clockHandShort} />
          </View>
        </View>
        <CollectionMemoryBoxGlyph
          color={!sealed || locked ? colors.textMuted : activeAccentColor}
          size={38}
        />
      </View>

      <View style={styles.copy}>
        <Text
          style={[
            styles.status,
            sealed && !locked && styles.statusReady,
          ]}
        >
          {status}
        </Text>
        <Text numberOfLines={2} style={styles.title}>
          {capsule.title}
        </Text>
        {capsule.description ? (
          <Text numberOfLines={2} style={styles.description}>
            {capsule.description}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          MEMORY CAPSULE{capsule.openedAt ? ' · ' + total + ' UNUTRA' : ''}
        </Text>
      </View>

      <Text style={styles.arrow}>›</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 128,
    marginBottom: 12,
    padding: 17,
    paddingRight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: activeAccentColor,
    backgroundColor: colors.surface,
  },
  cardLocked: {
    borderColor: colors.separator,
  },
  icon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fillStrong,
    overflow: 'visible',
  },
  clockBadge: {
    position: 'absolute',
    top: -5,
    right: -3,
    width: 19,
    height: 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  clockCrown: {
    position: 'absolute',
    top: 0,
    left: 7.5,
    width: 4,
    height: 4,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: activeAccentColor,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  clockFace: {
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7.5,
    borderWidth: 1,
    borderColor: activeAccentColor,
    backgroundColor: colors.surface,
  },
  clockCenter: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: activeAccentColor,
  },
  clockHandLong: {
    position: 'absolute',
    width: 1.5,
    height: 5,
    borderRadius: 1,
    backgroundColor: activeAccentColor,
    transform: [{ translateY: -1.5 }],
  },
  clockHandShort: {
    position: 'absolute',
    width: 4,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: activeAccentColor,
    transform: [{ translateX: 1.75 }],
  },
  copy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 15,
  },
  status: {
    color: colors.textMuted,
    fontSize: 8,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  statusReady: {
    color: activeAccentColor,
  },
  title: {
    marginTop: 5,
    color: colors.text,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '900',
  },
  description: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  meta: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  arrow: {
    position: 'absolute',
    right: 17,
    top: '50%',
    color: colors.textMuted,
    fontSize: 29,
    fontWeight: '300',
  },
  pressed: { opacity: 0.7 },
});

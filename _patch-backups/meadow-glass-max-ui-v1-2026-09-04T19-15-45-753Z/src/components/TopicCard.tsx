import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import type { TopicResponse } from '../types/topic';

import { celestial, celestialAlpha } from '../theme/celestial';
// forkMCelestialSharedComponentsV1
const celestialMode = activeVisualSkinId === 'classic';
const aeroMode = activeVisualSkinId === 'aero';

type Props = {
  topic: TopicResponse;
  onPress: () => void;
};

function activityCountLabel(count: number) {
  if (count === 1) return '1 aktivnost';
  if (count > 1 && count < 5) return `${count} aktivnosti`;
  return `${count} aktivnosti`;
}

export function TopicCard({ topic, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Otvori temu ${topic.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, aeroMode && styles.aeroCard, celestialMode && styles.celestialCard, pressed && styles.pressed]}
    >
      <View style={[styles.monogram, aeroMode && styles.aeroMonogram, celestialMode && styles.celestialMonogram]}>
        <Text style={[styles.monogramText, celestialMode && styles.celestialMonogramText]}>{topic.name.trim().charAt(0).toUpperCase()}</Text>
      </View>

      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.name, celestialMode && styles.celestialName]}>
          {topic.name}
        </Text>
        <Text numberOfLines={2} style={[styles.description, celestialMode && styles.celestialMuted]}>
          {topic.description || 'Osobni prostor za aktivnosti i vrijeme.'}
        </Text>
        <Text style={[styles.count, celestialMode && styles.celestialCount]}>{activityCountLabel(topic.activityCount)}</Text>
      </View>

      <Text style={[styles.arrow, celestialMode && styles.celestialArrow]}>✦</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 116,
    marginBottom: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.99 }],
  },
  monogram: {
    width: 58,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.black,
  },
  monogramText: {
    color: colors.white,
    fontSize: 27,
    fontWeight: '800',
  },
  copy: {
    flex: 1,
    paddingHorizontal: 15,
  },
  name: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  description: {
    minHeight: 34,
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
  },
  count: {
    marginTop: 7,
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  arrow: {
    color: colors.textMuted,
    fontSize: 28,
    fontWeight: '300',
  },
  aeroCard: {
    borderColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#087CB8',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 4,
  },
  aeroMonogram: {
    backgroundColor: '#0B88C8',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  celestialCard: {
    backgroundColor: celestial.night,
    borderColor: celestialAlpha(celestial.gold, 0.42),
    shadowColor: celestial.gold,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  celestialMonogram: {
    backgroundColor: celestialAlpha(celestial.gold, 0.08),
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.55),
  },
  celestialMonogramText: { color: celestial.gold },
  celestialName: { color: celestial.ivory },
  celestialMuted: { color: celestialAlpha(celestial.ivory, 0.62) },
  celestialCount: { color: celestial.gold, letterSpacing: 0.8 },
  celestialArrow: { color: celestial.gold, fontSize: 13 },
});

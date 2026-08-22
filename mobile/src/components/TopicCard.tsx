import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { TopicResponse } from '../types/topic';

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
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.monogram}>
        <Text style={styles.monogramText}>{topic.name.trim().charAt(0).toUpperCase()}</Text>
      </View>

      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.name}>
          {topic.name}
        </Text>
        <Text numberOfLines={2} style={styles.description}>
          {topic.description || 'Osobni prostor za aktivnosti i vrijeme.'}
        </Text>
        <Text style={styles.count}>{activityCountLabel(topic.activityCount)}</Text>
      </View>

      <Text style={styles.arrow}>›</Text>
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
});

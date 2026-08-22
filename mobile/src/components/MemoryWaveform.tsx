import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';

type Props = {
  progress: number;
  seed: string;
};

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function MemoryWaveform({ progress, seed }: Props) {
  const bars = useMemo(() => {
    let state = hash(seed);
    return Array.from({ length: 34 }, () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return 8 + (state % 27);
    });
  }, [seed]);
  const active = Math.round(Math.max(0, Math.min(1, progress)) * bars.length);

  return (
    <View style={styles.wave}>
      {bars.map((height, index) => (
        <View
          key={`${seed}-${index}`}
          style={[
            styles.bar,
            { height },
            index < active ? styles.barActive : styles.barIdle,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wave: {
    height: 38,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bar: {
    width: 3,
    marginRight: 3,
    borderRadius: 999,
  },
  barActive: {
    backgroundColor: colors.navy,
  },
  barIdle: {
    backgroundColor: colors.border,
  },
});

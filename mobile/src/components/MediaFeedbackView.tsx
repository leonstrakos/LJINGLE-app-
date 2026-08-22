import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

type Props = {
  type: 'loading' | 'error' | 'empty';
  message?: string;
  onRetry?: () => void;
};

export function MediaFeedbackView({ type, message, onRetry }: Props) {
  if (type === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.black} />
        <Text style={styles.message}>{message ?? 'Učitavanje filmova i serija…'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.symbol}>{type === 'error' ? '!' : '▶'}</Text>
      <Text style={styles.title}>
        {type === 'error' ? 'Dohvat nije uspio' : 'Katalog je još prazan'}
      </Text>
      <Text style={styles.message}>
        {message ?? (type === 'empty'
          ? 'Dodajte prvi film ili seriju iz online pretrage.'
          : 'Pokušajte ponovno.')}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retry}>
          <Text style={styles.retryLabel}>Pokušaj ponovno</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  symbol: {
    width: 54,
    height: 54,
    borderRadius: 27,
    color: colors.text,
    backgroundColor: colors.fillStrong,
    fontSize: 22,
    lineHeight: 54,
    textAlign: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 15,
  },
  message: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
  },
  retry: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.black,
  },
  retryLabel: {
    color: colors.white,
    fontWeight: '700',
  },
});

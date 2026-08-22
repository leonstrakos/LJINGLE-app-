import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

type Props = {
  type: 'loading' | 'error' | 'empty';
  message?: string;
  onRetry?: () => void;
};

export function FeedbackView({ type, message, onRetry }: Props) {
  if (type === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.black} />
        <Text style={styles.message}>Učitavanje knjiga…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.symbol}>{type === 'error' ? '!' : '⌁'}</Text>
      <Text style={styles.title}>
        {type === 'error' ? 'Nešto nije u redu' : 'Polica je još prazna'}
      </Text>
      <Text style={styles.message}>
        {message ??
          (type === 'empty'
            ? 'Dodajte prvu knjigu i započnite svoju zbirku.'
            : 'Pokušajte ponovno.')}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>Pokušaj ponovno</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 320,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  symbol: {
    width: 54,
    height: 54,
    borderRadius: 27,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: colors.black,
    backgroundColor: colors.fillStrong,
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 22,
    backgroundColor: colors.black,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: colors.white,
    fontWeight: '700',
  },
});
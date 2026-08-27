import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';

import { celestial, celestialAlpha } from '../theme/celestial';
// forkMCelestialSharedComponentsV1
const celestialMode = activeVisualSkinId === 'classic';

type Props = {
  type: 'loading' | 'error' | 'empty';
  message?: string;
  onRetry?: () => void;
};

export function MediaFeedbackView({ type, message, onRetry }: Props) {
  if (type === 'loading') {
    return (
      <View style={[styles.container, celestialMode && styles.celestialContainer]}>
        <ActivityIndicator size="large" color={colors.black} />
        <Text style={[styles.message, celestialMode && styles.celestialMessage]}>{message ?? 'Učitavanje filmova i serija…'}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, celestialMode && styles.celestialContainer]}>
      <Text style={[styles.symbol, celestialMode && styles.celestialSymbol]}>{type === 'error' ? '!' : celestialMode ? '✦' : '▶'}</Text>
      <Text style={[styles.title, celestialMode && styles.celestialTitle]}>
        {type === 'error' ? 'Dohvat nije uspio' : 'Katalog je još prazan'}
      </Text>
      <Text style={[styles.message, celestialMode && styles.celestialMessage]}>
        {message ?? (type === 'empty'
          ? 'Dodajte prvi film ili seriju iz online pretrage.'
          : 'Pokušajte ponovno.')}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={[styles.retry, celestialMode && styles.celestialRetry]}>
          <Text style={[styles.retryLabel, celestialMode && styles.celestialRetryText]}>Pokušaj ponovno</Text>
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
  celestialContainer: {
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.25),
    borderRadius: 26,
    backgroundColor: celestialAlpha(celestial.night, 0.035),
  },
  celestialSymbol: {
    color: celestial.gold,
    backgroundColor: celestial.night,
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.66),
  },
  celestialTitle: { letterSpacing: -0.2 },
  celestialMessage: { maxWidth: 420 },
  celestialRetry: {
    backgroundColor: celestial.night,
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.62),
  },
  celestialRetryText: { color: celestial.gold, letterSpacing: 0.55 },
});

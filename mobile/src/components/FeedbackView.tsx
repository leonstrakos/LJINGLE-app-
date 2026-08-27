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

export function FeedbackView({ type, message, onRetry }: Props) {
  if (type === 'loading') {
    return (
      <View style={[styles.container, celestialMode && styles.celestialContainer]}>
        <ActivityIndicator size="large" color={colors.black} />
        <Text style={[styles.message, celestialMode && styles.celestialMessage]}>Učitavanje knjiga…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, celestialMode && styles.celestialContainer]}>
      <Text style={[styles.symbol, celestialMode && styles.celestialSymbol]}>{type === 'error' ? '!' : celestialMode ? '✦' : '⌁'}</Text>
      <Text style={[styles.title, celestialMode && styles.celestialTitle]}>
        {type === 'error' ? 'Nešto nije u redu' : 'Polica je još prazna'}
      </Text>
      <Text style={[styles.message, celestialMode && styles.celestialMessage]}>
        {message ??
          (type === 'empty'
            ? 'Dodajte prvu knjigu i započnite svoju zbirku.'
            : 'Pokušajte ponovno.')}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={[styles.retryButton, celestialMode && styles.celestialRetry]}>
          <Text style={[styles.retryText, celestialMode && styles.celestialRetryText]}>Pokušaj ponovno</Text>
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
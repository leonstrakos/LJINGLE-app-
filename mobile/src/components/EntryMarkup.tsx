import { StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';

import { celestial, celestialAlpha } from '../theme/celestial';
// forkMCelestialSharedComponentsV1
const celestialMode = activeVisualSkinId === 'classic';

type Props = {
  content: string;
  onOpenReference?: (title: string) => void;
  quote?: boolean;
  numberOfLines?: number;
};

type InlineProps = {
  text: string;
  onOpenReference?: (title: string) => void;
};

function InlineMarkup({ text, onOpenReference }: InlineProps) {
  const parts = text.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|==[^=]+==)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('[[') && part.endsWith(']]')) {
          const title = part.slice(2, -2).trim();
          return (
            <Text key={`${part}-${index}`} onPress={() => onOpenReference?.(title)} style={[styles.reference, celestialMode && styles.celestialReference]}>
              {title}
            </Text>
          );
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return <Text key={`${part}-${index}`} style={styles.bold}>{part.slice(2, -2)}</Text>;
        }
        if (part.startsWith('==') && part.endsWith('==')) {
          return <Text key={`${part}-${index}`} style={[styles.highlight, celestialMode && styles.celestialHighlight]}>{part.slice(2, -2)}</Text>;
        }
        return <Text key={`${part}-${index}`}>{part}</Text>;
      })}
    </>
  );
}

export function EntryMarkup({ content, onOpenReference, quote = false, numberOfLines }: Props) {
  const lines = content.split('\n');

  return (
    <Text numberOfLines={numberOfLines} style={[styles.content, celestialMode && styles.celestialContent, quote && styles.quote, quote && celestialMode && styles.celestialQuote]}>
      {quote ? '“' : ''}
      {lines.map((line, index) => {
        const isList = line.startsWith('- ');
        const isQuote = line.startsWith('> ');
        const value = isList || isQuote ? line.slice(2) : line;
        return (
          <Text key={`${line}-${index}`}>
            {index > 0 ? '\n' : ''}
            {isList ? '• ' : isQuote ? '“' : ''}
            <InlineMarkup onOpenReference={onOpenReference} text={value} />
            {isQuote ? '”' : ''}
          </Text>
        );
      })}
      {quote ? '”' : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  content: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  quote: {
    color: colors.navySoft,
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  bold: {
    fontWeight: '800',
  },
  highlight: {
    backgroundColor: colors.goldSoft,
    borderRadius: 3,
  },
  reference: {
    color: colors.navySoft,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  celestialContent: { color: celestial.ivory },
  celestialQuote: { color: celestial.gold },
  celestialReference: { color: celestial.gold },
  celestialHighlight: {
    color: celestial.ivory,
    backgroundColor: celestialAlpha(celestial.gold, 0.22),
  },
});

import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EntryMarkup } from './EntryMarkup';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
// forkMCelestialSharedComponentsV1
const celestialMode = activeVisualSkinId === 'classic';
import {
  entryTypeLabels,  type Entry,
  type EntryLinkLabels,
} from '../types/entry';

import { celestial, celestialAlpha } from '../theme/celestial';
type Props = {
  entry: Entry;
  linkLabels: EntryLinkLabels;
  onEdit: () => void;
  onDelete: () => void;
  onOpenReference?: (title: string) => void;
  imageUris?: string[];
};

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date);
}

function boldFragments(content: string) {
  const found = content.match(/\*\*[^*]+\*\*/g) ?? [];
  return [...new Set(found.map((item) => item.slice(2, -2).trim()).filter(Boolean))].slice(0, 4);
}

function attachmentLabels(entry: Entry, labels: EntryLinkLabels) {
  return [
    entry.bookId ? `Knjiga · ${labels.books[entry.bookId] ?? 'Povezana knjiga'}` : null,
    entry.topicId ? `Tema · ${labels.topics[entry.topicId] ?? 'Povezana tema'}` : null,
    entry.activityId
      ? `Aktivnost · ${labels.activities[entry.activityId] ?? 'Povezana aktivnost'}`
      : null,
  ].filter((value): value is string => Boolean(value));
}

export function EntryCard({
  entry,
  linkLabels,
  onEdit,
  onDelete,
  onOpenReference,
  imageUris = [],
}: Props) {
  const attachments = attachmentLabels(entry, linkLabels);
  const highlights = boldFragments(entry.content);
  const isLong = entry.content.length > 460 || entry.content.split('\n').length > 8;
  const showHighlights = isLong && highlights.length > 0;
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  return (
    <View style={[styles.card, celestialMode && styles.celestialCard]}>
      <View style={styles.topLine}>
        <View style={styles.typeGroup}>
          <View>
            <Text style={[styles.typeLabel, celestialMode && styles.celestialType]}>{entryTypeLabels[entry.type]}</Text>
            <Text style={[styles.date, celestialMode && styles.celestialMuted]}>{dateLabel(entry.modifiedAt)}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityLabel="Uredi zapis"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onEdit}
            style={({ pressed }) => [styles.actionButton, celestialMode && styles.celestialActionButton, pressed && styles.pressed]}
          >
            <Text style={[styles.actionText, celestialMode && styles.celestialActionText]}>Uredi</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Obriši zapis"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onDelete}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          >
            <Text style={styles.deleteText}>Obriši</Text>
          </Pressable>
        </View>
      </View>
<View style={styles.body}>
        {entry.title ? (
          <Text numberOfLines={2} style={[styles.title, celestialMode && styles.celestialTitle]}>
            {entry.title}
          </Text>
        ) : null}
        <View style={styles.content}>
          <EntryMarkup
            content={entry.content}
            onOpenReference={onOpenReference}
            numberOfLines={entry.type === 'QUOTE' ? 6 : 7}
            quote={entry.type === 'QUOTE'}
          />
        </View>

        {imageUris.length > 0 ? (
          <>
            <ScrollView
              contentContainerStyle={styles.imageStrip}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {imageUris.map((uri, index) => (
                <Pressable
                  accessibilityLabel={`Otvori sliku ${index + 1}`}
                  accessibilityRole="button"
                  key={uri + index}
                  onPress={() => setViewerImage(uri)}
                  style={({ pressed }) => [
                    styles.imageThumbButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Image
                    resizeMode="cover"
                    source={{ uri }}
                    style={styles.imageThumb}
                  />
                </Pressable>
              ))}
            </ScrollView>

            <Modal
              animationType="fade"
              onRequestClose={() => setViewerImage(null)}
              transparent
              visible={viewerImage !== null}
            >
              <Pressable
                onPress={() => setViewerImage(null)}
                style={styles.viewerBackdrop}
              >
                {viewerImage ? (
                  <Image
                    resizeMode="contain"
                    source={{ uri: viewerImage }}
                    style={styles.viewerImage}
                  />
                ) : null}

                <Text style={styles.viewerHint}>
                  Dodirni za zatvaranje
                </Text>
              </Pressable>
            </Modal>
          </>
        ) : null}

        {showHighlights ? (
          <View style={styles.highlights}>
            <Text style={[styles.highlightsLabel, celestialMode && styles.celestialHighlightsLabel]}>IZDVOJENO IZ ZAPISA</Text>
            {highlights.map((highlight) => (
              <View key={highlight} style={styles.highlightRow}>
                <View style={[styles.highlightLine, celestialMode && styles.celestialHighlightLine]} />
                <Text style={[styles.highlightText, celestialMode && styles.celestialHighlightText]}>{highlight}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {attachments.length > 0 ? (
          <View style={styles.attachments}>
            {attachments.map((attachment) => (
              <View key={attachment} style={[styles.attachmentPill, celestialMode && styles.celestialAttachmentPill]}>
                <Text numberOfLines={1} style={[styles.attachmentText, celestialMode && styles.celestialAttachmentText]}>
                  {attachment}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 22,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 28,
    backgroundColor: colors.surface,
    padding: 28,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeGroup: {
    flex: 1,
    minWidth: 0,
  },
  typeLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  date: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
  },
  actions: {
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.fill,
  },
  deleteButton: {
    marginLeft: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.dangerSoft,
  },
  actionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  body: {
    marginTop: 0,
  },
  title: {
    marginTop: 25,
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 34,
  },
  content: {
    marginTop: 15,
  },
  imageStrip: {
    marginTop: 20,
    paddingRight: 8,
  },
  imageThumbButton: {
    width: 126,
    height: 126,
    marginRight: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.fill,
  },
  imageThumb: {
    width: '100%',
    height: '100%',
  },
  viewerBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: celestialAlpha(celestial.shadow, 0.92),
    padding: 20,
  },
  viewerImage: {
    width: '100%',
    height: '82%',
  },
  viewerHint: {
    marginTop: 14,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.72,
  },
  highlights: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
    paddingTop: 17,
  },
  highlightsLabel: {
    marginBottom: 11,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  highlightLine: {
    width: 3,
    alignSelf: 'stretch',
    marginRight: 11,
    borderRadius: 999,
    backgroundColor: colors.navySoft,
  },
  highlightText: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24,
  },
    attachments: {
    marginTop: 21,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  attachmentPill: {
    maxWidth: '100%',
    marginRight: 6,
    marginBottom: 6,
    borderRadius: 999,
    backgroundColor: colors.fill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  attachmentText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
  celestialCard: {
    backgroundColor: celestial.night,
    borderColor: celestialAlpha(celestial.gold, 0.44),
    shadowColor: celestial.gold,
    shadowOpacity: 0.09,
  },
  celestialType: { color: celestial.gold, letterSpacing: 1.0 },
  celestialMuted: { color: celestialAlpha(celestial.ivory, 0.58) },
  celestialActionButton: {
    backgroundColor: celestialAlpha(celestial.gold, 0.08),
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.25),
  },
  celestialActionText: { color: celestial.gold },
  celestialTitle: { color: celestial.ivory },
  celestialHighlightsLabel: { color: celestial.gold, letterSpacing: 1.2 },
  celestialHighlightLine: { backgroundColor: celestial.gold },
  celestialHighlightText: { color: celestial.ivory },
  celestialAttachmentPill: {
    backgroundColor: celestialAlpha(celestial.ivory, 0.05),
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.22),
  },
  celestialAttachmentText: { color: celestialAlpha(celestial.ivory, 0.62) },
  celestialTypeLabel: {
    color: celestial.gold,
    letterSpacing: 1.15,
  },

});

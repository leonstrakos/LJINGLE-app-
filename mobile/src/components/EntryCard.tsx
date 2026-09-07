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
import { celestial, celestialAlpha } from '../theme/celestial';
import {
  entryTypeLabels,
  entryTypeMarks,
  type Entry,
  type EntryLinkLabels,
} from '../types/entry';
import type { ReaderAnchorPreview } from '../types/reader';
import { FreshItemShimmer } from './FreshItemShimmer';

const celestialMode = (activeVisualSkinId === 'classic' || activeVisualSkinId === 'classic-ljingle');
const aeroMode = activeVisualSkinId === 'aero';

type Props = {
  entry: Entry;
  linkLabels: EntryLinkLabels;
  onEdit: () => void;
  onDelete: () => void;
  onOpenReference?: (title: string) => void;
  onOpenReaderAnchor?: () => void;
  readerAnchor?: ReaderAnchorPreview | null;
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

function attachmentLabels(entry: Entry, labels: EntryLinkLabels) {
  return [
    entry.bookId ? `Knjiga · ${labels.books[entry.bookId] ?? 'Povezana knjiga'}` : null,
    entry.topicId ? `Tema · ${labels.topics[entry.topicId] ?? 'Povezana tema'}` : null,
    entry.activityId
      ? `Aktivnost · ${labels.activities[entry.activityId] ?? 'Povezana aktivnost'}`
      : null,
  ].filter((value): value is string => Boolean(value));
}

function readerAnchorLabel(anchor: ReaderAnchorPreview) {
  if (anchor.format === 'PDF' && anchor.page) return `PDF · stranica ${anchor.page}`;
  return 'EPUB · spremljeno mjesto';
}

export function EntryCard({
  entry,
  linkLabels,
  onEdit,
  onDelete,
  onOpenReference,
  onOpenReaderAnchor,
  readerAnchor,
  imageUris = [],
}: Props) {
  const attachments = attachmentLabels(entry, linkLabels);
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  return (
    <View
      style={[
        styles.card,
        aeroMode && styles.aeroCard,
        celestialMode && styles.celestialCard,
      ]}
    >
      {/* ljingleSemanticAliveR21Exact:entry-fresh */}
      <FreshItemShimmer
        entityKey={
          'ENTRY:' +
          entry.entryId
        }
        createdAt={
          (entry as any).createdAt ??
          (entry as any).modifiedAt ??
          null
        }
      />
      <View style={[styles.accentRail, celestialMode && styles.celestialAccentRail]} />
      <View pointerEvents="none" style={styles.cardConstellation}>
        <Text style={styles.cardStarLarge}>✦</Text>
        <Text style={styles.cardStarSmall}>⋆</Text>
        <Text style={styles.cardGlyph}>⌑</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.topLine}>
          <View style={styles.identity}>
            <View style={[styles.typeMark, celestialMode && styles.celestialTypeMark]}>
              <Text style={[styles.typeMarkText, celestialMode && styles.celestialTypeMarkText]}>
                {entryTypeMarks[entry.type]}
              </Text>
            </View>
            <View style={styles.identityCopy}>
              <Text style={[styles.typeLabel, celestialMode && styles.celestialType]}>
                {entryTypeLabels[entry.type]}
              </Text>
              <Text style={[styles.date, celestialMode && styles.celestialMuted]}>
                {dateLabel(entry.modifiedAt)}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityLabel="Uredi zapis"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onEdit}
              style={({ pressed }) => [
                styles.actionButton,
                celestialMode && styles.celestialActionButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.actionText, celestialMode && styles.celestialActionText]}>
                Uredi
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Obriši zapis"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onDelete}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
            >
              <Text style={styles.deleteText}>×</Text>
            </Pressable>
          </View>
        </View>


        {entry.customLabel ? (
          <View style={styles.customLabelChip}>
            <Text style={styles.customLabelMark}>✦</Text>
            <Text numberOfLines={1} style={styles.customLabelText}>
              {entry.customLabel}
            </Text>
          </View>
        ) : null}

        {/* ljingleEntryObsidianUxR1:card — null title remains null in storage; UI says Untitled. */}
        <Text numberOfLines={3} style={[styles.title, celestialMode && styles.celestialTitle]}>
          {entry.title?.trim() || 'Untitled'}
        </Text>

        <View style={[styles.content, entry.type === 'QUOTE' && styles.quoteContent]}>
          <EntryMarkup
            content={entry.content}
            numberOfLines={entry.type === 'QUOTE' ? 7 : 8}
            onOpenReference={onOpenReference}
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
                  style={({ pressed }) => [styles.imageThumbButton, pressed && styles.pressed]}
                >
                  <Image resizeMode="cover" source={{ uri }} style={styles.imageThumb} />
                </Pressable>
              ))}
            </ScrollView>

            <Modal
              animationType="fade"
              onRequestClose={() => setViewerImage(null)}
              transparent
              visible={viewerImage !== null}
            >
              <Pressable onPress={() => setViewerImage(null)} style={styles.viewerBackdrop}>
                {viewerImage ? (
                  <Image resizeMode="contain" source={{ uri: viewerImage }} style={styles.viewerImage} />
                ) : null}
                <Text style={styles.viewerHint}>Dodirni za zatvaranje</Text>
              </Pressable>
            </Modal>
          </>
        ) : null}

        {readerAnchor ? (
          <Pressable
            accessibilityRole="button"
            onPress={onOpenReaderAnchor}
            style={({ pressed }) => [
              styles.readerAnchor,
              celestialMode && styles.celestialReaderAnchor,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.readerAnchorMark, celestialMode && styles.celestialReaderAnchorText]}>⌑</Text>
            <View style={styles.readerAnchorCopy}>
              <Text style={[styles.readerAnchorTitle, celestialMode && styles.celestialReaderAnchorText]}>
                {readerAnchorLabel(readerAnchor)}
              </Text>
              {readerAnchor.selectedText ? (
                <Text numberOfLines={1} style={[styles.readerAnchorQuote, celestialMode && styles.celestialMuted]}>
                  {readerAnchor.selectedText}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.readerAnchorArrow, celestialMode && styles.celestialReaderAnchorText]}>›</Text>
          </Pressable>
        ) : null}

        {attachments.length > 0 ? (
          <View style={styles.attachments}>
            {attachments.map((attachment) => (
              <View
                key={attachment}
                style={[
                  styles.attachmentPill,
                  celestialMode && styles.celestialAttachmentPill,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.attachmentText,
                    celestialMode && styles.celestialAttachmentText,
                  ]}
                >
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
  // ljingleZapisiVaultR1: quiet archive-card ornament and custom thread chip.
  cardConstellation: {
    ...StyleSheet.absoluteFillObject,
  },
  cardStarLarge: {
    position: 'absolute',
    top: 12,
    right: 108,
    color: celestialAlpha(celestial.gold, 0.16),
    fontSize: 13,
  },
  cardStarSmall: {
    position: 'absolute',
    top: 35,
    right: 92,
    color: celestialAlpha(celestial.gold, 0.11),
    fontSize: 15,
  },
  cardGlyph: {
    position: 'absolute',
    right: 13,
    bottom: 10,
    color: celestialAlpha(celestial.gold, 0.075),
    fontSize: 28,
  },
  customLabelChip: {
    alignSelf: 'flex-start',
    maxWidth: '86%',
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.22),
    borderRadius: 999,
    backgroundColor: celestialAlpha(celestial.gold, 0.065),
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  customLabelMark: {
    marginRight: 6,
    color: celestial.gold,
    fontSize: 10,
  },
  customLabelText: {
    color: celestialAlpha(celestial.ivory, 0.66),
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  card: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 20,
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.045,
    shadowRadius: 12,
    elevation: 2,
  },
  accentRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    backgroundColor: colors.gold,
  },
  cardBody: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 17 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  identityCopy: { flex: 1, minWidth: 0, marginLeft: 9 },
  typeMark: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.goldSoft,
  },
  typeMarkText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  typeLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  date: { marginTop: 2, color: colors.textMuted, fontSize: 11 },
  actions: { marginLeft: 10, flexDirection: 'row', alignItems: 'center' },
  actionButton: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.fill,
    paddingHorizontal: 10,
  },
  deleteButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    borderRadius: 10,
    backgroundColor: colors.dangerSoft,
  },
  actionText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  deleteText: { color: colors.danger, fontSize: 23, lineHeight: 25, fontWeight: '400' },
  title: {
    marginTop: 15,
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.35,
    lineHeight: 27,
  },
  content: { marginTop: 10 },
  quoteContent: {
    borderLeftWidth: 2,
    borderLeftColor: colors.gold,
    paddingLeft: 12,
  },
  imageStrip: { marginTop: 14, paddingRight: 8 },
  imageThumbButton: {
    width: 104,
    height: 104,
    marginRight: 8,
    overflow: 'hidden',
    borderRadius: 13,
    backgroundColor: colors.fill,
  },
  imageThumb: { width: '100%', height: '100%' },
  viewerBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: celestialAlpha(celestial.shadow, 0.92),
    padding: 20,
  },
  viewerImage: { width: '100%', height: '82%' },
  viewerHint: { marginTop: 14, color: '#FFFFFF', fontSize: 12, fontWeight: '600', opacity: 0.72 },
  readerAnchor: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 14,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  readerAnchorMark: { color: colors.text, fontSize: 21, fontWeight: '800' },
  readerAnchorCopy: { flex: 1, minWidth: 0, marginLeft: 9 },
  readerAnchorTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  readerAnchorQuote: { marginTop: 2, color: colors.textMuted, fontSize: 11 },
  readerAnchorArrow: { marginLeft: 8, color: colors.text, fontSize: 22 },
  attachments: { marginTop: 13, flexDirection: 'row', flexWrap: 'wrap' },
  attachmentPill: {
    maxWidth: '100%',
    marginRight: 6,
    marginBottom: 6,
    borderRadius: 999,
    backgroundColor: colors.fill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  attachmentText: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  pressed: { opacity: 0.72 },
  aeroCard: {
    borderColor: 'rgba(255,255,255,0.94)',
    shadowColor: colors.navySoft,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.13,
    shadowRadius: 15,
    elevation: 3,
  },
  celestialCard: {
    backgroundColor: celestial.night,
    borderColor: celestialAlpha(celestial.gold, 0.40),
    shadowColor: celestial.gold,
    shadowOpacity: 0.08,
  },
  celestialAccentRail: { backgroundColor: celestial.gold },
  celestialTypeMark: {
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.28),
    backgroundColor: celestialAlpha(celestial.gold, 0.08),
  },
  celestialTypeMarkText: { color: celestial.gold },
  celestialType: { color: celestial.gold, letterSpacing: 0.75 },
  celestialMuted: { color: celestialAlpha(celestial.ivory, 0.58) },
  celestialActionButton: {
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.24),
    backgroundColor: celestialAlpha(celestial.gold, 0.07),
  },
  celestialActionText: { color: celestial.gold },
  celestialTitle: { color: celestial.ivory },
  celestialReaderAnchor: {
    borderColor: celestialAlpha(celestial.gold, 0.25),
    backgroundColor: celestialAlpha(celestial.gold, 0.07),
  },
  celestialReaderAnchorText: { color: celestial.gold },
  celestialAttachmentPill: {
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.20),
    backgroundColor: celestialAlpha(celestial.ivory, 0.045),
  },
  celestialAttachmentText: { color: celestialAlpha(celestial.ivory, 0.62) },
});

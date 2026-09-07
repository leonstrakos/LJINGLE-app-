// ljingleEntriesGalleryMemoryBoxR2
import { useEffect, useRef } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { activeAccentColor, colors } from '../theme/colors';

export type EntryGalleryMode = 'LIST' | 'GALLERY';

export type EntryGalleryItem = {
  key: string;
  entryId: string;
  uri: string;
  title: string;
  typeLabel: string;
  // ljingleReaderGalleryCrossoverR2:component
  sourceLabel: string | null;
  sourceLocation: string | null;
};

type ToggleProps = {
  value: EntryGalleryMode;
  onChange: (value: EntryGalleryMode) => void;
};

export function EntryGalleryViewToggle({
  value,
  onChange,
}: ToggleProps) {
  return (
    <View style={styles.toggleWrap}>
      <Text style={styles.toggleEyebrow}>Prikaz</Text>
      <View style={styles.toggleRail}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: value === 'LIST' }}
          onPress={() => onChange('LIST')}
          style={({ pressed }) => [
            styles.toggleButton,
            value === 'LIST' && styles.toggleButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.listGlyph}>
            <View style={styles.listGlyphLine} />
            <View style={styles.listGlyphLine} />
            <View style={styles.listGlyphLine} />
          </View>
          <Text
            style={[
              styles.toggleLabel,
              value === 'LIST' && styles.toggleLabelActive,
            ]}
          >
            LIST
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: value === 'GALLERY' }}
          onPress={() => onChange('GALLERY')}
          style={({ pressed }) => [
            styles.toggleButton,
            value === 'GALLERY' && styles.toggleButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.galleryGlyph}>
            <View style={styles.galleryGlyphCell} />
            <View style={styles.galleryGlyphCell} />
            <View style={styles.galleryGlyphCell} />
            <View style={styles.galleryGlyphCell} />
          </View>
          <Text
            style={[
              styles.toggleLabel,
              value === 'GALLERY' && styles.toggleLabelActive,
            ]}
          >
            GALLERY
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

type TileProps = {
  item: EntryGalleryItem;
  onPress: () => void;
};

export function EntryGalleryTile({
  item,
  onPress,
}: TileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Otvori sliku iz zapisa ${item.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        pressed && styles.tilePressed,
      ]}
    >
      <Image
        source={{ uri: item.uri }}
        resizeMode="cover"
        style={styles.tileImage}
      />

      <View style={styles.tileCaption}>
        <Text numberOfLines={1} style={styles.tileType}>
          {item.typeLabel}
        </Text>
        <Text numberOfLines={2} style={styles.tileTitle}>
          {item.title}
        </Text>
      </View>
    </Pressable>
  );
}

type ViewerProps = {
  items: EntryGalleryItem[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onOpenEntry: (entryId: string) => void;
  onOpenSource: (entryId: string) => void;
};

export function EntryGalleryViewer({
  items,
  index,
  onIndexChange,
  onClose,
  onOpenEntry,
  onOpenSource,
}: ViewerProps) {
  const listRef = useRef<FlatList<EntryGalleryItem>>(null);
  const { width } = useWindowDimensions();

  const visible =
    index != null &&
    index >= 0 &&
    index < items.length;

  const selected =
    visible && index != null
      ? items[index] ?? null
      : null;

  useEffect(() => {
    if (!visible || index == null || width <= 0) return;

    const timer = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: index * width,
        animated: false,
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [index, visible, width]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent
      visible={visible}
    >
      <SafeAreaView
        edges={['top', 'left', 'right', 'bottom']}
        style={styles.viewerSafe}
      >
        <View style={styles.viewerHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zatvori galeriju"
            hitSlop={12}
            onPress={onClose}
            style={({ pressed }) => [
              styles.viewerClose,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.viewerCloseText}>×</Text>
          </Pressable>

          <Text numberOfLines={1} style={styles.viewerHeaderTitle}>
            Gallery
          </Text>

          <View style={styles.viewerHeaderSpacer} />
        </View>

        <FlatList
          ref={listRef}
          data={items}
          getItemLayout={(_, itemIndex) => ({
            length: width,
            offset: width * itemIndex,
            index: itemIndex,
          })}
          horizontal
          keyExtractor={(item) => item.key}
          onMomentumScrollEnd={(event) => {
            if (width <= 0) return;
            const nextIndex = Math.round(
              event.nativeEvent.contentOffset.x / width,
            );
            if (
              nextIndex >= 0 &&
              nextIndex < items.length
            ) {
              onIndexChange(nextIndex);
            }
          }}
          pagingEnabled
          renderItem={({ item }) => (
            <View style={[styles.viewerPage, { width }]}>
              <Image
                source={{ uri: item.uri }}
                resizeMode="contain"
                style={styles.viewerImage}
              />
            </View>
          )}
          showsHorizontalScrollIndicator={false}
        />

        {selected ? (
          <View style={styles.viewerCaption}>
            <View style={styles.viewerCaptionCopy}>
              <Text style={styles.viewerType}>
                {selected.typeLabel}
              </Text>
              <Text numberOfLines={2} style={styles.viewerTitle}>
                {selected.title}
              </Text>

              {selected.sourceLabel ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    'Vrati se u izvor: ' +
                    selected.sourceLabel +
                    (selected.sourceLocation
                      ? ' · ' + selected.sourceLocation
                      : '')
                  }
                  onPress={() => onOpenSource(selected.entryId)}
                  style={({ pressed }) => [
                    styles.sourceLink,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text numberOfLines={1} style={styles.sourceLinkText}>
                    {selected.sourceLabel}
                    {selected.sourceLocation
                      ? ' · ' + selected.sourceLocation
                      : ''}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => onOpenEntry(selected.entryId)}
              style={({ pressed }) => [
                styles.openEntryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.openEntryText}>OTVORI ZAPIS</Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toggleWrap: {
    marginTop: 14,
    marginBottom: 8,
  },
  toggleEyebrow: {
    marginBottom: 7,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.05,
    textTransform: 'uppercase',
  },
  toggleRail: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  toggleButton: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: activeAccentColor,
  },
  toggleLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  toggleLabelActive: {
    color: colors.background,
  },
  listGlyph: {
    width: 12,
    marginRight: 6,
  },
  listGlyphLine: {
    height: 1,
    marginVertical: 1.5,
    backgroundColor: colors.text,
  },
  galleryGlyph: {
    width: 12,
    height: 12,
    marginRight: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  galleryGlyphCell: {
    width: 4,
    height: 4,
    margin: 1,
    backgroundColor: colors.text,
  },
  pressed: {
    opacity: 0.65,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 4,
    marginBottom: 11,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  tilePressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  tileImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
  },
  tileCaption: {
    minHeight: 54,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tileType: {
    marginBottom: 3,
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tileTitle: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  viewerSafe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  viewerHeader: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  viewerClose: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCloseText: {
    color: colors.text,
    fontSize: 31,
    lineHeight: 34,
    fontWeight: '300',
  },
  viewerHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  viewerHeaderSpacer: {
    width: 42,
  },
  viewerPage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerCaption: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  viewerCaptionCopy: {
    marginBottom: 12,
  },
  viewerType: {
    marginBottom: 4,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  viewerTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  sourceLink: {
    alignSelf: 'flex-start',
    marginTop: 7,
    paddingVertical: 3,
  },
  sourceLinkText: {
    color: activeAccentColor,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  openEntryButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: activeAccentColor,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openEntryText: {
    color: activeAccentColor,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
});

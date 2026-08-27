// forkLCollectionsMemoryBoxV2
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  Easing,
} from 'react-native';
import {
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { colors } from '../theme/colors';
import type { CollectionSummary } from '../types/collection';
import { DEFAULT_COLLECTION_SYMBOL } from '../utils/collectionSymbols';

const ROW_STEP = 132;
// collectionReorderMotionGeometryV1
let activeDragRowStep = ROW_STEP;
const STAR_GOLD = '#D3A11B';

type Props = {
  collection: CollectionSummary;
  index: number;
  count: number;
  reorderMode: boolean;
  previewFromIndex: number | null;
  previewTargetIndex: number | null;
  onOpen: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onDrop: () => void;
  onPreviewMove: (fromIndex: number, targetIndex: number) => void;
  onPreviewClear: () => void;
  onMoveButton: (fromIndex: number, toIndex: number) => void;
  onDragStateChange: (dragging: boolean) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function CollectionMemoryBoxCard({
  collection,
  index,
  count,
  reorderMode,
  previewFromIndex,
  previewTargetIndex,
  onOpen,
  onMove,
  onDrop,
  onPreviewMove,
  onPreviewClear,
  onMoveButton,
  onDragStateChange,
}: Props) {
  const dragY = useRef(new Animated.Value(0)).current;
  const previewY = useRef(new Animated.Value(0)).current;
  const indexRef = useRef(index);
  const startIndexRef = useRef(index);
  const lastTargetRef = useRef(index);
  const lastDyRef = useRef(0);
  const rowStepRef = useRef(ROW_STEP);
  const draggingRef = useRef(false);

  indexRef.current = index;

  // forkN51FinalMotionRadioProfileV1
  // The collection array stays stable while the thumb is down. Instead,
  // siblings slide into their would-be slots so the destination gap is visible
  // before release. When preview state clears, the transform is reset in a
  // layout effect so the real reordered layout replaces it without a flash.
  useLayoutEffect(() => {
    if (
      !reorderMode ||
      previewFromIndex == null ||
      previewTargetIndex == null
    ) {
      previewY.stopAnimation();
      previewY.setValue(0);
      return;
    }

    let offset = 0;
    // Every sibling moves by the slot vacated by the dragged card.
    // Using each sibling's own measured height causes overlap when card
    // geometry differs even slightly.
    const rowStep = activeDragRowStep;

    if (
      previewFromIndex > previewTargetIndex &&
      index >= previewTargetIndex &&
      index < previewFromIndex
    ) {
      // Dragging upward: cards crossed by the dragged item move DOWN.
      offset = rowStep;
    } else if (
      previewFromIndex < previewTargetIndex &&
      index > previewFromIndex &&
      index <= previewTargetIndex
    ) {
      // Dragging downward: cards crossed by the dragged item move UP.
      offset = -rowStep;
    }

    previewY.stopAnimation();

    Animated.timing(previewY, {
      toValue: offset,
      duration: 95,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [
    index,
    previewFromIndex,
    previewTargetIndex,
    previewY,
    reorderMode,
  ]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => reorderMode,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          reorderMode && Math.abs(gesture.dy) > 2,

        onPanResponderGrant: () => {
          draggingRef.current = true;
          startIndexRef.current = indexRef.current;
          lastTargetRef.current = indexRef.current;
          lastDyRef.current = 0;
          dragY.stopAnimation();
          dragY.setValue(0);

          // Lock this card's actual measured slot geometry for every
          // sibling preview until the gesture ends.
          activeDragRowStep =
            Math.max(
              1,
              rowStepRef.current,
            );

          onPreviewMove(
            indexRef.current,
            indexRef.current,
          );
          onDragStateChange(true);
        },

        onPanResponderMove: (_event, gesture) => {
          if (!draggingRef.current) return;

          lastDyRef.current = gesture.dy;

          const rowStep = activeDragRowStep;
          const target = clamp(
            startIndexRef.current +
              Math.round(gesture.dy / rowStep),
            0,
            Math.max(0, count - 1),
          );

          if (target !== lastTargetRef.current) {
            lastTargetRef.current = target;
            onPreviewMove(
              startIndexRef.current,
              target,
            );
          }

          dragY.setValue(gesture.dy);
        },

        onPanResponderRelease: () => {
          if (!draggingRef.current) return;

          draggingRef.current = false;

          const fromIndex = startIndexRef.current;
          const toIndex = lastTargetRef.current;
          const rowStep = activeDragRowStep;
          const displacement =
            (toIndex - fromIndex) * rowStep;

          // forkN51FinalMotionRadioProfileV1: first LAND the dragged card into the previewed gap while
          // siblings are already displaced. Only after that tiny landing motion
          // do we swap the real array and clear every temporary transform.
          Animated.timing(dragY, {
            toValue: displacement,
            duration: fromIndex === toIndex ? 125 : 105,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            if (fromIndex !== toIndex) {
              onMove(fromIndex, toIndex);
            } else {
              onPreviewClear();
            }

            // State changes above are batched in the same JS turn. Resetting the
            // dragged transform now lets the final keyed layout replace the
            // temporary gesture geometry without a visible rebound.
            dragY.setValue(0);
            previewY.setValue(0);
            lastDyRef.current = 0;
            onDragStateChange(false);
            onDrop();
          });
        },

        onPanResponderTerminate: () => {
          draggingRef.current = false;
          lastTargetRef.current = startIndexRef.current;
          lastDyRef.current = 0;
          onPreviewClear();

          Animated.timing(dragY, {
            toValue: 0,
            duration: 140,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }).start(() => {
            previewY.setValue(0);
            onDragStateChange(false);
          });
        },

        onPanResponderTerminationRequest: () => false,
      }),
    [
      count,
      dragY,
      onDragStateChange,
      onDrop,
      onMove,
      onPreviewClear,
      onPreviewMove,
      previewY,
      reorderMode,
    ],
  );

  const symbol = collection.symbol || DEFAULT_COLLECTION_SYMBOL;

  return (
    <Animated.View
      onLayout={(event) => {
        const height = event.nativeEvent.layout.height;
        if (height > 80) {
          // shell margin is outside onLayout; include the visual inter-row gap.
          rowStepRef.current = height + 14;
        }
      }}
      style={[
        styles.shell,
        reorderMode && styles.shellReorder,
        {
          transform: [
            {
              translateY: Animated.add(
                dragY,
                previewY,
              ),
            },
          ],
        },
      ]}
    >
      <View style={styles.backLayer} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Otvori kolekciju ${collection.name}`}
        disabled={reorderMode}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.card,
          pressed && !reorderMode && styles.pressed,
          reorderMode && styles.cardReorder,
        ]}
      >
        <View style={styles.stars} pointerEvents="none">
          <Text style={styles.star}>✦</Text>
          <Text style={styles.starDot}>·</Text>
          <Text style={styles.starSmall}>✧</Text>
        </View>

        <View style={styles.symbolFrame}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={styles.symbol}
          >
            {symbol}
          </Text>
        </View>

        <View style={styles.copy}>
          <Text style={styles.meta}>
            MEMORY BOX · {collection.itemCount}{' '}
            {collection.itemCount === 1 ? 'STVAR' : 'STVARI'}
          </Text>

          <Text numberOfLines={1} style={styles.title}>
            {collection.name}
          </Text>

          <Text numberOfLines={2} style={styles.description}>
            {collection.description ||
              'Playlist · scrapbook · osobni arhiv'}
          </Text>

          {!reorderMode ? (
            <Text style={styles.openLabel}>Otvori kutiju</Text>
          ) : (
            <Text style={styles.reorderHint}>Povuci ručku za redoslijed</Text>
          )}
        </View>

        {reorderMode ? (
          <View style={styles.reorderTools}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Pomakni ${collection.name} gore`}
              disabled={index <= 0}
              onPress={() => onMoveButton(index, index - 1)}
              style={[
                styles.orderButton,
                index <= 0 && styles.orderDisabled,
              ]}
            >
              <Text style={styles.orderButtonText}>↑</Text>
            </Pressable>

            <View
              accessible
              accessibilityLabel={`Povuci ${collection.name} za promjenu redoslijeda`}
              accessibilityRole="adjustable"
              style={styles.dragHandle}
              {...responder.panHandlers}
            >
              <Text style={styles.dragHandleText}>≡</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Pomakni ${collection.name} dolje`}
              disabled={index >= count - 1}
              onPress={() => onMoveButton(index, index + 1)}
              style={[
                styles.orderButton,
                index >= count - 1 && styles.orderDisabled,
              ]}
            >
              <Text style={styles.orderButtonText}>↓</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.arrow}>›</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    marginBottom: 14,
    paddingTop: 5,
  },
  shellReorder: { zIndex: 20 },
  backLayer: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 0,
    bottom: 3,
    borderRadius: 22,
    backgroundColor: colors.fillStrong,
    opacity: 0.72,
  },
  card: {
    minHeight: 116,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  cardReorder: {
    borderColor: STAR_GOLD,
  },
  stars: {
    position: 'absolute',
    right: 15,
    top: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.58,
  },
  star: { color: STAR_GOLD, fontSize: 11 },
  starSmall: { color: STAR_GOLD, fontSize: 10 },
  starDot: { color: STAR_GOLD, fontSize: 13 },
  symbolFrame: {
    width: 66,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fillStrong,
  },
  symbol: {
    maxWidth: 58,
    color: colors.text,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '800',
    textAlign: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 15,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.85,
  },
  title: {
    marginTop: 4,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  description: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 16,
  },
  openLabel: {
    marginTop: 7,
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
  },
  reorderHint: {
    marginTop: 7,
    color: STAR_GOLD,
    fontSize: 9.5,
    fontWeight: '900',
  },
  arrow: {
    marginLeft: 10,
    color: colors.textMuted,
    fontSize: 30,
    fontWeight: '300',
  },
  reorderTools: {
    width: 42,
    marginLeft: 10,
    alignItems: 'center',
    gap: 5,
  },
  dragHandle: {
    width: 38,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.black,
  },
  dragHandleText: {
    color: colors.white,
    fontSize: 21,
    lineHeight: 24,
    fontWeight: '900',
  },
  orderButton: {
    width: 30,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.fill,
  },
  orderButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  orderDisabled: { opacity: 0.28 },
  pressed: { opacity: 0.68 },
});

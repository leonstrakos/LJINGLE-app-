// forkLCollectionsMemoryBoxV2
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useMemo,
  useRef,
  useState,
} from 'react';

import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import type { CollectionSummary } from '../types/collection';
import { DEFAULT_COLLECTION_SYMBOL } from '../utils/collectionSymbols';

const DRAG_TRIGGER_PX = 76;
const aeroMode = activeVisualSkinId === 'aero';
const STAR_GOLD = aeroMode ? '#49AF4E' : '#D3A11B';

type Props = {
  collection: CollectionSummary;
  index: number;
  count: number;
  reorderMode: boolean;
  reorderBusy: boolean;
  onOpen: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onDrop: (moved: boolean) => void;
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
  reorderBusy,
  onOpen,
  onMove,
  onDrop,
  onMoveButton,
  onDragStateChange,
}: Props) {
  const indexRef = useRef(index);
  const countRef = useRef(count);
  const reorderModeRef = useRef(reorderMode);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const stepOriginRef = useRef(0);
  const [draggingVisual, setDraggingVisual] = useState(false);

  const callbacksRef = useRef({
    onMove,
    onDrop,
    onDragStateChange,
  });

  indexRef.current = index;
  countRef.current = count;
  reorderModeRef.current = reorderMode && !reorderBusy;
  callbacksRef.current = {
    onMove,
    onDrop,
    onDragStateChange,
  };

  const finishDrag = () => {
    if (!draggingRef.current) return;

    const moved = movedRef.current;
    draggingRef.current = false;
    movedRef.current = false;
    stepOriginRef.current = 0;
    setDraggingVisual(false);
    callbacksRef.current.onDragStateChange(false);
    callbacksRef.current.onDrop(moved);
  };

  // collectionReorderEngineV1: the old floating-card/preview-offset system is gone.
  // The real keyed rows exchange one slot at a time, so FlatList always owns
  // the only geometry on screen and cannot leave holes or overlapping cards.
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          reorderModeRef.current,
        onStartShouldSetPanResponderCapture: () =>
          reorderModeRef.current,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          reorderModeRef.current && Math.abs(gesture.dy) > 2,

        onPanResponderGrant: () => {
          if (!reorderModeRef.current) return;

          draggingRef.current = true;
          movedRef.current = false;
          stepOriginRef.current = 0;
          setDraggingVisual(true);
          callbacksRef.current.onDragStateChange(true);
        },

        onPanResponderMove: (_event, gesture) => {
          if (!draggingRef.current) return;

          let remaining = gesture.dy - stepOriginRef.current;
          let safety = countRef.current;

          while (
            Math.abs(remaining) >= DRAG_TRIGGER_PX &&
            safety > 0
          ) {
            safety -= 1;

            const direction = remaining > 0 ? 1 : -1;
            const fromIndex = indexRef.current;
            const toIndex = clamp(
              fromIndex + direction,
              0,
              Math.max(0, countRef.current - 1),
            );

            if (fromIndex === toIndex) {
              stepOriginRef.current = gesture.dy;
              break;
            }

            // Advance locally before React renders the new index. This keeps
            // fast gestures deterministic even when several slots are crossed
            // inside one native move event.
            indexRef.current = toIndex;
            stepOriginRef.current += direction * DRAG_TRIGGER_PX;
            movedRef.current = true;
            callbacksRef.current.onMove(fromIndex, toIndex);
            remaining = gesture.dy - stepOriginRef.current;
          }
        },

        onPanResponderRelease: finishDrag,
        onPanResponderTerminate: finishDrag,
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );

  const symbol = collection.symbol || DEFAULT_COLLECTION_SYMBOL;

  return (
    <View
      style={[
        styles.shell,
        reorderMode && styles.shellReorder,
        draggingVisual && styles.shellDragging,
      ]}
    >
      <View style={styles.backLayer} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={'Otvori kolekciju ' + collection.name}
        disabled={reorderMode}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.card,
          aeroMode && styles.aeroCard,
          pressed && !reorderMode && styles.pressed,
          reorderMode && styles.cardReorder,
          draggingVisual && styles.cardDragging,
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
            <Text style={styles.reorderHint}>
              {reorderBusy
                ? 'Spremanje redoslijeda…'
                : 'Povuci ručku za redoslijed'}
            </Text>
          )}
        </View>

        {reorderMode ? (
          <View style={styles.reorderTools}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={'Pomakni ' + collection.name + ' gore'}
              disabled={reorderBusy || index <= 0}
              onPress={() => onMoveButton(index, index - 1)}
              style={[
                styles.orderButton,
                (reorderBusy || index <= 0) && styles.orderDisabled,
              ]}
            >
              <Text style={styles.orderButtonText}>↑</Text>
            </Pressable>

            <View
              accessible
              accessibilityLabel={
                'Povuci ' + collection.name + ' za promjenu redoslijeda'
              }
              accessibilityRole="adjustable"
              accessibilityState={{ disabled: reorderBusy }}
              collapsable={false}
              style={[
                styles.dragHandle,
                draggingVisual && styles.dragHandleActive,
              ]}
              {...responder.panHandlers}
            >
              <Text style={styles.dragHandleText}>≡</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={'Pomakni ' + collection.name + ' dolje'}
              disabled={reorderBusy || index >= count - 1}
              onPress={() => onMoveButton(index, index + 1)}
              style={[
                styles.orderButton,
                (reorderBusy || index >= count - 1) &&
                  styles.orderDisabled,
              ]}
            >
              <Text style={styles.orderButtonText}>↓</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.arrow}>›</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    marginBottom: 14,
    paddingTop: 5,
  },
  shellReorder: {
    zIndex: 1,
  },
  shellDragging: {
    zIndex: 3,
    elevation: 7,
  },
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
  aeroCard: {
    borderColor: 'rgba(255,255,255,0.94)',
    shadowColor: colors.navySoft,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 4,
  },
  cardReorder: {
    borderColor: STAR_GOLD,
  },
  cardDragging: {
    backgroundColor: colors.fillStrong,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 7,
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
  dragHandleActive: {
    backgroundColor: STAR_GOLD,
  },
  dragHandleText: {
    color: colors.onAccent,
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

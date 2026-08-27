// forkDTopicsV1
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { topicApi } from '../services/topicApi';
import { colors } from '../theme/colors';
import {
  activityTypeLabels,
  type TopicActivityResponse,
} from '../types/topic';

type Props = {
  visible: boolean;
  topicId: string;
  linkedActivityIds: string[];
  onClose: () => void;
  onLinked: () => void | Promise<void>;
};

const OPEN_MS = 170;
const CLOSE_MS = 140;

export function TopicActivityLinkPicker({
  visible,
  topicId,
  linkedActivityIds,
  onClose,
  onLinked,
}: Props) {
  const [rendered, setRendered] = useState(visible);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<TopicActivityResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  const linked = useMemo(
    () => new Set(linkedActivityIds),
    [linkedActivityIds],
  );

  useEffect(() => {
    progress.stopAnimation();

    if (visible) {
      setRendered(true);
      progress.setValue(0);

      const frame = requestAnimationFrame(() => {
        Animated.timing(progress, {
          toValue: 1,
          duration: OPEN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });

      return () => cancelAnimationFrame(frame);
    }

    Keyboard.dismiss();
    setQuery('');
    setError(null);

    Animated.timing(progress, {
      toValue: 0,
      duration: CLOSE_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRendered(false);
    });

    return undefined;
  }, [progress, visible]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);

      void topicApi
        .searchActivities(query)
        .then((loaded) => {
          if (!cancelled) setItems(loaded);
        })
        .catch((caught) => {
          if (!cancelled) {
            setError(
              caught instanceof Error
                ? caught.message
                : 'Aktivnosti se nisu učitale.',
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 110);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, visible]);

  useEffect(() => {
    if (!visible) setBusyId(null);
  }, [visible]);

  const available = items.filter(
    (item) => !linked.has(item.activityId),
  );

  const requestClose = () => {
    if (busyId) return;
    Keyboard.dismiss();
    onClose();
  };

  const link = async (activity: TopicActivityResponse) => {
    if (busyId) return;

    setBusyId(activity.activityId);
    setError(null);

    try {
      await topicApi.linkActivity(topicId, activity.activityId);
      onClose();
      await onLinked();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Aktivnost nije povezana.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [54, 0],
  });

  if (!rendered) return null;

  return (
    <Modal
      animationType="none"
      onRequestClose={requestClose}
      statusBarTranslucent
      transparent
      visible={rendered}
    >
      <View style={styles.modalRoot}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, { opacity: progress }]}
        />

        <Pressable
          accessibilityLabel="Zatvori povezivanje aktivnosti"
          accessibilityRole="button"
          onPress={requestClose}
          style={StyleSheet.absoluteFill}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
          style={styles.sheetHost}
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                opacity: progress,
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>
                  TEMA × AKTIVNOST
                </Text>
                <Text style={styles.title}>
                  Poveži aktivnost
                </Text>
                <Text style={styles.subtitle}>
                  Aktivnost ostaje samostalna i može biti povezana s više tema.
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={requestClose}
                style={({ pressed }) => [
                  styles.done,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.doneText}>Gotovo</Text>
              </Pressable>
            </View>

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Pretraži aktivnosti…"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              style={styles.search}
              value={query}
            />

            {error ? (
              <Text style={styles.error}>{error}</Text>
            ) : null}

            {loading ? (
              <ActivityIndicator
                color={colors.black}
                style={styles.loader}
              />
            ) : null}

            <FlatList
              contentContainerStyle={styles.list}
              data={available}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => item.activityId}
              ListEmptyComponent={
                !loading ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>
                      Nema drugih aktivnosti
                    </Text>
                    <Text style={styles.emptyCopy}>
                      Napravi novu aktivnost ili promijeni pretragu.
                    </Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityLabel={`Poveži aktivnost ${item.label}`}
                  accessibilityRole="button"
                  disabled={Boolean(busyId)}
                  onPress={() => void link(item)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.rowCopy}>
                    <Text numberOfLines={1} style={styles.rowTitle}>
                      {item.label}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {activityTypeLabels[item.activityType]}
                    </Text>
                  </View>

                  {busyId === item.activityId ? (
                    <ActivityIndicator
                      color={colors.black}
                      size="small"
                    />
                  ) : (
                    <Text style={styles.plus}>+</Text>
                  )}
                </Pressable>
              )}
              style={styles.listFrame}
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  sheetHost: {
    flex: 1,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  },
  sheet: {
    maxHeight: '78%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  handle: {
    width: 38,
    height: 4,
    marginTop: 9,
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: colors.separator,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    marginTop: 4,
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  done: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.black,
    paddingHorizontal: 14,
  },
  doneText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  search: {
    minHeight: 50,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 15,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 14,
  },
  error: {
    marginHorizontal: 20,
    marginTop: 10,
    color: colors.danger,
    fontSize: 12,
  },
  loader: {
    marginTop: 14,
  },
  listFrame: {
    maxHeight: 360,
  },
  list: {
    flexGrow: 0,
    padding: 20,
    gap: 8,
  },
  row: {
    minHeight: 62,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  rowMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  plus: {
    marginLeft: 12,
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.68,
  },
  empty: {
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyCopy: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 11,
  },
});

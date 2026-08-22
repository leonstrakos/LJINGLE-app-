import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EntryCard } from '../components/EntryCard';
import { EntryDeleteModal } from '../components/EntryDeleteModal';
import { entryApi } from '../services/entryApi';
import { getEntryImagePreviews } from '../services/entryImages';
import {
  emptyEntryLinkLabels,
  entryLinksApi,
} from '../services/entryLinksApi';
import { colors } from '../theme/colors';
import {
  entryTypeLabels,
  entryTypes,
  type Entry,
  type EntryFormParams,
  type EntryLinkLabels,
  type EntryType,
} from '../types/entry';

export type EntryListScreenProps = {
  navigation: {
    navigate: (screen: 'EntryForm', params?: EntryFormParams) => void;
  };
};

type Filter = EntryType | 'ALL';

export function EntryListScreen({ navigation }: EntryListScreenProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [linkLabels, setLinkLabels] = useState<EntryLinkLabels>(emptyEntryLinkLabels);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string[]>>({});
  const requestVersion = useRef(0);

  const loadEntries = useCallback(async (asRefresh = false) => {
    const version = ++requestVersion.current;
    asRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      const entriesPromise = entryApi.getAll(filter === 'ALL' ? {} : { type: filter });
      const allEntriesPromise = filter === 'ALL' ? entriesPromise : entryApi.getAll({});
      const labelsPromise = entryLinksApi
        .getAll(asRefresh)
        .then(entryLinksApi.toLabels)
        .catch(() => emptyEntryLinkLabels);
      const [nextEntries, nextAllEntries, nextLabels] = await Promise.all([
        entriesPromise,
        allEntriesPromise,
        labelsPromise,
      ]);

      const nextImagePreviews = await getEntryImagePreviews(
        nextEntries.map((entry) => entry.entryId),
      ).catch(() => ({} as Record<string, string[]>));

      if (version !== requestVersion.current) return;
      setEntries(nextEntries);
      setAllEntries(nextAllEntries);
      setLinkLabels(nextLabels);
      setImagePreviews(nextImagePreviews);
    } catch (caught) {
      if (version !== requestVersion.current) return;
      setError(caught instanceof Error ? caught.message : 'Zapisi se nisu mogli učitati.');
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      void loadEntries();
      return () => {
        requestVersion.current += 1;
      };
    }, [loadEntries]),
  );

  const closeDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const deleteEntry = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await entryApi.remove(deleteTarget.entryId);
      setEntries((current) =>
        current.filter((entry) => entry.entryId !== deleteTarget.entryId),
      );
      setImagePreviews((current) => {
        const next = { ...current };
        delete next[deleteTarget.entryId];
        return next;
      });
      setDeleteTarget(null);
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : 'Brisanje nije uspjelo.');
    } finally {
      setDeleting(false);
    }
  };

  const openReference = (title: string) => {
    const wanted = title.trim().toLocaleLowerCase('hr-HR');
    const target = allEntries.find(
      (entry) => entry.title?.trim().toLocaleLowerCase('hr-HR') === wanted,
    );
    if (target) navigation.navigate('EntryForm', { entryId: target.entryId });
  };

  const header = (
    <>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Misli, citati i tragovi</Text>
        <Text style={styles.heading}>Zapisi</Text>
        <Text style={styles.intro}>
          Jedno mjesto za sve što želiš zapamtiti uz knjige, teme i aktivnosti.
        </Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryValue}>{entries.length}</Text>
          <Text style={styles.summaryLabel}>
            {filter === 'ALL' ? 'prikazanih zapisa' : entryTypeLabels[filter].toLowerCase()}
          </Text>
          {loading && entries.length > 0 ? (
            <ActivityIndicator color={colors.black} size="small" style={styles.syncSpinner} />
          ) : null}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('EntryForm')}
        style={({ pressed }) => [styles.addCard, pressed && styles.addCardPressed]}
      >
        <View style={styles.addIcon}>
          <Text style={styles.addIconText}>+</Text>
        </View>
        <View style={styles.addCopy}>
          <Text style={styles.addTitle}>Novi zapis</Text>
          <Text style={styles.addSubtitle}>Zapiši misao, citat, opažanje ili osvrt</Text>
        </View>
        <Text style={styles.addArrow}>›</Text>
      </Pressable>

      <View style={styles.filterHeading}>
        <Text style={styles.sectionTitle}>Vrsta zapisa</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.filters}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <FilterChip
          active={filter === 'ALL'}
          label="Sve"
          onPress={() => setFilter('ALL')}
        />
        {entryTypes.map((type) => (
          <FilterChip
            active={filter === type}
            key={type}
            label={entryTypeLabels[type]}
            onPress={() => setFilter(type)}
          />
        ))}
      </ScrollView>

      {error && entries.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void loadEntries(true)}
          style={styles.errorBanner}
        >
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorRetry}>Ponovi</Text>
        </Pressable>
      ) : null}

      <View style={styles.listHeading}>
        <Text style={styles.sectionTitle}>
          {filter === 'ALL' ? 'Svi zapisi' : entryTypeLabels[filter]}
        </Text>
      </View>
    </>
  );

  if (loading && entries.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.black} size="large" />
          <Text style={styles.stateCopy}>Slažemo tvoje zapise…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && entries.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.errorMark}>!</Text>
          <Text style={styles.stateTitle}>Zapisi se nisu učitali</Text>
          <Text style={styles.stateCopy}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadEntries()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Pokušaj ponovno</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <FlatList
        contentContainerStyle={styles.content}
        data={entries}
        keyExtractor={(item) => item.entryId}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyMark}>✎</Text>
            <Text style={styles.emptyTitle}>
              {filter === 'ALL' ? 'Još nema zapisa' : 'Nema zapisa ove vrste'}
            </Text>
            <Text style={styles.emptyCopy}>
              {filter === 'ALL'
                ? 'Zabilježi prvu misao, citat ili opažanje i poveži ga sa svojim katalogom.'
                : `Kad stvoriš prvi zapis vrste „${entryTypeLabels[filter]}”, pojavit će se ovdje.`}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            colors={[colors.black]}
            onRefresh={() => void loadEntries(true)}
            refreshing={refreshing}
            tintColor={colors.black}
          />
        }
        renderItem={({ item }) => (
          <EntryCard
            entry={item}
            imageUris={imagePreviews[item.entryId] ?? []}
            linkLabels={linkLabels}
            onDelete={() => {
              setDeleteError(null);
              setDeleteTarget(item);
            }}
            onEdit={() => navigation.navigate('EntryForm', { entryId: item.entryId })}
            onOpenReference={openReference}
          />
        )}
        showsVerticalScrollIndicator={false}
      />

      <EntryDeleteModal
        entry={deleteTarget}
        errorMessage={deleteError}
        loading={deleting}
        onCancel={closeDelete}
        onConfirm={() => void deleteEntry()}
      />
    </SafeAreaView>
  );
}

type FilterChipProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

function FilterChip({ active, label, onPress }: FilterChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  hero: {
    paddingTop: 24,
    paddingBottom: 20,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heading: {
    marginTop: 5,
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.1,
  },
  intro: {
    maxWidth: 620,
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  summaryRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  summaryValue: {
    color: colors.black,
    fontSize: 27,
    fontWeight: '800',
  },
  summaryLabel: {
    marginLeft: 8,
    color: colors.textMuted,
    fontSize: 13,
  },
  syncSpinner: {
    marginLeft: 10,
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: colors.black,
    padding: 17,
  },
  addCardPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.995 }],
  },
  addIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.white,
  },
  addIconText: {
    color: colors.black,
    fontSize: 27,
    fontWeight: '400',
    lineHeight: 30,
  },
  addCopy: {
    flex: 1,
    marginLeft: 13,
  },
  addTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  addSubtitle: {
    marginTop: 3,
    color: '#C7C7CC',
    fontSize: 12,
  },
  addArrow: {
    marginLeft: 10,
    color: colors.white,
    fontSize: 28,
  },
  filterHeading: {
    marginTop: 25,
    marginBottom: 10,
  },
  filters: {
    paddingRight: 8,
    paddingBottom: 4,
  },
  filterChip: {
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  filterChipActive: {
    borderColor: colors.black,
    backgroundColor: colors.black,
  },
  filterLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  filterLabelActive: {
    color: colors.white,
  },
  listHeading: {
    marginTop: 24,
    marginBottom: 11,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  errorBanner: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 13,
    backgroundColor: colors.dangerSoft,
    padding: 12,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
  },
  errorRetry: {
    marginLeft: 10,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: 30,
  },
  emptyMark: {
    color: colors.black,
    fontSize: 32,
  },
  emptyTitle: {
    marginTop: 12,
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCopy: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorMark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    fontSize: 27,
    fontWeight: '700',
    lineHeight: 52,
    textAlign: 'center',
  },
  stateTitle: {
    marginTop: 16,
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateCopy: {
    marginTop: 9,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: colors.black,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});

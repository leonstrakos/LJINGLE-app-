import {
  useCallback,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  createCatalogueSnapshot,
  deleteCatalogueSnapshot,
  listCatalogueSnapshots,
  loadCatalogueSnapshot,
  type CatalogueSnapshot,
  type CatalogueSnapshotDetails,
  type CatalogueSnapshotItem,
} from '../services/catalogueSnapshots';
import { colors } from '../theme/colors';
import { readingStatusLabels } from '../types/book';
import { watchStatusLabels } from '../types/media';
import { gameStatusLabels } from '../games/types/game';

const nf = new Intl.NumberFormat('hr-HR');

function dateLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function entityLabel(
  type: CatalogueSnapshotItem['entityType'],
) {
  if (type === 'BOOK') return 'Knjiga';
  if (type === 'MOVIE') return 'Film';
  if (type === 'SERIES') return 'Serija';
  return 'Igra';
}

function statusLabel(item: CatalogueSnapshotItem) {
  if (item.entityType === 'BOOK') {
    return (
      readingStatusLabels[
        item.status as keyof typeof readingStatusLabels
      ] ?? item.status
    );
  }

  if (
    item.entityType === 'MOVIE' ||
    item.entityType === 'SERIES'
  ) {
    return (
      watchStatusLabels[
        item.status as keyof typeof watchStatusLabels
      ] ?? item.status
    );
  }

  return (
    gameStatusLabels[
      item.status as keyof typeof gameStatusLabels
    ] ?? item.status
  );
}

function SnapshotRow({
  snapshot,
  opening,
  deleteConfirm,
  onOpen,
  onDeleteRequest,
  onDeleteCancel,
  onDeleteConfirm,
}: {
  snapshot: CatalogueSnapshot;
  opening: boolean;
  deleteConfirm: boolean;
  onOpen: () => void;
  onDeleteRequest: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
}) {
  return (
    <View style={styles.snapshotCard}>
      <View style={styles.snapshotTop}>
        <View style={styles.snapshotTitleWrap}>
          <Text style={styles.snapshotLabel}>
            {snapshot.label}
          </Text>

          <Text style={styles.snapshotDate}>
            {dateLabel(snapshot.createdAt)}
          </Text>
        </View>

        <Text style={styles.snapshotTotal}>
          {nf.format(snapshot.totalItems)}
        </Text>
      </View>

      <View style={styles.metrics}>
        <Text style={styles.metric}>
          {snapshot.movieCount} filmova
        </Text>
        <Text style={styles.metric}>
          {snapshot.seriesCount} serija
        </Text>
        <Text style={styles.metric}>
          {snapshot.bookCount} knjiga
        </Text>
        <Text style={styles.metric}>
          {snapshot.gameCount} igara
        </Text>
      </View>

      <View style={styles.smallMetrics}>
        <Text style={styles.smallMetric}>
          ? {snapshot.jingleCount} Jingle
        </Text>

        {snapshot.nebitnoCount > 0 ? (
          <Text style={styles.smallMetric}>
            ? {snapshot.nebitnoCount} Nebitno
          </Text>
        ) : null}

        <Text style={styles.smallMetric}>
          ? {snapshot.activeCount} aktivnih
        </Text>
      </View>

      {deleteConfirm ? (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmText}>
            Stvarno obrisati ovu eru?
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={onDeleteCancel}
            style={styles.confirmCancel}
          >
            <Text style={styles.confirmCancelText}>
              Ne
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onDeleteConfirm}
            style={styles.confirmDelete}
          >
            <Text style={styles.confirmDeleteText}>
              Obri?i
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={opening}
            onPress={onOpen}
            style={({ pressed }) => [
              styles.openButton,
              pressed && styles.pressed,
            ]}
          >
            {opening ? (
              <ActivityIndicator
                color={colors.white}
                size="small"
              />
            ) : (
              <Text style={styles.openButtonText}>
                Otvori snapshot
              </Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onDeleteRequest}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.deleteButtonText}>
              Obri?i
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function SnapshotViewer({
  details,
  onClose,
}: {
  details: CatalogueSnapshotDetails | null;
  onClose: () => void;
}) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      visible={details !== null}
    >
      {details ? (
        <View style={styles.viewer}>
          <View style={styles.viewerHeader}>
            <View style={styles.viewerHeadingCopy}>
              <Text style={styles.viewerEyebrow}>
                ERA KATALOGA
              </Text>

              <Text style={styles.viewerHeading}>
                {details.snapshot.label}
              </Text>

              <Text style={styles.viewerDate}>
                {dateLabel(
                  details.snapshot.createdAt,
                )}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.closeButtonText}>
                Zatvori
              </Text>
            </Pressable>
          </View>

          <View style={styles.viewerSummary}>
            <Text style={styles.viewerSummaryValue}>
              {nf.format(
                details.snapshot.totalItems,
              )}
            </Text>

            <Text style={styles.viewerSummaryLabel}>
              stvari u katalogu tada
            </Text>
          </View>

          <FlatList
            contentContainerStyle={styles.viewerList}
            data={details.items}
            keyExtractor={(item) =>
              item.entityType + ':' + item.entityId
            }
            renderItem={({ item }) => (
              <View style={styles.itemRow}>
                <View style={styles.itemCopy}>
                  <Text
                    numberOfLines={2}
                    style={styles.itemTitle}
                  >
                    {item.title}
                  </Text>

                  <Text style={styles.itemMeta}>
                    {entityLabel(item.entityType)}
                    {item.subtitle
                      ? ' ? ' + item.subtitle
                      : ''}
                  </Text>

                  <View style={styles.itemStateRow}>
                    <Text style={styles.itemStatus}>
                      {statusLabel(item)}
                    </Text>

                    {item.progress > 0 ? (
                      <Text style={styles.itemProgress}>
                        ? {item.progress}%
                      </Text>
                    ) : null}

                    {item.jingle ? (
                      <Text style={styles.itemJingle}>
                        ? Jingle
                      </Text>
                    ) : null}

                    {item.nebitno ? (
                      <Text style={styles.itemNebitno}>
                        ? Nebitno
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            )}
            showsVerticalScrollIndicator={false}
          />
        </View>
      ) : null}
    </Modal>
  );
}

export function CatalogueSnapshotsSection() {
  const [snapshots, setSnapshots] =
    useState<CatalogueSnapshot[]>([]);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [openingId, setOpeningId] =
    useState<string | null>(null);

  const [deleteId, setDeleteId] =
    useState<string | null>(null);

  const [details, setDetails] =
    useState<CatalogueSnapshotDetails | null>(
      null,
    );

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setSnapshots(
        await listCatalogueSnapshots(),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Ere kataloga nisu se mogle u?itati.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const create = async () => {
    if (creating) return;

    setCreating(true);
    setError(null);

    try {
      const snapshot =
        await createCatalogueSnapshot();

      setSnapshots((current) => [
        snapshot,
        ...current,
      ]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Snapshot se nije mogao spremiti.',
      );
    } finally {
      setCreating(false);
    }
  };

  const open = async (
    snapshotId: string,
  ) => {
    if (openingId) return;

    setOpeningId(snapshotId);
    setError(null);

    try {
      setDetails(
        await loadCatalogueSnapshot(
          snapshotId,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Snapshot se nije mogao otvoriti.',
      );
    } finally {
      setOpeningId(null);
    }
  };

  const remove = async (
    snapshotId: string,
  ) => {
    setError(null);

    try {
      await deleteCatalogueSnapshot(
        snapshotId,
      );

      setSnapshots((current) =>
        current.filter(
          (snapshot) =>
            snapshot.snapshotId !== snapshotId,
        ),
      );

      setDeleteId(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Snapshot se nije mogao obrisati.',
      );
    }
  };

  return (
    <>
      <View style={styles.section}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>
              VREMENSKE KAPSULE
            </Text>

            <Text style={styles.heading}>
              Ere mog kataloga
            </Text>

            <Text style={styles.intro}>
              Zamrzni katalog kakav je danas i
              kasnije vidi što se promijenilo.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={creating}
            onPress={() => void create()}
            style={({ pressed }) => [
              styles.createButton,
              pressed && styles.pressed,
            ]}
          >
            {creating ? (
              <ActivityIndicator
                color={colors.white}
                size="small"
              />
            ) : (
              <Text style={styles.createButtonText}>
                + Snapshot
              </Text>
            )}
          </Pressable>
        </View>

        {error ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void load()}
            style={styles.errorBox}
          >
            <Text style={styles.errorText}>
              {error}
            </Text>

            <Text style={styles.retryText}>
              Ponovi
            </Text>
          </Pressable>
        ) : null}

        {loading && snapshots.length === 0 ? (
          <View style={styles.loadingState}>
            <ActivityIndicator
              color={colors.black}
              size="small"
            />

            <Text style={styles.loadingText}>
              U?itavam ere...
            </Text>
          </View>
        ) : snapshots.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              Još nema snapshotova
            </Text>

            <Text style={styles.emptyText}>
              Prvi snapshot postaje početna točka
              za buduće usporedbe kataloga.
            </Text>
          </View>
        ) : (
          <View style={styles.snapshotList}>
            {snapshots.map((snapshot) => (
              <SnapshotRow
                deleteConfirm={
                  deleteId === snapshot.snapshotId
                }
                key={snapshot.snapshotId}
                onDeleteCancel={() =>
                  setDeleteId(null)
                }
                onDeleteConfirm={() =>
                  void remove(snapshot.snapshotId)
                }
                onDeleteRequest={() =>
                  setDeleteId(snapshot.snapshotId)
                }
                onOpen={() =>
                  void open(snapshot.snapshotId)
                }
                opening={
                  openingId === snapshot.snapshotId
                }
                snapshot={snapshot}
              />
            ))}
          </View>
        )}
      </View>

      <SnapshotViewer
        details={details}
        onClose={() => setDetails(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 28,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 28,
    backgroundColor: colors.surface,
    padding: 22,
  },

  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  headingCopy: {
    flex: 1,
    marginRight: 14,
  },

  eyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },

  heading: {
    marginTop: 6,
    color: colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  intro: {
    marginTop: 6,
    maxWidth: 520,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },

  createButton: {
    minWidth: 100,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.black,
    paddingHorizontal: 14,
  },

  createButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },

  errorBox: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: colors.dangerSoft,
    padding: 14,
  },

  errorText: {
    color: colors.danger,
    fontSize: 12,
  },

  retryText: {
    marginTop: 5,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },

  loadingState: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.fill,
    padding: 15,
  },

  loadingText: {
    marginLeft: 10,
    color: colors.textMuted,
    fontSize: 12,
  },

  emptyState: {
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: colors.fill,
    padding: 17,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },

  emptyText: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
  },

  snapshotList: {
    marginTop: 18,
  },

  snapshotCard: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 20,
    backgroundColor: colors.fill,
    padding: 17,
  },

  snapshotTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  snapshotTitleWrap: {
    flex: 1,
    marginRight: 12,
  },

  snapshotLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },

  snapshotDate: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 10,
  },

  snapshotTotal: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  metrics: {
    marginTop: 13,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  metric: {
    marginRight: 10,
    marginBottom: 4,
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },

  smallMetrics: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  smallMetric: {
    marginRight: 5,
    color: colors.textMuted,
    fontSize: 10,
  },

  actions: {
    marginTop: 15,
    flexDirection: 'row',
  },

  openButton: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.black,
  },

  openButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
  },

  deleteButton: {
    minWidth: 72,
    minHeight: 40,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 12,
  },

  deleteButtonText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '800',
  },

  confirmRow: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  confirmText: {
    flex: 1,
    marginRight: 8,
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },

  confirmCancel: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },

  confirmCancelText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },

  confirmDelete: {
    minHeight: 36,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
  },

  confirmDeleteText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
  },

  viewer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 22,
    paddingHorizontal: 18,
  },

  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
    paddingBottom: 16,
  },

  viewerHeadingCopy: {
    flex: 1,
    marginRight: 14,
  },

  viewerEyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },

  viewerHeading: {
    marginTop: 5,
    color: colors.text,
    fontSize: 27,
    fontWeight: '800',
  },

  viewerDate: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 11,
  },

  closeButton: {
    borderRadius: 999,
    backgroundColor: colors.black,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },

  closeButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
  },

  viewerSummary: {
    paddingVertical: 18,
  },

  viewerSummaryValue: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
  },

  viewerSummaryLabel: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
  },

  viewerList: {
    paddingBottom: 40,
  },

  itemRow: {
    borderTopWidth: 1,
    borderTopColor: colors.separator,
    paddingVertical: 14,
  },

  itemCopy: {
    flex: 1,
  },

  itemTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },

  itemMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 10,
  },

  itemStateRow: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  itemStatus: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },

  itemProgress: {
    marginLeft: 4,
    color: colors.textMuted,
    fontSize: 10,
  },

  itemJingle: {
    marginLeft: 4,
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
  },

  itemNebitno: {
    marginLeft: 4,
    color: colors.textMuted,
    fontSize: 10,
    fontStyle: 'italic',
  },

  pressed: {
    opacity: 0.7,
  },
});

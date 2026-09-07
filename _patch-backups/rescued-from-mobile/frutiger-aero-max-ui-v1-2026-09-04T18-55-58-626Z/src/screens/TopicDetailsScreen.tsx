import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopicActivityCreateSheet } from '../components/TopicActivityCreateSheet';
import { CelestialAtmosphere } from '../components/CelestialAtmosphere';
import { EntityRelationsPanel } from '../components/EntityRelationsPanel';
import { FeedbackView } from '../components/FeedbackView';
import { TopicActivityCard } from '../components/TopicActivityCard';
import { TopicActivityLinkPicker } from '../components/TopicActivityLinkPicker';
import { topicApi } from '../services/topicApi';
import { topicTimeApi } from '../services/topicTimeApi';
import { sharePortableTopic } from '../services/portableExport';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import { TimerMotionView } from '../components/TimerMotionView';
import { semanticFeedback } from '../utils/semanticFeedback';
import { formatDuration } from '../utils/activityTime';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { deletedFeedback } from '../utils/crudFeedback';
import { ShareGlyph } from '../components/ShareGlyph';
import type { TopicTimeSummary } from '../types/topicTime';
// forkDTopicsV1
import type {
  ActivityType,
  TopicActivityResponse,
  TopicActivityTimerResponse,
  TopicDetailsParams,
  TopicResponse,
} from '../types/topic';

import { celestial, celestialAlpha } from '../theme/celestial';
// forkN2CelestialCollectionsTopicsV2
const celestialMode = activeVisualSkinId === 'classic';
const CELESTIAL_GOLD = celestial.gold;

export type TopicDetailsScreenProps = {
  route: { params: TopicDetailsParams };
  navigation: {
    goBack: () => void;
  };
};

function timersByActivityId(timers: TopicActivityTimerResponse[]) {
  const byId = new Map<string, TopicActivityTimerResponse>();
  timers.forEach((timer) => {
    if (timer.activityId) byId.set(timer.activityId, timer);
  });
  return byId;
}

export function TopicDetailsScreen({ route, navigation }: TopicDetailsScreenProps) {
  const { topicId } = route.params;
  const [topic, setTopic] = useState<TopicResponse | null>(null);
  const [sharingTopic, setSharingTopic] = useState(false);
  const [activities, setActivities] = useState<TopicActivityResponse[]>([]);
  const [timeSummary, setTimeSummary] =
    useState<TopicTimeSummary | null>(null);
  const [timers, setTimers] = useState<Map<string, TopicActivityTimerResponse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());
  const [formVisible, setFormVisible] = useState(false);
  const [activityLabel, setActivityLabel] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('STUDYING');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [linkPickerVisible, setLinkPickerVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // topicEditHotfixV1
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const orderedActivities = useMemo(() => {
    const totals = new Map(
      (timeSummary?.activities ?? []).map(
        (item) => [
          item.activityId,
          item.totalSeconds,
        ],
      ),
    );

    return [...activities].sort(
      (left, right) =>
        (totals.get(right.activityId) ?? 0) -
        (totals.get(left.activityId) ?? 0),
    );
  }, [activities, timeSummary]);

  const runningCount = useMemo(
    () => Array.from(timers.values()).filter((timer) => timer.running).length,
    [timers],
  );

  const loadTopic = useCallback(async (asRefresh = false) => {
    asRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [
        loadedTopic,
        loadedActivities,
        activeTimers,
        loadedTimeSummary,
      ] = await Promise.all([
        topicApi.getById(topicId),
        topicApi.getActivities(topicId),
        topicApi.getActiveActivities(),
        topicTimeApi.getSummary(topicId),
      ]);
      const activityIds = new Set(loadedActivities.map((activity) => activity.activityId));
      setTopic(loadedTopic);
      setActivities(loadedActivities);
      setTimeSummary(loadedTimeSummary);
      setTimers(
        timersByActivityId(
          activeTimers.filter(
            (timer) => timer.activityId !== null && activityIds.has(timer.activityId),
          ),
        ),
      );
      setNow(Date.now());
      // architectureBatchA_refreshTopicTime
      void topicTimeApi
        .getSummary(topicId)
        .then(setTimeSummary)
        .catch(() => {});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dohvat teme nije uspio.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [topicId]);

  useFocusEffect(
    useCallback(() => {
      void loadTopic();
    }, [loadTopic]),
  );

  useEffect(() => {
    if (runningCount === 0) return undefined;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningCount]);

  const closeForm = () => {
    if (saving) return;
    setFormVisible(false);
    setActivityLabel('');
    setActivityType('STUDYING');
    setFormError(null);
  };

  const createActivity = async () => {
    const label = activityLabel.trim();
    if (!label || saving) return;

    setSaving(true);
    setFormError(null);
    try {
      // topicActivityCreateAsLinkV1
      await topicApi.createActivity(topicId, {
        label,
        activityType,
      });
      setFormVisible(false);
      setActivityLabel('');
      setActivityType('STUDYING');
      await loadTopic(true);
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : 'Stvaranje aktivnosti nije uspjelo.',
      );
    } finally {
      setSaving(false);
    }
  };

  const openEditTopic = () => {
    // topicEditNullGuardV1
    if (!topic) return;
    setEditName(topic.name);
    setEditDescription(topic.description ?? '');
    setEditError(null);
    setEditVisible(true);
  };

  const closeEditTopic = () => {
    if (editSaving) return;
    setEditVisible(false);
    setEditError(null);
  };

  const saveEditTopic = async () => {
    const name = editName.trim();

    if (!name || editSaving) return;

    setEditSaving(true);
    setEditError(null);

    try {
      const updated = await topicApi.update(
        topicId,
        {
          name,
          description:
            editDescription.trim() || null,
        },
      );

      setTopic(updated);
      setEditVisible(false);
    } catch (caught) {
      setEditError(
        caught instanceof Error
          ? caught.message
          : 'Uređivanje teme nije uspjelo.',
      );
    } finally {
      setEditSaving(false);
    }
  };

  const unlinkActivity = async (
    activity: TopicActivityResponse,
  ) => {
    if (busyIds.has(activity.activityId)) return;

    setActionError(null);
    setBusyIds((current) =>
      new Set(current).add(activity.activityId),
    );

    try {
      await topicApi.unlinkActivity(
        topicId,
        activity.activityId,
      );
      await loadTopic(true);
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : 'Aktivnost nije odvezana.',
      );
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(activity.activityId);
        return next;
      });
    }
  };

  const confirmDeleteTopic = () => {
    if (deleting) return;
    setDeleteError(null);
    setDeleteVisible(true);
  };

  const closeDeleteTopic = () => {
    if (deleting) return;
    setDeleteVisible(false);
    setDeleteError(null);
  };

  const deleteTopic = async () => {
    if (deleting) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await topicApi.remove(topicId);
      deletedFeedback();
      setDeleteVisible(false);
      navigation.goBack();
    } catch (caught) {
      setDeleteError(
        caught instanceof Error ? caught.message : 'Brisanje teme nije uspjelo.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const toggleTimer = async (activity: TopicActivityResponse) => {
    if (busyIds.has(activity.activityId)) return;

    const currentTimer = timers.get(activity.activityId);
    setActionError(null);
    setBusyIds((current) => new Set(current).add(activity.activityId));
    try {
      const updated = currentTimer?.running
        ? await topicApi.stopActivity(activity.activityId)
        : await topicApi.startActivity(activity.activityId);
      setTimers((current) => {
        const next = new Map(current);
        next.set(activity.activityId, updated);
        return next;
      });
            void (updated.running
        ? semanticFeedback.timerStart()
        : semanticFeedback.timerStop());
      setNow(Date.now());
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : 'Promjena timera nije uspjela.',
      );
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(activity.activityId);
        return next;
      });
    }
  };

  if (loading && !topic) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.black} />
          <Text style={styles.loadingText}>Povezujemo aktivnosti i vrijeme…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if ((error && !topic) || !topic) {
    return (
      <FeedbackView
        type="error"
        message={error ?? 'Tema nije pronađena.'}
        onRetry={() => void loadTopic()}
      />
    );
  }

  const shareTopic = async () => {
    if (sharingTopic) return;

    setSharingTopic(true);
    setError(null);

    try {
      await sharePortableTopic(topicId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Share nije uspio.',
      );
    } finally {
      setSharingTopic(false);
    }
  };

  const header = (
    <>
      <View style={[styles.hero, celestialMode && styles.heroCelestial]}>
        {celestialMode ? <CelestialAtmosphere variant="topics" /> : null}
        {celestialMode ? <Text style={styles.topicDossierSeal}> </Text> : null}
        <Text style={[styles.eyebrow, celestialMode && styles.eyebrowCelestial]}>Tema</Text>
        <View style={styles.portableTitleRow}>
          <Text
            numberOfLines={2}
            style={[styles.heading, styles.portableTitleText, celestialMode && styles.headingCelestial]}
          >
            {topic.name}
          </Text>

          <Pressable
            accessibilityLabel="Share tema"
            accessibilityRole="button"
            disabled={sharingTopic}
            onPress={() => void shareTopic()}
            style={({ pressed }) => [
              styles.portableShare,
              pressed && { opacity: 0.72 },
              sharingTopic && { opacity: 0.5 },
            ]}
          >
            <ShareGlyph />
          </Pressable>
        </View>
        {/* portableVisualPolishV1 */}
        <Text style={[styles.description, celestialMode && styles.descriptionCelestial]}>
          {topic.description || 'Aktivnosti i vrijeme povezani s ovom temom.'}
        </Text>

        {/* forkDTopicsV1: top object management */}
        <View style={styles.topicManageRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Uredi temu"
            onPress={openEditTopic}
            style={({ pressed }) => [
              styles.editTopicButton,
              celestialMode && styles.editTopicButtonCelestial,
              pressed && styles.editTopicButtonPressed,
            ]}
          >
            <Text style={styles.editTopicText}>Uredi temu</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Obriši temu"
            disabled={deleting}
            onPress={confirmDeleteTopic}
            style={({ pressed }) => [
              styles.deleteTopicButton,
              celestialMode && styles.deleteTopicButtonCelestial,
              pressed && !deleting && styles.deleteTopicButtonPressed,
              deleting && styles.deleteTopicButtonDisabled,
            ]}
          >
            <Text style={styles.deleteTopicText}>Obriši temu</Text>
          </Pressable>
        </View>

        {/* topicSingleTotalV1 */}
        <View style={[styles.topicTotalCard, celestialMode && styles.topicTotalCardCelestial]}>
          {celestialMode ? <Text pointerEvents="none" style={styles.topicTotalStar}>✦</Text> : null}
          <View>
            <Text style={[styles.topicTotalLabel, celestialMode && styles.topicTotalLabelCelestial]}>
              UKUPNO VRIJEME
            </Text>
            <Text style={[styles.topicTotalValue, celestialMode && styles.topicTotalValueCelestial]}>
              {formatDuration(
                timeSummary?.totalSeconds ?? 0,
              )}
            </Text>
          </View>

          <Text style={styles.topicTotalMeta}>
            {activities.length === 1
              ? '1 povezana aktivnost'
              : activities.length +
                ' povezanih aktivnosti'}
          </Text>
        </View>

      </View>

      {/* topicActivityActionsV1 */}
      <View style={styles.activityActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Poveži aktivnost aktivnost"
          onPress={() => setLinkPickerVisible(true)}
          style={({ pressed }) => [
            styles.activityAction,
            styles.activityActionPrimary,
            celestialMode && styles.activityActionPrimaryCelestial,
            pressed && styles.activityActionPressed,
          ]}
        >
          <Text style={styles.activityActionMark}>↗</Text>
          <View style={styles.activityActionCopy}>
            <Text
              style={[
                styles.activityActionTitle,
                styles.activityActionTitlePrimary,
              ]}
            >
              Poveži aktivnost
            </Text>
            <Text
              style={[
                styles.activityActionSubtitle,
                styles.activityActionSubtitlePrimary,
              ]}
            >
              Odaberi postojeću aktivnost
            </Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Napravi novu aktivnost"
          onPress={() => {
            setFormError(null);
            setFormVisible(true);
          }}
          style={({ pressed }) => [
            styles.activityAction,
            celestialMode && styles.activityActionCelestial,
            pressed && styles.activityActionPressed,
          ]}
        >
          <Text style={styles.activityActionMark}>+</Text>
          <View style={styles.activityActionCopy}>
            <Text style={styles.activityActionTitle}>
              Nova aktivnost
            </Text>
            <Text style={styles.activityActionSubtitle}>
              Napravi novu i poveži je
            </Text>
          </View>
        </Pressable>
      </View>

      <View style={[styles.sectionHeading, celestialMode && styles.sectionHeadingCelestial]}>
        <Text style={[styles.sectionTitle, celestialMode && styles.sectionTitleCelestial]}>
          {celestialMode ? '✦  ' : ''}Aktivnosti
        </Text>
        {runningCount > 0 ? (
          <View style={styles.runningBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.runningText}>{runningCount} aktivno</Text>
          </View>
        ) : null}
      </View>

      {actionError ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zatvori poruku o grešci"
          onPress={() => setActionError(null)}
          style={styles.errorBanner}
        >
          <Text style={styles.errorText}>{actionError}</Text>
          <Text style={styles.errorClose}>×</Text>
        </Pressable>
      ) : null}

      {error && activities.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void loadTopic(true)}
          style={styles.errorBanner}
        >
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorRetry}>Ponovi</Text>
        </Pressable>
      ) : null}
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <FlatList
          data={orderedActivities}
          keyExtractor={(item) => item.activityId}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const timer = timers.get(item.activityId);

            const trackedSeconds =
              timeSummary?.activities.find(
                (summary) =>
                  summary.activityId ===
                  item.activityId,
              )?.totalSeconds ?? 0;

            return (
              <View style={styles.linkedActivity}>
                <TimerMotionView active={Boolean(timer?.running)}>
                  <TopicActivityCard
                    activity={item}
                    timer={timer}
                    now={now}
                    busy={busyIds.has(item.activityId)}
                    onToggle={() => void toggleTimer(item)}
                  />
                </TimerMotionView>

                {/* topicLinkedActivityMetaV1 */}
                <View style={[styles.linkedActivityMeta, celestialMode && styles.linkedActivityMetaCelestial]}>
                  <Text style={styles.linkedActivityTime}>
                    {formatDuration(trackedSeconds)} ukupno
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    disabled={busyIds.has(item.activityId)}
                    onPress={() =>
                      void unlinkActivity(item)
                    }
                    style={({ pressed }) => [
                      styles.unlinkButton,
                      pressed && styles.unlinkPressed,
                    ]}
                  >
                    <Text style={styles.unlinkText}>
                      Odveži
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListHeaderComponent={header}
          ListFooterComponent={
            <EntityRelationsPanel
              entityType="TOPIC"
              entityId={topicId}
              title={topic.name}
            />
          }
          ListEmptyComponent={
            <View style={[styles.emptyCard, celestialMode && styles.emptyCardCelestial]}>
              <Text style={[styles.emptyMark, celestialMode && styles.emptyMarkCelestial]}>✦</Text>
              <Text style={styles.emptyTitle}>Dodaj prvi način sudjelovanja</Text>
              <Text style={styles.emptyMessage}>
                Jedna tema može imati više različitih aktivnosti. Primjerice, Šah može
                sadržavati i igranje i učenje.
              </Text>
            </View>
          }
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadTopic(true)}
              tintColor={colors.black}
              colors={[colors.black]}
            />
          }
          showsVerticalScrollIndicator={false}
        />

        <TopicActivityLinkPicker
          linkedActivityIds={activities.map(
            (activity) => activity.activityId,
          )}
          onClose={() => setLinkPickerVisible(false)}
          onLinked={() => loadTopic(true)}
          topicId={topicId}
          visible={linkPickerVisible}
        />

        <TopicActivityCreateSheet
          activityType={activityType}
          errorMessage={formError}
          label={activityLabel}
          onClose={closeForm}
          onLabelChange={setActivityLabel}
          onSubmit={() => void createActivity()}
          onTypeChange={setActivityType}
          saving={saving}
          visible={formVisible}
        />

        <Modal
          animationType="fade"
          onRequestClose={closeEditTopic}
          transparent
          visible={editVisible}
        >
          <View style={styles.editBackdrop}>
            <View style={styles.editCard}>
              <Text style={styles.editEyebrow}>
                TEMA
              </Text>

              <Text style={styles.editTitle}>
                Uredi temu
              </Text>

              <Text style={styles.editLabel}>
                Naziv
              </Text>

              <TextInput
                autoFocus
                onChangeText={setEditName}
                placeholder="Naziv teme"
                placeholderTextColor={colors.textMuted}
                style={styles.editInput}
                value={editName}
              />

              <Text style={styles.editLabel}>
                Opis
              </Text>

              <TextInput
                multiline
                onChangeText={setEditDescription}
                placeholder="Opis · neobavezno"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.editInput,
                  styles.editDescription,
                ]}
                textAlignVertical="top"
                value={editDescription}
              />

              {editError ? (
                <Text style={styles.editError}>
                  {editError}
                </Text>
              ) : null}

              <View style={styles.editActions}>
                <Pressable
                  disabled={editSaving}
                  onPress={closeEditTopic}
                  style={styles.editCancel}
                >
                  <Text style={styles.editCancelText}>
                    Odustani
                  </Text>
                </Pressable>

                <Pressable
                  disabled={
                    editSaving ||
                    !editName.trim()
                  }
                  onPress={() => void saveEditTopic()}
                  style={[
                    styles.editSave,
                    (editSaving ||
                      !editName.trim()) &&
                      styles.editSaveDisabled,
                  ]}
                >
                  {editSaving ? (
                    <ActivityIndicator
                      color={colors.white}
                      size="small"
                    />
                  ) : (
                    <Text style={styles.editSaveText}>
                      Spremi
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <DeleteConfirmationModal
          visible={deleteVisible}
          itemTitle={topic.name}
          title="Obrisati temu?"
          message={`Tema „${topic.name}” bit će obrisana. Poveznice s aktivnostima se uklanjaju, ali aktivnosti ostaju.`}
          accessibilityLabel={`Potvrda brisanja teme ${topic.name}`}
          loading={deleting}
          errorMessage={deleteError}
          onCancel={closeDeleteTopic}
          onConfirm={() => void deleteTopic()}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topicTotalCard: {
    marginTop: 18,
    minHeight: 84,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  topicTotalLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  topicTotalValue: {
    marginTop: 4,
    color: colors.text,
    fontSize: 27,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  topicTotalMeta: {
    maxWidth: 180,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'right',
  },
  activityActions: {
    marginTop: 18,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 10,
  },
  activityAction: {
    flex: 1,
    minHeight: 68,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 17,
    backgroundColor: colors.surface,
  },
  activityActionPrimary: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  activityActionPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.99 }],
  },
  activityActionMark: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: '800',
  },
  activityActionCopy: {
    flex: 1,
    minWidth: 0,
  },
  activityActionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  activityActionTitlePrimary: {
    color: colors.white,
  },
  activityActionSubtitle: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 9.5,
    lineHeight: 13,
  },
  activityActionSubtitlePrimary: {
    color: colors.white,
    opacity: 0.72,
  },
  linkedActivity: {
    marginBottom: 10,
  },
  linkedActivityMeta: {
    marginTop: -1,
    marginHorizontal: 14,
    minHeight: 36,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
    backgroundColor: colors.fill,
  },
  linkedActivityTime: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  unlinkButton: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  unlinkPressed: {
    opacity: 0.55,
  },
  unlinkText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 14,
    color: colors.textMuted,
    fontSize: 14,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 38,
  },
  hero: {
    paddingTop: 22,
    paddingBottom: 23,
  },
  heroMark: {
    width: 64,
    height: 64,
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.black,
  },
  heroMarkText: {
    color: colors.white,
    fontSize: 29,
    fontWeight: '800',
  },
  topicManageRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 9,
  },
  editTopicButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fillStrong,
    paddingHorizontal: 14,
  },
  editTopicButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.985 }],
  },
  editTopicText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  editBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
    backgroundColor: celestialAlpha(celestial.shadow, 0.38),
  },
  editCard: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  editEyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  editTitle: {
    marginTop: 5,
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  editLabel: {
    marginTop: 17,
    marginBottom: 7,
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  editInput: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 14,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
  },
  editDescription: {
    minHeight: 100,
    paddingTop: 13,
  },
  editError: {
    marginTop: 10,
    color: colors.danger,
    fontSize: 12,
  },
  editActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  editCancel: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 13,
  },
  editCancelText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  editSave: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.black,
  },
  editSaveDisabled: {
    opacity: 0.45,
  },
  editSaveText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  deleteTopicButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },
  deleteTopicButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.985 }],
  },
  deleteTopicButtonDisabled: {
    opacity: 0.5,
  },
  deleteTopicText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heading: {
    marginTop: 3,
    color: colors.text,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  portableTitleRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  portableTitleText: {
    flexShrink: 1,
    minWidth: 0,
  },
  portableShare: {
    width: 30,
    height: 30,
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  portableShareText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  description: {
    maxWidth: 360,
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  metrics: {
    minHeight: 67,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 33,
    backgroundColor: colors.separator,
  },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  metricLabel: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  addButton: {
    minHeight: 74,
    marginBottom: 22,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: colors.fillStrong,
  },
  addButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.99 }],
  },
  addPlus: {
    width: 40,
    height: 40,
    color: colors.white,
    backgroundColor: colors.black,
    borderRadius: 13,
    fontSize: 24,
    lineHeight: 39,
    fontWeight: '400',
    textAlign: 'center',
  },
  addCopy: {
    flex: 1,
    paddingHorizontal: 12,
  },
  addTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  addSubtitle: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 11,
  },
  addArrow: {
    color: colors.textMuted,
    fontSize: 27,
  },
  sectionHeading: {
    minHeight: 31,
    marginBottom: 10,
    paddingHorizontal: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  runningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.black,
  },
  liveDot: {
    width: 7,
    height: 7,
    marginRight: 6,
    borderRadius: 4,
    backgroundColor: '#30D158',
  },
  runningText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  errorBanner: {
    marginBottom: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 13,
    backgroundColor: colors.dangerSoft,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  errorClose: {
    marginLeft: 9,
    color: colors.danger,
    fontSize: 22,
    lineHeight: 22,
  },
  errorRetry: {
    marginLeft: 9,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  emptyCard: {
    minHeight: 230,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    borderStyle: 'dashed',
  },
  emptyMark: {
    color: colors.black,
    fontSize: 36,
  },
  emptyTitle: {
    marginTop: 9,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyMessage: {
    maxWidth: 310,
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  heroCelestial: {
    position: 'relative',
    marginTop: 10,
    marginBottom: 16,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.34),
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  topicDossierSeal: {
    marginBottom: 11,
    color: CELESTIAL_GOLD,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2.1,
    textAlign: 'right',
    opacity: 0.8,
  },
  eyebrowCelestial: {
    color: CELESTIAL_GOLD,
    letterSpacing: 1.7,
  },
  headingCelestial: {
    letterSpacing: -0.35,
  },
  descriptionCelestial: {
    maxWidth: 520,
  },
  editTopicButtonCelestial: {
    borderColor: celestialAlpha(celestial.gold, 0.40),
    backgroundColor: celestialAlpha(celestial.gold, 0.08),
  },
  deleteTopicButtonCelestial: {
    borderColor: celestialAlpha(celestial.gold, 0.22),
  },
  topicTotalCardCelestial: {
    position: 'relative',
    overflow: 'hidden',
    borderColor: celestialAlpha(celestial.gold, 0.46),
    shadowColor: celestial.night,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1,
  },
  topicTotalStar: {
    position: 'absolute',
    right: 12,
    top: 9,
    color: CELESTIAL_GOLD,
    fontSize: 9,
    opacity: 0.64,
  },
  topicTotalLabelCelestial: {
    color: CELESTIAL_GOLD,
    letterSpacing: 1.25,
  },
  topicTotalValueCelestial: {
    letterSpacing: -0.35,
  },
  activityActionPrimaryCelestial: {
    borderColor: celestialAlpha(celestial.gold, 0.70),
  },
  activityActionCelestial: {
    borderColor: celestialAlpha(celestial.gold, 0.38),
  },
  sectionHeadingCelestial: {
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: celestialAlpha(celestial.gold, 0.28),
  },
  sectionTitleCelestial: {
    letterSpacing: 0.15,
  },
  linkedActivityMetaCelestial: {
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.20),
  },
  emptyCardCelestial: {
    borderColor: celestialAlpha(celestial.gold, 0.38),
    backgroundColor: colors.surface,
  },
  emptyMarkCelestial: {
    color: CELESTIAL_GOLD,
  },
});

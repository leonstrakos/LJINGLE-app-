import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityCreateForm } from '../components/ActivityCreateForm';
import { EntityRelationsPanel } from '../components/EntityRelationsPanel';
import { FeedbackView } from '../components/FeedbackView';
import { TopicActivityCard } from '../components/TopicActivityCard';
import { topicApi } from '../services/topicApi';
import { colors } from '../theme/colors';
import type {
  ActivityType,
  TopicActivityResponse,
  TopicActivityTimerResponse,
  TopicDetailsParams,
  TopicResponse,
} from '../types/topic';

export type TopicDetailsScreenProps = {
  route: { params: TopicDetailsParams };
};

function timersByActivityId(timers: TopicActivityTimerResponse[]) {
  const byId = new Map<string, TopicActivityTimerResponse>();
  timers.forEach((timer) => {
    if (timer.activityId) byId.set(timer.activityId, timer);
  });
  return byId;
}

export function TopicDetailsScreen({ route }: TopicDetailsScreenProps) {
  const { topicId } = route.params;
  const [topic, setTopic] = useState<TopicResponse | null>(null);
  const [activities, setActivities] = useState<TopicActivityResponse[]>([]);
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

  const runningCount = useMemo(
    () => Array.from(timers.values()).filter((timer) => timer.running).length,
    [timers],
  );

  const loadTopic = useCallback(async (asRefresh = false) => {
    asRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [loadedTopic, loadedActivities, activeTimers] = await Promise.all([
        topicApi.getById(topicId),
        topicApi.getActivities(topicId),
        topicApi.getActiveActivities(),
      ]);
      const activityIds = new Set(loadedActivities.map((activity) => activity.activityId));
      setTopic(loadedTopic);
      setActivities(loadedActivities);
      setTimers(
        timersByActivityId(
          activeTimers.filter(
            (timer) => timer.activityId !== null && activityIds.has(timer.activityId),
          ),
        ),
      );
      setNow(Date.now());
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
      const created = await topicApi.createActivity(topicId, {
        label,
        activityType,
      });
      setActivities((current) => [...current, created]);
      setTopic((current) =>
        current ? { ...current, activityCount: current.activityCount + 1 } : current,
      );
      setFormVisible(false);
      setActivityLabel('');
      setActivityType('STUDYING');
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : 'Stvaranje aktivnosti nije uspjelo.',
      );
    } finally {
      setSaving(false);
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

  const header = (
    <>
      <View style={styles.hero}>
        <View style={styles.heroMark}>
          <Text style={styles.heroMarkText}>{topic.name.trim().charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.eyebrow}>Tema</Text>
        <Text style={styles.heading}>{topic.name}</Text>
        <Text style={styles.description}>
          {topic.description || 'Aktivnosti i vrijeme povezani s ovom temom.'}
        </Text>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{activities.length}</Text>
            <Text style={styles.metricLabel}>aktivnosti</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{runningCount}</Text>
            <Text style={styles.metricLabel}>aktivno sada</Text>
          </View>
        </View>
      </View>

      <EntityRelationsPanel entityType="TOPIC" entityId={topicId} title={topic.name} />

      {formVisible ? (
        <ActivityCreateForm
          label={activityLabel}
          activityType={activityType}
          saving={saving}
          errorMessage={formError}
          onLabelChange={setActivityLabel}
          onTypeChange={setActivityType}
          onCancel={closeForm}
          onSubmit={() => void createActivity()}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dodaj novu aktivnost"
          onPress={() => {
            setFormError(null);
            setFormVisible(true);
          }}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        >
          <Text style={styles.addPlus}>+</Text>
          <View style={styles.addCopy}>
            <Text style={styles.addTitle}>Dodaj aktivnost</Text>
            <Text style={styles.addSubtitle}>Učenje, igranje, istraživanje ili nešto tvoje</Text>
          </View>
          <Text style={styles.addArrow}>›</Text>
        </Pressable>
      )}

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Aktivnosti</Text>
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
          data={activities}
          keyExtractor={(item) => item.activityId}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TopicActivityCard
              activity={item}
              timer={timers.get(item.activityId)}
              now={now}
              busy={busyIds.has(item.activityId)}
              onToggle={() => void toggleTimer(item)}
            />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyMark}>◇</Text>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
});

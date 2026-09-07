// ljingleContrastTargetedR3
import { useCallback, useState } from 'react';
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
import { AeroAtmosphere } from '../components/AeroAtmosphere';

import { FeedbackView } from '../components/FeedbackView';
import { TopicCard } from '../components/TopicCard';
import { TopicCreateForm } from '../components/TopicCreateForm';
import { topicApi } from '../services/topicApi';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import type { TopicDetailsParams, TopicResponse } from '../types/topic';
import { createdFeedback } from '../utils/crudFeedback';

import { CelestialAtmosphere } from '../components/CelestialAtmosphere';

import { celestial, celestialAlpha } from '../theme/celestial';
import { CelestialMotionLayer } from '../components/CelestialMotionLayer';
import { updateCelestialParallax } from '../motion/celestialParallax';
// forkN2CelestialCollectionsTopicsV2
const celestialMode = (activeVisualSkinId === 'classic' || activeVisualSkinId === 'classic-ljingle');
const CELESTIAL_GOLD = celestial.gold;

export type TopicListScreenProps = {
  navigation: {
    navigate: (screen: 'TopicDetails', params: TopicDetailsParams) => void;
  };
};

function topicCountLabel(count: number) {
  if (count === 1) return 'tema u tvom svijetu';
  if (count > 1 && count < 5) return 'teme u tvom svijetu';
  return 'tema u tvom svijetu';
}

export function TopicListScreen({ navigation }: TopicListScreenProps) {
  const [topics, setTopics] = useState<TopicResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadTopics = useCallback(async (asRefresh = false) => {
    asRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setTopics(await topicApi.getAll());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dohvat tema nije uspio.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTopics();
    }, [loadTopics]),
  );

  const closeForm = () => {
    if (saving) return;
    setFormVisible(false);
    setName('');
    setDescription('');
    setFormError(null);
  };

  const createTopic = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;

    setSaving(true);
    setFormError(null);
    try {
      const trimmedDescription = description.trim();
      const created = await topicApi.create({
        name: trimmedName,
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
      });
      createdFeedback();
      setTopics((current) => [created, ...current]);
      setFormVisible(false);
      setName('');
      setDescription('');
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Stvaranje teme nije uspjelo.');
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <>
      <View
        style={[
          styles.hero,
          celestialMode && styles.heroCelestial,
          celestialMode && styles.topicsEntriesHeroR1,
        ]}
      >
        {/* ljingleCelestialMotionLanguageR1:topics */}
        <CelestialMotionLayer preset="topics" />
        <CelestialAtmosphere variant="topics" />
        <Text
          style={[
            styles.eyebrow,
            celestialMode && styles.eyebrowCelestial,
            celestialMode && styles.topicsEntriesEyebrowR1,
          ]}
        ></Text>
        <Text
          style={[
            styles.heading,
            celestialMode && styles.headingCelestial,
            celestialMode && styles.topicsEntriesHeadingR1,
          ]}
        >
          Teme
        </Text>
        <Text style={[styles.intro, celestialMode && styles.introCelestial]}>
          Okupi aktivnosti, katalog i vrijeme oko onoga što ti je doista važno.
        </Text>

        <View
          style={[
            styles.summaryRow,
            celestialMode && styles.topicsEntriesSummaryRowR1,
          ]}
        >
          <View
            style={[
              styles.summaryNumber,
              celestialMode && styles.summaryNumberCelestial,
              celestialMode && styles.topicsEntriesSummaryNumberR1,
            ]}
          >
            <Text
              style={[
                styles.summaryValue,
                celestialMode && styles.topicsEntriesSummaryValueR1,
              ]}
            >
              {topics.length}
            </Text>
          </View>
          <Text
            style={[
              styles.summaryLabel,
              celestialMode && styles.topicsEntriesSummaryLabelR1,
            ]}
          >
            {topicCountLabel(topics.length)}
          </Text>
        </View>
      </View>

      {formVisible ? (
        <TopicCreateForm
          name={name}
          description={description}
          saving={saving}
          errorMessage={formError}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onCancel={closeForm}
          onSubmit={() => void createTopic()}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setFormError(null);
            setFormVisible(true);
          }}
          style={({ pressed }) => [
            styles.addCard,
            celestialMode && styles.addCardCelestial,
            pressed && styles.addCardPressed,
          ]}
        >
          <View style={[styles.addIcon, celestialMode && styles.addIconCelestial]}>
            <Text style={[styles.addIconText, celestialMode && styles.addIconTextCelestial]}>+</Text>
          </View>
          <View style={styles.addCopy}>
            <Text style={styles.addTitle}>Nova tema</Text>
            <Text style={styles.addSubtitle}>Stvori prostor za interes ili projekt</Text>
          </View>
          <Text style={styles.addArrow}>›</Text>
        </Pressable>
      )}

      <View
        style={[
          styles.sectionHeading,
          celestialMode && styles.sectionHeadingCelestial,
          celestialMode && styles.topicsEntriesSectionHeadingR1,
        ]}
      >
        <Text
          style={[
            styles.sectionTitle,
            celestialMode && styles.sectionTitleCelestial,
            celestialMode && styles.topicsEntriesSectionTitleR1,
          ]}
        >
          Sve teme
        </Text>
        {refreshing ? <Text style={styles.syncText}>Osvježavanje…</Text> : null}
      </View>

      {error && topics.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void loadTopics(true)}
          style={styles.errorBanner}
        >
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorRetry}>Ponovi</Text>
        </Pressable>
      ) : null}
    </>
  );

  if (loading && topics.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
      <AeroAtmosphere variant="topics" />
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.black} />
          <Text style={styles.loadingText}>Slažemo tvoj indeks tema…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && topics.length === 0) {
    return <FeedbackView type="error" message={error} onRetry={() => void loadTopics()} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <AeroAtmosphere variant="topics" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <FlatList
          data={topics}
          keyExtractor={(item) => item.topicId}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TopicCard
              topic={item}
              onPress={() => navigation.navigate('TopicDetails', { topicId: item.topicId })}
            />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View style={[styles.emptyCard, celestialMode && styles.emptyCardCelestial]}>
              <Text style={styles.emptyMark}>○</Text>
              <Text style={styles.emptyTitle}>Tvoj indeks još je prazan</Text>
              <Text style={styles.emptyMessage}>
                Započni temom poput Filozofija, Francuski ili Šah, a zatim joj dodaj
                različite aktivnosti.
              </Text>
            </View>
          }
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadTopics(true)}
              tintColor={colors.black}
              colors={[colors.black]}
            />
          }
          showsVerticalScrollIndicator={false}
        
          onScroll={(event) => {
            // ljingleSemanticAliveR1:scroll-topics
            updateCelestialParallax(event.nativeEvent.contentOffset.y);
          }}
          scrollEventThrottle={16}
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
    paddingTop: 24,
    paddingHorizontal: 3,
    paddingBottom: 22,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  heading: {
    marginTop: 4,
    color: colors.text,
    fontSize: 42,
    lineHeight: 49,
    fontWeight: '900',
    letterSpacing: -1.3,
  },
  intro: {
    maxWidth: 355,
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  summaryRow: {
    marginTop: 17,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryNumber: {
    minWidth: 34,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: colors.black,
  },
  summaryValue: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '800',
  },
  summaryLabel: {
    marginLeft: 9,
    color: colors.textMuted,
    fontSize: 13,
  },
  addCard: {
    minHeight: 77,
    marginBottom: 22,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: colors.black,
  },
  addCardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  addIcon: {
    width: 43,
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: celestialMode ? 'transparent' : colors.white,
  },
  addIconText: {
    color: celestialMode ? colors.onAccent : colors.black,
    fontSize: 25,
    lineHeight: 28,
    fontWeight: '400',
  },
  addCopy: {
    flex: 1,
    paddingHorizontal: 13,
  },
  addTitle: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '800',
  },
  addSubtitle: {
    marginTop: 3,
    color: colors.onAccent,
    fontSize: 12,
  },
  addArrow: {
    color: colors.onAccent,
    fontSize: 27,
  },
  sectionHeading: {
    marginBottom: 11,
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
  syncText: {
    color: colors.textMuted,
    fontSize: 11,
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
  },
  errorRetry: {
    marginLeft: 8,
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
    fontSize: 37,
    fontWeight: '300',
  },
  emptyTitle: {
    marginTop: 10,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyMessage: {
    maxWidth: 300,
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  heroCelestial: {
    marginTop: 10,
    marginBottom: 18,
    paddingTop: 25,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.32),
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  eyebrowCelestial: {
    color: CELESTIAL_GOLD,
    letterSpacing: 1.8,
  },
  headingCelestial: {
    letterSpacing: -0.4,
  },
  introCelestial: {
    maxWidth: 520,
  },
  topicIndexSeal: {
    marginTop: 16,
    color: CELESTIAL_GOLD,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2.1,
    opacity: 0.82,
  },
  summaryNumberCelestial: {
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.72),
  },
  addCardCelestial: {
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.58),
    shadowColor: celestial.night,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.13,
    shadowRadius: 14,
    elevation: 2,
  },
  addIconCelestial: {
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.72),
    backgroundColor: 'transparent',
  },
  addIconTextCelestial: {
    color: colors.onAccent,
  },
  sectionHeadingCelestial: {
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: celestialAlpha(celestial.gold, 0.25),
  },
  sectionTitleCelestial: {
    letterSpacing: 0.2,
  },
  emptyCardCelestial: {
    borderColor: celestialAlpha(celestial.gold, 0.38),
    backgroundColor: colors.surface,
  },
  // ljingleTopicsEntriesUiParityR1
  topicsEntriesHeroR1: {
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 24,
    paddingHorizontal: 3,
    paddingBottom: 20,
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    overflow: 'visible',
  },
  topicsEntriesEyebrowR1: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  topicsEntriesHeadingR1: {
    marginTop: 5,
    fontSize: 36,
    lineHeight: 43,
    fontWeight: '800',
    letterSpacing: -1.1,
  },
  topicsEntriesSummaryRowR1: {
    marginTop: 18,
    alignItems: 'baseline',
  },
  topicsEntriesSummaryNumberR1: {
    minWidth: 0,
    height: 34,
    paddingHorizontal: 0,
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  topicsEntriesSummaryValueR1: {
    color: colors.text,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '800',
  },
  topicsEntriesSummaryLabelR1: {
    marginLeft: 8,
    fontSize: 13,
  },
  topicsEntriesSectionHeadingR1: {
    paddingTop: 0,
    borderTopWidth: 0,
    borderTopColor: 'transparent',
  },
  topicsEntriesSectionTitleR1: {
    letterSpacing: 0,
  },

});

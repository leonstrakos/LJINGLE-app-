import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActiveTimerCard } from '../components/ActiveTimerCard';
import { CelestialAtmosphere } from '../components/CelestialAtmosphere';
import { RecentActivityCard } from '../components/RecentActivityCard';
import { activityApi } from '../services/activityApi';
import { entryApi } from '../services/entryApi';
import { statsApi } from '../services/statsApi';
import { colors,
  isDarkBackground,
} from '../theme/colors';
import { activeAeroBackgroundId } from '../theme/aeroBackground';
import { activeVisualSkinId } from '../theme/visualSkins';
import { activeRadioThemeId } from '../theme/radioTheme';
import type { ActivityTimerResponse } from '../types/activity';
import type { Entry } from '../types/entry';
import type { RootStackParamList } from '../types/navigation';
import type { DailyTimeResponse } from '../types/stats';
import { formatDuration } from '../utils/activityTime';
import { semanticFeedback } from '../utils/semanticFeedback';

import { celestial, celestialAlpha } from '../theme/celestial';
import { ConstellationGridGlyph } from '../components/ConstellationGridGlyph';

// forkN5GlyphReorderV1

type Props = NativeStackScreenProps<RootStackParamList, 'Today'>;

const pixelMode = activeVisualSkinId === 'pixel';
const aeroMode = activeVisualSkinId === 'aero';

// aeroSearchQuoteTimerHygieneV3
// Aero is an authored visual skin, not a semantic accent variant.
// Keep its Home accent fixed while Classic/Pixel keep the existing theme token.
const AERO_HOME_ACCENT = '#505359';
const AERO_METAL_MID = '#73777D';
const AERO_GLASS_EDGE = 'rgba(104,108,114,0.42)';
const AERO_GLASS_WHITE = 'rgba(255,255,255,0.72)';
const AERO_GLASS_WHITE_STRONG = 'rgba(255,255,255,0.90)';
const AERO_METAL_SOFT = 'rgba(80,83,89,0.58)';

// aeroVistaNeutralFinalV32
// Final Aero UI palette: Vista white glass + neutral graphite/silver.
// No semantic blue/cyan is used for UI chrome.
const homeAccent =
  aeroMode
    ? AERO_HOME_ACCENT
    : colors.navy;

// aeroVistaWhiteGlassV31
// Vista Aero is neutral silver/graphite: no saturated semantic accent bleed.
const celestialMode = activeVisualSkinId === 'classic';
// forkKDarkBackgroundContrastV1
// forkN1CelestialHomeCommandBellV1
const radioInverted = activeRadioThemeId === 'inverted';
const aeroOcean =
  aeroMode && activeAeroBackgroundId === 'ocean';
const aeroMeadow =
  aeroMode && activeAeroBackgroundId === 'meadow';

const dayNames = [
  'nedjelja',
  'ponedjeljak',
  'utorak',
  'srijeda',
  'četvrtak',
  'petak',
  'subota',
];

const monthNames = [
  'siječnja',
  'veljače',
  'ožujka',
  'travnja',
  'svibnja',
  'lipnja',
  'srpnja',
  'kolovoza',
  'rujna',
  'listopada',
  'studenoga',
  'prosinca',
];

function formatToday(date: Date) {
  return `${dayNames[date.getDay()]}, ${date.getDate()}. ${monthNames[date.getMonth()]}`;
}


function CelestialHomeField() {
  return (
    <View pointerEvents="none" style={styles.celestialFieldN1}>
      <Text style={[styles.celestialStarN1, styles.celestialStarA1N1]}>✦</Text>
      <Text style={[styles.celestialStarN1, styles.celestialStarA2N1]}>·</Text>
      <Text style={[styles.celestialStarN1, styles.celestialStarA3N1]}>✧</Text>
      <Text style={[styles.celestialStarN1, styles.celestialStarA4N1]}>✦</Text>
      <Text style={[styles.celestialStarN1, styles.celestialStarA5N1]}>·</Text>
      <Text style={[styles.celestialStarN1, styles.celestialStarA6N1]}>✧</Text>
      <Text style={[styles.celestialStarN1, styles.celestialStarA7N1]}>✦</Text>
      <Text style={[styles.celestialStarN1, styles.celestialStarA8N1]}>·</Text>
      <View style={[styles.celestialLineN1, styles.celestialLineOneN1]} />
      <View style={[styles.celestialLineN1, styles.celestialLineTwoN1]} />
      <View style={styles.celestialOrbitN1}>
        <View style={styles.celestialOrbitCoreN1} />
      </View>
    </View>
  );
}

function AeroBubble({ style, float }: { style: object; float: Animated.Value }) {
  return (
    <Animated.View
      style={[
        styles.aeroBubble3d,
        style,
        {
          transform: [
            { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [18, -32] }) },
            { scale: float.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.92, 1.04, 0.92] }) },
          ],
        },
      ]}
    >
      <View style={styles.aeroBubbleShine} />
    </Animated.View>
  );
}

function AeroFish({ style, swim }: { style: object; swim: Animated.Value }) {
  return (
    <Animated.View
      style={[
        styles.aeroFish,
        style,
        { transform: [{ translateX: swim.interpolate({ inputRange: [0, 1], outputRange: [-120, 920] }) }] },
      ]}
    >
      <View style={styles.aeroFishTail} />
      <View style={styles.aeroFishBody}>
        <View style={styles.aeroFishStripeOne} />
        <View style={styles.aeroFishStripeTwo} />
        <View style={styles.aeroFishEye} />
      </View>
    </Animated.View>
  );
}

function AeroAquarium() {
  const float = useRef(new Animated.Value(0)).current;
  const swim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bubbles = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 7200, useNativeDriver: false }),
        Animated.timing(float, { toValue: 0, duration: 7200, useNativeDriver: false }),
      ]),
    );
    const fish = Animated.loop(
      Animated.sequence([
        Animated.timing(swim, { toValue: 1, duration: 24000, useNativeDriver: false }),
        Animated.timing(swim, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    );
    bubbles.start();
    fish.start();
    return () => { bubbles.stop(); fish.stop(); };
  }, [float, swim]);

  return (
    <View style={styles.aeroAtmosphere}>
      <View style={styles.aeroWaterGlow} />
      <View style={styles.aeroGlassArc} />
      <AeroBubble float={float} style={styles.aeroBubbleA} />
      <AeroBubble float={float} style={styles.aeroBubbleB} />
      <AeroBubble float={float} style={styles.aeroBubbleC} />
      <AeroBubble float={float} style={styles.aeroBubbleD} />
      <AeroBubble float={float} style={styles.aeroBubbleE} />
      <AeroFish swim={swim} style={styles.aeroFishOne} />
      <AeroFish swim={swim} style={styles.aeroFishTwo} />
    </View>
  );
}

function AeroScreenBubbles() {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 26000, useNativeDriver: false }),
        Animated.timing(drift, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [drift]);

  const bubbles = [
    [styles.screenBubblePink, 0],
    [styles.screenBubbleGold, 110],
    [styles.screenBubbleViolet, 250],
    [styles.screenBubbleMint, 390],
    [styles.screenBubbleBlue, 540],
    [styles.screenBubblePeach, 680],
  ] as const;

  return (
    <View style={styles.aeroScreenBubbleLayer}>
      {bubbles.map(([bubbleStyle, offset], index) => (
        <Animated.View
          key={index}
          style={[
            styles.screenBubble,
            bubbleStyle,
            {
              transform: [
                { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [980 + offset, -420 + offset] }) },
                { translateX: drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, index % 2 ? 34 : -28, 0] }) },
                { scale: drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.86, 1.06, 0.9] }) },
              ],
            },
          ]}
        >
          <View style={styles.screenBubbleRim} />
          <View style={styles.screenBubbleGlint} />
        </Animated.View>
      ))}
    </View>
  );
}

function AeroGrassTexture() {
  return (
    <View style={styles.aeroGrassBed}>
      <View style={styles.aeroGrassFarHill} />
      <View style={styles.aeroGrassNearHill} />
      <View style={styles.aeroGrassGlow} />
      {Array.from({ length: 80 }, (_, index) => (
        <View
          key={index}
          style={[
            styles.aeroGrassBlade,
            {
              left: index * 5,
              height: 28 + (index % 9) * 6,
              opacity: 0.42 + (index % 4) * 0.12,
              backgroundColor: index % 7 === 0 ? '#D8FF66' : index % 3 === 0 ? '#67C84A' : '#218540',
              transform: [{ rotate: index % 2 ? '9deg' : '-7deg' }],
            },
          ]}
        />
      ))}
    </View>
  );
}


type AeroReflectionVariant =
  | 'search'
  | 'catalogue'
  | 'daily'
  | 'left'
  | 'right'
  | 'wide'
  | 'soft';

function AeroReflection({
  variant = 'soft',
}: {
  variant?: AeroReflectionVariant;
}) {
  const fromRight =
    variant === 'catalogue' ||
    variant === 'right';

  const wide =
    variant === 'daily' ||
    variant === 'wide';

  const soft =
    variant === 'soft';

  return (
    <View
      pointerEvents="none"
      style={[
        styles.aeroReflectionLayer,
        soft && styles.aeroReflectionSoft,
      ]}
    >
      <View
        style={[
          styles.aeroReflectionSheen,
          fromRight
            ? styles.aeroReflectionSheenRight
            : styles.aeroReflectionSheenLeft,
          wide && styles.aeroReflectionSheenWide,
        ]}
      />

      <View
        style={[
          styles.aeroReflectionStreak,
          fromRight
            ? styles.aeroReflectionStreakRight
            : styles.aeroReflectionStreakLeft,
          wide && styles.aeroReflectionStreakWide,
        ]}
      />

      <View
        style={[
          styles.aeroReflectionBloom,
          fromRight
            ? styles.aeroReflectionBloomRight
            : styles.aeroReflectionBloomLeft,
          wide && styles.aeroReflectionBloomWide,
        ]}
      />

      <View style={styles.aeroReflectionTopRim} />
      <View style={styles.aeroReflectionBottomRim} />
    </View>
  );
}

const aeroWorldBackgroundSource =
  activeAeroBackgroundId === 'ocean'
    ? require('../assets/aero/aero-world-bg2.webp')
    : require('../assets/aero/aero-meadow-ufo.jpeg');

export function TodayScreen({ navigation }: Props) {
  const oceanAero = aeroMode && activeAeroBackgroundId === 'ocean';
  const [timers, setTimers] = useState<ActivityTimerResponse[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityTimerResponse[]>([]);
  const [dailyTime, setDailyTime] = useState<DailyTimeResponse | null>(null);
  // globalTimerInsideDailyCardV1
  const [globalTimer, setGlobalTimer] =
    useState<ActivityTimerResponse | null>(null);
  const [globalTimerBusy, setGlobalTimerBusy] =
    useState(false);
  const [quotes, setQuotes] = useState<Entry[]>([]);
  const [dailyMeasuredAt, setDailyMeasuredAt] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set());
  const [startingIds, setStartingIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());

  const dateLabel = useMemo(() => formatToday(new Date(now)), [now]);
  const dailyQuote = useMemo(() => {
    if (quotes.length === 0) return null;
    const dayNumber = Math.floor(new Date(now).setHours(0, 0, 0, 0) / 86_400_000);
    return quotes[dayNumber % quotes.length];
  }, [now, quotes]);

  const loadActiveTimers = useCallback(async (asRefresh = false) => {
    asRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      const [activeTimers, recent, today, savedQuotes] = await Promise.all([
        activityApi.getActive(),
        activityApi.getRecent(),
        statsApi.getDaily(),
        entryApi.getAll({ type: 'QUOTE' }),
      ]);
      setTimers(activeTimers);
      setGlobalTimer(await activityApi.getGlobal());
      setRecentActivities(recent);
      setDailyTime(today);
      setQuotes(savedQuotes);
      setDailyMeasuredAt(Date.now());
      setNow(Date.now());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Dohvat aktivnih aktivnosti nije uspio.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadActiveTimers();
    }, [loadActiveTimers]),
  );

  useEffect(() => {
    if (
      timers.length === 0 &&
      !globalTimer?.running
    ) {
      return undefined;
    }

    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [timers.length, globalTimer?.running]);

  const stopTimer = async (timer: ActivityTimerResponse) => {
    if (!timer.activityId || stoppingIds.has(timer.activityId)) return;

    const activityId = timer.activityId;
    setError(null);
    setStoppingIds((current) => new Set(current).add(activityId));

    try {
      await activityApi.stop(activityId);
      // semanticTimerFeedbackV1
      void semanticFeedback.timerStop();
      await loadActiveTimers(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Zaustavljanje aktivnosti nije uspjelo.',
      );
    } finally {
      setStoppingIds((current) => {
        const updated = new Set(current);
        updated.delete(activityId);
        return updated;
      });
    }
  };

  const startRecentActivity = async (activity: ActivityTimerResponse) => {
    if (!activity.activityId || startingIds.has(activity.activityId)) return;

    const activityId = activity.activityId;
    setError(null);
    setStartingIds((current) => new Set(current).add(activityId));

    try {
      await activityApi.start(activityId);
      void semanticFeedback.timerStart();
      await loadActiveTimers(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Nastavljanje aktivnosti nije uspjelo.',
      );
    } finally {
      setStartingIds((current) => {
        const updated = new Set(current);
        updated.delete(activityId);
        return updated;
      });
    }
  };

  const toggleGlobalTimer = async () => {
    if (globalTimerBusy) return;

    setGlobalTimerBusy(true);
    setError(null);

    try {
      const updated = globalTimer?.running
        ? (await activityApi.stopGlobal()).timer
        : await activityApi.startGlobal();

      setGlobalTimer(updated);
      setNow(Date.now());

      void (
        updated.running
          ? semanticFeedback.timerStart()
          : semanticFeedback.timerStop()
      );

      // Refresh daily totals + breakdown immediately.
      await loadActiveTimers(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Globalni timer nije promijenjen.',
      );
    } finally {
      setGlobalTimerBusy(false);
    }
  };

  const liveDailyIncrement = Math.max(0, Math.floor((now - dailyMeasuredAt) / 1000));
  const liveDailyTotal = dailyTime
    ? dailyTime.totalSeconds
      + dailyTime.activities.filter((activity) => activity.running).length * liveDailyIncrement
    : 0;

  const header = (
    <>
      <View style={[styles.hero, aeroMode && styles.aeroHero, celestialMode && styles.celestialHeroN1]}>
        <CelestialAtmosphere variant="home" />
        {oceanAero ? <AeroAquarium /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Otvori postavke"
          hitSlop={16}
          onPress={() => navigation.navigate('ThemePicker')}
          style={({ pressed }) => [styles.themeButton, pressed && styles.themeButtonPressed]}
        >
          {/* settingsGearIconV1 */}
          <Image
            source={require('../assets/ui/settings-gear.png')}
            resizeMode="cover"
            style={[
              styles.settingsGearIcon,
              {
                tintColor: aeroMode
                  ? '#666A70'
                  : celestialMode
                    ? celestial.gold
                    : pixelMode
                      ? colors.text
                      : homeAccent,
              },
            ]}
          />
        </Pressable>
        <Text style={[styles.date, pixelMode && styles.pixelText, celestialMode && styles.celestialDateN1]}>{dateLabel}</Text>
        {pixelMode ? (
          <>
            <Text style={styles.pixelBoot}>LJINGLE_OS / TODAY.LOG / READY</Text>
            <View style={styles.pixelDither}>
              {Array.from({ length: 64 }, (_, index) => (
                <View key={index} style={[styles.pixelDot, index % 3 === 0 && styles.pixelDotOn]} />
              ))}
            </View>
          </>
        ) : null}
        <View style={[styles.quoteHero, celestialMode && styles.celestialQuoteHeroN1]}>
          <Text
            style={[
              styles.quoteText,
              pixelMode && styles.pixelText,
              !dailyQuote?.content && styles.aeroEmptyQuoteV31,
            ]}
            numberOfLines={4}
          >
            {dailyQuote?.content ?? (pixelMode ? '"' : '\u201C')}
          </Text>
          {dailyQuote?.title ? (
            <Text style={styles.quoteSource}>{dailyQuote.title}</Text>
          ) : null}
        </View>
      </View>



      {/* forkIHomeProfileV1: Home search removed — Bell Menu, Command Palette and Catalogue own search. */}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Otvori katalog"
        onPress={() => navigation.navigate('Catalogue')}
        style={({ pressed }) => [
          styles.catalogueCard,
          celestialMode && styles.jinglePolishCatalogueCard,
          aeroMode && styles.aeroGlassCard,
          pressed && styles.cataloguePressed,
        ]}
      >
        {celestialMode ? (
          <>
            <Text
              pointerEvents="none"
              style={styles.jinglePolishCatalogueStar}
            >
              ✦
            </Text>
            <Text
              pointerEvents="none"
              style={styles.jinglePolishCatalogueSpark}
            >
              ✧
            </Text>
            <View
              pointerEvents="none"
              style={styles.jinglePolishCatalogueOrbit}
            />
          </>
        ) : null}
        {aeroMode ? (
          <AeroReflection variant="catalogue" />
        ) : null}
        {aeroMode ? (
          <View
            style={[
              styles.aeroCatalogueIconHost,
              aeroMeadow && styles.aeroMeadowCatalogueIconHost,
            ]}
          >
            <Image
              
              source={
                aeroMeadow
                  ? require('../assets/aero/katalog-meadow.png')
                  : require('../assets/aero/katalog.png')
              }
              resizeMode="contain"
              style={[
                styles.aeroCatalogueIconImage,
                aeroMeadow && styles.aeroMeadowCatalogueIconImage,
                aeroOcean &&
                  Platform.OS !== 'web' &&
                  styles.aeroCatalogueIconMobileFix,
              ]}
            />
          </View>
        ) : (
          <View
            style={[
              styles.catalogueIcon,
              celestialMode &&
                styles.catalogueJingleIconV1,
            ]}
          >
            {celestialMode ? (
              <>
                {/* forkN5GlyphReorderV1:today-catalogue */}
                <ConstellationGridGlyph
                  color={homeAccent}
                  size={48}
                />
              </>
            ) : (
              <>
                <View style={styles.bookSpine} />
                <View style={styles.bookSpineWide} />
                <View style={styles.bookSpineShort} />
              </>
            )}
          </View>
        )}
        <View style={styles.catalogueCopy}>
          <Text style={styles.catalogueEyebrow}></Text>
          <Text style={styles.catalogueTitle}>Katalog</Text>
          <Text style={styles.catalogueSubtitle}>Knjige, filmovi, serije i igre</Text>
        </View>
        <Text style={styles.catalogueArrow}>{'\u203A'}</Text>
      </Pressable>


      <View
        style={[
          styles.radioTimerRow,
          celestialMode && styles.jinglePolishTimerRadioStack,
          aeroMeadow ? styles.meadowTopRowV3 : null,
          aeroMode ? styles.aeroRestoreTopRowV3 : null,
        ]}
      >
        {aeroMode ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Otvori Memory Radio"
          onPress={() => navigation.navigate('MemoryRadio')}
          style={(state) => [(({ pressed }) => [
            styles.aeroRadioImageButton,
            pressed && styles.quickPressed,
          ])(state), aeroMeadow ? styles.meadowRadioSlotV3 : null, aeroMode ? styles.aeroRestoreRadioSlotV3 : null]}
        >
          <Image
            
            source={
              aeroMeadow
                ? require('../assets/aero/radio-meadow.png')
                : require('../assets/aero/radio.png')
            }
            resizeMode={aeroMeadow ? 'contain' : 'stretch'}
            style={[[
              styles.aeroRadioImage,
              aeroMeadow && styles.aeroMeadowRadioImage,
              aeroMeadow && styles.aeroMeadowRadioImageFinal,
            ], aeroMeadow ? styles.meadowRadioImageV3 : null, aeroMode ? styles.aeroRestoreRadioImageV3 : null]}
          />
        </Pressable>
      ) : (
        <Pressable
        accessibilityRole="button"
        accessibilityLabel="Otvori Memory Radio"
        onPress={() => navigation.navigate('MemoryRadio')}
        style={({ pressed }) => [
          styles.memoryRadioCard,
          celestialMode && styles.jinglePolishRadioCard,
          !pixelMode &&
            Platform.OS !== 'web' &&
            styles.classicMobileRadioCompact,
          radioInverted && {
            backgroundColor: colors.surface,
            borderColor: homeAccent,
          },
          pressed &&
            (celestialMode && Platform.OS !== 'web'
              ? styles.classicRadioPressedN51
              : styles.quickPressed),
        ]}
      >
        <View style={styles.radioAntenna} />
        {celestialMode ? (
          <>
            <Text
              pointerEvents="none"
              style={styles.jinglePolishRadioStar}
            >
              ✦
            </Text>
            <Text
              pointerEvents="none"
              style={styles.jinglePolishRadioSpark}
            >
              ✧
            </Text>
            <View
              pointerEvents="none"
              style={styles.jinglePolishRadioOrbit}
            />
          </>
        ) : null}

        <View style={styles.radioSpeaker}>
          {Array.from({ length: 15 }, (_, index) => (
            <View
              key={index}
              style={[
                styles.radioSpeakerHole,
                radioInverted && { backgroundColor: colors.white },
              ]}
            />
          ))}
        </View>

        <View
          style={[
            styles.radioDisplay,
            radioInverted && { backgroundColor: homeAccent },
          ]}
        >
          <Text
            style={[
              styles.radioBand,
              radioInverted && { color: colors.white },
            ]}
          >LJINGLE MEMORY BAND</Text>
          <Text
            style={[
              styles.radioFrequency,
              radioInverted && { color: colors.white },
            ]}
          >15.9MHz</Text>
          <Text
            style={[
              styles.radioStation,
              radioInverted && { color: celestialAlpha(celestial.ivory, 0.72) },
            ]}
          >MEMORY RADIO ? FM</Text>

          <View
            style={[
              styles.radioSignal,
              radioInverted && {
                backgroundColor: celestialAlpha(celestial.ivory, 0.24),
              },
            ]}
          >
            <View
              style={[
                styles.radioSignalActive,
                radioInverted && { backgroundColor: colors.white },
              ]}
            />
          </View>
        </View>

        <View
          style={[
            styles.radioKnob,
            radioInverted && {
              backgroundColor: homeAccent,
              borderColor: homeAccent,
            },
          ]}
        >
          <View
            style={[
              styles.radioKnobMark,
              radioInverted && { backgroundColor: colors.white },
            ]}
          />
        </View>

        <Text
          style={[
            styles.radioHint,
            radioInverted && { color: homeAccent },
          ]}
        >TAP TO TUNE IN</Text>
      </Pressable>
      )}

        <View
          style={[
            styles.timerColumn,
            aeroMeadow ? styles.meadowTimerSlotV3 : null,
            aeroMode ? styles.aeroRestoreTimerSlotV3 : null,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Otvori povijest mjerenja"
            accessibilityHint="Prikazuje sesije i vremensku crtu"
            onPress={() => navigation.navigate('History')}
            style={(state) => [
              [
                styles.dailyCard,
                styles.dailyCardInRow,
                aeroMode && styles.aeroTimerGlass,
                aeroMeadow && styles.meadowTimerCleanGlass,
              ],
              aeroMeadow ? styles.meadowGlassCardV3 : null,
              state.pressed && styles.dailyHistoryPressedForkIV1,
            ]}
          >
          {aeroMode ? (
            <AeroReflection variant="daily" />
          ) : null}
        
        {pixelMode ? <Text style={styles.pixelBuffer}>██████░░░░ MEMORY BUFFER</Text> : null}
        {aeroMode && !(aeroMeadow && Platform.OS !== 'web') ? (
          <Image
            
            source={require('../assets/aero/timer.png')}
            resizeMode="cover"
            style={[
              Platform.OS === 'web'
                ? styles.aeroTimerMeadowImage
                : styles.aeroTimerMeadowImageMobile,
              aeroMeadow &&
                styles.aeroTimerMeadowSubtleFinal,
            ]}
          />
        ) : null}

        <View style={styles.dailyHeader}>
          <View>
            <Text style={styles.dailyEyebrow}>Zabilježeno danas</Text>
            <Text style={styles.dailyTotal}>
              {formatDuration(liveDailyTotal)}
            </Text>

            {!celestialMode ? (
<Pressable
              accessibilityRole="button"
              accessibilityLabel={
                globalTimer?.running
                  ? 'Zaustavi globalni timer'
                  : 'Pokreni globalni timer'
              }
              disabled={globalTimerBusy}
              onPress={(event) => {
                event.stopPropagation();
                void toggleGlobalTimer();
              }}
              style={({ pressed }) => [
                styles.dailyGlobalTimerButton,
                globalTimer?.running &&
                  styles.dailyGlobalTimerButtonRunning,
                pressed &&
                  !globalTimerBusy &&
                  styles.dailyGlobalTimerButtonPressed,
                globalTimerBusy &&
                  styles.dailyGlobalTimerButtonDisabled,
              ]}
            >
              {globalTimerBusy ? (
                <ActivityIndicator
                  color={colors.white}
                  size="small"
                />
              ) : (
                <Text style={styles.dailyGlobalTimerButtonText}>
                  {globalTimer?.running ? 'STOP' : 'START'}
                </Text>
              )}
            </Pressable>
          ) : null}
          {/* finalJingleHomeCatalogueControlsV2:timer-button-relocated */}
          </View>
          <Pressable
            style={[
              styles.dailyMark,
              celestialMode &&
                styles.jingleTimerStartSlotV2,
              celestialMode &&
                globalTimer?.running &&
                styles.jingleTimerStartSlotRunningV2,
              aeroOcean && styles.aeroBlueOrbShell,
              aeroOcean && styles.aeroBlueOrbHost,
              aeroMeadow && styles.aeroMeadow24HostFinal,
            ]}
          
            accessibilityRole={
              celestialMode
                ? 'button'
                : undefined
            }
            accessibilityLabel={
              celestialMode
                ? globalTimer?.running
                  ? 'Zaustavi globalni timer'
                  : 'Pokreni globalni timer'
                : undefined
            }
            disabled={
              celestialMode
                ? globalTimerBusy
                : true
            }
            onPress={() => {
              if (celestialMode) {
                void toggleGlobalTimer();
              }
            }}
          >
            {celestialMode ? (
              globalTimerBusy ? (
                <ActivityIndicator
                  color={colors.background}
                  size="small"
                />
              ) : (
                <Text
                  style={[
                    styles.dailyMarkText,
                    styles.jingleTimerStartSlotTextV2,
                    globalTimer?.running &&
                      styles.jingleTimerStartSlotTextRunningV2,
                  ]}
                >
                  {globalTimer?.running
                    ? 'STOP'
                    : 'START'}
                </Text>
              )
            ) : (
              <>

            {aeroMeadow ? (
              <Image
                source={require('../assets/aero/24-meadow.png')}
                resizeMode="contain"
                style={styles.aeroMeadow24ImageFinal}
              />
            ) : aeroOcean ? (
              <Image
                source={require('../assets/aero/aero-blue-orb.png')}
                resizeMode="contain"
                style={[
                  styles.aeroBlueOrbImage,
                  Platform.OS !== 'web' &&
                    styles.aeroDailyOrbMobileFix,
                ]}
              />
            ) : null}

            <Text
              style={[
                styles.dailyMarkText,
                aeroOcean && styles.aeroBlueOrbText,
                aeroMeadow && styles.aeroMeadow24TextFinal,
              ]}
            >
              24
            </Text>
          
              </>
            )}
          </Pressable>
          {/* finalJingleHomeCatalogueControlsV2:timer-slot */}
        </View>

        {dailyTime && dailyTime.activities.length > 0 ? (
          <View style={styles.dailyBreakdown}>
            {dailyTime.activities.slice(0, 3).map((activity) => (
              <View key={activity.activityId} style={styles.dailyLine}>
                <Text style={styles.dailyLabel} numberOfLines={1}>
                  {activity.label}
                </Text>
                <Text style={styles.dailyValue}>
                  {formatDuration(
                    activity.seconds + (activity.running ? liveDailyIncrement : 0),
                  )}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.dailyEmpty}>Provedeno vremena</Text>
        )}
          </Pressable>
        </View>
      </View>

      <View style={[styles.quickGrid, aeroMeadow && styles.meadowQuickGridV4]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Topics')}
          style={(state) => [(({ pressed }) => [styles.quickCard, aeroMode && styles.aeroGlassCard, pressed && styles.quickPressed])(state), aeroMeadow ? styles.meadowGlassCardV3 : null, aeroMeadow ? styles.meadowQuickGlassV4 : null]}
        >
          {aeroOcean ? (
          <View style={[oceanAero ? styles.aeroTopicOrb : styles.aeroPlainIconHost, oceanAero && styles.aeroBubbleHostClean]}>
            
            <Image
              
              source={require('../assets/aero/bubble.png')}
              resizeMode="contain"
              style={[styles.aeroBubbleAsset, !oceanAero && { display: 'none' }]}
            />
            <Image
              
              source={require('../assets/aero/star.png')}
              resizeMode="contain"
              style={styles.aeroTopicStarImage}
            />
          </View>
        ) : (
          <Text style={styles.quickSymbol}>{'\u25CE'}</Text>
        )}
          <Text style={styles.quickTitle}>Teme</Text>
          <Text style={styles.quickSubtitle}>Interesi i aktivnosti</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Entries')}
          style={(state) => [(({ pressed }) => [styles.quickCard, aeroMode && styles.aeroGlassCard, pressed && styles.quickPressed])(state), aeroMeadow ? styles.meadowGlassCardV3 : null, aeroMeadow ? styles.meadowQuickGlassV4 : null]}
        >
          {aeroOcean ? (
          <View style={[
            oceanAero ? styles.aeroPenOrb : styles.aeroPlainIconHost,
            oceanAero && styles.aeroOrbShell,
            oceanAero && styles.aeroBubbleHostClean,
          ]}>
            
            <Image
              
              source={require('../assets/aero/bubble.png')}
              resizeMode="contain"
              style={[styles.aeroBubbleAsset, !oceanAero && { display: 'none' }]}
            />
            <Image
              
              source={require('../assets/aero/pen2.png')}
              resizeMode="contain"
              style={styles.aeroPenIcon}
            />
          </View>
        ) : (
          <Text style={styles.quickSymbol}>{'\u270E'}</Text>
        )}
          <Text style={styles.quickTitle}>Zapisi</Text>
          <Text style={styles.quickSubtitle}>Bilješke, citati i zapisi</Text>
        </Pressable>
      </View>

      {/* forkIHomeProfileV1: History moved onto the timer card; Stats becomes full-width Profile. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Otvori profil"
        onPress={() => navigation.navigate('Stats')}
        style={(state) => [
          styles.profileCardForkIV1,
          celestialMode && styles.profileCardCompactN51,
          aeroMode && styles.aeroGlassCard,
          aeroMeadow ? styles.meadowGlassCardV3 : null,
          aeroMeadow ? styles.meadowQuickGlassV4 : null,
          state.pressed && styles.quickPressed,
        ]}
      >
        {aeroMode ? <AeroReflection variant="wide" /> : null}

        <View
          style={[
            styles.profileTopForkIV1,
            celestialMode && styles.profileTopCompactN51,
          ]}
        >
          {/* forkN5GlyphReorderV1:profile-clean */}
          <Text
            style={[
              styles.profileArrowForkIV1,
              aeroMode && styles.aeroProfileArrowV33,
            ]}
          >
            {'\u203A'}
          </Text>
        </View>

        <Text
          style={[
            styles.profileEyebrowForkIV1,
            aeroMode && styles.aeroProfileEyebrowV33,
            celestialMode && styles.profileEyebrowCompactN51,
          ]}
        >
          TVOJA ARHIVA
        </Text>
        <Text
          style={[
            styles.profileTitleForkIV1,
            aeroMode && styles.aeroProfileTitleV33,
          ]}
        >
          Profil
        </Text>
        <Text
          style={[
            styles.profileSubtitleForkIV1,
            aeroMode && styles.aeroProfileSubtitleV33,
          ]}
        >
          Vrijeme, katalog, čitanje i trendovi na jednom mjestu.
        </Text>
      </Pressable>

      {/* Katalog sadržava knjige, filmove/serije i igre; Teme i Zapisi ostaju
          zasebni jer se mogu povezati sa svim vrstama sadržaja. */}
<View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Aktivno sada</Text>
        {timers.length > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{timers.length}</Text>
          </View>
        ) : null}
      </View>

      {error && (timers.length > 0 || recentActivities.length > 0) ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void loadActiveTimers(true)}
          style={styles.errorBanner}
        >
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.retryText}>Pokušaj ponovno</Text>
        </Pressable>
      ) : null}
    </>
  );

  const dismissRecentActivity = useCallback(
    async (activity: ActivityTimerResponse) => {
      const activityId = activity.activityId;
      if (!activityId) return;
      setRecentActivities((current) => current.filter((item) => item.activityId !== activityId));
      try {
        await activityApi.dismissRecent(activityId);
      } catch {
        void loadActiveTimers();
      }
    },
    [loadActiveTimers],
  );

  const recentSection = (
    <View style={styles.recentSection}>
      <View style={styles.recentHeadingRow}>
        <View style={styles.recentHeadingCopy}>
          <Text style={styles.recentKicker}></Text>
          <Text style={styles.recentTitle}>Nedavno</Text>
          <Text style={styles.recentSubtitle}>
            Pauzirane aktivnosti.
          </Text>
        </View>
        {recentActivities.length > 0 ? (
          <View style={styles.recentCount}>
            <Text style={styles.recentCountText}>{recentActivities.length}</Text>
          </View>
        ) : null}
      </View>

      {recentActivities.length > 0 ? (
        recentActivities.map((activity) => (
          <RecentActivityCard
            key={activity.activityId ?? activity.label}
            activity={activity}
            starting={
              activity.activityId ? startingIds.has(activity.activityId) : false
            }
            onStart={() => void startRecentActivity(activity)}
            onDismiss={() => void dismissRecentActivity(activity)}
          />
        ))
      ) : (
        <View style={[styles.recentEmpty, aeroMeadow ? styles.meadowRecentCardV3 : null]}>
          <Text style={styles.recentEmptyText}>
            Zaustavljena aktivnost pojavit će se ovdje...
          </Text>
        </View>
      )}
    </View>
  );

  if (loading && timers.length === 0 && recentActivities.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.black} />
          <Text style={styles.loadingText}>Slažem tvoj današnji pregled.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && timers.length === 0 && recentActivities.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorState}>
          <Text style={styles.errorMark}>!</Text>
          <Text style={styles.errorTitle}>Danas se nije učitao</Text>
          <Text style={styles.errorStateMessage}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadActiveTimers()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}
          >
            <Text style={styles.retryButtonText}>Pokušaj ponovno</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Catalogue')}
            style={styles.catalogueFallback}
          >
            <Text style={styles.catalogueFallbackText}>Svejedno otvori katalog</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        aeroMode && styles.aeroSafeArea,
        aeroMeadow && styles.meadowSafeAreaForkCV1,
      ]}
      edges={['top', 'left', 'right']}
    >
      {aeroMode ? (
        <>
          <Image
            source={aeroWorldBackgroundSource}
            resizeMode="cover"
            style={styles.aeroWorldBackground}
          />
          <View
            pointerEvents="none"
            style={[
              styles.aeroWorldVeil,
              aeroMeadow && styles.meadowWorldVeilForkCV1,
            ]}
          />
        </>
      ) : null}

      {oceanAero ? <AeroScreenBubbles /> : null}
      {celestialMode ? <CelestialHomeField /> : null}
      <FlatList
        data={timers}
        keyExtractor={(item) => item.activityId ?? item.activeSessionId ?? item.label}
        renderItem={({ item }) => (
          <ActiveTimerCard
            timer={item}
            now={now}
            stopping={item.activityId ? stoppingIds.has(item.activityId) : false}
            onOpen={
              item.bookId
                ? () => navigation.navigate('BookDetails', { bookId: item.bookId as string })
                : item.topicId
                  ? () => navigation.navigate('TopicDetails', { topicId: item.topicId as string })
                  : undefined
            }
            onStop={() => void stopTimer(item)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View
            style={[
              styles.emptyCard,
              aeroMeadow ? styles.meadowGlassCardV3 : null,
              aeroMode && styles.aeroEmptyCardV33,
            ]}
          >
            {aeroMode ? (
              <AeroReflection variant="soft" />
            ) : null}
            <View
              style={[
                styles.emptyIcon,
                aeroMode && styles.aeroEmptyIconV33,
              ]}
            >
              <Text
                style={[
                  styles.emptyIconText,
                  aeroMode && styles.aeroEmptyIconTextV33,
                ]}
              >
                {'\uFF0B'}
              </Text>
            </View>
            <Text
              style={[
                styles.emptyTitle,
                aeroMode && styles.aeroEmptyTitleV33,
              ]}
            >
              Nema aktivnih timera
            </Text>
            <Text
              style={[
                styles.emptyMessage,
                aeroMode && styles.aeroEmptyMessageV33,
              ]}
            >
              Ništa trenutačno ne bilježi vrijeme. Nastavi nešto nedavno ispod ili
              započni novu aktivnost iz kataloga.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('Catalogue')}
              style={({ pressed }) => [
                styles.emptyButton,
                aeroMode && styles.aeroEmptyButtonV33,
                pressed && styles.emptyButtonPressed,
              ]}
            >
              <Text
                style={[
                  styles.emptyButtonText,
                  aeroMode && styles.aeroEmptyButtonTextV33,
                ]}
              >
                Otvori katalog
              </Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={recentSection}
        contentContainerStyle={[styles.content, aeroMode && styles.aeroContent]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadActiveTimers(true)}
            tintColor={colors.black}
            colors={[colors.black]}
          />
        }
      />
    </SafeAreaView>
  );
}

// aeroBottomV1Applied
// aeroTimerRefV1Applied
// aeroWhiteGlassV1Applied
// aeroOrbShineV2Applied
// aeroBubbleAssetV2Applied
// aeroBubbleHostCleanupV1Applied
// aeroBubbleScaleV1
// aeroBubbleSoftV3Applied
// aeroBlueOrbAssetV1
// aeroBlueOrbPolishV1
// aeroRealIconsV1Applied
// aeroBottomTypeV3Applied
// aeroBottomVisibilityV1Applied
// aeroBreathingRoomV1Applied
// aeroTimerMeadowV1Applied
// aeroTimerMeadowCleanupV2Applied
// aeroTimerSceneV3Applied
// aeroFinalBottomReadabilityPassV1
// aeroHeaderSearchFinalV1Applied
// aeroHeroTypographyREALV1Applied
// frutigerHeroPlayTuneV1
// aeroSearchIconColorLOCKV1
// aeroSearchDateMicroV1Applied
// aeroReflectionPassV2Applied
// aeroReflectionPolishV3Applied
// aeroIconAssetSweepV1
// aeroMobileFinalFitV1
const styles = StyleSheet.create({
  // forkN1CelestialHomeCommandBellV1 — Classic-only celestial archive ornaments.
  celestialFieldN1: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: celestial.night,
  },
  celestialStarN1: {
    position: 'absolute',
    color: celestial.gold,
    opacity: 0.34,
    fontSize: 15,
  },
  celestialStarA1N1: { left: '8%', top: '6%' },
  celestialStarA2N1: { left: '22%', top: '15%', fontSize: 20, opacity: 0.18 },
  celestialStarA3N1: { right: '12%', top: '9%', fontSize: 12 },
  celestialStarA4N1: { right: '25%', top: '27%', fontSize: 19, opacity: 0.20 },
  celestialStarA5N1: { left: '10%', top: '46%', fontSize: 22, opacity: 0.14 },
  celestialStarA6N1: { right: '7%', top: '58%', fontSize: 15, opacity: 0.26 },
  celestialStarA7N1: { left: '27%', top: '74%', fontSize: 11, opacity: 0.28 },
  celestialStarA8N1: { right: '30%', top: '88%', fontSize: 24, opacity: 0.14 },
  celestialLineN1: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth,
    backgroundColor: celestialAlpha(celestial.gold, 0.17),
  },
  celestialLineOneN1: { width: 110, right: -18, top: 190, transform: [{ rotate: '-24deg' }] },
  celestialLineTwoN1: { width: 86, left: -16, top: 520, transform: [{ rotate: '18deg' }] },
  celestialOrbitN1: {
    position: 'absolute',
    right: -92,
    top: 360,
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  celestialOrbitCoreN1: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.08),
  },
  celestialHeroN1: {
    marginTop: 8,
    paddingTop: 22,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: celestialAlpha(celestial.gold, 0.22),
  },
  celestialKickerN1: {
    alignSelf: 'center',
    color: celestial.gold,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.2,
    opacity: 0.90,
    marginBottom: 9,
  },
  celestialDateN1: {
    alignSelf: 'center',
    color: celestial.gold,
    textAlign: 'center',
    fontFamily: Platform.select({ web: 'Georgia, Times New Roman, serif', ios: 'Georgia', android: 'serif' }),
    fontSize: Platform.OS === 'web' ? 18 : 15,
    lineHeight: Platform.OS === 'web' ? 23 : 20,
    fontWeight: '700',
    letterSpacing: 1.4,
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
  },
  celestialQuoteHeroN1: {
    minHeight: 142,
    marginTop: 6,
    marginHorizontal: 2,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: celestialAlpha(celestial.gold, 0.16),
    backgroundColor: celestialAlpha(celestial.night, 0.48),
  },



  // Meadow Home glass polish — isolated additive styles.
  meadowRadioStageV4: {
    borderRadius: Platform.OS === 'web' ? 28 : 24,
    paddingHorizontal: Platform.OS === 'web' ? 14 : 10,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    backgroundColor:
      Platform.OS === 'web'
        ? 'rgba(248,250,247,0.44)'
        : 'rgba(248,250,247,0.52)',
    borderWidth: 1.25,
    borderColor: celestialAlpha(celestial.ivory, 0.92),
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: `0 8px 24px rgba(38,54,40,0.08), inset 0 1px 0 ${celestialAlpha(celestial.ivory, 0.88)}`,
          backdropFilter: 'blur(11px) saturate(1.08)',
        } as any)
      : {}),
  },

  // forkCMeadowHomeV1
  // On Android, native elevation/shadows create visible rectangular layers
  // behind translucent rounded Meadow cards. Keep the frosted surface, but let
  // the white border do the edge work and reserve richer shadow/blur for web.
  meadowQuickGlassV4: {
    backgroundColor:
      Platform.OS === 'web'
        ? 'rgba(255,255,255,0.62)'
        : 'rgba(255,255,255,0.78)',
    borderColor: AERO_GLASS_EDGE,
    borderWidth: 1.25,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 1,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 10px 24px rgba(68,72,78,0.11), inset 0 1px 0 rgba(255,255,255,0.98)',
          backdropFilter:
            'blur(14px) saturate(0.28) brightness(1.15)',
          WebkitBackdropFilter:
            'blur(14px) saturate(0.28) brightness(1.15)',
        } as any)
      : {}),
  },

  meadowQuickGridV4: {
    gap: Platform.OS === 'web' ? 18 : 14,
    marginBottom: Platform.OS === 'web' ? 18 : 16,
  },


  // ----------------------------------------------------------
  // FINAL AERO MOBILE-ONLY FIT
  // Classic / Pixel / Aero web stay untouched.
  // ----------------------------------------------------------

  aeroTimerMeadowImageMobile: {
    position: 'absolute',

    left: 0,
    right: 0,

    // Mobile wide timer crop:
    // move artwork upward so the lower meadow enters view.
    top: '-42%',

    width: '100%',
    height: '184%',

    opacity: 0.38,
    zIndex: 0,
  },

  aeroCatalogueIconMobileFix: {
    transform: [
      { scale: 0.72 },
    ],
  },

  aeroDailyOrbMobileFix: {
    position: 'absolute',

    width: '130%',
    height: '130%',

    top: '-15%',
    left: '-15%',
  },

  aeroSweepStar: {
    width: 54,
    height: 54,
    opacity: 0.68,
  },

  aeroSweepPen: {
    width: 48,
    height: 48,
    opacity: 0.90,

    ...(Platform.OS === 'web'
      ? ({
          filter:
            'drop-shadow(0 3px 5px rgba(13,100,190,0.20))',
        } as any)
      : {}),
  },

  aeroSweepHistory: {
    width: 48,
    height: 48,
    opacity: 0.88,
  },

  aeroSweepSearch: {
    width: 42,
    height: 42,
    opacity: 0.92,
  },

  // ==========================================================
  // FRUTIGER AERO GLASS REFLECTIONS
  // ==========================================================

  aeroReflectionLayer: {
    ...StyleSheet.absoluteFillObject,

    zIndex: 0,

    overflow: 'hidden',

    borderRadius: 30,
  },

  aeroReflectionSoft: {
    opacity: 0.56,
  },


  // ----------------------------------------------------------
  // BROAD GLASS HIGHLIGHT
  // ----------------------------------------------------------

  aeroReflectionSheen: {
    position: 'absolute',

    top: -14,

    width: '34%',
    height: 38,

    borderRadius: 999,

    backgroundColor:
      'rgba(255,255,255,0.28)',

    shadowColor: '#FFFFFF',

    shadowOffset: {
      width: 0,
      height: 1,
    },

    shadowOpacity: 0.28,
    shadowRadius: 10,

    transform: [
      {
        rotate: '-8deg',
      },
    ],
  },

  aeroReflectionSheenLeft: {
    left: '6%',
  },

  aeroReflectionSheenRight: {
    left: undefined,
    right: '6%',

    transform: [
      {
        rotate: '8deg',
      },
    ],
  },

  aeroReflectionSheenWide: {
    left: '11%',
    right: undefined,

    width: '46%',
    height: 42,

    top: -15,

    backgroundColor:
      'rgba(255,255,255,0.22)',
  },


  // ----------------------------------------------------------
  // SPECULAR STREAK
  // ----------------------------------------------------------

  aeroReflectionStreak: {
    position: 'absolute',

    top: 10,

    width: '22%',
    height: 3,

    borderRadius: 999,

    backgroundColor:
      'rgba(92,96,102,0.24)',

    shadowColor: '#FFFFFF',

    shadowOffset: {
      width: 0,
      height: 0,
    },

    shadowOpacity: 0.46,
    shadowRadius: 6,

    transform: [
      {
        rotate: '-9deg',
      },
    ],
  },

  aeroReflectionStreakLeft: {
    left: '11%',
  },

  aeroReflectionStreakRight: {
    left: undefined,
    right: '10%',

    transform: [
      {
        rotate: '9deg',
      },
    ],
  },

  aeroReflectionStreakWide: {
    left: '16%',
    right: undefined,

    width: '34%',

    top: 12,

    backgroundColor:
      'rgba(92,96,102,0.20)',
  },


  // ----------------------------------------------------------
  // SUN BLOOM
  // ----------------------------------------------------------

  aeroReflectionBloom: {
    position: 'absolute',

    top: -17,

    width: 58,
    height: 58,

    borderRadius: 40,

    backgroundColor:
      'rgba(255,255,255,0.18)',

    shadowColor: '#FFFFFF',

    shadowOffset: {
      width: 0,
      height: 0,
    },

    shadowOpacity: 0.58,
    shadowRadius: 14,
  },

  aeroReflectionBloomLeft: {
    left: '5%',
  },

  aeroReflectionBloomRight: {
    left: undefined,
    right: '5%',
  },

  aeroReflectionBloomWide: {
    left: undefined,
    right: '16%',

    width: 82,
    height: 62,

    backgroundColor:
      'rgba(255,255,255,0.12)',
  },


  // ----------------------------------------------------------
  // GLASS EDGE CATCHLIGHTS
  // ----------------------------------------------------------

  aeroReflectionTopRim: {
    position: 'absolute',

    top: 1,
    left: 18,
    right: 18,

    height: 1,

    borderRadius: 999,

    backgroundColor:
      'rgba(255,255,255,0.82)',

    shadowColor: '#FFFFFF',

    shadowOffset: {
      width: 0,
      height: 1,
    },

    shadowOpacity: 0.48,
    shadowRadius: 3,
  },

  aeroReflectionBottomRim: {
    position: 'absolute',

    bottom: 1,
    left: 24,
    right: 24,

    height: 1,

    borderRadius: 999,

    backgroundColor:
      'rgba(255,255,255,0.62)',

    shadowColor: '#FFFFFF',

    shadowOffset: {
      width: 0,
      height: -1,
    },

    shadowOpacity: 0.30,
    shadowRadius: 4,
  },

  aeroSearchMagnifierGray: {
    color: homeAccent,

    fontSize:
      Platform.OS === 'web'
        ? 35
        : 31,

    lineHeight:
      Platform.OS === 'web'
        ? 38
        : 34,

    fontWeight: '800',

    opacity: 1,

    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,

    ...(Platform.OS === 'web'
      ? ({
          textShadow: 'none',
        } as any)
      : {}),
  },

  aeroTimerMeadowImage: {
    position: 'absolute',

    left: 0,
    right: 0,

    top: Platform.OS === 'web'
      ? '-34%'
      : '-26%',

    width: '100%',

    height: Platform.OS === 'web'
      ? '168%'
      : '152%',

    opacity: 0.34,

    zIndex: 0,
  },

  aeroTopicStarImage: {
    position: 'relative',
    zIndex: 3,

    width: Platform.OS === 'web' ? 46 : 41,
    height: Platform.OS === 'web' ? 46 : 41,

    opacity: 0.58,

    ...(Platform.OS === 'web'
      ? ({
          filter:
            'drop-shadow(0 1px 2px rgba(68,72,78,0.10))',
        } as any)
      : {}),
  },

  aeroCatalogueIconHost: {
    width: 72,
    height: 72,

    alignItems: 'center',
    justifyContent: 'center',

    overflow: 'visible',

    backgroundColor: 'transparent',
  },

  aeroCatalogueIconImage: {
    // katalog.png contains transparent breathing room.
    // Oversizing the source makes the visible blue object
    // roughly the same size as the old 68px catalogue icon.
    width: Platform.OS === 'web' ? 102 : 94,
    height: Platform.OS === 'web' ? 102 : 94,

    ...(Platform.OS === 'web'
      ? ({
          filter:
            'drop-shadow(0 7px 9px rgba(68,72,78,0.18)) drop-shadow(0 0 7px rgba(255,255,255,0.28))',
        } as any)
      : {}),
  },



  // meadowAssetPolishV2
  aeroMeadowCatalogueIconHost: {
    width: Platform.OS === 'web' ? 112 : 82,
    height: Platform.OS === 'web' ? 88 : 72,

    flexShrink: 0,

    alignItems: 'center',
    justifyContent: 'center',

    marginLeft: Platform.OS === 'web' ? 5 : 1,
    marginRight: Platform.OS === 'web' ? 13 : 8,

    overflow: 'visible',
  },

  aeroMeadowCatalogueIconImage: {
    width: Platform.OS === 'web' ? 84 : 68,
    height: Platform.OS === 'web' ? 84 : 68,

    ...(Platform.OS === 'web'
      ? ({
          filter: 'none',
        } as any)
      : {}),
  },

  aeroMeadowRadioImage: {
    position: 'absolute',

    width: '90%',
    height: '90%',

    top: '5%',
    left: '5%',
  },

  aeroMeadow24Host: {
    position: 'relative',

    width: Platform.OS === 'web' ? 36 : 32,
    height: Platform.OS === 'web' ? 36 : 32,

    borderRadius: Platform.OS === 'web' ? 18 : 16,

    alignItems: 'center',
    justifyContent: 'center',

    overflow: 'visible',

    backgroundColor: 'transparent',
    borderWidth: 0,

    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow: 'none',
        } as any)
      : {}),
  },

  // 24-meadow.png has large transparent padding.
  // Large image canvas -> small visible metal button.
  aeroMeadow24Image: {
    position: 'absolute',

    width: '345%',
    height: '345%',

    top: '-122.5%',
    left: '-122.5%',

    zIndex: 0,
  },

  aeroMeadow24Text: {
    position: 'relative',
    zIndex: 2,

    color: '#232323',

    fontSize: Platform.OS === 'web' ? 12 : 11,
    fontWeight: '800',

    textShadowColor: 'transparent',
    textShadowOffset: {
      width: 0,
      height: 0,
    },
    textShadowRadius: 0,
  },


  // meadowFinalPolishV3
  aeroMeadow24HostFinal: {
    position: 'relative',

    width: Platform.OS === 'web' ? 34 : 32,
    height: Platform.OS === 'web' ? 34 : 32,

    borderRadius:
      Platform.OS === 'web' ? 17 : 16,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: 'transparent',

    borderWidth: 0,
    borderColor: 'transparent',

    overflow: 'visible',

    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow: 'none',
        } as any)
      : {}),
  },

  // PNG has a lot of transparent canvas around the metal button.
  aeroMeadow24ImageFinal: {
    position: 'absolute',

    width: '390%',
    height: '390%',

    top: '-145%',
    left: '-145%',

    zIndex: 0,
  },

  aeroMeadow24TextFinal: {
    position: 'relative',
    zIndex: 2,

    color: '#26302A',

    fontSize:
      Platform.OS === 'web' ? 11 : 10,

    lineHeight:
      Platform.OS === 'web' ? 13 : 12,

    fontWeight: '800',

    textShadowColor: 'transparent',
    textShadowRadius: 0,

    ...(Platform.OS === 'web'
      ? ({
          textShadow: 'none',
        } as any)
      : {}),
  },

  aeroMeadowRadioImageFinal: {
    position: 'absolute',

    width: '106%',
    height: '106%',

    top: '-3%',
    left: '-3%',
  },

  aeroTimerMeadowSubtleFinal: {
    // Keep the retro “24”/streak artwork, but make it metallic instead of cyan.
    opacity: Platform.OS === 'web'
      ? 0.085
      : 0.10,
    tintColor: AERO_METAL_MID,
    ...(Platform.OS === 'web'
      ? ({
          filter:
            'grayscale(1) saturate(0) opacity(0.72)',
        } as any)
      : {}),
  },

  aeroBlueOrbHost: {
    position: 'relative',
    overflow: 'visible',

    backgroundColor: 'transparent',

    borderWidth: 0,
    borderColor: 'transparent',

    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow: 'none',
        } as any)
      : {}),
  },

  aeroBlueOrbImage: {
    position: 'absolute',

    width: '148%',
    height: '148%',

    top: '-24%',
    left: '-24%',

    zIndex: 0,
  
    // aeroBlueOrbPolishTune
    ...({
      ...(Platform.OS === 'web'
        ? {
            filter:
              'drop-shadow(0 8px 7px rgba(255,255,255,0.72)) drop-shadow(0 4px 6px rgba(89,225,255,0.30))',
          }
        : {
            shadowColor: '#FFFFFF',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.62,
            shadowRadius: 9,
          }),
    } as any),},

  aeroBlueOrbText: {
    position: 'relative',
    zIndex: 2,

    color: '#FFFFFF',

    fontFamily: Platform.select({
      web: 'Segoe UI, Arial, sans-serif',
      android: 'sans-serif',
      ios: 'System',
    }),

    fontWeight: '700',

    ...(Platform.OS === 'web'
      ? ({
          textShadow:
            '0 1px 3px rgba(0,60,135,0.38)',
        } as any)
      : {}),
  
    // aeroBlueOrbPolishTune
    ...({
      fontSize: Platform.OS === 'web' ? 20 : 18,
      lineHeight: Platform.OS === 'web' ? 24 : 21,

      fontWeight: '800',
      letterSpacing: -0.25,

      ...(Platform.OS === 'web'
        ? {
            textShadow:
              '0 1px 3px rgba(0,62,145,0.48)',
          }
        : {
            textShadowColor: 'rgba(0,62,145,0.48)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }),
    } as any),},

  aeroPlainIconHost: {
    width: Platform.OS === 'web' ? 58 : 52,
    height: Platform.OS === 'web' ? 58 : 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },

  aeroBubbleHostClean: {
    backgroundColor: 'transparent',

    borderWidth: 0,
    borderColor: 'transparent',

    overflow: 'visible',

    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow: 'none',
          backdropFilter: 'none',
        } as any)
      : {}),
  },

  aeroBubbleAsset: {
    position: 'absolute',

    width: '116%',
    height: '116%',

    top: '-8%',
    left: '-8%',

    opacity: 0.68,

    zIndex: 0,
  
    // aeroBubbleScaleTune
    ...({
      width: '132%',
      height: '132%',
      top: '-16%',
      left: '-16%',
      opacity: 0.40,
    } as any),},

  aeroOrbShell: {
    position: 'relative',
    overflow: 'hidden',

    backgroundColor: celestialAlpha(celestial.ivory, 0.78),

    borderWidth: 1.5,
    borderColor: celestialAlpha(celestial.ivory, 0.99),

    shadowColor: '#8DE7FF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.27,
    shadowRadius: 11,
    elevation: 7,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow: `0 5px 14px rgba(65,190,235,0.20), 0 0 18px ${celestialAlpha(celestial.ivory, 0.98)}, inset 0 2px 4px ${celestialAlpha(celestial.ivory, 0.88)}, inset 0 -8px 15px rgba(170,225,255,0.17)`,
          backdropFilter:
            'blur(7px) brightness(1.12)',
        } as any)
      : {}),
  },

  aeroTopicOrb: {
    position: 'relative',

    width: Platform.OS === 'web' ? 58 : 52,
    height: Platform.OS === 'web' ? 58 : 52,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: Platform.OS === 'web' ? 29 : 26,

    overflow: 'hidden',

    backgroundColor: celestialAlpha(celestial.ivory, 0.78),

    borderWidth: 1.5,
    borderColor: celestialAlpha(celestial.ivory, 0.99),

    shadowColor: '#8DE7FF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.27,
    shadowRadius: 11,
    elevation: 7,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow: `0 5px 14px rgba(65,190,235,0.20), 0 0 18px ${celestialAlpha(celestial.ivory, 0.98)}, inset 0 2px 4px ${celestialAlpha(celestial.ivory, 0.88)}, inset 0 -8px 15px rgba(170,225,255,0.17)`,
        } as any)
      : {}),
  
    // aeroBubbleScaleTune
    ...({
      width: Platform.OS === 'web' ? 70 : 62,
      height: Platform.OS === 'web' ? 70 : 62,
      borderRadius: Platform.OS === 'web' ? 35 : 31,
    } as any),},

  aeroHistoryOrb: {
    position: 'relative',

    width: Platform.OS === 'web' ? 48 : 44,
    height: Platform.OS === 'web' ? 48 : 44,

    borderRadius: Platform.OS === 'web' ? 24 : 22,

    overflow: 'hidden',

    backgroundColor: celestialAlpha(celestial.ivory, 0.78),

    borderWidth: 1.5,
    borderColor: celestialAlpha(celestial.ivory, 0.99),

    shadowColor: '#8DE7FF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 7,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow: `0 5px 13px rgba(65,190,235,0.18), 0 0 17px ${celestialAlpha(celestial.ivory, 0.96)}, inset 0 2px 4px ${celestialAlpha(celestial.ivory, 0.84)}`,
        } as any)
      : {}),
  
    // aeroBubbleScaleTune
    ...({
      width: Platform.OS === 'web' ? 60 : 54,
      height: Platform.OS === 'web' ? 60 : 54,
      borderRadius: Platform.OS === 'web' ? 30 : 27,
    } as any),},

  aeroOrbShineLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },

  aeroOrbGlint: {
    position: 'absolute',

    top: '12%',
    left: '16%',

    width: '36%',
    height: '20%',

    borderRadius: 999,

    backgroundColor: celestialAlpha(celestial.ivory, 0.96),

    opacity: 0.94,

    transform: [
      { rotate: '-24deg' },
    ],
  },

  aeroOrbSparkleH: {
    position: 'absolute',

    top: '15%',
    right: '13%',

    width: 12,
    height: 2,

    borderRadius: 2,

    backgroundColor: '#FFFFFF',

    opacity: 0.90,
  },

  aeroOrbSparkleV: {
    position: 'absolute',

    top: '8%',
    right: '22%',

    width: 2,
    height: 12,

    borderRadius: 2,

    backgroundColor: '#FFFFFF',

    opacity: 0.90,
  },

  aeroBlueOrbShell: {
    position: 'relative',
    overflow: 'hidden',

    ...(Platform.OS === 'web'
      ? ({
          boxShadow: `0 7px 17px rgba(0,132,215,0.38), 0 0 15px rgba(110,245,255,0.88), inset 0 2px 5px ${celestialAlpha(celestial.ivory, 0.32)}`,
        } as any)
      : {}),
  },

  // aeroPenOrbV1Applied
  aeroPenOrb: {
    width: Platform.OS === 'web' ? 54 : 48,
    height: Platform.OS === 'web' ? 54 : 48,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: Platform.OS === 'web' ? 27 : 24,

    backgroundColor: celestialAlpha(celestial.ivory, 0.72),

    borderWidth: 1.5,
    borderColor: celestialAlpha(celestial.ivory, 0.99),

    shadowColor: '#50DFFF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.34,
    shadowRadius: 10,
    elevation: 7,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow: `0 5px 14px rgba(0,145,215,0.24), 0 0 14px ${celestialAlpha(celestial.ivory, 0.98)}, inset 0 2px 3px ${celestialAlpha(celestial.ivory, 0.75)}`,
          backdropFilter: 'blur(7px) brightness(1.10)',
        } as any)
      : {}),
  
    // aeroBubbleScaleTune
    ...({
      width: Platform.OS === 'web' ? 66 : 58,
      height: Platform.OS === 'web' ? 66 : 58,
      borderRadius: Platform.OS === 'web' ? 33 : 29,
    } as any),},

  aeroPenIcon: {
    width: 32,
    height: 32,
    opacity: 0.96,
},

  // aeroRadioImageV1
  aeroRadioImageButton: {
    position: 'relative',

    width: '100%',
    maxWidth: Platform.OS === 'web' ? 620 : 520,

    // visible artwork ratio: 895 / 402
    aspectRatio: 895 / 402,

    alignSelf: 'flex-start',
    overflow: 'visible',

    padding: 0,
    margin: 0,

    backgroundColor: 'transparent',
    borderWidth: 0,

    shadowOpacity: 0,
    elevation: 0,
  },

  aeroRadioImage: {
    position: 'absolute',

    top: 0,
    left: 0,

    // Compensates for transparent right/bottom padding
    // in the source PNG.
    width: '102.9%',
    height: '123.9%',
  },
  globalCatalogueSearch: {
    minHeight: 82,
    marginTop: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: pixelMode ? 0 : 20,
    backgroundColor: colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: pixelMode ? colors.text : colors.separator,
  },
  globalSearchIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: pixelMode ? 0 : 16,
    backgroundColor: colors.fillStrong,
    borderWidth: pixelMode ? 2 : 0,
    borderColor: colors.text,
  },
  globalSearchIconText: {
    color: aeroMode
      ? '#073B76'
      : colors.black,

    fontSize: aeroMode
      ? 30
      : 27,

    fontWeight: '800',

    opacity: 1,

    ...(aeroMode && Platform.OS === 'web'
      ? ({
          textShadow:
            '0 1px 2px rgba(255,255,255,0.62)',
        } as any)
      : {}),
  
    // forkKDarkBackgroundContrastV1_globalSearchIconText
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  },
  aeroSearchIcon: {
    backgroundColor: 'rgba(246,252,255,0.50)',
    borderWidth: 1.5,
    borderColor: celestialAlpha(celestial.ivory, 0.99),

    shadowColor: '#98E5FF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.20,
    shadowRadius: 10,
    elevation: 5,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow: `0 4px 12px rgba(120,215,255,0.20), 0 0 16px ${celestialAlpha(celestial.ivory, 0.98)}, inset 0 1px 0 ${celestialAlpha(celestial.ivory, 1)}`,
        } as any)
      : {}),
  
    // aeroBubbleScaleTune
    ...({
      width: Platform.OS === 'web' ? 60 : 54,
      height: Platform.OS === 'web' ? 60 : 54,
      borderRadius: Platform.OS === 'web' ? 30 : 27,
    } as any),},
  aeroSearchIconText: {
    color: homeAccent,
  
    // forkKDarkBackgroundContrastV1_aeroSearchIconText
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  },
  globalSearchCopy: {
    flex: 1,
    marginLeft: 13,
  },
  globalSearchTitle: {
    color: homeAccent,
    fontSize: 18,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '700',
  
    // aeroV3Override
    ...(aeroMode ? {
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      color: homeAccent,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.25,
    } : {}),
    // aeroHeaderSearchFinalV1
    ...(aeroMode ? {
      color: homeAccent,

      fontFamily:
        Platform.select({
          web:
            'Segoe UI, Arial, sans-serif',

          android:
            'sans-serif',

          ios:
            'System',
        }),

      fontSize:
        Platform.OS === 'web'
          ? 18
          : 17,

      fontWeight: '700',

      letterSpacing: -0.15,
    } : {}),
    // aeroHeroTypographyREALV1
    ...(aeroMode ? {
      color: homeAccent,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize:
        Platform.OS === 'web'
          ? 19
          : 17,

      fontWeight: '700',

      letterSpacing: -0.15,
    } : {}),
    // forkKDarkBackgroundContrastV1_globalSearchTitle
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  },
  globalSearchSubtitle: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 15,
    fontFamily: pixelMode ? 'monospace' : undefined,
  
    // aeroV3Override
    ...(aeroMode ? {
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      color: colors.textMuted,
      fontWeight: '400',
      letterSpacing: 0,
    } : {}),
    // aeroHeaderSearchFinalV1
    ...(aeroMode ? {
      color:
        'rgba(18,72,125,0.76)',

      fontFamily:
        Platform.select({
          web:
            'Segoe UI, Arial, sans-serif',

          android:
            'sans-serif',

          ios:
            'System',
        }),

      fontSize:
        Platform.OS === 'web'
          ? 12
          : 11,

      lineHeight:
        Platform.OS === 'web'
          ? 17
          : 15,

      fontWeight: '400',
    } : {}),
    // aeroHeroTypographyREALV1
    ...(aeroMode ? {
      color: homeAccent,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize:
        Platform.OS === 'web'
          ? 13
          : 11,

      lineHeight:
        Platform.OS === 'web'
          ? 18
          : 15,

      fontWeight: '400',

      opacity: 0.90,
    } : {}),
    // forkKDarkBackgroundContrastV1_globalSearchSubtitle
    ...(isDarkBackground && !aeroMode ? {
      color: colors.textMuted,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  },
  globalSearchArrow: {
    color: colors.textMuted,
    fontSize: 28,
    fontFamily: pixelMode ? 'monospace' : undefined,
  
    // aeroV3Override
    ...(aeroMode ? {
      color: homeAccent,
    } : {}),
    // aeroHeaderSearchFinalV1
    ...(aeroMode ? {
      color: homeAccent,
      opacity: 0.92,
    } : {}),
    // aeroHeroTypographyREALV1
    ...(aeroMode ? {
      color: homeAccent,
      opacity: 0.90,
    } : {}),
    // forkKDarkBackgroundContrastV1_globalSearchArrow
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  },
  aeroScreenBubbleLayer: { ...StyleSheet.absoluteFillObject, zIndex: 40, overflow: 'hidden', pointerEvents: 'none' },
  screenBubble: { position: 'absolute', borderRadius: 999, borderWidth: 2, shadowColor: '#693CC5', shadowOffset: { width: 4, height: 8 }, shadowOpacity: 0.19, shadowRadius: 12, elevation: 8 },
  screenBubbleRim: { ...StyleSheet.absoluteFillObject, borderRadius: 999, borderWidth: 3, borderTopColor: celestialAlpha(celestial.ivory, 0.9), borderLeftColor: 'rgba(255,190,245,0.72)', borderRightColor: 'rgba(126,235,255,0.72)', borderBottomColor: 'rgba(255,235,130,0.58)' },
  screenBubbleGlint: { position: 'absolute', top: '16%', left: '20%', width: '30%', height: '18%', borderRadius: 999, backgroundColor: celestialAlpha(celestial.ivory, 0.82), transform: [{ rotate: '-28deg' }] },
  screenBubblePink: { left: '5%', width: 66, height: 66, backgroundColor: 'rgba(255,132,211,0.19)', borderColor: 'rgba(255,166,224,0.72)' },
  screenBubbleGold: { right: '9%', width: 92, height: 92, backgroundColor: 'rgba(255,222,105,0.16)', borderColor: 'rgba(255,231,139,0.76)' },
  screenBubbleViolet: { left: '47%', width: 48, height: 48, backgroundColor: 'rgba(162,119,255,0.18)', borderColor: 'rgba(195,166,255,0.76)' },
  screenBubbleMint: { right: '31%', width: 36, height: 36, backgroundColor: 'rgba(91,242,180,0.2)', borderColor: 'rgba(153,255,214,0.8)' },
  screenBubbleBlue: { left: '20%', width: 108, height: 108, backgroundColor: 'rgba(88,190,255,0.13)', borderColor: 'rgba(150,222,255,0.7)' },
  screenBubblePeach: { right: '3%', width: 52, height: 52, backgroundColor: 'rgba(255,151,116,0.18)', borderColor: 'rgba(255,191,165,0.75)' },
  // aeroMeadowV4Applied
  aeroGrassFarHill: { position: 'absolute', left: -30, right: -30, bottom: 54, height: 70, borderRadius: 55, backgroundColor: 'rgba(147,224,92,0.4)', borderTopWidth: 3, borderTopColor: 'rgba(232,255,170,0.6)', 
    // aeroTimerRefTune
    ...(aeroMode ? {
      bottom: 33,
      opacity: 0.72,
    } : {}),},
  aeroGrassNearHill: { position: 'absolute', left: -20, right: -20, bottom: 20, height: 78, borderRadius: 58, backgroundColor: 'rgba(61,170,58,0.44)', borderTopWidth: 3, borderTopColor: 'rgba(160,239,106,0.74)', 
    // aeroTimerRefTune
    ...(aeroMode ? {
      bottom: 7,
      opacity: 0.72,
    } : {}),},
  aeroGrassBed: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 126, overflow: 'hidden', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, backgroundColor: 'rgba(94,197,69,0.42)', zIndex: 0, 
    // aeroTimerRefTune
    ...(aeroMode ? {
      height: 92,
      opacity: 0.46,
    } : {}),
    opacity: 0,},
  aeroGrassGlow: { position: 'absolute', left: -35, right: -35, bottom: -8, height: 96, borderRadius: 55, backgroundColor: 'rgba(37,139,52,0.62)', borderTopWidth: 4, borderTopColor: 'rgba(210,255,123,0.84)', 
    // aeroTimerRefTune
    ...(aeroMode ? {
      bottom: -30,
      opacity: 0.62,
    } : {}),
    opacity: 0,},
  aeroGrassBlade: { position: 'absolute', bottom: -2, width: 5, borderRadius: 5, shadowColor: '#E9FF93', shadowOpacity: 0.6, shadowRadius: 3 ,
    opacity: 0,},
  // meadowTimerCleanGlassV1
  meadowTimerCleanGlass: {
    backgroundColor: 'rgba(255,255,255,0.44)',

    borderWidth: 1.25,
    borderColor: AERO_GLASS_EDGE,

    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow: 'none',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        } as any)
      : {}),
  },

  aeroTimerGlass: {
    minHeight: 152,
    overflow: 'hidden',

    

    borderWidth: 1.25,
    borderColor: AERO_GLASS_EDGE,

    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: aeroMeadow ? 0 : 0.13,
    shadowRadius: 22,
    elevation: aeroMeadow ? 0 : 8,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 10px 26px rgba(68,72,78,0.13), 0 0 24px rgba(255,255,255,0.58), inset 0 1px 0 rgba(255,255,255,0.98), inset 0 -1px 0 rgba(110,114,120,0.14)',
          backdropFilter:
            'blur(14px) saturate(0.30) brightness(1.16)',
        } as any)
      : {}),
  
    // aeroTimerMeadowCleanupV2
    
    // aeroTimerSceneV3
    backgroundColor: 'rgba(255,255,255,0.72)',},
  // Meadow fills the entire root/safe-area with its own neutral-green base.
  // This prevents the Aero ocean cyan fallback from showing below the artwork.
  meadowSafeAreaForkCV1: {
    backgroundColor: '#71835B',
  },
  meadowWorldVeilForkCV1: {
    backgroundColor: 'rgba(247,250,241,0.02)',
  },

  aeroWorldBackground: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },

  aeroWorldVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(214,246,255,0.08)',
  },

  aeroSafeArea: {
    backgroundColor: '#70D3F4',
  },
  aeroContent: {
    backgroundColor: 'transparent',
  
    // aeroBreathingRoomV1
    ...(aeroMode ? {
      paddingHorizontal:
        Platform.OS === 'web'
          ? 38
          : 20,

      paddingBottom:
        Platform.OS === 'web'
          ? 50
          : 42,
    } : {}),},
  aeroHero: {
    minHeight: 224,
    marginHorizontal: -18,
    paddingHorizontal: 22,
    overflow: 'hidden',
    borderBottomLeftRadius: 42,
    borderBottomRightRadius: 42,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    shadowOpacity: 0,
  
    // aeroBreathingRoomV1
    ...(aeroMode ? {
      marginHorizontal:
        Platform.OS === 'web'
          ? -18
          : -8,

      paddingHorizontal:
        Platform.OS === 'web'
          ? 28
          : 22,

      paddingTop:
        Platform.OS === 'web'
          ? 28
          : 26,
    } : {}),},
  aeroAtmosphere: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: 'rgba(195,244,255,0.06)',
  },
  aeroWaterGlow: {
    position: 'absolute',
    top: -110,
    left: '12%',
    width: 520,
    height: 330,
    borderRadius: 260,
    backgroundColor: celestialAlpha(celestial.ivory, 0.18),
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.48,
    shadowRadius: 42,
  },
  aeroGlassArc: { position: 'absolute', top: -155, right: -75, width: 310, height: 310, borderRadius: 155, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 3, borderColor: 'rgba(255,255,255,0.42)' },
  aeroBubble3d: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(213,250,255,0.27)', borderWidth: 2, borderColor: celestialAlpha(celestial.ivory, 0.78), shadowColor: '#006DA8', shadowOffset: { width: 3, height: 6 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 3 },
  aeroBubbleShine: { position: 'absolute', top: '17%', left: '19%', width: '28%', height: '20%', borderRadius: 999, backgroundColor: celestialAlpha(celestial.ivory, 0.82), transform: [{ rotate: '-24deg' }] },
  aeroBubbleA: { width: 46, height: 46, left: '7%', bottom: 18 },
  aeroBubbleB: { width: 25, height: 25, left: '22%', bottom: 92 },
  aeroBubbleC: { width: 70, height: 70, right: '7%', bottom: 28 },
  aeroBubbleD: { width: 19, height: 19, right: '25%', top: 35 },
  aeroBubbleE: { width: 34, height: 34, right: '42%', bottom: 4 },
  aeroFish: { position: 'absolute', width: 72, height: 38, opacity: 0.72 },
  aeroFishOne: { top: 68, left: 0 },
  aeroFishTwo: { bottom: 23, left: -310, transform: [{ scale: 0.72 }] },
  aeroFishBody: { position: 'absolute', right: 0, top: 4, width: 53, height: 30, borderRadius: 19, backgroundColor: '#FF7A21', borderWidth: 2, borderColor: celestialAlpha(celestial.ivory, 0.9), overflow: 'hidden' },
  aeroFishTail: { position: 'absolute', left: 0, top: 8, width: 0, height: 0, borderTopWidth: 11, borderBottomWidth: 11, borderRightWidth: 20, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: '#FF7A21' },
  aeroFishStripeOne: { position: 'absolute', left: 12, top: -2, width: 7, height: 34, backgroundColor: '#FFFFFF', transform: [{ rotate: '8deg' }] },
  aeroFishStripeTwo: { position: 'absolute', right: 12, top: -2, width: 7, height: 34, backgroundColor: '#FFFFFF', transform: [{ rotate: '-8deg' }] },
  aeroFishEye: { position: 'absolute', right: 6, top: 7, width: 5, height: 5, borderRadius: 3, backgroundColor: '#132B38' },
  aeroGlassCard: {
    borderRadius: 30,
    overflow: 'hidden',

    backgroundColor:
      Platform.OS === 'web'
        ? 'rgba(255,255,255,0.58)'
        : 'rgba(255,255,255,0.72)',

    borderWidth: 1.25,
    borderColor: AERO_GLASS_EDGE,

    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: aeroMeadow ? 0 : 0.18,
    shadowRadius: 18,
    elevation: aeroMeadow ? 0 : 5,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow: `0 10px 28px rgba(72,76,82,0.15), 0 0 28px rgba(255,255,255,0.66), inset 0 1px 0 rgba(255,255,255,0.98), inset 0 -1px 0 rgba(170,174,180,0.18)`,
          backdropFilter:
            'blur(14px) saturate(0.34) brightness(1.18)',
        } as any)
      : {}),
  },
  aeroRadio: { borderRadius: 34, backgroundColor: 'rgba(23,185,207,0.76)', borderWidth: 3, borderColor: 'rgba(235,255,255,0.98)', shadowColor: '#087D99', shadowOffset: { width: 0, height: 13 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 7 },
  // aeroGlassV3Applied
  // aeroGlassV4Softened
  pixelText: { fontFamily: 'monospace', letterSpacing: 0 },
  pixelBoot: { marginTop: 14, color: colors.text, fontFamily: 'monospace', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  pixelDither: { width: '100%', height: 34, marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden', borderWidth: 2, borderColor: colors.text },
  pixelDot: { width: '6.25%', height: 8, backgroundColor: colors.background },
  pixelDotOn: { backgroundColor: colors.text },
  pixelBuffer: { marginBottom: 12, color: colors.text, fontFamily: 'monospace', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  
    // forkN1CelestialHomeCommandBellV1_safeArea
    ...(celestialMode ? { backgroundColor: celestial.night } : {}),
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 38,
  },
  hero: {
    paddingTop: 25,
    paddingHorizontal: 4,
  },
  themeButton: {
    position: 'absolute',
    zIndex: 100,
    elevation: 100,
    top: 20,
    right: 2,
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: pixelMode ? 0 : 23,
    backgroundColor: aeroMode ? celestialAlpha(celestial.ivory, 0.58) : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: aeroMode ? celestialAlpha(celestial.ivory, 0.9) : colors.separator,
  
    // aeroBreathingRoomV1
    ...(aeroMode ? {
      top:
        Platform.OS === 'web'
          ? 26
          : 22,

      right:
        Platform.OS === 'web'
          ? 18
          : 12,

      width:
        Platform.OS === 'web'
          ? 48
          : 46,

      height:
        Platform.OS === 'web'
          ? 48
          : 46,

      borderRadius:
        Platform.OS === 'web'
          ? 24
          : 23,

      backgroundColor:
        'rgba(255,255,255,0.78)',

      borderColor:
        AERO_GLASS_EDGE,

      shadowColor: '#FFFFFF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 9,

      ...(Platform.OS === 'web'
        ? ({
            boxShadow:
              '0 5px 16px rgba(68,72,78,0.16), 0 0 10px rgba(255,255,255,0.48)',
          } as any)
        : {}),
    } : {}),
    // forkN1CelestialHomeCommandBellV1_themeButton
    ...(celestialMode ? {
      backgroundColor: celestialAlpha(celestial.night, 0.94),
      borderColor: celestialAlpha(celestial.gold, 0.46),
      shadowColor: celestial.gold,
      shadowOpacity: 0.16,
      shadowRadius: 12,
    } : {}),
  },
  themeButtonPressed: { opacity: 0.65, transform: [{ scale: 0.96 }] },
  settingsGearIcon: {
    width:
      Platform.OS === 'web'
        ? 38
        : 36,
    height:
      Platform.OS === 'web'
        ? 38
        : 36,
    borderRadius:
      Platform.OS === 'web'
        ? 19
        : 18,
  },
  themeButtonIcon: { color: colors.black, fontSize: 22, fontWeight: '800' ,
    // aeroBreathingRoomV1
    ...(aeroMode ? {
      color: homeAccent,

      fontSize:
        Platform.OS === 'web'
          ? 23
          : 22,

      fontWeight: '800',

      textShadowColor:
        celestialAlpha(celestial.ivory, 0.72),

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 3,
    } : {}),
    // forkKDarkBackgroundContrastV1_themeButtonIcon
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_themeButtonIcon
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  date: {
    
    
    fontFamily: pixelMode ? 'monospace' : undefined,

    
    
    textTransform: 'uppercase',
  
    // aeroV3Override
    ...(aeroMode ? {
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      color: colors.textMuted,
      fontWeight: '600',
      letterSpacing: 0.7,
    } : {}),
    // aeroBreathingRoomV1
    ...(aeroMode ? {
      color: homeAccent,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize:
        Platform.OS === 'web'
          ? 14
          : 13,

      lineHeight:
        Platform.OS === 'web'
          ? 19
          : 18,

      fontWeight: '800',
      letterSpacing: 0.85,

      textShadowColor:
        celestialAlpha(celestial.ivory, 0.98),

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 6,

      ...(Platform.OS === 'web'
        ? ({
            textShadow:
              '0 1px 1px rgba(255,255,255,1), 0 0 7px rgba(255,255,255,0.94)',
          } as any)
        : {}),
    } : {}),
    // aeroHeaderSearchFinalV1
    ...(aeroMode ? {
      color: homeAccent,

      fontFamily:
        Platform.select({
          web:
            'Segoe UI, Arial, sans-serif',

          android:
            'sans-serif',

          ios:
            'System',
        }),

      fontSize:
        Platform.OS === 'web'
          ? 15
          : 14,

      lineHeight:
        Platform.OS === 'web'
          ? 20
          : 19,

      fontWeight: '700',

      letterSpacing: 0.85,

      textShadowColor:
        celestialAlpha(celestial.ivory, 0.98),

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 5,
    } : {}),
    // aeroHeroTypographyREALV1
    ...(aeroMode ? {
      color: homeAccent,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize:
        Platform.OS === 'web'
          ? 17
          : 15,

      lineHeight:
        Platform.OS === 'web'
          ? 22
          : 20,

      fontWeight: '800',

      letterSpacing: 0.7,

      textShadowColor: celestialAlpha(celestial.ivory, 0.78),

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 3,

      ...(Platform.OS === 'web'
        ? ({
            textShadow:
              '0 1px 2px rgba(255,255,255,0.88), 0 0 5px rgba(255,255,255,0.42)',
          } as any)
        : {}),
    } : {}),
    // frutigerDateTuneV1
    color: homeAccent,
    fontSize: Platform.OS === 'web' ? 20 : 16,
    lineHeight: Platform.OS === 'web' ? 24 : 20,
    fontWeight: '800',
    letterSpacing: 0.8,
    textShadowColor: celestialAlpha(celestial.ivory, 0.85),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,


    // aeroSearchDateMicroV1
    ...(aeroMode ? {
      alignSelf: 'center',

      width: '100%',

      textAlign: 'center',

      color: homeAccent,

      fontSize:
        Platform.OS === 'web'
          ? 18
          : 16,

      lineHeight:
        Platform.OS === 'web'
          ? 23
          : 21,

      fontWeight: '800',

      textShadowColor: 'transparent',

      textShadowOffset: {
        width: 0,
        height: 0,
      },

      textShadowRadius: 0,

      ...(Platform.OS === 'web'
        ? ({
            textShadow: 'none',
          } as any)
        : {}),
    } : {}),
    // forkKDarkBackgroundContrastV1_date
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkKDarkBackgroundContrastV1_noGloss_date
    ...(aeroMode ? {
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  },
  heading: {
    marginTop: 4,
    color: colors.text,
    fontSize: 42,
    lineHeight: 49,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '900',
    letterSpacing: -1.4,
  },
  intro: {
    maxWidth: 350,
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  quoteHero: {
    minHeight: 126,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  quoteMark: {
    
    
    fontFamily: pixelMode ? 'monospace' : undefined,

    
    
  
    // aeroHeaderSearchFinalV1
    ...(aeroMode ? {
      color: homeAccent,

      fontFamily:
        Platform.select({
          web:
            'Segoe UI, Arial, sans-serif',

          android:
            'sans-serif',

          ios:
            'System',
        }),

      fontSize:
        Platform.OS === 'web'
          ? 26
          : 23,

      lineHeight:
        Platform.OS === 'web'
          ? 28
          : 25,

      fontWeight: '800',

      textShadowColor:
        celestialAlpha(celestial.ivory, 0.78),

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 4,
    } : {}),
    // aeroHeroTypographyREALV1
    ...(aeroMode ? {
      color: homeAccent,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize:
        Platform.OS === 'web'
          ? 30
          : 26,

      lineHeight:
        Platform.OS === 'web'
          ? 31
          : 28,

      fontWeight: '800',

      opacity: 0.94,

      textShadowColor: celestialAlpha(celestial.ivory, 0.58),

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 2,
    } : {}),
    // frutigerQuoteMarkTuneV1
    color: homeAccent,
    fontSize: Platform.OS === 'web' ? 34 : 28,
    lineHeight: Platform.OS === 'web' ? 36 : 30,
    fontWeight: '800',
    opacity: 0.96,

    // forkKDarkBackgroundContrastV1_quoteMark
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkKDarkBackgroundContrastV1_noGloss_quoteMark
    ...(aeroMode ? {
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_quoteMark
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  quoteText: {
    
    
    
    fontFamily: pixelMode ? 'monospace' : undefined,

    
    
    textAlign: 'center',
  
    // aeroV3Override
    ...(aeroMode ? {
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      color: homeAccent,
      fontWeight: '700',
      letterSpacing: -0.25,
    } : {}),
    // aeroHeaderSearchFinalV1
    ...(aeroMode ? {
      color: homeAccent,

      fontFamily:
        Platform.select({
          web:
            'Segoe UI, Arial, sans-serif',

          android:
            'sans-serif',

          ios:
            'System',
        }),

      fontSize:
        Platform.OS === 'web'
          ? 22
          : 18,

      lineHeight:
        Platform.OS === 'web'
          ? 29
          : 25,

      fontWeight: '650',

      letterSpacing: -0.15,

      textShadowColor:
        celestialAlpha(celestial.ivory, 0.98),

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 6,
    } : {}),
    // aeroHeroTypographyREALV1
    ...(aeroMode ? {
      color: homeAccent,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize:
        Platform.OS === 'web'
          ? 24
          : 20,

      lineHeight:
        Platform.OS === 'web'
          ? 31
          : 27,

      fontWeight: '700',

      letterSpacing: -0.25,

      textShadowColor: celestialAlpha(celestial.ivory, 0.70),

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 3,

      ...(Platform.OS === 'web'
        ? ({
            textShadow:
              '0 1px 2px rgba(255,255,255,0.80), 0 0 5px rgba(255,255,255,0.34)',
          } as any)
        : {}),
    } : {}),
    // frutigerQuoteTuneV1
    color: homeAccent,
    fontSize: Platform.OS === 'web' ? 28 : 22,
    lineHeight: Platform.OS === 'web' ? 34 : 28,
    fontWeight: '700',
    letterSpacing: -0.2,
    textShadowColor: celestialAlpha(celestial.ivory, 0.72),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,

    // forkKDarkBackgroundContrastV1_quoteText
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkKDarkBackgroundContrastV1_noGloss_quoteText
    ...(aeroMode ? {
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_quoteText
    ...(celestialMode ? {
      color: celestial.ivory,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  quoteSource: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  
    // forkKDarkBackgroundContrastV1_quoteSource
    ...(isDarkBackground && !aeroMode ? {
      color: colors.textMuted,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_quoteSource
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.62) } : {}),
  },  catalogueCard: {
    minHeight: 112,
    marginTop: 25,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: pixelMode ? 0 : 20,
    backgroundColor: aeroMode ? celestialAlpha(celestial.ivory, 0.58) : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: aeroMode ? celestialAlpha(celestial.ivory, 0.9) : colors.separator,
  
    // forkN1CelestialHomeCommandBellV1_catalogueCard
    ...(celestialMode ? {
      backgroundColor: celestialAlpha(celestial.night, 0.94),
      borderColor: celestialAlpha(celestial.gold, 0.38),
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.34,
      shadowRadius: 24,
      elevation: 7,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: `0 18px 44px ${celestialAlpha(celestial.shadow, 0.34)}, inset 0 1px 0 ${celestialAlpha(celestial.gold, 0.12)}` } as any)
        : {}),
    } : {}),
  },
  cataloguePressed: {
    opacity: 0.7,
    transform: [{ scale: 0.99 }],
  },
  catalogueIcon: {
    width: 68,
    height: 72,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    borderRadius: pixelMode ? 0 : 16,
    backgroundColor: colors.black,
    paddingBottom: 15,
  
    // forkN1CelestialHomeCommandBellV1_catalogueIcon
    ...(celestialMode ? {
      backgroundColor: celestial.nightSoft,
      borderWidth: 1,
      borderColor: celestialAlpha(celestial.gold, 0.42),
    } : {}),
  },
  catalogueJingleIconV1: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 0,
    overflow: 'hidden',
  },
  catalogueJingleOrbitOuterV1: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: homeAccent,
    opacity: 0.46,
    transform: [{ rotate: '-18deg' }],
  },
  catalogueJingleOrbitInnerV1: {
    position: 'absolute',
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeAccent,
    opacity: 0.72,
    transform: [{ rotate: '22deg' }],
  },
  catalogueJingleShelfTopV1: {
    position: 'absolute',
    width: 31,
    height: 1,
    bottom: 16,
    backgroundColor: homeAccent,
    opacity: 0.58,
  },
  catalogueJingleShelfBottomV1: {
    position: 'absolute',
    width: 22,
    height: 1,
    bottom: 12,
    backgroundColor: homeAccent,
    opacity: 0.34,
  },
  catalogueJingleCoreV1: {
    color: homeAccent,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
  },
  catalogueJingleSparkAV1: {
    position: 'absolute',
    top: 8,
    right: 9,
    color: homeAccent,
    fontSize: 10,
    opacity: 0.92,
  },
  catalogueJingleSparkBV1: {
    position: 'absolute',
    left: 10,
    bottom: 20,
    color: homeAccent,
    fontSize: 14,
    opacity: 0.68,
  },

  bookSpine: {
    width: 7,
    height: 31,
    borderRadius: pixelMode ? 0 : 2,
    backgroundColor: colors.white,
  
    // forkN1CelestialHomeCommandBellV1_bookSpine
    ...(celestialMode ? { backgroundColor: celestial.gold } : {}),
  },
  bookSpineWide: {
    width: 10,
    height: 38,
    marginLeft: 4,
    borderRadius: pixelMode ? 0 : 2,
    backgroundColor: '#8E8E93',
  
    // forkN1CelestialHomeCommandBellV1_bookSpineWide
    ...(celestialMode ? { backgroundColor: celestial.ivory } : {}),
  },
  bookSpineShort: {
    width: 8,
    height: 26,
    marginLeft: 4,
    borderRadius: pixelMode ? 0 : 2,
    backgroundColor: '#D1D1D6',
  
    // forkN1CelestialHomeCommandBellV1_bookSpineShort
    ...(celestialMode ? { backgroundColor: celestialAlpha(celestial.gold, 0.58) } : {}),
  },
  catalogueCopy: {
    flex: 1,
    marginLeft: 15,
  },
  catalogueEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  catalogueTitle: {
    marginTop: 2,
    color: colors.text,
    fontSize: 21,
    lineHeight: 26,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
  
    // aeroV3Override
    ...(aeroMode ? {
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      color: homeAccent,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '700',
      letterSpacing: -0.2,
    } : {}),
    // forkKDarkBackgroundContrastV1_catalogueTitle
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_catalogueTitle
    ...(celestialMode ? {
      color: celestial.ivory,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  catalogueSubtitle: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  
    // aeroV3Override
    ...(aeroMode ? {
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      color: colors.textMuted,
      fontWeight: '400',
      letterSpacing: 0,
    } : {}),
    // forkKDarkBackgroundContrastV1_catalogueSubtitle
    ...(isDarkBackground && !aeroMode ? {
      color: colors.textMuted,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_catalogueSubtitle
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.62) } : {}),
  },
  catalogueArrow: {
    marginLeft: 8,
    color: colors.textMuted,
    fontSize: 31,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '300',
  
    // aeroV3Override
    ...(aeroMode ? {
      color: homeAccent,
    } : {}),
    // forkKDarkBackgroundContrastV1_catalogueArrow
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_catalogueArrow
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  dailyCard: {
    marginTop: 14,
    padding: 18,
    borderRadius: pixelMode ? 0 : 20,
    backgroundColor: aeroMode ? celestialAlpha(celestial.ivory, 0.58) : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: aeroMode ? celestialAlpha(celestial.ivory, 0.9) : colors.separator,
  
    // aeroTimerRefTune
    ...(aeroMode ? {
      paddingHorizontal: Platform.OS === 'web' ? 28 : 20,
      paddingTop: Platform.OS === 'web' ? 24 : 19,
      paddingBottom: Platform.OS === 'web' ? 22 : 18,
    } : {}),
    // forkN1CelestialHomeCommandBellV1_dailyCard
    ...(celestialMode ? {
      backgroundColor: celestialAlpha(celestial.night, 0.94),
      borderColor: celestialAlpha(celestial.gold, 0.38),
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.34,
      shadowRadius: 24,
      elevation: 7,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: `0 18px 44px ${celestialAlpha(celestial.shadow, 0.34)}, inset 0 1px 0 ${celestialAlpha(celestial.gold, 0.12)}` } as any)
        : {}),
    } : {}),
  },
  // catalogueSearchDeleteV1Applied
  dailyGlobalTimerButton: {
    alignSelf: 'flex-start',
    minWidth: 72,
    minHeight: 34,
    marginTop: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: pixelMode ? 0 : 999,
    backgroundColor:
      aeroMode
        ? '#5B5F65'
        : colors.black,
    borderWidth: aeroMode ? 1 : 0,
    borderColor: aeroMode
      ? 'rgba(255,255,255,0.86)'
      : 'transparent',
    shadowColor:
      aeroMode
        ? '#FFFFFF'
        : 'transparent',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: aeroMode ? 0.12 : 0,
    shadowRadius: aeroMode ? 8 : 0,
  
    // forkN1CelestialHomeCommandBellV1_dailyGlobalTimerButton
    ...(celestialMode ? { backgroundColor: celestial.gold, borderColor: celestial.gold, borderWidth: 1 } : {}),
  },
  dailyGlobalTimerButtonRunning: {
    backgroundColor: colors.danger,
  },
  dailyGlobalTimerButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  dailyGlobalTimerButtonDisabled: {
    opacity: 0.55,
  },
  dailyGlobalTimerButtonText: {
    color:
      aeroMode
        ? '#F5F5F3'
        : colors.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  
    // forkN1CelestialHomeCommandBellV1_dailyGlobalTimerButtonText
    ...(celestialMode ? { color: celestial.onAccent } : {}),
  },
  jingleTimerStartSlotV2: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: homeAccent,
    borderWidth: 1,
    borderColor: homeAccent,
    shadowColor: homeAccent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 3,
  },
  jingleTimerStartSlotRunningV2: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
    shadowColor: colors.danger,
  },
  jingleTimerStartSlotTextV2: {
    color: colors.background,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  jingleTimerStartSlotTextRunningV2: {
    color: colors.white,
  },

  dailyHeader: {
    
    
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  
    // aeroTimerRefTune
    ...(aeroMode ? {
      alignItems: 'flex-start',
      paddingTop: Platform.OS === 'web' ? 4 : 2,
    } : {}),
    // aeroTimerMeadowLift
    position: 'relative',
    zIndex: 2},
  dailyEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  
    // aeroV3Override
    ...(aeroMode ? {
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      color: homeAccent,
      fontWeight: '700',
      letterSpacing: 1.5,
    } : {}),
    // aeroTimerRefTune
    ...(aeroMode ? {
      color: homeAccent,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: Platform.OS === 'web' ? 12 : 11,
      lineHeight: 16,

      fontWeight: '700',
      letterSpacing: 2.1,
      textTransform: 'uppercase',
    } : {}),
    // forkKDarkBackgroundContrastV1_dailyEyebrow
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_dailyEyebrow
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  dailyTotal: {
    marginTop: 5,
    color: colors.text,
    fontSize: 32,
    lineHeight: 38,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
  
    // aeroV3Override
    ...(aeroMode ? {
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      color: homeAccent,
      fontWeight: '700',
      letterSpacing: -1.1,
    } : {}),
    // aeroTimerRefTune
    ...(aeroMode ? {
      marginTop: 8,

      color: homeAccent,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: Platform.OS === 'web' ? 46 : 39,
      lineHeight: Platform.OS === 'web' ? 52 : 44,

      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      letterSpacing: -1.6,
    } : {}),
    // forkKDarkBackgroundContrastV1_dailyTotal
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_dailyTotal
    ...(celestialMode ? {
      color: celestial.ivory,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  dailyMark: {
    width: aeroMode && Platform.OS !== 'web' ? 34 : 44,
    height: aeroMode && Platform.OS !== 'web' ? 34 : 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: pixelMode ? 0 : aeroMode && Platform.OS !== 'web' ? 17 : 22,
    backgroundColor: colors.black,
  
    // aeroTimerRefTune
    ...(aeroOcean ? {
      width: Platform.OS === 'web' ? 58 : 50,
      height: Platform.OS === 'web' ? 58 : 50,

      borderRadius: Platform.OS === 'web' ? 29 : 25,

      backgroundColor: '#078DDA',

      borderWidth: 2,
      borderColor: 'rgba(214,255,255,0.98)',

      shadowColor: '#00D9FF',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.42,
      shadowRadius: 10,
      elevation: 8,

      ...(Platform.OS === 'web'
        ? ({
            boxShadow: `0 6px 15px rgba(0,126,210,0.34), 0 0 9px rgba(115,246,255,0.88), inset 0 2px 4px ${celestialAlpha(celestial.ivory, 0.38)}`,
          } as any)
        : {}),
    } : {}),
    // forkN1CelestialHomeCommandBellV1_dailyMark
    ...(celestialMode ? { backgroundColor: celestial.nightSoft, borderColor: celestialAlpha(celestial.gold, 0.62), borderWidth: 1 } : {}),
  },
  dailyMarkText: {
    color: colors.white,
    fontSize: aeroMode && Platform.OS !== 'web' ? 11 : 13,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
  
    // aeroTimerRefTune
    ...(aeroMode ? {
      color: '#FFFFFF',

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: Platform.OS === 'web' ? 18 : 16,
      fontWeight: '700',
    } : {}),
    // forkN1CelestialHomeCommandBellV1_dailyMarkText
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  dailyBreakdown: {
    
    
    marginTop: 14,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  
    // aeroTimerRefTune
    ...(aeroMode ? {
      marginTop: 13,
      paddingTop: 15,

      borderTopWidth: 1,
      borderTopColor: 'rgba(31,157,211,0.48)',
    } : {}),
    // aeroTimerMeadowLift
    position: 'relative',
    zIndex: 2},
  dailyLine: {
    minHeight: 31,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  
    // aeroTimerRefTune
    ...(aeroMode ? {
      minHeight: Platform.OS === 'web' ? 45 : 39,
    } : {}),},
  dailyLabel: {
    flex: 1,
    marginRight: 12,
    color: colors.textMuted,
    fontSize: 15,
  
    // aeroV3Override
    ...(aeroMode ? {
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      color: colors.textMuted,
      fontWeight: '400',
    } : {}),
    // aeroTimerRefTune
    ...(aeroMode ? {
      marginRight: 18,

      color: colors.textMuted,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: Platform.OS === 'web' ? 15 : 13,
      lineHeight: Platform.OS === 'web' ? 21 : 18,

      fontWeight: '400',
      letterSpacing: 0.1,
    } : {}),
    // forkKDarkBackgroundContrastV1_dailyLabel
    ...(isDarkBackground && !aeroMode ? {
      color: colors.textMuted,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_dailyLabel
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.62) } : {}),
  },
  dailyValue: {
    color: homeAccent,
    fontSize: 15,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  
    // aeroV3Override
    ...(aeroMode ? {
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      color: homeAccent,
      fontWeight: '700',
    } : {}),
    // aeroTimerRefTune
    ...(aeroMode ? {
      color: homeAccent,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: Platform.OS === 'web' ? 15 : 13,

      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.15,
    } : {}),
    // forkKDarkBackgroundContrastV1_dailyValue
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_dailyValue
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  dailyEmpty: {
    
    
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  
    // aeroTimerRefTune
    ...(aeroMode ? {
      color: colors.textMuted,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: 13,
      lineHeight: 19,
    } : {}),
    // aeroTimerMeadowLift
    position: 'relative',
    zIndex: 2,
    // forkKDarkBackgroundContrastV1_dailyEmpty
    ...(isDarkBackground && !aeroMode ? {
      color: colors.textMuted,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  },
  // forkIHomeProfileV1
  dailyHistoryPressedForkIV1: {
    opacity: 0.82,
    transform: [{ scale: 0.995 }],
  },
  profileCardForkIV1: {
    position: 'relative',
    minHeight: celestialMode ? 140 : 166,
    marginTop: 12,
    padding: 18,
    overflow: 'hidden',
    borderRadius: pixelMode ? 0 : 22,
    backgroundColor: aeroMode ? celestialAlpha(celestial.ivory, 0.58) : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: aeroMode ? celestialAlpha(celestial.ivory, 0.9) : colors.separator,
  
    // forkN1CelestialHomeCommandBellV1_profileCard
    ...(celestialMode ? {
      backgroundColor: celestialAlpha(celestial.night, 0.94),
      borderColor: celestialAlpha(celestial.gold, 0.38),
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.34,
      shadowRadius: 24,
      elevation: 7,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: `0 18px 44px ${celestialAlpha(celestial.shadow, 0.34)}, inset 0 1px 0 ${celestialAlpha(celestial.gold, 0.12)}` } as any)
        : {}),
    } : {}),
  },
  profileTopForkIV1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  profileMarkForkIV1: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: pixelMode ? 0 : 15,
    backgroundColor: colors.fill,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: colors.separator,
  
    // forkN1CelestialHomeCommandBellV1_profileMark
    ...(celestialMode ? { backgroundColor: celestial.nightSoft, borderColor: celestialAlpha(celestial.gold, 0.36) } : {}),
  },
  profileMarkTextForkIV1: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  
    // forkN1CelestialHomeCommandBellV1_profileMarkText
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  profileArrowForkIV1: {
    color: colors.textMuted,
    fontSize: 30,
    fontWeight: '300',
  
    // forkN1CelestialHomeCommandBellV1_profileArrow
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  profileEyebrowForkIV1: {
    marginTop: 15,
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: 1.2,
  
    // forkN1CelestialHomeCommandBellV1_profileEyebrow
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  profileTitleForkIV1: {
    marginTop: 3,
    color: colors.text,
    fontSize: 25,
    lineHeight: 30,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: -0.55,
  
    // forkN1CelestialHomeCommandBellV1_profileTitle
    ...(celestialMode ? {
      color: celestial.ivory,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  profileSubtitleForkIV1: {
    marginTop: 4,
    maxWidth: 520,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  
    // forkN1CelestialHomeCommandBellV1_profileSubtitle
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.62) } : {}),
  },
  profileTagsForkIV1: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  profileTagForkIV1: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: pixelMode ? 0 : 999,
    backgroundColor: colors.fill,
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: 0.65,
  
    // forkN1CelestialHomeCommandBellV1_profileTag
    ...(celestialMode ? {
      backgroundColor: celestialAlpha(celestial.gold, 0.08),
      color: celestial.gold,
      borderWidth: 1,
      borderColor: celestialAlpha(celestial.gold, 0.20),
    } : {}),
  },

  // forkN51FinalMotionRadioProfileV1
  classicRadioPressedN51: {
    // The Classic mobile radio rests at the compact scale. quickPressed
    // used to overwrite that transform with ~1.0, producing the big snap.
    opacity: 0.90,
    transform: [{ scale: 0.84 }],
  },
  profileCardCompactN51: {
    minHeight: 116,
    paddingTop: 15,
    paddingBottom: 14,
  },
  profileTopCompactN51: {
    position: 'absolute',
    top: 10,
    left: 14,
    right: 14,
    justifyContent: 'flex-end',
  },
  profileEyebrowCompactN51: {
    marginTop: 0,
    paddingRight: 34,
  },

  quickGrid: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  quickCard: {
    flex: 1,
    minHeight: 112,
    padding: 15,
    borderRadius: pixelMode ? 0 : 18,
    backgroundColor: aeroMode ? celestialAlpha(celestial.ivory, 0.58) : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: aeroMode ? celestialAlpha(celestial.ivory, 0.9) : colors.separator,
  
    // forkN1CelestialHomeCommandBellV1_quickCard
    ...(celestialMode ? {
      backgroundColor: celestialAlpha(celestial.night, 0.94),
      borderColor: celestialAlpha(celestial.gold, 0.38),
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.34,
      shadowRadius: 24,
      elevation: 7,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: `0 18px 44px ${celestialAlpha(celestial.shadow, 0.34)}, inset 0 1px 0 ${celestialAlpha(celestial.gold, 0.12)}` } as any)
        : {}),
    } : {}),
  },

  // finalHomeProfileJinglePolishV1
  jinglePolishCatalogueCard: {
    position: 'relative',
    overflow: 'hidden',
    borderColor: homeAccent,
    shadowColor: homeAccent,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 2,
  },
  jinglePolishCatalogueStar: {
    position: 'absolute',
    right: 28,
    top: 13,
    color: homeAccent,
    fontSize: 11,
    opacity: 0.92,
    zIndex: 4,
  },
  jinglePolishCatalogueSpark: {
    position: 'absolute',
    left: 15,
    bottom: 12,
    color: homeAccent,
    fontSize: 9,
    opacity: 0.62,
    zIndex: 4,
  },
  jinglePolishCatalogueOrbit: {
    position: 'absolute',
    right: -30,
    top: -38,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeAccent,
    opacity: 0.22,
  },
  jinglePolishTimerRadioStack: {
    flexDirection: 'column-reverse',
    alignItems: 'stretch',
    flexWrap: 'nowrap',
    gap: 8,
  },
  jinglePolishRadioCard: {
    position: 'relative',
    borderColor: homeAccent,
    shadowColor: homeAccent,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 3,
  },
  jinglePolishRadioStar: {
    position: 'absolute',
    right: 13,
    top: 11,
    color: homeAccent,
    fontSize: 11,
    opacity: 0.96,
    zIndex: 6,
  },
  jinglePolishRadioSpark: {
    position: 'absolute',
    left: 12,
    bottom: 9,
    color: homeAccent,
    fontSize: 9,
    opacity: 0.70,
    zIndex: 6,
  },
  jinglePolishRadioOrbit: {
    position: 'absolute',
    right: -18,
    top: -24,
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: homeAccent,
    opacity: 0.24,
  },

  radioTimerRow: {
    // mobileStabilityUiPolishV1
    marginTop: aeroMode && Platform.OS !== 'web' ? 19 : 30,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'stretch',
    flexWrap: 'wrap',
    gap: 16,
  },
  timerColumn: {
    flex: 1,
    minWidth: 280,
  },
  dailyCardInRow: {
    flex: 1,
    minHeight: 118,
    marginTop: 0,
  },

  memoryRadioCard: {
    position: 'relative',
    width: '100%',
    maxWidth: 520,
    marginLeft: 'auto',
    marginRight: 'auto',
    minHeight: 148,
    marginTop: aeroMode && Platform.OS !== 'web' ? 0 : 28,
    marginBottom: 6,
    padding: 18,
    paddingBottom: 34,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 16,
    borderRadius: pixelMode ? 0 : 25,
    backgroundColor: homeAccent,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: homeAccent,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: pixelMode ? 0.85 : 0.12,
    shadowRadius: pixelMode ? 0 : 18,
    elevation: 4,
  
    // forkN1CelestialHomeCommandBellV1_memoryRadioCard
    ...(celestialMode ? {
      backgroundColor: celestial.night,
      borderColor: celestialAlpha(celestial.gold, 0.56),
      borderWidth: 1.25,
      shadowColor: '#000000',
      shadowOpacity: 0.42,
      shadowRadius: 22,
    } : {}),
  },
  // classicMobileRadioCompactV1
  classicMobileRadioCompact: {
    transform: [{ scale: 0.70 }],
    marginTop: -4,
    marginBottom: -30,
  },

  radioAntenna: {
    position: 'absolute',
    top: -17,
    left: 35,
    width: 112,
    height: 3,
    borderRadius: pixelMode ? 0 : 3,
    backgroundColor: colors.text,
    transform: [{ rotate: '-7deg' }],
  
    // forkN1CelestialHomeCommandBellV1_radioAntenna
    ...(celestialMode ? { backgroundColor: celestial.gold } : {}),
  },
  radioSpeaker: {
    width: 92,
    height: 82,
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: pixelMode ? 0 : 20,
    backgroundColor: colors.black,
  
    // forkN1CelestialHomeCommandBellV1_radioSpeaker
    ...(celestialMode ? { backgroundColor: celestial.nightRaised, borderColor: celestialAlpha(celestial.gold, 0.34) } : {}),
  },
  radioSpeakerHole: {
    width: 5,
    height: 5,
    borderRadius: pixelMode ? 0 : 3,
    backgroundColor: homeAccent,
  
    // forkN1CelestialHomeCommandBellV1_radioSpeakerHole
    ...(celestialMode ? { backgroundColor: celestial.gold, opacity: 0.72 } : {}),
  },
  radioDisplay: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: pixelMode ? 0 : 17,
    backgroundColor: aeroMode ? celestialAlpha(celestial.ivory, 0.58) : colors.surface,
  
    // forkN1CelestialHomeCommandBellV1_radioDisplay
    ...(celestialMode ? { backgroundColor: celestial.nightSoft, borderColor: celestialAlpha(celestial.gold, 0.26) } : {}),
  },
  radioBand: {
    color: homeAccent,
    fontSize: 8,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '900',
    letterSpacing: 1.1,
  
    // forkN1CelestialHomeCommandBellV1_radioBand
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  radioFrequency: {
    marginTop: 2,
    color: colors.text,
    fontSize: 30,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '900',
    letterSpacing: -1.2,
  
    // forkN1CelestialHomeCommandBellV1_radioFrequency
    ...(celestialMode ? {
      color: celestial.ivory,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  radioStation: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
    letterSpacing: 0.7,
  
    // forkN1CelestialHomeCommandBellV1_radioStation
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.62) } : {}),
  },
  radioSignal: {
    height: 4,
    marginTop: 8,
    overflow: 'hidden',
    borderRadius: pixelMode ? 0 : 4,
    backgroundColor: colors.fill,
  
    // forkN1CelestialHomeCommandBellV1_radioSignal
    ...(celestialMode ? { backgroundColor: celestialAlpha(celestial.gold, 0.16) } : {}),
  },
  radioSignalActive: {
    width: '58%',
    height: '100%',
    borderRadius: pixelMode ? 0 : 4,
    backgroundColor: homeAccent,
  
    // forkN1CelestialHomeCommandBellV1_radioSignalActive
    ...(celestialMode ? { backgroundColor: celestial.gold } : {}),
  },
  radioKnob: {
    width: 50,
    height: 50,
    alignItems: 'center',
    borderRadius: pixelMode ? 0 : 25,
    backgroundColor: aeroMode ? celestialAlpha(celestial.ivory, 0.58) : colors.surface,
    borderWidth: 5,
    borderColor: colors.black,
  
    // forkN1CelestialHomeCommandBellV1_radioKnob
    ...(celestialMode ? { backgroundColor: celestial.nightRaised, borderColor: celestialAlpha(celestial.gold, 0.62) } : {}),
  },
  radioKnobMark: {
    width: 3,
    height: 13,
    borderRadius: pixelMode ? 0 : 2,
    backgroundColor: homeAccent,
  
    // forkN1CelestialHomeCommandBellV1_radioKnobMark
    ...(celestialMode ? { backgroundColor: celestial.gold } : {}),
  },
  radioHint: {
    position: 'absolute',
    left: 19,
    bottom: 12,
    color: colors.white,
    fontSize: 8,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '900',
    letterSpacing: 1.4,
  
    // forkN1CelestialHomeCommandBellV1_radioHint
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },

  quickWideCard: {
    minHeight: 82,
    marginTop: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: pixelMode ? 0 : 18,
    backgroundColor: aeroMode ? celestialAlpha(celestial.ivory, 0.58) : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: aeroMode ? celestialAlpha(celestial.ivory, 0.9) : colors.separator,
  },
  quickWideIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: pixelMode ? 0 : 13,
    backgroundColor: colors.fill,
  },
  quickWideCopy: {
    flex: 1,
    marginLeft: 13,
  },
  quickWideTitle: {
    color: colors.text,
    fontSize: 16,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
  
    // aeroV3Override
    ...(aeroMode ? {
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      color: homeAccent,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.15,
    } : {}),
    // forkKDarkBackgroundContrastV1_quickWideTitle
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  },
  quickWideArrow: {
    color: colors.textMuted,
    fontSize: 29,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '300',
    marginLeft: 8,
  
    // aeroV3Override
    ...(aeroMode ? {
      color: homeAccent,
    } : {}),
    // forkKDarkBackgroundContrastV1_quickWideArrow
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  },
  quickPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.99 }],
  },
  quickSymbol: {
    color: colors.text,
    fontSize: 20,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '700',
  
    // aeroV3Override
    ...(aeroMode ? {
      color: homeAccent,
    } : {}),
    // forkKDarkBackgroundContrastV1_quickSymbol
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_quickSymbol
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  quickTitle: {
    marginTop: 11,
    color: homeAccent,
    fontSize: 18,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '700',
  
    // aeroV3Override
    ...(aeroMode ? {
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      color: homeAccent,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.15,
    } : {}),
    // forkKDarkBackgroundContrastV1_quickTitle
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_quickTitle
    ...(celestialMode ? {
      color: celestial.ivory,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  quickSubtitle: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 18,
  
    // aeroV3Override
    ...(aeroMode ? {
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      color: colors.textMuted,
      fontWeight: '400',
      letterSpacing: 0,
    } : {}),
    // forkKDarkBackgroundContrastV1_quickSubtitle
    ...(isDarkBackground && !aeroMode ? {
      color: colors.textMuted,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_quickSubtitle
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.62) } : {}),
  },
  sectionHeading: {
    marginTop: 29,
    marginBottom: 13,
    paddingHorizontal: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    
    
    fontFamily: pixelMode ? 'monospace' : undefined,

    
    letterSpacing: -0.3,
  
    // aeroBottomTune
    ...(aeroMode ? {
      color: '#073B70',
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      fontWeight: '700',
    } : {}),
    // aeroBottomTypeV3
    ...(aeroMode ? {
      color: homeAccent,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: Platform.OS === 'web' ? 20 : 19,
      lineHeight: Platform.OS === 'web' ? 25 : 24,

      fontWeight: '700',
      letterSpacing: -0.25,
    } : {}),
    // aeroBottomVisibilityV1
    ...(aeroMode ? {
      color: homeAccent,

      fontSize: Platform.OS === 'web' ? 23 : 21,
      lineHeight: Platform.OS === 'web' ? 29 : 27,

      fontWeight: '800',
      letterSpacing: -0.45,

      textShadowColor: celestialAlpha(celestial.ivory, 0.98),
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 8,

      ...(Platform.OS === 'web'
        ? ({
            textShadow:
              '0 1px 1px rgba(255,255,255,1), 0 0 8px rgba(255,255,255,0.96), 0 0 15px rgba(255,255,255,0.62)',
          } as any)
        : {}),
    } : {}),
    // frutigerRecentTitleTuneV1
    color: homeAccent,
    fontSize: Platform.OS === 'web' ? 24 : 20,
    lineHeight: Platform.OS === 'web' ? 28 : 24,
    fontWeight: '800',
    textShadowColor: celestialAlpha(celestial.ivory, 0.55),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,

    // forkKDarkBackgroundContrastV1_sectionTitle
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_sectionTitle
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    marginLeft: 9,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: pixelMode ? 0 : 12,
    backgroundColor: colors.fillStrong,
  
    // forkN1CelestialHomeCommandBellV1_countBadge
    ...(celestialMode ? { backgroundColor: celestialAlpha(celestial.gold, 0.12), borderColor: celestialAlpha(celestial.gold, 0.34), borderWidth: 1 } : {}),
  },
  countText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
  
    // forkN1CelestialHomeCommandBellV1_countText
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  errorBanner: {
    marginBottom: 14,
    padding: 14,
    borderRadius: pixelMode ? 0 : 14,
    backgroundColor: colors.dangerSoft,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  retryText: {
    marginTop: 4,
    color: colors.danger,
    fontSize: 13,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
  },
  emptyCard: {
    paddingHorizontal: 25,
    paddingVertical: 28,
    alignItems: 'center',
    borderRadius: pixelMode ? 0 : 22,
    backgroundColor: aeroMode ? celestialAlpha(celestial.ivory, 0.58) : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: aeroMode ? celestialAlpha(celestial.ivory, 0.9) : colors.separator,
  
    // aeroBottomTune
    ...(aeroMode ? {
      backgroundColor: celestialAlpha(celestial.ivory, 0.46),
      borderWidth: 1.5,
      borderColor: celestialAlpha(celestial.ivory, 0.98),

      shadowColor: '#A9E8FF',
      shadowOffset: { width: 0, height: 9 },
      shadowOpacity: aeroMeadow ? 0 : 0.14,
      shadowRadius: 20,
      elevation: aeroMeadow ? 0 : 7,

      ...(Platform.OS === 'web'
        ? ({
            boxShadow: `0 8px 20px rgba(70,165,210,0.13), 0 0 28px ${celestialAlpha(celestial.ivory, 0.90)}, inset 0 1px 0 ${celestialAlpha(celestial.ivory, 1)}`,
            backdropFilter:
              'blur(10px) saturate(0.78) brightness(1.10)',
          } as any)
        : {}),
    } : {}),
    // forkN1CelestialHomeCommandBellV1_emptyCard
    ...(celestialMode ? {
      backgroundColor: celestialAlpha(celestial.night, 0.94),
      borderColor: celestialAlpha(celestial.gold, 0.38),
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.34,
      shadowRadius: 24,
      elevation: 7,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: `0 18px 44px ${celestialAlpha(celestial.shadow, 0.34)}, inset 0 1px 0 ${celestialAlpha(celestial.gold, 0.12)}` } as any)
        : {}),
    } : {}),
  },
  emptyIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: pixelMode ? 0 : 24,
    backgroundColor: colors.fill,
  
    // aeroBottomTune
    ...(aeroMode ? {
      backgroundColor: celestialAlpha(celestial.ivory, 0.66),
      borderWidth: 1,
      borderColor: celestialAlpha(celestial.ivory, 0.98),
    } : {}),
    // forkN1CelestialHomeCommandBellV1_emptyIcon
    ...(celestialMode ? { backgroundColor: celestialAlpha(celestial.gold, 0.08), borderWidth: 1, borderColor: celestialAlpha(celestial.gold, 0.28) } : {}),
  },
  emptyIconText: {
    color: colors.text,
    fontSize: 24,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '400',
  
    // aeroBottomTune
    ...(aeroMode ? {
      color: homeAccent,
    } : {}),
    // forkKDarkBackgroundContrastV1_emptyIconText
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_emptyIconText
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  emptyTitle: {
    marginTop: 16,
    color: colors.text,
    fontSize: 19,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
  
    // aeroBottomTune
    ...(aeroMode ? {
      color: '#073B70',
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      fontWeight: '700',
      letterSpacing: -0.2,
    } : {}),
    // aeroBottomTypeV3
    ...(aeroMode ? {
      color: homeAccent,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: Platform.OS === 'web' ? 18 : 17,
      lineHeight: 23,

      fontWeight: '700',
      letterSpacing: -0.15,
    } : {}),
    // aeroBottomVisibilityV1
    ...(aeroMode ? {
      color: homeAccent,

      fontSize: Platform.OS === 'web' ? 20 : 18,
      lineHeight: 25,

      fontWeight: '800',

      textShadowColor: celestialAlpha(celestial.ivory, 0.88),
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 5,
    } : {}),
    // forkKDarkBackgroundContrastV1_emptyTitle
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_emptyTitle
    ...(celestialMode ? {
      color: celestial.ivory,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  emptyMessage: {
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  
    // aeroBottomTune
    ...(aeroMode ? {
      color: colors.textMuted,
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      fontWeight: '400',
    } : {}),
    // aeroBottomTypeV3
    ...(aeroMode ? {
      color: colors.textMuted,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: 13,
      lineHeight: 20,
      fontWeight: '400',
    } : {}),
    // aeroBottomVisibilityV1
    ...(aeroMode ? {
      color: homeAccent,

      fontSize: Platform.OS === 'web' ? 14 : 13,
      lineHeight: 21,

      fontWeight: '500',

      textShadowColor: celestialAlpha(celestial.ivory, 0.86),
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    } : {}),
    // forkKDarkBackgroundContrastV1_emptyMessage
    ...(isDarkBackground && !aeroMode ? {
      color: colors.textMuted,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_emptyMessage
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.62) } : {}),
  },
  emptyButton: {
    minHeight: 46,
    marginTop: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: pixelMode ? 0 : 14,
    backgroundColor: colors.black,
  
    // aeroBottomTune
    ...(aeroOcean ? {
      backgroundColor: '#0784A6',
      borderWidth: 1,
      borderColor: celestialAlpha(celestial.ivory, 0.92),
      shadowColor: '#8CE9FF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 9,
    } : {}),
    // aeroBottomTypeV3
    ...(aeroOcean ? {
      backgroundColor: '#078BAD',

      borderWidth: 1,
      borderColor: celestialAlpha(celestial.ivory, 0.96),

      shadowColor: '#8CEBFF',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.22,
      shadowRadius: 9,

      ...(Platform.OS === 'web'
        ? ({
            boxShadow: `0 5px 13px rgba(0,145,205,0.22), 0 0 13px ${celestialAlpha(celestial.ivory, 0.48)}`,
          } as any)
        : {}),
    } : {}),
    // aeroBottomVisibilityV1
    ...(aeroOcean ? {
      backgroundColor: colors.black,

      minHeight: Platform.OS === 'web' ? 46 : 44,

      paddingHorizontal:
        Platform.OS === 'web' ? 24 : 22,

      borderWidth: 1,
      borderColor: 'rgba(226,252,255,0.98)',

      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 7 },
      shadowOpacity: 0.34,
      shadowRadius: 12,

      ...(Platform.OS === 'web'
        ? ({
            boxShadow: `0 6px 14px rgba(0,116,195,0.24), 0 0 12px rgba(169,244,255,0.66), inset 0 1px 0 ${celestialAlpha(celestial.ivory, 0.72)}`,
          } as any)
        : {}),
    } : {}),
    // forkN1CelestialHomeCommandBellV1_emptyButton
    ...(celestialMode ? { backgroundColor: celestial.gold } : {}),
  },    // meadowNoGlowV1

  emptyButtonPressed: {
    opacity: 0.78,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
  
    // aeroBottomTypeV3
    ...(aeroMode ? {
      color: '#FFFFFF',

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.05,
    } : {}),
    // aeroBottomVisibilityV1
    ...(aeroMode ? {
      color: '#FFFFFF',

      fontSize: Platform.OS === 'web' ? 14 : 13,

      fontWeight: '800',

      textShadowColor: 'rgba(0,73,140,0.48)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    } : {}),
    // forkN1CelestialHomeCommandBellV1_emptyButtonText
    ...(celestialMode ? { color: celestial.onAccent } : {}),
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 15,
    color: colors.textMuted,
    fontSize: 14,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorMark: {
    width: 52,
    height: 52,
    borderRadius: pixelMode ? 0 : 26,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    fontSize: 27,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '700',
    lineHeight: 52,
    textAlign: 'center',
  },
  errorTitle: {
    marginTop: 17,
    color: colors.text,
    fontSize: 21,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
  },
  errorStateMessage: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 48,
    marginTop: 22,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: pixelMode ? 0 : 14,
    backgroundColor: colors.black,
  },
  retryPressed: {
    opacity: 0.78,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
  },
  catalogueFallback: {
    marginTop: 16,
    padding: 10,
  },
  catalogueFallbackText: {
    color: colors.text,
    fontSize: 14,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '700',
  },
  recentSection: {
    marginTop: 30,
    paddingBottom: 8,
  },
  recentHeadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingHorizontal: 3,
  },
  recentHeadingCopy: {
    flex: 1,
  },
  recentKicker: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  
    // aeroBottomTune
    ...(aeroMode ? {
      color: colors.textMuted,
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
    } : {}),
    // aeroBottomTypeV3
    ...(aeroMode ? {
      color: colors.textMuted,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.45,
    } : {}),
    // aeroBottomVisibilityV1
    ...(aeroMode ? {
      color: homeAccent,

      fontSize: Platform.OS === 'web' ? 11 : 10,
      lineHeight: 14,

      fontWeight: '800',
      letterSpacing: 1.8,

      textShadowColor: celestialAlpha(celestial.ivory, 0.96),
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,

      ...(Platform.OS === 'web'
        ? ({
            textShadow:
              '0 0 7px rgba(255,255,255,0.98)',
          } as any)
        : {}),
    } : {}),
    // forkKDarkBackgroundContrastV1_recentKicker
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  },
  recentTitle: {
    marginTop: 2,
    
    
    fontFamily: pixelMode ? 'monospace' : undefined,

    
    letterSpacing: -0.3,
  
    // aeroBottomTune
    ...(aeroMode ? {
      color: '#073B70',
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
      fontWeight: '700',
    } : {}),
    // aeroBottomTypeV3
    ...(aeroMode ? {
      color: homeAccent,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: Platform.OS === 'web' ? 20 : 19,
      lineHeight: 25,

      fontWeight: '700',
      letterSpacing: -0.25,
    } : {}),
    // aeroBottomVisibilityV1
    ...(aeroMode ? {
      color: homeAccent,

      fontSize: Platform.OS === 'web' ? 23 : 21,
      lineHeight: Platform.OS === 'web' ? 28 : 26,

      fontWeight: '800',
      letterSpacing: -0.4,

      textShadowColor: celestialAlpha(celestial.ivory, 0.98),
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 8,

      ...(Platform.OS === 'web'
        ? ({
            textShadow:
              '0 1px 1px rgba(255,255,255,1), 0 0 8px rgba(255,255,255,0.96), 0 0 15px rgba(255,255,255,0.62)',
          } as any)
        : {}),
    } : {}),
    // frutigerRecentTitleTuneV1
    color: homeAccent,
    fontSize: Platform.OS === 'web' ? 24 : 20,
    lineHeight: Platform.OS === 'web' ? 28 : 24,
    fontWeight: '800',
    textShadowColor: celestialAlpha(celestial.ivory, 0.55),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,

    // forkKDarkBackgroundContrastV1_recentTitle
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_recentTitle
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  recentSubtitle: {
    maxWidth: 310,
    marginTop: 4,
    
    
    
  
    // aeroBottomTune
    ...(aeroMode ? {
      color: colors.textMuted,
      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),
    } : {}),
    // aeroBottomTypeV3
    ...(aeroMode ? {
      color: colors.textMuted,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: 12,
      lineHeight: 17,
      fontWeight: '400',
    } : {}),
    // aeroBottomVisibilityV1
    ...(aeroMode ? {
      color: homeAccent,

      fontSize: Platform.OS === 'web' ? 13 : 12,
      lineHeight: 18,

      fontWeight: '500',

      textShadowColor: celestialAlpha(celestial.ivory, 0.98),
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,

      ...(Platform.OS === 'web'
        ? ({
            textShadow:
              '0 0 7px rgba(255,255,255,0.98)',
          } as any)
        : {}),
    } : {}),
    // frutigerRecentTitleTuneV1
    color: homeAccent,
    fontSize: Platform.OS === 'web' ? 24 : 20,
    lineHeight: Platform.OS === 'web' ? 28 : 24,
    fontWeight: '800',
    textShadowColor: celestialAlpha(celestial.ivory, 0.55),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,

    // forkKDarkBackgroundContrastV1_recentSubtitle
    ...(isDarkBackground && !aeroMode ? {
      color: colors.textMuted,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_recentSubtitle
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.62) } : {}),
  },
  recentCount: {
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: pixelMode ? 0 : 14,
    backgroundColor: colors.fillStrong,
  
    // aeroBottomTune
    ...(aeroMode ? {
      backgroundColor: celestialAlpha(celestial.ivory, 0.72),
      borderWidth: 1,
      borderColor: celestialAlpha(celestial.ivory, 0.98),
    } : {}),
    // aeroBottomTypeV3
    ...(aeroMode ? {
      backgroundColor: celestialAlpha(celestial.ivory, 0.67),
      borderWidth: 1,
      borderColor: celestialAlpha(celestial.ivory, 0.97),
    } : {}),
    // aeroBottomVisibilityV1
    ...(aeroMode ? {
      minWidth: 30,
      height: 30,

      backgroundColor: celestialAlpha(celestial.ivory, 0.82),

      borderWidth: 1,
      borderColor: celestialAlpha(celestial.ivory, 0.98),

      shadowColor: '#FFFFFF',
      shadowOpacity: 0.38,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 3 },
    } : {}),
    // forkN1CelestialHomeCommandBellV1_recentCount
    ...(celestialMode ? { backgroundColor: celestialAlpha(celestial.gold, 0.10), borderWidth: 1, borderColor: celestialAlpha(celestial.gold, 0.28) } : {}),
  },
  recentCountText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
  
    // aeroBottomTune
    ...(aeroMode ? {
      color: homeAccent,
    } : {}),
    // aeroBottomTypeV3
    ...(aeroMode ? {
      color: homeAccent,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontWeight: '700',
    } : {}),
    // aeroBottomVisibilityV1
    ...(aeroMode ? {
      color: homeAccent,
      fontSize: 12,
      fontWeight: '800',
    } : {}),
    // forkKDarkBackgroundContrastV1_recentCountText
    ...(isDarkBackground && !aeroMode ? {
      color: colors.text,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
      ...(Platform.OS === 'web'
        ? ({ textShadow: 'none' } as any)
        : {}),
    } : {}),
  
    // forkN1CelestialHomeCommandBellV1_recentCountText
    ...(celestialMode ? {
      color: celestial.gold,
      textShadowColor: 'transparent',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    } : {}),
  },
  recentEmpty: {
    padding: 17,
    borderRadius: pixelMode ? 0 : 16,
    backgroundColor: colors.fill,
  
    // forkN1CelestialHomeCommandBellV1_recentEmpty
    ...(celestialMode ? { backgroundColor: celestialAlpha(celestial.night, 0.94), borderWidth: 1, borderColor: celestialAlpha(celestial.gold, 0.24) } : {}),
  },
  recentEmptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  
    // forkN1CelestialHomeCommandBellV1_recentEmptyText
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.62) } : {}),
  },


  // meadowHomeAlignmentV3
  meadowGlassCardV3: {
    backgroundColor:
      Platform.OS === 'web'
        ? 'rgba(255,255,255,0.62)'
        : 'rgba(255,255,255,0.78)',
    borderColor: AERO_GLASS_EDGE,
    borderWidth: 1.25,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 12px 30px rgba(68,72,78,0.13), inset 0 1px 0 rgba(255,255,255,0.98)',
          backdropFilter:
            'blur(14px) saturate(0.32) brightness(1.16)',
        } as any)
      : {}),
  },

  meadowRecentCardV3: {
    backgroundColor:
      Platform.OS === 'web'
        ? 'rgba(255,255,255,0.66)'
        : 'rgba(255,255,255,0.82)',
    borderColor: AERO_GLASS_EDGE,
    borderWidth: 1.25,
    minHeight: Platform.OS === 'web' ? undefined : 76,
  },

  meadowTopRowV3: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Platform.OS === 'web' ? 18 : 10,
  },

  meadowRadioSlotV3: {
    flex: Platform.OS === 'web' ? 0.82 : 0.72,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
      alignSelf: 'stretch',
    aspectRatio: undefined,
    minHeight: Platform.OS === 'web' ? 128 : 118,
},

  meadowTimerSlotV3: {
    flex: Platform.OS === 'web' ? 1.18 : 1.28,
    minWidth: 0,
  },

  meadowRadioImageV3: {
    width: Platform.OS === 'web' ? '88%' : '84%',
    maxWidth: undefined,
    height: Platform.OS === 'web' ? '88%' : '84%',
    resizeMode: 'contain',
    alignSelf: 'center',
      top: Platform.OS === 'web' ? '6%' : '8%',
    left: Platform.OS === 'web' ? '6%' : '8%',
},
  // aeroSearchQuoteTimerHygieneV3:AeroHomeGeometry
  // Meadow V3 made radio + timer side-by-side. Aero returns to the original
  // hierarchy: a large radio row, then a full-width timer row.
  aeroRestoreTopRowV3: {
    flexDirection: 'column',
    alignItems: 'stretch',
    flexWrap: 'nowrap',
    gap: 14,
  },

  aeroRestoreRadioSlotV3: {
    flex: 0,
    width: '100%',
    maxWidth: 520,
    minWidth: 0,
    minHeight:
      Platform.OS === 'web'
        ? 220
        : 190,
    aspectRatio: undefined,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },

  aeroRestoreRadioImageV3: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    maxWidth: undefined,
    resizeMode: 'contain',
    alignSelf: 'center',
  },

  aeroRestoreTimerSlotV3: {
    flex: 0,
    width: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },

  // aeroVistaWhiteGlassV31:Quote
  aeroEmptyQuoteV31: {
    ...(aeroMode ? {
      color: AERO_HOME_ACCENT,
      fontSize:
        Platform.OS === 'web'
          ? 30
          : 26,
      lineHeight:
        Platform.OS === 'web'
          ? 34
          : 30,
      fontWeight: '700',
      letterSpacing: 0,
      opacity: 0.94,
      transform: [
        {
          translateY:
            Platform.OS === 'web'
              ? 38
              : 28,
        },
      ],
    } : {}),
  },


  // aeroProfileActiveNeutralV33

  // ---- PROFILE · neutral Vista graphite --------------------------------
  aeroProfileArrowV33: {
    color: '#686C72',
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
    ...(Platform.OS === 'web'
      ? ({
          textShadow: 'none',
        } as any)
      : {}),
  },

  aeroProfileEyebrowV33: {
    color: '#74777C',
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
    ...(Platform.OS === 'web'
      ? ({
          textShadow: 'none',
        } as any)
      : {}),
  },

  aeroProfileTitleV33: {
    color: '#4E5156',
    textShadowColor: 'rgba(255,255,255,0.58)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    ...(Platform.OS === 'web'
      ? ({
          textShadow:
            '0 1px 0 rgba(255,255,255,0.62)',
        } as any)
      : {}),
  },

  aeroProfileSubtitleV33: {
    color: '#76797E',
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
    ...(Platform.OS === 'web'
      ? ({
          textShadow: 'none',
        } as any)
      : {}),
  },

  // ---- ACTIVE NOW EMPTY STATE · neutral Vista glass -------------------
  aeroEmptyCardV33: {
    backgroundColor:
      Platform.OS === 'web'
        ? 'rgba(255,255,255,0.58)'
        : 'rgba(255,255,255,0.74)',
    borderWidth: 1.25,
    borderColor: 'rgba(105,109,115,0.38)',
    shadowColor: '#FFFFFF',
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 1,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 12px 28px rgba(67,71,77,0.13), inset 0 1px 0 rgba(255,255,255,0.96)',
          backdropFilter:
            'blur(14px) saturate(0.26) brightness(1.12)',
          WebkitBackdropFilter:
            'blur(14px) saturate(0.26) brightness(1.12)',
        } as any)
      : {}),
  },

  aeroEmptyIconV33: {
    backgroundColor:
      'rgba(255,255,255,0.48)',
    borderWidth: 1,
    borderColor:
      'rgba(103,107,113,0.42)',
    shadowColor: '#FFFFFF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },

  aeroEmptyIconTextV33: {
    color: '#62666C',
    textShadowColor: 'transparent',
    textShadowOffset: {
      width: 0,
      height: 0,
    },
    textShadowRadius: 0,
    ...(Platform.OS === 'web'
      ? ({
          textShadow: 'none',
        } as any)
      : {}),
  },

  aeroEmptyTitleV33: {
    color: '#4F5257',
    textShadowColor:
      'rgba(255,255,255,0.46)',
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 1,
    ...(Platform.OS === 'web'
      ? ({
          textShadow:
            '0 1px 0 rgba(255,255,255,0.54)',
        } as any)
      : {}),
  },

  aeroEmptyMessageV33: {
    color: '#6F7277',
    textShadowColor: 'transparent',
    textShadowOffset: {
      width: 0,
      height: 0,
    },
    textShadowRadius: 0,
    ...(Platform.OS === 'web'
      ? ({
          textShadow: 'none',
        } as any)
      : {}),
  },

  aeroEmptyButtonV33: {
    backgroundColor: '#595D63',
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.78)',
    shadowColor: '#FFFFFF',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.10,
    shadowRadius: 7,
    elevation: 1,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 5px 13px rgba(65,69,75,0.18), inset 0 1px 0 rgba(255,255,255,0.25)',
        } as any)
      : {}),
  },

  aeroEmptyButtonTextV33: {
    color: '#F5F5F3',
    textShadowColor: 'transparent',
    textShadowOffset: {
      width: 0,
      height: 0,
    },
    textShadowRadius: 0,
    ...(Platform.OS === 'web'
      ? ({
          textShadow: 'none',
        } as any)
      : {}),
  },

});



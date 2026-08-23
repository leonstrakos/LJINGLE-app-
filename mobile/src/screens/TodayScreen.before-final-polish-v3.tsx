import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { RecentActivityCard } from '../components/RecentActivityCard';
import { activityApi } from '../services/activityApi';
import { entryApi } from '../services/entryApi';
import { statsApi } from '../services/statsApi';
import { colors } from '../theme/colors';
import { activeAeroBackgroundId } from '../theme/aeroBackground';
import { activeVisualSkinId } from '../theme/visualSkins';
import { activeRadioThemeId } from '../theme/radioTheme';
import type { ActivityTimerResponse } from '../types/activity';
import type { Entry } from '../types/entry';
import type { RootStackParamList } from '../types/navigation';
import type { DailyTimeResponse } from '../types/stats';
import { formatDuration } from '../utils/activityTime';
import { semanticFeedback } from '../utils/semanticFeedback';

type Props = NativeStackScreenProps<RootStackParamList, 'Today'>;

const pixelMode = activeVisualSkinId === 'pixel';
const aeroMode = activeVisualSkinId === 'aero';
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
    if (timers.length === 0) return undefined;

    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [timers.length]);

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

  const liveDailyIncrement = Math.max(0, Math.floor((now - dailyMeasuredAt) / 1000));
  const liveDailyTotal = dailyTime
    ? dailyTime.totalSeconds
      + dailyTime.activities.filter((activity) => activity.running).length * liveDailyIncrement
    : 0;

  const header = (
    <>
      <View style={[styles.hero, aeroMode && styles.aeroHero]}>
        {oceanAero ? <AeroAquarium /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Otvori postavke"
          hitSlop={16}
          onPress={() => navigation.navigate('ThemePicker')}
          style={({ pressed }) => [styles.themeButton, pressed && styles.themeButtonPressed]}
        >
          <Text style={styles.themeButtonIcon}>{'\u25D0'}</Text>
        </Pressable>
        <Text style={[styles.date, pixelMode && styles.pixelText]}>{dateLabel}</Text>
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
        <View style={styles.quoteHero}>
          <Text style={[styles.quoteMark, pixelMode && styles.pixelText]}>{pixelMode ? '"' : '\u201C'}</Text>
          <Text style={[styles.quoteText, pixelMode && styles.pixelText]} numberOfLines={4}>
            {dailyQuote?.content ?? 'Dodaj citat u Zapisima i ovdje će se pojavljivati svaki dan.'}
          </Text>
          {dailyQuote?.title ? (
            <Text style={styles.quoteSource}>{dailyQuote.title}</Text>
          ) : null}
        </View>
      </View>



      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pretraži cijeli katalog"
        onPress={() => navigation.navigate('BookSearch')}
        style={({ pressed }) => [styles.globalCatalogueSearch, aeroMode && styles.aeroGlassCard, pressed && styles.quickPressed]}
      >
        {aeroMode ? (
          <AeroReflection variant="search" />
        ) : null}
        <View style={[
          styles.globalSearchIcon,
          oceanAero && styles.aeroSearchIcon,
          oceanAero && styles.aeroOrbShell,
          oceanAero && styles.aeroBubbleHostClean,
        ]}>
          {aeroOcean ? (
            <Image
              
              source={require('../assets/aero/bubble.png')}
              resizeMode="contain"
              style={[styles.aeroBubbleAsset, !oceanAero && { display: 'none' }]}
            />
          ) : null}
          <Text style={[styles.globalSearchIconText, aeroOcean && styles.aeroSearchIconText,
              aeroOcean && styles.aeroSearchMagnifierGray,
            ]}>⌕</Text></View>
        <View style={styles.globalSearchCopy}>
          <Text style={styles.globalSearchTitle}>Pretraži cijeli katalog</Text>
          <Text style={styles.globalSearchSubtitle}>Knjige, filmovi, serije i igre koje si već spremio/la</Text>
        </View>
        <Text style={styles.globalSearchArrow}>›</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Otvori katalog"
        onPress={() => navigation.navigate('Catalogue')}
        style={({ pressed }) => [styles.catalogueCard, aeroMode && styles.aeroGlassCard, pressed && styles.cataloguePressed]}
      >
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
          <View style={styles.catalogueIcon}>
          <View style={styles.bookSpine} />
          <View style={styles.bookSpineWide} />
          <View style={styles.bookSpineShort} />
        </View>
        )}
        <View style={styles.catalogueCopy}>
          <Text style={styles.catalogueEyebrow}></Text>
          <Text style={styles.catalogueTitle}>Katalog</Text>
          <Text style={styles.catalogueSubtitle}>Knjige, filmovi, serije i igre</Text>
        </View>
        <Text style={styles.catalogueArrow}>{'\u203A'}</Text>
      </Pressable>


      <View style={styles.radioTimerRow}>
        {aeroMode ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Otvori Memory Radio"
          onPress={() => navigation.navigate('MemoryRadio')}
          style={({ pressed }) => [
            styles.aeroRadioImageButton,
            pressed && styles.quickPressed,
          ]}
        >
          <Image
            
            source={
              aeroMeadow
                ? require('../assets/aero/radio-meadow.png')
                : require('../assets/aero/radio.png')
            }
            resizeMode={aeroMeadow ? 'contain' : 'stretch'}
            style={[
              styles.aeroRadioImage,
              aeroMeadow && styles.aeroMeadowRadioImage,
            ]}
          />
        </Pressable>
      ) : (
        <Pressable
        accessibilityRole="button"
        accessibilityLabel="Otvori Memory Radio"
        onPress={() => navigation.navigate('MemoryRadio')}
        style={({ pressed }) => [
          styles.memoryRadioCard,
          !pixelMode &&
            Platform.OS !== 'web' &&
            styles.classicMobileRadioCompact,
          radioInverted && {
            backgroundColor: colors.surface,
            borderColor: colors.navy,
          },
          pressed && styles.quickPressed,
        ]}
      >
        <View style={styles.radioAntenna} />

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
            radioInverted && { backgroundColor: colors.navy },
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
          >15.9305</Text>
          <Text
            style={[
              styles.radioStation,
              radioInverted && { color: 'rgba(255,255,255,0.72)' },
            ]}
          >MEMORY RADIO ? FM</Text>

          <View
            style={[
              styles.radioSignal,
              radioInverted && {
                backgroundColor: 'rgba(255,255,255,0.24)',
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
              backgroundColor: colors.navy,
              borderColor: colors.navy,
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
            radioInverted && { color: colors.navy },
          ]}
        >TAP TO TUNE IN</Text>
      </Pressable>
      )}

        <View style={styles.timerColumn}>
          <View style={[styles.dailyCard, styles.dailyCardInRow, aeroMode && styles.aeroTimerGlass]}>
          {aeroMode ? (
            <AeroReflection variant="daily" />
          ) : null}
        
        {pixelMode ? <Text style={styles.pixelBuffer}>██████░░░░ MEMORY BUFFER</Text> : null}
        {aeroMode ? (
          <Image
            
            source={require('../assets/aero/timer.png')}
            resizeMode="cover"
            style={Platform.OS === 'web' ? styles.aeroTimerMeadowImage : styles.aeroTimerMeadowImageMobile}
          />
        ) : null}

        <View style={styles.dailyHeader}>
          <View>
            <Text style={styles.dailyEyebrow}>Zabilježeno danas</Text>
            <Text style={styles.dailyTotal}>
              {formatDuration(liveDailyTotal)}
            </Text>
          </View>
          <View style={[
            styles.dailyMark,
            oceanAero && styles.aeroBlueOrbShell,
            oceanAero && styles.aeroBlueOrbHost,
          ]}>
            
            {oceanAero ? (
              <Image
                
                source={aeroMeadow ? require('../assets/aero/24-meadow.png') : require('../assets/aero/aero-blue-orb.png')}
                resizeMode="contain"
                style={[styles.aeroBlueOrbImage, aeroMeadow && styles.aeroMeadow24Image, aeroOcean && Platform.OS !== 'web' && styles.aeroDailyOrbMobileFix]}
              />
            ) : null}

            <Text
              style={[
                styles.dailyMarkText,
                oceanAero && styles.aeroBlueOrbText,
              ]}
            >24</Text>
          </View>
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
      </View>
        </View>
      </View>

      <View style={styles.quickGrid}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Topics')}
          style={({ pressed }) => [styles.quickCard, aeroMode && styles.aeroGlassCard, pressed && styles.quickPressed]}
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
          style={({ pressed }) => [styles.quickCard, aeroMode && styles.aeroGlassCard, pressed && styles.quickPressed]}
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

      <View style={[styles.quickGrid, { marginTop: 10 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('History')}
          style={({ pressed }) => [
            styles.quickCard,
            aeroMode && styles.aeroGlassCard,
            pressed && styles.quickPressed,
          ]}
        >
          <Text style={styles.quickSymbol}>{'\u21BA'}</Text>
          <Text style={styles.quickTitle}>Povijest</Text>
          <Text style={styles.quickSubtitle}>Sesije i vremenska crta</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Stats')}
          style={({ pressed }) => [
            styles.quickCard,
            aeroMode && styles.aeroGlassCard,
            pressed && styles.quickPressed,
          ]}
        >
          <Text style={styles.quickSymbol}>{'\u25A5'}</Text>
          <Text style={styles.quickTitle}>Statistika</Text>
          <Text style={styles.quickSubtitle}>Vrijeme, gledanje i trendovi</Text>
        </Pressable>
      </View>

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
          <Text style={styles.recentKicker}>Continue</Text>
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
        <View style={styles.recentEmpty}>
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
    <SafeAreaView style={[styles.safeArea, aeroMode && styles.aeroSafeArea]} edges={['top', 'left', 'right']}>
      {aeroMode ? (
        <>
          <Image
            source={aeroWorldBackgroundSource}
            resizeMode="cover"
            style={styles.aeroWorldBackground}
          />
          <View
            pointerEvents="none"
            style={styles.aeroWorldVeil}
          />
        </>
      ) : null}

      {oceanAero ? <AeroScreenBubbles /> : null}
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
          <View style={styles.emptyCard}>
            {aeroMode ? (
              <AeroReflection variant="soft" />
            ) : null}
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>{'\uFF0B'}</Text>
            </View>
            <Text style={styles.emptyTitle}>Nema aktivnih timera</Text>
            <Text style={styles.emptyMessage}>
              Ništa trenutačno ne bilježi vrijeme. Nastavi nešto nedavno ispod ili
              započni novu aktivnost iz kataloga.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('Catalogue')}
              style={({ pressed }) => [styles.emptyButton, pressed && styles.emptyButtonPressed]}
            >
              <Text style={styles.emptyButtonText}>Otvori katalog</Text>
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

  // ----------------------------------------------------------
  // FINAL AERO MOBILE-ONLY FIT
  // Classic / Pixel / Aero web stay untouched.
  // ----------------------------------------------------------

  aeroTimerMeadowImageMobile: {
    ...StyleSheet.absoluteFillObject,
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
      'rgba(255,255,255,0.20)',

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
      'rgba(255,255,255,0.16)',
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
      'rgba(255,255,255,0.48)',

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
      'rgba(255,255,255,0.40)',
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
      'rgba(255,255,255,0.16)',

    shadowColor: '#F5FEFF',

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
      'rgba(255,255,255,0.11)',
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
      'rgba(255,255,255,0.78)',

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
      'rgba(172,241,255,0.48)',

    shadowColor: '#E9FDFF',

    shadowOffset: {
      width: 0,
      height: -1,
    },

    shadowOpacity: 0.30,
    shadowRadius: 4,
  },

  aeroSearchMagnifierGray: {
    color: colors.navy,

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
            'drop-shadow(0 1px 2px rgba(0,96,190,0.07))',
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
            'drop-shadow(0 7px 9px rgba(0,124,216,0.22)) drop-shadow(0 0 7px rgba(111,240,255,0.32))',
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

    backgroundColor: 'rgba(255,255,255,0.78)',

    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.99)',

    shadowColor: '#8DE7FF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.27,
    shadowRadius: 11,
    elevation: 7,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 5px 14px rgba(65,190,235,0.20), 0 0 18px rgba(255,255,255,0.98), inset 0 2px 4px rgba(255,255,255,0.88), inset 0 -8px 15px rgba(170,225,255,0.17)',
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

    backgroundColor: 'rgba(255,255,255,0.78)',

    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.99)',

    shadowColor: '#8DE7FF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.27,
    shadowRadius: 11,
    elevation: 7,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 5px 14px rgba(65,190,235,0.20), 0 0 18px rgba(255,255,255,0.98), inset 0 2px 4px rgba(255,255,255,0.88), inset 0 -8px 15px rgba(170,225,255,0.17)',
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

    backgroundColor: 'rgba(255,255,255,0.78)',

    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.99)',

    shadowColor: '#8DE7FF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 7,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 5px 13px rgba(65,190,235,0.18), 0 0 17px rgba(255,255,255,0.96), inset 0 2px 4px rgba(255,255,255,0.84)',
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

    backgroundColor: 'rgba(255,255,255,0.96)',

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
          boxShadow:
            '0 7px 17px rgba(0,132,215,0.38), 0 0 15px rgba(110,245,255,0.88), inset 0 2px 5px rgba(255,255,255,0.32)',
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

    backgroundColor: 'rgba(255,255,255,0.72)',

    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.99)',

    shadowColor: '#50DFFF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.34,
    shadowRadius: 10,
    elevation: 7,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 5px 14px rgba(0,145,215,0.24), 0 0 14px rgba(255,255,255,0.98), inset 0 2px 3px rgba(255,255,255,0.75)',
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
  },
  aeroSearchIcon: {
    backgroundColor: 'rgba(246,252,255,0.50)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.99)',

    shadowColor: '#98E5FF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.20,
    shadowRadius: 10,
    elevation: 5,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 4px 12px rgba(120,215,255,0.20), 0 0 16px rgba(255,255,255,0.98), inset 0 1px 0 rgba(255,255,255,1)',
        } as any)
      : {}),
  
    // aeroBubbleScaleTune
    ...({
      width: Platform.OS === 'web' ? 60 : 54,
      height: Platform.OS === 'web' ? 60 : 54,
      borderRadius: Platform.OS === 'web' ? 30 : 27,
    } as any),},
  aeroSearchIconText: {
    color: colors.navy,
  },
  globalSearchCopy: {
    flex: 1,
    marginLeft: 13,
  },
  globalSearchTitle: {
    color: colors.navy,
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
      color: colors.navy,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.25,
    } : {}),
    // aeroHeaderSearchFinalV1
    ...(aeroMode ? {
      color: colors.navy,

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
      color: colors.navy,

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
    } : {}),},
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
      color: colors.navy,

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
    } : {}),},
  globalSearchArrow: {
    color: colors.textMuted,
    fontSize: 28,
    fontFamily: pixelMode ? 'monospace' : undefined,
  
    // aeroV3Override
    ...(aeroMode ? {
      color: colors.navy,
    } : {}),
    // aeroHeaderSearchFinalV1
    ...(aeroMode ? {
      color: colors.navy,
      opacity: 0.92,
    } : {}),
    // aeroHeroTypographyREALV1
    ...(aeroMode ? {
      color: colors.navy,
      opacity: 0.90,
    } : {}),},
  aeroScreenBubbleLayer: { ...StyleSheet.absoluteFillObject, zIndex: 40, overflow: 'hidden', pointerEvents: 'none' },
  screenBubble: { position: 'absolute', borderRadius: 999, borderWidth: 2, shadowColor: '#693CC5', shadowOffset: { width: 4, height: 8 }, shadowOpacity: 0.19, shadowRadius: 12, elevation: 8 },
  screenBubbleRim: { ...StyleSheet.absoluteFillObject, borderRadius: 999, borderWidth: 3, borderTopColor: 'rgba(255,255,255,0.9)', borderLeftColor: 'rgba(255,190,245,0.72)', borderRightColor: 'rgba(126,235,255,0.72)', borderBottomColor: 'rgba(255,235,130,0.58)' },
  screenBubbleGlint: { position: 'absolute', top: '16%', left: '20%', width: '30%', height: '18%', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.82)', transform: [{ rotate: '-28deg' }] },
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
  aeroTimerGlass: {
    minHeight: 152,
    overflow: 'hidden',

    

    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.99)',

    shadowColor: '#9DEBFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 22,
    elevation: 8,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 8px 20px rgba(90,190,235,0.12), 0 0 34px rgba(255,255,255,0.96), inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(210,245,255,0.18)',
          backdropFilter:
            'blur(12px) saturate(0.56) brightness(1.15)',
        } as any)
      : {}),
  
    // aeroTimerMeadowCleanupV2
    
    // aeroTimerSceneV3
    backgroundColor: 'rgba(250,254,255,0.78)',},
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
    backgroundColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.48,
    shadowRadius: 42,
  },
  aeroGlassArc: { position: 'absolute', top: -155, right: -75, width: 310, height: 310, borderRadius: 155, backgroundColor: 'rgba(21,115,218,0.14)', borderWidth: 3, borderColor: 'rgba(255,255,255,0.42)' },
  aeroBubble3d: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(213,250,255,0.27)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.78)', shadowColor: '#006DA8', shadowOffset: { width: 3, height: 6 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 3 },
  aeroBubbleShine: { position: 'absolute', top: '17%', left: '19%', width: '28%', height: '20%', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.82)', transform: [{ rotate: '-24deg' }] },
  aeroBubbleA: { width: 46, height: 46, left: '7%', bottom: 18 },
  aeroBubbleB: { width: 25, height: 25, left: '22%', bottom: 92 },
  aeroBubbleC: { width: 70, height: 70, right: '7%', bottom: 28 },
  aeroBubbleD: { width: 19, height: 19, right: '25%', top: 35 },
  aeroBubbleE: { width: 34, height: 34, right: '42%', bottom: 4 },
  aeroFish: { position: 'absolute', width: 72, height: 38, opacity: 0.72 },
  aeroFishOne: { top: 68, left: 0 },
  aeroFishTwo: { bottom: 23, left: -310, transform: [{ scale: 0.72 }] },
  aeroFishBody: { position: 'absolute', right: 0, top: 4, width: 53, height: 30, borderRadius: 19, backgroundColor: '#FF7A21', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', overflow: 'hidden' },
  aeroFishTail: { position: 'absolute', left: 0, top: 8, width: 0, height: 0, borderTopWidth: 11, borderBottomWidth: 11, borderRightWidth: 20, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: '#FF7A21' },
  aeroFishStripeOne: { position: 'absolute', left: 12, top: -2, width: 7, height: 34, backgroundColor: '#FFFFFF', transform: [{ rotate: '8deg' }] },
  aeroFishStripeTwo: { position: 'absolute', right: 12, top: -2, width: 7, height: 34, backgroundColor: '#FFFFFF', transform: [{ rotate: '-8deg' }] },
  aeroFishEye: { position: 'absolute', right: 6, top: 7, width: 5, height: 5, borderRadius: 3, backgroundColor: '#132B38' },
  aeroGlassCard: {
    borderRadius: 30,
    overflow: 'hidden',

    backgroundColor: 'rgba(248,253,255,0.34)',

    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.96)',

    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 8px 20px rgba(90,190,235,0.12), 0 0 34px rgba(255,255,255,0.96), inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(210,245,255,0.18)',
          backdropFilter:
            'blur(12px) saturate(0.56) brightness(1.14)',
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
    backgroundColor: aeroMode ? 'rgba(255,255,255,0.58)' : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: aeroMode ? 'rgba(255,255,255,0.9)' : colors.separator,
  
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
        'rgba(255,255,255,0.72)',

      borderColor:
        'rgba(255,255,255,0.98)',

      shadowColor: '#FFFFFF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 9,

      ...(Platform.OS === 'web'
        ? ({
            boxShadow:
              '0 4px 14px rgba(31,139,202,0.16), 0 0 12px rgba(255,255,255,0.54)',
          } as any)
        : {}),
    } : {}),},
  themeButtonPressed: { opacity: 0.65, transform: [{ scale: 0.96 }] },
  themeButtonIcon: { color: colors.black, fontSize: 22, fontWeight: '800' ,
    // aeroBreathingRoomV1
    ...(aeroMode ? {
      color: colors.navy,

      fontSize:
        Platform.OS === 'web'
          ? 23
          : 22,

      fontWeight: '800',

      textShadowColor:
        'rgba(255,255,255,0.72)',

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 3,
    } : {}),},
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
      color: colors.navy,

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
        'rgba(255,255,255,0.98)',

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
      color: colors.navy,

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
        'rgba(255,255,255,0.98)',

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 5,
    } : {}),
    // aeroHeroTypographyREALV1
    ...(aeroMode ? {
      color: colors.navy,

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

      textShadowColor: 'rgba(255,255,255,0.78)',

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
    color: colors.navy,
    fontSize: Platform.OS === 'web' ? 20 : 16,
    lineHeight: Platform.OS === 'web' ? 24 : 20,
    fontWeight: '800',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(255,255,255,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,


    // aeroSearchDateMicroV1
    ...(aeroMode ? {
      alignSelf: 'center',

      width: '100%',

      textAlign: 'center',

      color: colors.navy,

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
    } : {}),},
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
      color: colors.navy,

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
        'rgba(255,255,255,0.78)',

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 4,
    } : {}),
    // aeroHeroTypographyREALV1
    ...(aeroMode ? {
      color: colors.navy,

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

      textShadowColor: 'rgba(255,255,255,0.58)',

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 2,
    } : {}),
    // frutigerQuoteMarkTuneV1
    color: colors.navy,
    fontSize: Platform.OS === 'web' ? 34 : 28,
    lineHeight: Platform.OS === 'web' ? 36 : 30,
    fontWeight: '800',
    opacity: 0.96,
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
      color: colors.navy,
      fontWeight: '700',
      letterSpacing: -0.25,
    } : {}),
    // aeroHeaderSearchFinalV1
    ...(aeroMode ? {
      color: colors.navy,

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
        'rgba(255,255,255,0.98)',

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 6,
    } : {}),
    // aeroHeroTypographyREALV1
    ...(aeroMode ? {
      color: colors.navy,

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

      textShadowColor: 'rgba(255,255,255,0.70)',

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
    color: colors.navy,
    fontSize: Platform.OS === 'web' ? 28 : 22,
    lineHeight: Platform.OS === 'web' ? 34 : 28,
    fontWeight: '700',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(255,255,255,0.72)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
},
  quoteSource: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  },  catalogueCard: {
    minHeight: 112,
    marginTop: 25,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: pixelMode ? 0 : 20,
    backgroundColor: aeroMode ? 'rgba(255,255,255,0.58)' : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: aeroMode ? 'rgba(255,255,255,0.9)' : colors.separator,
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
  },
  bookSpine: {
    width: 7,
    height: 31,
    borderRadius: pixelMode ? 0 : 2,
    backgroundColor: colors.white,
  },
  bookSpineWide: {
    width: 10,
    height: 38,
    marginLeft: 4,
    borderRadius: pixelMode ? 0 : 2,
    backgroundColor: '#8E8E93',
  },
  bookSpineShort: {
    width: 8,
    height: 26,
    marginLeft: 4,
    borderRadius: pixelMode ? 0 : 2,
    backgroundColor: '#D1D1D6',
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
      color: colors.navy,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '700',
      letterSpacing: -0.2,
    } : {}),},
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
    } : {}),},
  catalogueArrow: {
    marginLeft: 8,
    color: colors.textMuted,
    fontSize: 31,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '300',
  
    // aeroV3Override
    ...(aeroMode ? {
      color: colors.navy,
    } : {}),},
  dailyCard: {
    marginTop: 14,
    padding: 18,
    borderRadius: pixelMode ? 0 : 20,
    backgroundColor: aeroMode ? 'rgba(255,255,255,0.58)' : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: aeroMode ? 'rgba(255,255,255,0.9)' : colors.separator,
  
    // aeroTimerRefTune
    ...(aeroMode ? {
      paddingHorizontal: Platform.OS === 'web' ? 28 : 20,
      paddingTop: Platform.OS === 'web' ? 24 : 19,
      paddingBottom: Platform.OS === 'web' ? 22 : 18,
    } : {}),},
  // catalogueSearchDeleteV1Applied
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
      color: colors.navy,
      fontWeight: '700',
      letterSpacing: 1.5,
    } : {}),
    // aeroTimerRefTune
    ...(aeroMode ? {
      color: colors.navy,

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
    } : {}),},
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
      color: colors.navy,
      fontWeight: '700',
      letterSpacing: -1.1,
    } : {}),
    // aeroTimerRefTune
    ...(aeroMode ? {
      marginTop: 8,

      color: colors.navy,

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
    } : {}),},
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
            boxShadow:
              '0 6px 15px rgba(0,126,210,0.34), 0 0 9px rgba(115,246,255,0.88), inset 0 2px 4px rgba(255,255,255,0.38)',
          } as any)
        : {}),
    } : {}),},
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
    } : {}),},
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
    } : {}),},
  dailyValue: {
    color: colors.navy,
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
      color: colors.navy,
      fontWeight: '700',
    } : {}),
    // aeroTimerRefTune
    ...(aeroMode ? {
      color: colors.navy,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: Platform.OS === 'web' ? 15 : 13,

      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.15,
    } : {}),},
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
    zIndex: 2},
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
    backgroundColor: aeroMode ? 'rgba(255,255,255,0.58)' : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: aeroMode ? 'rgba(255,255,255,0.9)' : colors.separator,
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
    backgroundColor: colors.navy,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: colors.navy,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: pixelMode ? 0.85 : 0.12,
    shadowRadius: pixelMode ? 0 : 18,
    elevation: 4,
  },
  // classicMobileRadioCompactV1
  classicMobileRadioCompact: {
    transform: [{ scale: 0.88 }],
    marginTop: 18,
    marginBottom: -10,
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
  },
  radioSpeakerHole: {
    width: 5,
    height: 5,
    borderRadius: pixelMode ? 0 : 3,
    backgroundColor: colors.navy,
  },
  radioDisplay: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: pixelMode ? 0 : 17,
    backgroundColor: aeroMode ? 'rgba(255,255,255,0.58)' : colors.surface,
  },
  radioBand: {
    color: colors.navy,
    fontSize: 8,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '900',
    letterSpacing: 1.1,
  },
  radioFrequency: {
    marginTop: 2,
    color: colors.text,
    fontSize: 30,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '900',
    letterSpacing: -1.2,
  },
  radioStation: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
    letterSpacing: 0.7,
  },
  radioSignal: {
    height: 4,
    marginTop: 8,
    overflow: 'hidden',
    borderRadius: pixelMode ? 0 : 4,
    backgroundColor: colors.fill,
  },
  radioSignalActive: {
    width: '58%',
    height: '100%',
    borderRadius: pixelMode ? 0 : 4,
    backgroundColor: colors.navy,
  },
  radioKnob: {
    width: 50,
    height: 50,
    alignItems: 'center',
    borderRadius: pixelMode ? 0 : 25,
    backgroundColor: aeroMode ? 'rgba(255,255,255,0.58)' : colors.surface,
    borderWidth: 5,
    borderColor: colors.black,
  },
  radioKnobMark: {
    width: 3,
    height: 13,
    borderRadius: pixelMode ? 0 : 2,
    backgroundColor: colors.navy,
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
  },

  quickWideCard: {
    minHeight: 82,
    marginTop: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: pixelMode ? 0 : 18,
    backgroundColor: aeroMode ? 'rgba(255,255,255,0.58)' : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: aeroMode ? 'rgba(255,255,255,0.9)' : colors.separator,
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
      color: colors.navy,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.15,
    } : {}),},
  quickWideArrow: {
    color: colors.textMuted,
    fontSize: 29,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '300',
    marginLeft: 8,
  
    // aeroV3Override
    ...(aeroMode ? {
      color: colors.navy,
    } : {}),},
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
      color: colors.navy,
    } : {}),},
  quickTitle: {
    marginTop: 11,
    color: colors.navy,
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
      color: colors.navy,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.15,
    } : {}),},
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
    } : {}),},
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
      color: colors.navy,

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
      color: colors.navy,

      fontSize: Platform.OS === 'web' ? 23 : 21,
      lineHeight: Platform.OS === 'web' ? 29 : 27,

      fontWeight: '800',
      letterSpacing: -0.45,

      textShadowColor: 'rgba(255,255,255,0.98)',
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
    color: colors.navy,
    fontSize: Platform.OS === 'web' ? 24 : 20,
    lineHeight: Platform.OS === 'web' ? 28 : 24,
    fontWeight: '800',
    textShadowColor: 'rgba(255,255,255,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
  },
  countText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
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
    backgroundColor: aeroMode ? 'rgba(255,255,255,0.58)' : colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: aeroMode ? 'rgba(255,255,255,0.9)' : colors.separator,
  
    // aeroBottomTune
    ...(aeroMode ? {
      backgroundColor: 'rgba(255,255,255,0.46)',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.98)',

      shadowColor: '#A9E8FF',
      shadowOffset: { width: 0, height: 9 },
      shadowOpacity: 0.14,
      shadowRadius: 20,
      elevation: 7,

      ...(Platform.OS === 'web'
        ? ({
            boxShadow:
              '0 8px 20px rgba(70,165,210,0.13), 0 0 28px rgba(255,255,255,0.90), inset 0 1px 0 rgba(255,255,255,1)',
            backdropFilter:
              'blur(10px) saturate(0.78) brightness(1.10)',
          } as any)
        : {}),
    } : {}),},
  emptyIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: pixelMode ? 0 : 24,
    backgroundColor: colors.fill,
  
    // aeroBottomTune
    ...(aeroMode ? {
      backgroundColor: 'rgba(255,255,255,0.66)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.98)',
    } : {}),},
  emptyIconText: {
    color: colors.text,
    fontSize: 24,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '400',
  
    // aeroBottomTune
    ...(aeroMode ? {
      color: colors.navy,
    } : {}),},
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
      color: colors.navy,

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
      color: colors.navy,

      fontSize: Platform.OS === 'web' ? 20 : 18,
      lineHeight: 25,

      fontWeight: '800',

      textShadowColor: 'rgba(255,255,255,0.88)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 5,
    } : {}),},
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
      color: colors.navy,

      fontSize: Platform.OS === 'web' ? 14 : 13,
      lineHeight: 21,

      fontWeight: '500',

      textShadowColor: 'rgba(255,255,255,0.86)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    } : {}),},
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
      borderColor: 'rgba(255,255,255,0.92)',
      shadowColor: '#8CE9FF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 9,
    } : {}),
    // aeroBottomTypeV3
    ...(aeroOcean ? {
      backgroundColor: '#078BAD',

      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.96)',

      shadowColor: '#8CEBFF',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.22,
      shadowRadius: 9,

      ...(Platform.OS === 'web'
        ? ({
            boxShadow:
              '0 5px 13px rgba(0,145,205,0.22), 0 0 13px rgba(255,255,255,0.48)',
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
            boxShadow:
              '0 6px 14px rgba(0,116,195,0.24), 0 0 12px rgba(169,244,255,0.66), inset 0 1px 0 rgba(255,255,255,0.72)',
          } as any)
        : {}),
    } : {}),},    // meadowNoGlowV1

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
    } : {}),},
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
      color: colors.navy,

      fontSize: Platform.OS === 'web' ? 11 : 10,
      lineHeight: 14,

      fontWeight: '800',
      letterSpacing: 1.8,

      textShadowColor: 'rgba(255,255,255,0.96)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,

      ...(Platform.OS === 'web'
        ? ({
            textShadow:
              '0 0 7px rgba(255,255,255,0.98)',
          } as any)
        : {}),
    } : {}),},
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
      color: colors.navy,

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
      color: colors.navy,

      fontSize: Platform.OS === 'web' ? 23 : 21,
      lineHeight: Platform.OS === 'web' ? 28 : 26,

      fontWeight: '800',
      letterSpacing: -0.4,

      textShadowColor: 'rgba(255,255,255,0.98)',
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
    color: colors.navy,
    fontSize: Platform.OS === 'web' ? 24 : 20,
    lineHeight: Platform.OS === 'web' ? 28 : 24,
    fontWeight: '800',
    textShadowColor: 'rgba(255,255,255,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
      color: colors.navy,

      fontSize: Platform.OS === 'web' ? 13 : 12,
      lineHeight: 18,

      fontWeight: '500',

      textShadowColor: 'rgba(255,255,255,0.98)',
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
    color: colors.navy,
    fontSize: Platform.OS === 'web' ? 24 : 20,
    lineHeight: Platform.OS === 'web' ? 28 : 24,
    fontWeight: '800',
    textShadowColor: 'rgba(255,255,255,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
      backgroundColor: 'rgba(255,255,255,0.72)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.98)',
    } : {}),
    // aeroBottomTypeV3
    ...(aeroMode ? {
      backgroundColor: 'rgba(255,255,255,0.67)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.97)',
    } : {}),
    // aeroBottomVisibilityV1
    ...(aeroMode ? {
      minWidth: 30,
      height: 30,

      backgroundColor: 'rgba(255,255,255,0.82)',

      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.98)',

      shadowColor: '#FFFFFF',
      shadowOpacity: 0.38,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 3 },
    } : {}),},
  recentCountText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: pixelMode ? 'monospace' : undefined,

    fontWeight: '800',
  
    // aeroBottomTune
    ...(aeroMode ? {
      color: colors.navy,
    } : {}),
    // aeroBottomTypeV3
    ...(aeroMode ? {
      color: colors.navy,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontWeight: '700',
    } : {}),
    // aeroBottomVisibilityV1
    ...(aeroMode ? {
      color: colors.navy,
      fontSize: 12,
      fontWeight: '800',
    } : {}),},
  recentEmpty: {
    padding: 17,
    borderRadius: pixelMode ? 0 : 16,
    backgroundColor: colors.fill,
  },
  recentEmptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});


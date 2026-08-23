import {
  useMemo,
  useRef } from 'react';
import {
  Image,
  Platform,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
  PanResponder,
} from 'react-native';

import { activityAccents, colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import type { ActivityTimerResponse } from '../types/activity';
import { formatDuration } from '../utils/activityTime';

const pixelMode = activeVisualSkinId === 'pixel';
const aeroMode = activeVisualSkinId === 'aero';

type Props = {
  activity: ActivityTimerResponse;
  starting: boolean;
  onStart: () => void;
  onDismiss: () => void;
};

const activityLabels: Record<ActivityTimerResponse['activityType'], string> = {
  READING: 'Čitanje',
  WATCHING: 'Gledanje',
  STUDYING: 'Učenje',
  PLAYING: 'Igranje',
  RESEARCH: 'Istraživanje',
  WORK: 'Rad',
  EXERCISE: 'Vježbanje',
  CUSTOM: 'Aktivnost',
};

export function RecentActivityCard({ activity, starting, onStart, onDismiss }: Props) {
  const accent = activityAccents[activity.activityType];


  // recentSwipeDismissV1 — either horizontal direction dismisses Continue only; history stays intact.
  const translateX = useRef(new Animated.Value(0)).current;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !starting && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25,
        onPanResponderMove: (_, gesture) => translateX.setValue(gesture.dx),
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) >= 72) {
            Animated.timing(translateX, {
              toValue: gesture.dx < 0 ? -520 : 520,
              duration: 170,
              useNativeDriver: true,
            }).start(() => {
              translateX.setValue(0);
              onDismiss();
            });
            return;
          }
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            speed: 22,
            bounciness: 5,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [onDismiss, starting, translateX],
  );
  return (
    <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
    <View style={[styles.card, aeroMode && styles.aeroCard]}>
      <View style={[styles.symbol, { backgroundColor: accent.background }]}>
        <View style={[styles.symbolDot, { backgroundColor: accent.foreground }]} />
      </View>

      <View style={styles.copy}>
        <Text style={[styles.type, { color: accent.foreground }]}>
          {activityLabels[activity.activityType]}
        </Text>
        <Text style={styles.label} numberOfLines={1}>
          {activity.label}
        </Text>
        <Text style={styles.total}>{formatDuration(activity.totalSeconds)} ukupno</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Nastavi ${activity.label}`}
        disabled={starting || !activity.activityId}
        onPress={onStart}
        style={({ pressed }) => [

          styles.continueButton,
          { backgroundColor: accent.foreground },
          pressed && styles.continuePressed,
          starting && styles.continueDisabled,
        aeroMode && styles.aeroPlayButtonOverride,
      ]}
      >
      {aeroMode ? (
        <Image
          
          source={require('../assets/aero/play.png')}
          resizeMode="contain"
          style={styles.aeroPlayOrbImage}
        />
      ) : null}
        {starting ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={[
          styles.continueIcon,
          aeroMode && styles.aeroPlayGlyphHidden,
        ]}>▶</Text>
        )}
      </Pressable>
    </View>
    </Animated.View>
  );
}

// aeroRecentPlayV3Applied
// aeroPlayScaleV1Applied
// aeroPlayRepairV2Applied
// aeroPlayContainLOCKV1
const styles = StyleSheet.create({

  aeroPlayButtonOverride: {
    position: 'relative',

    width:
      Platform.OS === 'web'
        ? 44
        : 42,

    height:
      Platform.OS === 'web'
        ? 44
        : 42,

    minWidth:
      Platform.OS === 'web'
        ? 44
        : 42,

    borderRadius:
      Platform.OS === 'web'
        ? 22
        : 21,

    marginRight:
      Platform.OS === 'web'
        ? 12
        : 8,

    alignSelf: 'center',

    alignItems: 'center',
    justifyContent: 'center',

    overflow: 'visible',

    backgroundColor: 'transparent',

    borderWidth: 0,
    borderColor: 'transparent',

    padding: 0,

    transform: [
      {
        translateY:
          Platform.OS === 'web'
            ? -2
            : -1,
      },
    ],

    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow: 'none',
        } as any)
      : {}),
  },

  aeroPlayOrbImage: {
    position: 'absolute',

    width: '100%',
    height: '100%',

    top: 0,
    left: 0,

    opacity: 0.82,

    zIndex: 5,

    transform: [
      {
        scale:
          Platform.OS === 'web'
            ? 5.0
            : 4.7,
      },
    ],

    ...(Platform.OS === 'web'
      ? ({
          filter:
            'drop-shadow(0 6px 6px rgba(255,255,255,0.48)) drop-shadow(0 2px 5px rgba(55,210,255,0.26))',
        } as any)
      : {
          shadowColor: '#FFFFFF',
          shadowOffset: {
            width: 0,
            height: 5,
          },
          shadowOpacity: 0.38,
          shadowRadius: 7,
        }),
  },

  aeroPlayGlyphHidden: {
    opacity: 0,
  },
  card: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    padding: 13,
    borderRadius: pixelMode ? 0 : 18,
    backgroundColor: colors.surface,
    borderWidth: pixelMode ? 2 : 1,
    borderColor: pixelMode ? colors.text : colors.separator,
  },
  aeroCard: {
    borderRadius: 28,

    backgroundColor: 'rgba(255,255,255,0.28)',

    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.98)',

    shadowColor: '#A7ECFF',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.11,
    shadowRadius: 16,
    elevation: 6,

    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 6px 16px rgba(80,175,220,0.10), 0 0 24px rgba(255,255,255,0.90), inset 0 1px 0 rgba(255,255,255,1)',
          backdropFilter:
            'blur(10px) saturate(0.66) brightness(1.13)',
        } as any)
      : {}),
  },
  symbol: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: pixelMode ? 0 : 15,
  },
  symbolDot: {
    width: 12,
    height: 12,
    borderRadius: pixelMode ? 0 : 6,
  },
  copy: {
    flex: 1,
    marginHorizontal: 13,
  },
  type: {
    fontSize: 10,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '900',
    letterSpacing: 0.65,
    textTransform: 'uppercase',
  
    // aeroRecentTypeV3
    ...(aeroMode ? {
      color: colors.navy,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: 10,
      lineHeight: 14,

      fontWeight: '700',
      letterSpacing: 1.4,
    } : {}),
    // aeroRecentVisibilityV1
    ...(aeroMode ? {
      color: colors.navy,

      fontSize: Platform.OS === 'web' ? 11 : 10,
      lineHeight: 15,

      fontWeight: '800',
      letterSpacing: 1.45,

      textShadowColor: 'rgba(255,255,255,0.90)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    } : {}),},
  label: {
    marginTop: 2,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '700',
  
    // aeroRecentTypeV3
    ...(aeroMode ? {
      color: colors.navy,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: Platform.OS === 'web' ? 15 : 14,
      lineHeight: 20,

      fontWeight: '700',
      letterSpacing: -0.15,
    } : {}),
    // aeroRecentVisibilityV1
    ...(aeroMode ? {
      color: colors.navy,

      fontSize: Platform.OS === 'web' ? 16 : 15,
      lineHeight: 21,

      fontWeight: '800',
      letterSpacing: -0.2,

      textShadowColor: 'rgba(255,255,255,0.92)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    } : {}),},
  total: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: pixelMode ? 'monospace' : undefined,
    fontWeight: '600',
  
    // aeroRecentTypeV3
    ...(aeroMode ? {
      color: colors.textMuted,

      fontFamily: Platform.select({
        web: 'Segoe UI, Arial, sans-serif',
        android: 'sans-serif',
        ios: 'System',
      }),

      fontSize: 11,
      lineHeight: 15,

      fontWeight: '500',
    } : {}),
    // aeroRecentVisibilityV1
    ...(aeroMode ? {
      color: colors.navy,

      fontSize: Platform.OS === 'web' ? 12 : 11,
      lineHeight: 16,

      fontWeight: '600',

      textShadowColor: 'rgba(255,255,255,0.84)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    } : {}),},
  continueButton: {
    width: 43,
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: pixelMode ? 0 : 22,
  },
  continuePressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  continueDisabled: {
    opacity: 0.6,
  },
  continueIcon: {
    marginLeft: 2,
    color: colors.white,
    fontSize: 13,
    fontFamily: pixelMode ? 'monospace' : undefined,
  },
});

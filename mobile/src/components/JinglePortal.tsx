// ljingleCataloguePdfInteractionFixR1
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../theme/colors';
import { JingleBellIcon } from './JingleBellIcon';

import { activeVisualSkinId } from '../theme/visualSkins';
import { semanticFeedback } from '../utils/semanticFeedback';
import {
  isPaletteInteractionLocked,
  subscribePaletteInteractionLock,
} from '../utils/paletteInteractionLock';
import {
  getJingleBackgroundEnabled,
  subscribeJingleBackgroundEnabled,
} from '../services/jinglePortalStylePreference';
import { celestial, celestialAlpha } from '../theme/celestial';
import { BellSearchGlyph } from './BellSearchGlyph';
import { CollectionMemoryBoxGlyph } from './CollectionMemoryBoxGlyph';
import { FirstRunTutorial } from './FirstRunTutorial';
import { useMemoryAudio } from '../audio/MemoryAudioProvider';
import { CompletionCelebrationOverlay } from './CompletionCelebrationOverlay';
import { SemanticAliveOverlay } from './SemanticAliveOverlay';
// completionCelebrationR1:portal-host

// forkN5GlyphReorderV1
// ljingleOnboardingPlayerV1

export type JinglePortalRoute =
  | 'Today'
  | 'JingleNetwork'
  | 'Catalogue'
  | 'Collections'
  | 'BookList'
  | 'Entries'
  | 'Topics'
  | 'Games'
  | 'Media'
  | 'History'
  | 'MemoryRadio'
  | 'Stats'
  | 'ThemePicker';

type Props = {
  onNavigate: (route: JinglePortalRoute) => void;
  onOpenPalette: () => void;
};

const aeroMode = activeVisualSkinId === 'aero';
const celestialMode = (activeVisualSkinId === 'classic' || activeVisualSkinId === 'classic-ljingle');
// forkN1CelestialHomeCommandBellV1

// Portal controls follow the currently applied LJingle palette.
const JINGLE_BRAND_NAVY = colors.navy;
const JINGLE_BRAND_GOLD = colors.gold;
const JINGLE_BRAND_GOLD_BORDER = colors.separator;
const webGlassStyle =
  Platform.OS === 'web'
    ? ({
        backdropFilter: 'blur(18px) saturate(1.18)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.18)',
      } as any)
    : null;

// forkOBellCatalogueV1
// Bell Menu is navigation, not a duplicate home screen. Catalogue owns the
// content destinations; the top level stays intentionally small.
type BellDestination = {
  route: JinglePortalRoute;
  mark: string;
  title: string;
  detail: string;
};

const catalogueDestinations: BellDestination[] = [
  {
    route: 'Catalogue',
    mark: '◇',
    title: 'Sve iz kataloga',
    detail: 'Pretraži cijeli osobni katalog',
  },
  {
    route: 'BookList',
    mark: '▣',
    title: 'Knjige',
    detail: 'Čitanje, stranice i bilješke',
  },
  {
    route: 'Media',
    mark: '▷',
    title: 'Filmovi i serije',
    detail: 'Gledanje i spremljeni naslovi',
  },
  {
    route: 'Games',
    mark: '⌘',
    title: 'Igre',
    detail: 'Igranje i vrijeme',
  },
  {
    route: 'Topics',
    mark: '✦',
    title: 'Teme',
    detail: 'Semantički indeks i aktivnosti',
  },
  {
    route: 'Collections',
    mark: '✧',
    title: 'Kolekcije',
    detail: 'Memory boxevi, playliste i zbirke',
  },
];

const primaryDestinations: BellDestination[] = [
  {
    route: 'JingleNetwork',
    mark: '⌁',
    title: 'Jingle Portal',
    detail: 'Ljudi, shared catalogues i primljeni Jingles',
  },
  {
    route: 'Entries',
    mark: '✎',
    title: 'Zapisi',
    detail: 'Misli, citati i opažanja',
  },
  {
    route: 'MemoryRadio',
    mark: '♫',
    title: 'Memory Radio',
    detail: 'Frekvencije, pjesme i zvučna sjećanja',
  },
  {
    route: 'History',
    mark: '⌁',
    title: 'Povijest',
    detail: 'Sesije i tragovi kroz vrijeme',
  },
  {
    route: 'Stats',
    mark: '↗',
    title: 'Profil',
    detail: 'Vrijeme, katalog i osobni trendovi',
  },
];

// jingleLongPressHomeOnlyV1
let suppressJinglePressUntil = 0;

function playerTime(value: number) {
  const safe = Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

// ljingleBrainRadioJingleMotionR1:portal
function PortalTransportGlyphR1({
  playing,
}: {
  playing: boolean;
}) {
  return (
    <View
      pointerEvents="none"
      style={styles.portalTransportGlyphR1}
    >
      {playing ? (
        <>
          <View
            style={[
              styles.portalPauseBarR1,
              styles.portalPauseLeftR1,
            ]}
          />
          <View
            style={[
              styles.portalPauseBarR1,
              styles.portalPauseRightR1,
            ]}
          />
        </>
      ) : (
        <View style={styles.portalPlayTriangleR1} />
      )}
    </View>
  );
}

export function JinglePortal({
  onNavigate,
  onOpenPalette,
}: Props) {
  const audio = useMemoryAudio();
  const [panelVisible, setPanelVisible] = useState(false);
  const [portalInteractionLocked, setPortalInteractionLocked] = useState(isPaletteInteractionLocked());
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [bellBackgroundEnabled, setBellBackgroundEnabled] = useState(false);

  useEffect(() => subscribePaletteInteractionLock(() => {
    const locked = isPaletteInteractionLocked();
    setPortalInteractionLocked(locked);
    if (locked) {
      setPanelVisible(false);
      setCatalogueOpen(false);
    }
  }), []);

  useEffect(() => {
    let active = true;

    void getJingleBackgroundEnabled().then((enabled) => {
      if (active) setBellBackgroundEnabled(enabled);
    });

    const unsubscribe = subscribeJingleBackgroundEnabled((enabled) => {
      if (active) setBellBackgroundEnabled(enabled);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const longPressTriggered = useRef(false);
  const ring = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const playbackMotion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    playbackMotion.stopAnimation();

    if (!audio.playing) {
      Animated.timing(playbackMotion, {
        toValue: 0,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(playbackMotion, {
          toValue: 1,
          duration: 1450,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(playbackMotion, {
          toValue: 0.18,
          duration: 1650,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [audio.playing, playbackMotion]);

  const animateBell = () => {
    ring.stopAnimation();
    scale.stopAnimation();

    ring.setValue(0);
    scale.setValue(1);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(ring, {
          toValue: -1,
          duration: 42,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ring, {
          toValue: 1,
          duration: 52,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ring, {
          toValue: -0.82,
          duration: 48,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ring, {
          toValue: 0.7,
          duration: 46,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ring, {
          toValue: -0.46,
          duration: 44,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ring, {
          toValue: 0.34,
          duration: 42,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(ring, {
          toValue: 0,
          speed: 24,
          bounciness: 6,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.86,
          duration: 55,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(scale, {
          toValue: 1.16,
          speed: 28,
          bounciness: 10,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(scale, {
          toValue: 1,
          speed: 20,
          bounciness: 7,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ]).start();
  };

  // forkGBellInteractionV1
  // The Jingle is an OPEN cue, not a generic button sound. Closing the Bell
  // Menu or moving from it into another destination stays quiet.
  const ringBellOpenCue = () => {
    animateBell();
    // semanticFeedback keeps haptics active even when Sound Effects are off.
    void semanticFeedback.jingle(true);
  };

  const closePanel = () => {
    setPanelVisible(false);
    setCatalogueOpen(false);
  };

  const togglePanel = () => {
    if (panelVisible) {
      closePanel();
      return;
    }

    ringBellOpenCue();
    setPanelVisible(true);
  };

  const openPalette = () => {
    closePanel();
    onOpenPalette();
  };

  const goHomeFromBell = () => {
    closePanel();
    void semanticFeedback.selection();
    onNavigate('Today');
  };

  const rotate = ring.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-19deg', '0deg', '19deg'],
  });


  const renderFloatingBell = (insidePanel = false) => (
    <View pointerEvents={portalInteractionLocked ? 'none' : 'auto'} style={[styles.anchor, insidePanel && styles.anchorOnPanel]}>
      {audio.current ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.playbackBubble,
            !audio.playing && styles.playbackBubblePaused,
            {
              opacity: playbackMotion.interpolate({
                inputRange: [0, 1],
                outputRange: [0.14, 0.40],
              }),
              transform: [
                {
                  scale: playbackMotion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1.08],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}

      {bellBackgroundEnabled ? (
        <View style={[styles.halo, aeroMode && styles.aeroHalo]} />
      ) : null}

      <Text style={[styles.spark, styles.sparkLeft]}>✦</Text>
      {/* jingleTopDotRemovedV6 */}
      <Text style={[styles.spark, styles.sparkRight]}>✧</Text>

      <Pressable
        accessibilityLabel={insidePanel ? 'Zatvori Jingle' : 'Jingle'}
        accessibilityRole="button"
        disabled={portalInteractionLocked}
        delayLongPress={430}
        hitSlop={14}
        accessibilityHint={
          insidePanel
            ? 'Dodirni za zatvaranje. Drži za Početnu.'
            : 'Dodirni za Bell Menu. Drži za Početnu.'
        }
        onLongPress={() => {
          if (portalInteractionLocked || isPaletteInteractionLocked()) return;
          longPressTriggered.current = true;
          suppressJinglePressUntil =
            Date.now() + 1000;
          goHomeFromBell();
        }}
        onPress={() => {
          if (portalInteractionLocked || isPaletteInteractionLocked()) return;
          if (
            longPressTriggered.current ||
            Date.now() <
              suppressJinglePressUntil
          ) {
            longPressTriggered.current = false;
            return;
          }

          togglePanel();
        }}
        style={({ pressed }) => [
          styles.button,
          bellBackgroundEnabled && aeroMode && styles.aeroButton,
          bellBackgroundEnabled && aeroMode && webGlassStyle,
          !bellBackgroundEnabled && styles.buttonNaked,
          pressed && styles.buttonPressed,
        ]}
      >
        {aeroMode && bellBackgroundEnabled ? (
          <View style={styles.glassHighlight} />
        ) : null}

        <Animated.View
          style={{
            transform: [
              {
                rotate: playbackMotion.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange: ['0deg', '-2deg', '2.5deg', '-1.5deg', '0deg'],
                }),
              },
              {
                scale: playbackMotion.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.045],
                }),
              },
            ],
          }}
        >
        <Animated.View
          style={[
            styles.bellWrap,
            {
              transform: [
                { rotate },
                { scale },
                { scale: bellBackgroundEnabled ? 1 : 1.24 },
              ],
            },
          ]}
        >
          <JingleBellIcon active style={styles.bell} />
        </Animated.View>
        </Animated.View>

{/* ljingleMorningFixesV1:portalBadge — playback controls live inside the player, not on the global bell. */}
      </Pressable>
    </View>
  );
  return (
    <>
      {renderFloatingBell()}
      <CompletionCelebrationOverlay />
      {/* ljingleSemanticAliveR1:overlay */}
      <SemanticAliveOverlay />

      <Modal
        animationType="fade"
        onRequestClose={closePanel}
        transparent
        visible={panelVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Zatvori Jingle"
            onPress={closePanel}
            style={styles.scrim}
          />

          <View
            style={[
              styles.sheet,
              celestialMode && styles.celestialSheetN1,
              aeroMode && styles.aeroSheet,
              aeroMode && webGlassStyle,
            ]}
          >
            <View style={styles.sheetStars}>
              <Text style={[styles.sheetStar, { left: '8%', top: 14 }]}>✦</Text>
              <Text style={[styles.sheetStar, { left: '25%', top: 42 }]}>·</Text>
              <Text style={[styles.sheetStar, { right: '24%', top: 23 }]}>✧</Text>
              <Text style={[styles.sheetStar, { right: '8%', top: 50 }]}>·</Text>
            </View>

            <View style={styles.handle} />

            {celestialMode ? (
              <View style={styles.celestialCrownN1}>
                <View style={styles.celestialCrownLineN1} />
                <Text style={styles.celestialCrownStarN1}>✦</Text>
                <Text style={styles.celestialCrownStarN1}>✦</Text>
                <View style={styles.celestialCrownLineN1} />
              </View>
            ) : null}

            <View style={styles.brandRow}>
              <View style={styles.brandCopy}>
                <Text style={styles.brandEyebrow}>LJINGLE</Text>
                <Text style={styles.brandTitle}>Kamo želiš?</Text>
                <Text style={styles.brandSubtitle}>
                  Bell Menu · tvoj ulaz kroz LJingle.
                </Text>
              </View>
            </View>

            {audio.current ? (
              <View style={styles.nowPlaying}>
                <View style={styles.nowPlayingTop}>
                  <View style={styles.nowPlayingCopy}>
                    <Text style={styles.nowPlayingEyebrow}>
                      {audio.playing ? 'NOW PLAYING' : 'PAUSED'}
                    </Text>
                    <Text numberOfLines={1} style={styles.nowPlayingTitle}>
                      {audio.current.trackTitle}
                    </Text>
                    <Text numberOfLines={1} style={styles.nowPlayingArtist}>
                      {audio.current.artist || 'LJingle Memory Radio'}
                      {' · '}
                      {playerTime(audio.currentTime)}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      closePanel();
                      onNavigate('MemoryRadio');
                    }}
                    style={({ pressed }) => [
                      styles.openRadio,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.openRadioText}>RADIO ›</Text>
                  </Pressable>
                </View>

                <View style={styles.playerControls}>
                  <Pressable
                    accessibilityLabel="Prethodna frekvencija"
                    accessibilityRole="button"
                    onPress={audio.previous}
                    style={({ pressed }) => [styles.playerControl, pressed && styles.pressed]}
                  >
                    <Text style={styles.playerControlText}>|◀</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={audio.playing ? 'Pauziraj' : 'Nastavi'}
                    accessibilityRole="button"
                    onPress={audio.toggleCurrent}
                    style={({ pressed }) => [styles.playerControlMain, pressed && styles.pressed]}
                  >
                    <PortalTransportGlyphR1 playing={audio.playing} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Sljedeća frekvencija"
                    accessibilityRole="button"
                    onPress={audio.next}
                    style={({ pressed }) => [styles.playerControl, pressed && styles.pressed]}
                  >
                    <Text style={styles.playerControlText}>▶|</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Zaustavi reprodukciju"
                    accessibilityRole="button"
                    onPress={audio.stop}
                    style={({ pressed }) => [styles.playerStop, pressed && styles.pressed]}
                  >
                    <Text style={styles.playerStopText}>■</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={openPalette}
              style={({ pressed }) => [
                styles.searchAction,
                pressed && styles.pressed,
              ]}
            >
              {(activeVisualSkinId === 'classic' || activeVisualSkinId === 'classic-ljingle') ? (
                <View style={styles.searchMark}>
                  {/* forkN5GlyphReorderV1:bell-search */}
                  <BellSearchGlyph
                    color={JINGLE_BRAND_GOLD}
                    size={29}
                  />
                </View>
              ) : (
                <Text style={styles.searchMark}>⌕</Text>
              )}
              <View style={styles.searchCopy}>
                <Text style={styles.searchTitle}>Pretraži sve</Text>
                <Text style={styles.searchDetail}>
                  Command Palette · pretraga i brze akcije
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            <ScrollView
              contentContainerStyle={styles.destinationList}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.catalogueGroup}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    catalogueOpen
                      ? 'Zatvori Katalog izbornik'
                      : 'Otvori Katalog izbornik'
                  }
                  accessibilityState={{ expanded: catalogueOpen }}
                  onPress={() => {
                    void semanticFeedback.selection();
                    setCatalogueOpen((current) => !current);
                  }}
                  style={({ pressed }) => [
                    styles.catalogueHeader,
                    catalogueOpen && styles.catalogueHeaderOpen,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.catalogueMark}>
                    <Text style={styles.catalogueMarkText}>◇</Text>
                  </View>

                  <View style={styles.catalogueCopy}>
                    <Text style={styles.catalogueTitle}>Katalog</Text>
                    <Text style={styles.catalogueDetail}>
                      Knjige · filmovi · igre · teme · kolekcije
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.catalogueChevron,
                      catalogueOpen && styles.catalogueChevronOpen,
                    ]}
                  >
                    ›
                  </Text>
                </Pressable>

                {catalogueOpen ? (
                  <View style={styles.catalogueChildren}>
                    <View style={styles.catalogueRail} />

                    {catalogueDestinations.map((item) => (
                      <Pressable
                        key={item.route}
                        accessibilityRole="button"
                        onPress={() => {
                          closePanel();
                          onNavigate(item.route);
                        }}
                        style={({ pressed }) => [
                          styles.catalogueChild,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.catalogueChildMark}>
                          {item.route === 'Collections' &&
                          (activeVisualSkinId === 'classic' || activeVisualSkinId === 'classic-ljingle') ? (
                            <>
                              {/* forkN5GlyphReorderV1:memory-box-nav */}
                              <CollectionMemoryBoxGlyph
                                color={colors.navy}
                                size={23}
                              />
                            </>
                          ) : (
                            <Text style={styles.catalogueChildMarkText}>
                              {item.mark}
                            </Text>
                          )}
                        </View>

                        <View style={styles.catalogueChildCopy}>
                          <Text style={styles.catalogueChildTitle}>
                            {item.title}
                          </Text>
                          <Text style={styles.catalogueChildDetail}>
                            {item.detail}
                          </Text>
                        </View>

                        <Text style={styles.catalogueChildChevron}>›</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              {primaryDestinations.map((item) => (
                <Pressable
                  key={item.route}
                  accessibilityRole="button"
                  onPress={() => {
                    closePanel();
                    onNavigate(item.route);
                  }}
                  style={({ pressed }) => [
                    styles.destination,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.destinationMark}>
                    <Text style={styles.destinationMarkText}>{item.mark}</Text>
                  </View>

                  <View style={styles.destinationCopy}>
                    <Text style={styles.destinationTitle}>{item.title}</Text>
                    <Text style={styles.destinationDetail}>{item.detail}</Text>
                  </View>

                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  closePanel();
                  onNavigate('ThemePicker');
                }}
                style={({ pressed }) => [
                  styles.settings,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.settingsText}>Postavke</Text>
                <Text style={styles.settingsText}>›</Text>
              </Pressable>
            </ScrollView>

            <Text style={styles.longPressHint}>
              Drži zvono za Početnu
            </Text>
          </View>

          {renderFloatingBell(true)}
        </View>
      </Modal>

      <FirstRunTutorial auto />
    </>
  );
}

// jinglePanelAccentCleanV1
const styles = StyleSheet.create({
  // ljingleBrainRadioJingleMotionR1:portal-styles
  portalTransportGlyphR1: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalPauseBarR1: {
    position: 'absolute',
    top: 5,
    width: 5,
    height: 20,
    borderRadius: 2.5,
    backgroundColor: colors.background,
  },
  portalPauseLeftR1: {
    left: 7,
  },
  portalPauseRightR1: {
    right: 7,
  },
  portalPlayTriangleR1: {
    width: 0,
    height: 0,
    marginLeft: 4,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 17,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.background,
  },

  // forkN1CelestialHomeCommandBellV1
  celestialSheetN1: {
    backgroundColor: celestial.night,
    borderColor: celestialAlpha(celestial.gold, 0.50),
    borderTopWidth: 1.25,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.44,
    shadowRadius: 28,
    elevation: 18,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: `0 -18px 55px ${celestialAlpha(celestial.shadow, 0.44)}, inset 0 1px 0 ${celestialAlpha(celestial.gold, 0.12)}` } as any)
      : {}),
  },
  celestialCrownN1: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  celestialCrownLineN1: {
    width: 34,
    height: StyleSheet.hairlineWidth,
    backgroundColor: celestialAlpha(celestial.gold, 0.38),
  },
  celestialCrownStarN1: {
    color: celestial.gold,
    fontSize: 10,
  },
  celestialCrownBellN1: {
    color: celestial.gold,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2.4,
  },

  anchor: {
    position: 'absolute',
    left: '50%',
    bottom: 13,
    width: 72,
    height: 72,
    marginLeft: -36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 90,
  },
  anchorOnPanel: {
    zIndex: 999,
    elevation: 40,
  },
  halo: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(6, 55, 142, 0.10)',
  },
  playbackBubble: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 1.5,
    borderColor: 'rgba(220,160,31,0.88)',
    backgroundColor: 'rgba(220,160,31,0.10)',
  },
  playbackBubblePaused: {
    opacity: 0.24,
  },
  button: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: JINGLE_BRAND_NAVY,
    borderWidth: 1,
    borderColor: JINGLE_BRAND_GOLD_BORDER,
    shadowColor: JINGLE_BRAND_NAVY,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
  },
  aeroHalo: {
    backgroundColor: 'rgba(7,31,79,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.58)',
  },
  aeroButton: {
    backgroundColor: JINGLE_BRAND_NAVY,
    borderWidth: 1.5,
    borderColor: JINGLE_BRAND_GOLD_BORDER,
    shadowColor: JINGLE_BRAND_NAVY,
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  glassHighlight: {
    position: 'absolute',
    top: 4,
    left: 8,
    right: 8,
    height: 15,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  playbackBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: JINGLE_BRAND_GOLD,
    backgroundColor: JINGLE_BRAND_NAVY,
  },
  playbackBadgeText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '900',
  },
  aeroSheet: {
    backgroundColor: 'rgba(244, 252, 255, 0.86)',
    borderColor: 'rgba(255, 255, 255, 0.76)',
    shadowColor: '#3A86B8',
    shadowOpacity: 0.18,
    shadowRadius: 22,
  },
  buttonNaked: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  bellWrap: {
    width: 58,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bell: {
    width: 56,
    height: 60,
    transform: [{ scale: 1.26 }],
  },
  spark: {
    position: 'absolute',
    color: JINGLE_BRAND_GOLD,
    fontSize: 12,
  },
  sparkLeft: {
    left: 0,
    top: 28,
  },
  sparkTop: {
    top: -2,
    left: 40,
    fontSize: 17,
  },
  sparkRight: {
    right: 0,
    top: 25,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 12, 29, 0.28)',
  
    // forkN1CelestialHomeCommandBellV1_scrim
    ...(celestialMode ? { backgroundColor: celestialAlpha(celestial.night, 0.72) } : {}),
  },
  sheet: {
    maxHeight: '84%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.separator,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  sheetStars: {
    ...StyleSheet.absoluteFillObject,
    height: 115,
    pointerEvents: 'none',
  },
  sheetStar: {
    position: 'absolute',
    color: JINGLE_BRAND_GOLD,
    opacity: 0.4,
    fontSize: 14,
  
    // forkN1CelestialHomeCommandBellV1_sheetStar
    ...(celestialMode ? { color: celestial.gold, opacity: 0.34 } : {}),
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.separator,
    marginBottom: 14,
  
    // forkN1CelestialHomeCommandBellV1_handle
    ...(celestialMode ? { backgroundColor: celestialAlpha(celestial.gold, 0.34) } : {}),
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingBottom: 14,
  },
  brandBell: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: 'rgba(226, 169, 45, 0.72)',
  },
  brandBellIcon: {
    width: 40,
    height: 45,
  },
  brandCopy: {
    flex: 1,
  },
  brandEyebrow: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
  
    // forkN1CelestialHomeCommandBellV1_brandEyebrow
    ...(celestialMode ? { color: celestial.gold } : {}),
  },
  brandTitle: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    marginTop: 2,
  
    // forkN1CelestialHomeCommandBellV1_brandTitle
    ...(celestialMode ? {
      color: celestial.ivory,
      fontFamily: Platform.select({ web: 'Georgia, Times New Roman, serif', ios: 'Georgia', android: 'serif' }),
      fontWeight: '700',
      letterSpacing: 0.2,
    } : {}),
  },
  brandSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  
    // forkN1CelestialHomeCommandBellV1_brandSubtitle
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.58) } : {}),
  },
  nowPlaying: {
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: JINGLE_BRAND_GOLD_BORDER,
    backgroundColor: celestialMode
      ? celestial.nightSoft
      : 'rgba(7,31,79,0.96)',
    padding: 14,
  },
  nowPlayingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nowPlayingCopy: {
    flex: 1,
    minWidth: 0,
  },
  nowPlayingEyebrow: {
    color: JINGLE_BRAND_GOLD,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  nowPlayingTitle: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  nowPlayingArtist: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 10,
  },
  openRadio: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  openRadioText: {
    color: JINGLE_BRAND_GOLD,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  playerControls: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  playerControl: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  playerControlText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  playerControlMain: {
    // ljingleRadioWhiteSilentR1:portal
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
  },
  playerControlMainText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '900',
  },
  // ljingleReaderEntriesHighlightRadioR1: font-independent Android play/pause icon
  playerPauseIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  playerPauseBar: {
    width: 5,
    height: 19,
    borderRadius: 2,
    backgroundColor: colors.background,
  },
  playerPlayTriangle: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 16,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.background,
  },
  playerStop: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  playerStopText: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 10,
  },
  searchAction: {
    minHeight: 66,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navy,
    paddingHorizontal: 16,
    marginBottom: 10,
      borderWidth: 1,
    borderColor: celestialAlpha(celestial.ivory, 0.30),

    // forkN1CelestialHomeCommandBellV1_searchAction
    ...(celestialMode ? { backgroundColor: celestial.nightSoft, borderColor: celestialAlpha(celestial.gold, 0.54), borderWidth: 1.25 } : {}),
  },
  searchMark: {
    color: '#E0A42B',
    fontSize: 25,
    width: 34,
  
    // forkN1CelestialHomeCommandBellV1_searchMark
    ...(celestialMode ? { color: celestial.gold } : {}),
  },
  searchCopy: {
    flex: 1,
  },
  searchTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  
    // forkN1CelestialHomeCommandBellV1_searchTitle
    ...(celestialMode ? { color: celestial.ivory } : {}),
  },
  searchDetail: {
    color: celestialAlpha(celestial.ivory, 0.68),
    fontSize: 11,
    marginTop: 3,
  
    // forkN1CelestialHomeCommandBellV1_searchDetail
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.58) } : {}),
  },
  destinationList: {
    paddingBottom: 8,
  },
  catalogueGroup: {
    marginBottom: 3,
  },
  catalogueHeader: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(217, 156, 29, 0.20)',
    backgroundColor: 'rgba(217, 156, 29, 0.055)',
  },
  catalogueHeaderOpen: {
    borderColor: 'rgba(217, 156, 29, 0.34)',
    backgroundColor: 'rgba(217, 156, 29, 0.09)',
  },
  catalogueMark: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  catalogueMarkText: {
    color: colors.background,
    fontSize: 19,
    fontWeight: '800',
  },
  catalogueCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  catalogueTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  catalogueDetail: {
    color: colors.textMuted,
    fontSize: 10.5,
    marginTop: 3,
  },
  catalogueChevron: {
    color: JINGLE_BRAND_GOLD,
    fontSize: 28,
    lineHeight: 30,
    transform: [{ rotate: '90deg' }],
  },
  catalogueChevronOpen: {
    transform: [{ rotate: '-90deg' }],
  },
  catalogueChildren: {
    position: 'relative',
    marginLeft: 20,
    paddingLeft: 20,
    paddingTop: 5,
    paddingBottom: 7,
  },
  catalogueRail: {
    position: 'absolute',
    left: 5,
    top: 0,
    bottom: 12,
    width: 1,
    backgroundColor: JINGLE_BRAND_GOLD,
    opacity: 0.28,
  },
  catalogueChild: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  catalogueChildMark: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217, 156, 29, 0.075)',
  },
  catalogueChildMarkText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  catalogueChildCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  catalogueChildTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  catalogueChildDetail: {
    color: colors.textMuted,
    fontSize: 9.5,
    marginTop: 2,
  },
  catalogueChildChevron: {
    color: JINGLE_BRAND_GOLD,
    fontSize: 21,
  },
  destination: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  
    // forkN1CelestialHomeCommandBellV1_destination
    ...(celestialMode ? { borderBottomColor: celestialAlpha(celestial.gold, 0.13) } : {}),
  },
  destinationMark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217, 156, 29, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(217, 156, 29, 0.22)',
  
    // forkN1CelestialHomeCommandBellV1_destinationMark
    ...(celestialMode ? { backgroundColor: celestialAlpha(celestial.gold, 0.07), borderColor: celestialAlpha(celestial.gold, 0.30) } : {}),
  },
  destinationMarkText: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '700',
  
    // forkN1CelestialHomeCommandBellV1_destinationMarkText
    ...(celestialMode ? { color: celestial.gold } : {}),
  },
  destinationCopy: {
    flex: 1,
    paddingHorizontal: 12,
  },
  destinationTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  
    // forkN1CelestialHomeCommandBellV1_destinationTitle
    ...(celestialMode ? { color: celestial.ivory } : {}),
  },
  destinationDetail: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  
    // forkN1CelestialHomeCommandBellV1_destinationDetail
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.58) } : {}),
  },
  chevron: {
    color: '#D99C1D',
    fontSize: 27,
    lineHeight: 28,
  
    // forkN1CelestialHomeCommandBellV1_chevron
    ...(celestialMode ? { color: celestial.gold } : {}),
  },
  settings: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  settingsText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  
    // forkN1CelestialHomeCommandBellV1_settingsText
    ...(celestialMode ? { color: celestialAlpha(celestial.ivory, 0.58) } : {}),
  },
  longPressHint: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 11,
    marginTop: 8,
  
    // forkN1CelestialHomeCommandBellV1_longPressHint
    ...(celestialMode ? { color: celestial.gold } : {}),
  },
  pressed: {
    opacity: 0.66,
  },
});

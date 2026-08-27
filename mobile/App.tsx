import {
  useEffect,
  useRef,
  useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  useNavigationContainerRef,
  } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar,
  View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BookDetailsScreen } from './src/screens/BookDetailsScreen';
import { BookFormScreen } from './src/screens/BookFormScreen';
import { BookListScreen } from './src/screens/BookListScreen';
import { BookMetadataImportScreen } from './src/screens/BookMetadataImportScreen';
import { BookSearchScreen } from './src/screens/BookSearchScreen';
import { CatalogueHomeScreen } from './src/screens/CatalogueHomeScreen';
import { CollectionsScreen } from './src/screens/CollectionsScreen';
import { CollectionDetailsScreen } from './src/screens/CollectionDetailsScreen';
import { EntryFormScreen } from './src/screens/EntryFormScreen';
import { EntryListScreen } from './src/screens/EntryListScreen';
import { MemoryAudioProvider } from './src/audio/MemoryAudioProvider';
import { MemoryRadioScreen } from './src/screens/MemoryRadioScreen';
import { GamesNavigator } from './src/games';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SessionNotePrompt } from './src/components/SessionNotePrompt';
import { GlobalUndoToast } from './src/components/GlobalUndoToast';
import { StatsScreen } from './src/screens/StatsScreen';
import { ReconstructionScreen } from './src/screens/ReconstructionScreen';
import { MediaNavigator } from './src/navigation/MediaNavigator';
import { ParentBackButton } from './src/components/ParentBackButton';
import { CommandPalette } from './src/components/CommandPalette';
import { CommandPaletteEdgeGesture } from './src/components/CommandPaletteEdgeGesture';
import { TodayScreen } from './src/screens/TodayScreen';
import { ThemePickerScreen } from './src/screens/ThemePickerScreen';
import { TopicDetailsScreen } from './src/screens/TopicDetailsScreen';
import { TopicListScreen } from './src/screens/TopicListScreen';
import { colors,
  isDarkBackground,
} from './src/theme/colors';
import { semanticFeedback } from './src/utils/semanticFeedback';
import type { RootStackParamList } from './src/types/navigation';
import { AuthProvider } from './src/auth/AuthContext';
import { AuthGate } from './src/auth/AuthGate';

// forkD3MobileAuthSecureStoreV1
import { playUiCue } from './src/audio/uiFeedback';
import { runCloudSync } from './src/services/cloudSync';

import { JinglePortal } from './src/components/JinglePortal';
import {
  getJinglePortalEnabled,
  subscribeJinglePortalEnabled,
} from './src/services/jinglePortalPreference';
import {
  PortableShareSheet,
} from './src/components/PortableShareSheet';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    primary: colors.black,
    text: colors.text,
    border: colors.separator,
  },
};

function LJingleAuthenticatedApp() {
  // appOpeningSoundFinalV1
  useEffect(() => {
    void playUiCue('open');
  }, []);

  const navigationRef =
    useNavigationContainerRef<RootStackParamList>();

  // cloudSyncAppOpenV1
  useEffect(() => {
    void runCloudSync({
      reason: 'APP_OPEN',
    });
  }, []);

  // commandPalettePeekGestureV1

  // commandPalettePeekGestureV1
  const [paletteOpenSignal, setPaletteOpenSignal] =
    useState(0);
  const [jinglePortalEnabled, setJinglePortalEnabledState] =
    useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    void getJinglePortalEnabled().then((value) => {
      if (active) setJinglePortalEnabledState(value);
    });

    const unsubscribe = subscribeJinglePortalEnabled((value) => {
      if (active) setJinglePortalEnabledState(value);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // commandPaletteGlobalLongHoldV1
  const globalHoldTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const globalHoldStart =
    useRef<{ x: number; y: number } | null>(null);

  const cancelGlobalHold = () => {
    if (globalHoldTimer.current) {
      clearTimeout(globalHoldTimer.current);
      globalHoldTimer.current = null;
    }

    globalHoldStart.current = null;
  };

  const touchPoint = (event: any) => {
    const touch =
      event.nativeEvent?.touches?.[0] ??
      event.nativeEvent?.changedTouches?.[0] ??
      event.nativeEvent;

    return {
      x: Number(touch?.pageX ?? 0),
      y: Number(touch?.pageY ?? 0),
    };
  };

  const beginGlobalHold = (event: any) => {
    cancelGlobalHold();

    if (
      event.nativeEvent?.touches &&
      event.nativeEvent.touches.length !== 1
    ) {
      return;
    }

    globalHoldStart.current = touchPoint(event);

    globalHoldTimer.current = setTimeout(() => {
      globalHoldTimer.current = null;
      globalHoldStart.current = null;

      void semanticFeedback.gestureThreshold();
      setPaletteOpenSignal(
        (current) => current + 1,
      );
    }, 480);
  };

  const moveGlobalHold = (event: any) => {
    const start = globalHoldStart.current;
    if (!start) return;

    const point = touchPoint(event);
    const dx = point.x - start.x;
    const dy = point.y - start.y;

    // Normal scroll/swipe cancels the long hold.
    if (Math.hypot(dx, dy) > 14) {
      cancelGlobalHold();
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar
        // forkKDarkBackgroundContrastV1
        barStyle={isDarkBackground ? 'light-content' : 'dark-content'}
        backgroundColor={colors.surface}
      />

      <MemoryAudioProvider>
      <View
        style={{ flex: 1 }}
        onTouchStart={beginGlobalHold}
        onTouchMove={moveGlobalHold}
        onTouchEnd={cancelGlobalHold}
        onTouchCancel={cancelGlobalHold}
      >
      <SessionNotePrompt />
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
      >
        <Stack.Navigator
          initialRouteName="Today"
          screenOptions={({ navigation }) => ({
            // globalScreenMotionStableV4
            // globalScreenMotionV1
            animation: 'fade_from_bottom',
            animationDuration: 220,
            headerStyle: { backgroundColor: colors.surface },
            // forkKDarkBackgroundContrastV1
            headerTintColor: colors.text,
            headerTitleStyle: {
              color: colors.text,
              fontSize: 17,
              fontWeight: '600',
            },
            headerBackVisible: false,
            headerBackTitle: 'Natrag',
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
            headerLeft: () => <ParentBackButton onPress={() => navigation.goBack()} />,
          })}
        >
          <Stack.Screen
            name="Today"
            component={TodayScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="ThemePicker"
            component={ThemePickerScreen}
            options={{ title: 'Postavke' }}
          />

          <Stack.Screen
            name="Catalogue"
            component={CatalogueHomeScreen}
            options={{ title: 'Katalog' }}
          />

          <Stack.Screen
            name="Collections"
            component={CollectionsScreen}
            options={{ title: 'Collections' }}
          />

          <Stack.Screen
            name="CollectionDetails"
            component={CollectionDetailsScreen}
            options={{ title: 'Collection' }}
          />

          <Stack.Screen
            name="BookList"
            component={BookListScreen}
            options={{ title: 'Knjige' }}
          />

          <Stack.Screen
            name="Topics"
            component={TopicListScreen}
            options={{ title: 'Teme' }}
          />

          <Stack.Screen
            name="TopicDetails"
            component={TopicDetailsScreen}
            options={{ title: 'Tema' }}
          />

          <Stack.Screen
            name="History"
            component={HistoryScreen}
            options={{ title: 'Povijest' }}
          />

          <Stack.Screen
            name="Stats"
            component={StatsScreen}
            options={{ title: 'Profil' }}
          />

          <Stack.Screen
            name="Reconstruction"
            component={ReconstructionScreen}
            options={{ title: 'Osobni arhiv' }}
          />

          <Stack.Screen
            name="Entries"
            component={EntryListScreen}
            options={{ title: 'Zapisi' }}
          />

          <Stack.Screen
            name="EntryForm"
            component={EntryFormScreen}
            options={({ route }) => ({
              title: route.params?.entryId ? 'Uredi zapis' : 'Novi zapis',
            })}
          />

          <Stack.Screen
            name="MemoryRadio"
            component={MemoryRadioScreen}
            options={{ title: 'Memory Radio' }}
          />

          <Stack.Screen
            name="Games"
            component={GamesNavigator}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="Media"
            component={MediaNavigator}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="BookDetails"
            component={BookDetailsScreen}
            options={{ title: 'Detalji knjige' }}
          />

          <Stack.Screen
            name="BookSearch"
            component={BookSearchScreen}
            options={{ title: 'Pretraži katalog' }}
          />

          <Stack.Screen
            name="BookMetadataImport"
            component={BookMetadataImportScreen}
            options={{ title: 'Online pretraga knjiga' }}
          />
<Stack.Screen
            name="BookForm"
            component={BookFormScreen}
            options={({ route }) => ({
              title: route.params?.bookId ? 'Uredi knjigu' : 'Nova knjiga',
            })}
          />
        </Stack.Navigator>
      </NavigationContainer>

        {/* globalUndoToastV1 */}
        <GlobalUndoToast />

      <CommandPaletteEdgeGesture
        onOpen={() => {
          setPaletteOpenSignal(
            (current) => current + 1
          );
        }}
      />

      <CommandPalette
        navigation={navigationRef}
        openSignal={paletteOpenSignal}
      />

      {jinglePortalEnabled ? (
        <>
        <JinglePortal
        onNavigate={(route) => {
          if (!navigationRef.isReady()) return;
          navigationRef.navigate(route as any);
        }}
        onOpenPalette={() => {
          setPaletteOpenSignal((current) => current + 1);
        }}
      />
        <PortableShareSheet />
      </>
      ) : null}
      </View>
      </MemoryAudioProvider>
    </SafeAreaProvider>
  );
}


export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <LJingleAuthenticatedApp />
      </AuthGate>
    </AuthProvider>
  );
}

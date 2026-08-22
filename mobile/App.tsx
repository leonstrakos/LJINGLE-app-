import { useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BookDetailsScreen } from './src/screens/BookDetailsScreen';
import { BookFormScreen } from './src/screens/BookFormScreen';
import { BookListScreen } from './src/screens/BookListScreen';
import { BookMetadataImportScreen } from './src/screens/BookMetadataImportScreen';
import { BookSearchScreen } from './src/screens/BookSearchScreen';
import { BookStatsScreen } from './src/screens/BookStatsScreen';
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
import { StatsScreen } from './src/screens/StatsScreen';
import { MediaNavigator } from './src/navigation/MediaNavigator';
import { ParentBackButton } from './src/components/ParentBackButton';
import { CommandPalette } from './src/components/CommandPalette';
import { CommandPaletteEdgeGesture } from './src/components/CommandPaletteEdgeGesture';
import { TodayScreen } from './src/screens/TodayScreen';
import { ThemePickerScreen } from './src/screens/ThemePickerScreen';
import { TopicDetailsScreen } from './src/screens/TopicDetailsScreen';
import { TopicListScreen } from './src/screens/TopicListScreen';
import { colors } from './src/theme/colors';
import type { RootStackParamList } from './src/types/navigation';

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

export default function App() {
  const navigationRef =
    useNavigationContainerRef<RootStackParamList>();

  // commandPalettePeekGestureV1
  const [paletteOpenSignal, setPaletteOpenSignal] =
    useState(0);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

      <MemoryAudioProvider>
      <SessionNotePrompt />
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
      >
        <Stack.Navigator
          initialRouteName="Today"
          screenOptions={({ navigation }) => ({
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.black,
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
            options={{ title: 'Statistika' }}
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
            name="BookStats"
            component={BookStatsScreen}
            options={{ title: 'Statistika' }}
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
      </MemoryAudioProvider>
    </SafeAreaProvider>
  );
}

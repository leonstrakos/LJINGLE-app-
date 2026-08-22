import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ParentBackButton } from '../components/ParentBackButton';
import { colors } from '../theme/colors';
import { GameDetailsScreen } from './screens/GameDetailsScreen';
import { GameFormScreen } from './screens/GameFormScreen';
import { GameListScreen } from './screens/GameListScreen';
import { GameMetadataSearchScreen } from './screens/GameMetadataSearchScreen';
import type { GameStackParamList } from './types/game';

const Stack = createNativeStackNavigator<GameStackParamList>();

export function GamesNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="GameList"
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.black,
        headerTitleStyle: { color: colors.text, fontSize: 17, fontWeight: '600' },
        headerBackVisible: false,
        headerBackTitle: 'Natrag',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        headerLeft: () => <ParentBackButton onPress={() => navigation.goBack()} />,
      })}
    >
      <Stack.Screen
        name="GameList"
        component={GameListScreen}
        options={({ navigation }) => ({
          title: 'Igre',
          headerLeft: () => (
            <ParentBackButton onPress={() => navigation.getParent()?.goBack()} />
          ),
        })}
      />
      <Stack.Screen name="GameDetails" component={GameDetailsScreen} options={{ title: 'Detalji igre' }} />
      <Stack.Screen
        name="GameForm"
        component={GameFormScreen}
        options={({ route }) => ({ title: route.params?.gameId ? 'Uredi igru' : 'Nova igra' })}
      />
      <Stack.Screen
        name="GameMetadataSearch"
        component={GameMetadataSearchScreen}
        options={{ title: 'Online pretraživanje' }}
      />
    </Stack.Navigator>
  );
}

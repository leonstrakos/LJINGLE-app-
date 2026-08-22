import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ParentBackButton } from '../components/ParentBackButton';
import { MediaDetailsScreen } from '../screens/MediaDetailsScreen';
import { MediaFormScreen } from '../screens/MediaFormScreen';
import { MediaListScreen } from '../screens/MediaListScreen';
import { MediaSearchScreen } from '../screens/MediaSearchScreen';
import { colors } from '../theme/colors';
import type { MediaStackParamList } from '../types/mediaNavigation';

const Stack = createNativeStackNavigator<MediaStackParamList>();

export function MediaNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="MediaList"
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
        headerBackVisible: false,
        headerLeft: () => <ParentBackButton onPress={() => navigation.goBack()} />,
      })}
    >
      <Stack.Screen
        name="MediaList"
        component={MediaListScreen}
        options={({ navigation }) => ({
          title: 'Filmovi i serije',
          headerLeft: () => (
            <ParentBackButton onPress={() => navigation.getParent()?.goBack()} />
          ),
        })}
      />
      <Stack.Screen
        name="MediaDetails"
        component={MediaDetailsScreen}
        options={{ title: 'Detalji' }}
      />
      <Stack.Screen
        name="MediaSearch"
        component={MediaSearchScreen}
        options={{ title: 'Online pretraga' }}
      />
      <Stack.Screen
        name="MediaForm"
        component={MediaFormScreen}
        options={{ title: 'Film ili serija' }}
      />
    </Stack.Navigator>
  );
}

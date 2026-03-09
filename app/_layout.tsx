import '../tasks/backgroundLocation'; // Register background location task at app load
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../utils/colors';
import { ActiveRecordBanner } from '../components/ActiveRecordBanner';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ActiveRecordBanner />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.secondary },
          headerTintColor: Colors.textOnSecondary,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="director/name-race"
          options={{ title: 'Create Race', headerBackVisible: false }}
        />
        <Stack.Screen
          name="director/mark-course"
          options={{ title: 'Mark Course' }}
        />
        <Stack.Screen
          name="director/races"
          options={{ title: 'Active Races', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="racer/scan"
          options={{ title: 'Scan QR Code', headerBackVisible: false }}
        />
        <Stack.Screen
          name="racer/enter-name"
          options={{ title: 'Join Race' }}
        />
        <Stack.Screen
          name="race/[id]/invite"
          options={{ title: 'Share Race' }}
        />
        <Stack.Screen
          name="race/[id]/record"
          options={{ title: 'Race', headerBackVisible: false }}
        />
        <Stack.Screen
          name="race/[id]/leaderboard"
          options={{ title: 'Leaderboard' }}
        />
        <Stack.Screen
          name="race/[id]/map"
          options={{ title: 'Race on map', headerBackVisible: false }}
        />
        <Stack.Screen
          name="race/[id]/racer-home"
          options={{ title: 'Race', headerBackVisible: false }}
        />
      </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

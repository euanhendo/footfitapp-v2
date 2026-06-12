import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function Layout() {
  const dark = useColorScheme() === 'dark';
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: dark ? '#000' : '#f9f9f9' },
        headerTintColor: dark ? '#fff' : '#111',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: dark ? '#000' : '#f9f9f9' },
      }}
    >
      <Stack.Screen name="screens/WelcomeScreen" options={{ headerShown: false }} />
      <Stack.Screen name="screens/HomeScreen" options={{ headerShown: false }} />
      <Stack.Screen name="screens/ManualInputScreen" options={{ title: 'Your Measurements' }} />
      <Stack.Screen name="screens/SockSelectionScreen" options={{ title: 'Select Socks' }} />
      <Stack.Screen name="screens/ResultScreen" options={{ title: 'Your Matches' }} />
      <Stack.Screen name="screens/OwnedShoesScreen" options={{ title: 'My Shoes' }} />
      <Stack.Screen name="screens/MeasureGuideScreen" options={{ title: 'How to measure' }} />
      <Stack.Screen name="screens/ScannerScreen" options={{ title: 'Scan your foot' }} />
      <Stack.Screen name="screens/ScanReviewScreen" options={{ title: 'Scan result' }} />
      <Stack.Screen name="screens/ScannerDebugScreen" options={{ title: 'Scanner debug' }} />
    </Stack>
  );
}

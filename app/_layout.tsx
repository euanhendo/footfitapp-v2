import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
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

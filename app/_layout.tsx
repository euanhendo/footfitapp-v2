import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="screens/HomeScreen" options={{ headerShown: false }} />
      <Stack.Screen name="screens/ManualInputScreen" options={{ title: 'Your Measurements' }} />
      <Stack.Screen name="screens/SockSelectionScreen" options={{ title: 'Select Socks' }} />
      <Stack.Screen name="screens/ResultScreen" options={{ title: 'Your Matches' }} />
    </Stack>
  );
}

import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1200&q=70&fit=crop';

export default function WelcomeScreen() {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: '#111' }}>
      {!imageFailed && (
        <Image
          source={{ uri: HERO_IMAGE }}
          style={{ position: 'absolute', width: '100%', height: '100%' }}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      )}
      <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.55)' }} />
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', padding: 24 }}>
        <Text style={{ fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: 4, marginTop: 12 }}>
          FOOTFIT
        </Text>
        <View>
          <Text style={{ fontSize: 36, fontWeight: '800', color: '#fff', lineHeight: 42, marginBottom: 12 }}>
            Know your real size.
          </Text>
          <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 22, marginBottom: 28 }}>
            Most people don&apos;t. Your phone camera and a sheet of A4 paper measure
            your feet to the millimetre — then we match footwear to them, brand by brand.
          </Text>
          <Pressable
            onPress={() => router.push('/screens/ScannerScreen')}
            style={{
              backgroundColor: '#fff',
              borderRadius: 999,
              paddingVertical: 16,
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Text style={{ color: '#111', fontSize: 13, fontWeight: '800', letterSpacing: 1.5 }}>
              SCAN YOUR FEET
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/screens/HomeScreen')}
            style={{ paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>
              SKIP FOR NOW
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

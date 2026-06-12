import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1200&q=70&fit=crop';

// Stacked translucent bands fake a top-to-bottom gradient without a gradient
// dependency — photo stays readable up top, type stays legible down low.
const SCRIM_BANDS = [
  { top: '0%', height: '100%', opacity: 0.28 },
  { top: '45%', height: '55%', opacity: 0.2 },
  { top: '62%', height: '38%', opacity: 0.22 },
  { top: '78%', height: '22%', opacity: 0.24 },
] as const;

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
      {SCRIM_BANDS.map((band, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: '100%',
            top: band.top,
            height: band.height,
            backgroundColor: `rgba(0,0,0,${band.opacity})`,
          }}
        />
      ))}
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', padding: 24 }}>
        <Text style={{ fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: 4, marginTop: 12 }}>
          FOOTFIT
        </Text>
        <View>
          <Text style={{ fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.75)', letterSpacing: 2.5, marginBottom: 10 }}>
            FIT, MEASURED — NOT GUESSED
          </Text>
          <Text style={{ fontSize: 42, fontWeight: '900', color: '#fff', lineHeight: 46, letterSpacing: -0.5, marginBottom: 12 }}>
            Know your{'\n'}real size.
          </Text>
          <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 22, marginBottom: 28 }}>
            Your phone camera and a sheet of A4 paper measure your feet to the
            millimetre — then we match footwear to them, brand by brand.
          </Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/screens/ScannerScreen');
            }}
            style={({ pressed }) => ({
              backgroundColor: '#fff',
              borderRadius: 999,
              paddingVertical: 16,
              alignItems: 'center',
              marginBottom: 8,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <Text style={{ color: '#111', fontSize: 13, fontWeight: '800', letterSpacing: 1.5 }}>
              SCAN YOUR FEET
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/screens/HomeScreen')}
            style={({ pressed }) => ({ paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>
              SKIP FOR NOW
            </Text>
          </Pressable>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 2 }}>
            Takes about 60 seconds · No account needed
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

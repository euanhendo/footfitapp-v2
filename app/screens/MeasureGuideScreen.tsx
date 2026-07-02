import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '../../lib/theme';

const STEPS: { title: string; body: string }[] = [
  {
    title: '1. Paper against a wall',
    body: 'Place a sheet of paper flat on the floor with one edge against a wall. Stand on it with your heel touching the wall.',
  },
  {
    title: '2. Mark your longest toe',
    body: 'Make a pencil mark at the tip of your longest toe. Measure heel-edge to mark in millimetres — that is your foot length.',
  },
  {
    title: '3. Mark the widest points',
    body: 'Mark each side of the ball of your foot (the widest part). Measure across the two marks in millimetres — that is your foot width.',
  },
  {
    title: '4. Both feet, end of day',
    body: 'Repeat for the other foot and use the larger numbers. Feet swell through the day — late afternoon gives the truest fit.',
  },
];

export default function MeasureGuideScreen() {
  const p = usePalette();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: p.text, marginBottom: 6 }}>
          How to measure
        </Text>
        <Text style={{ fontSize: 14, color: p.muted, marginBottom: 20 }}>
          Takes about 30 seconds. You need paper, a pencil, and a ruler or tape measure.
        </Text>

        {STEPS.map((step) => (
          <View
            key={step.title}
            style={{
              backgroundColor: p.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: p.cardBorder,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: p.text, marginBottom: 6 }}>
              {step.title}
            </Text>
            <Text style={{ fontSize: 14, color: p.muted, lineHeight: 20 }}>
              {step.body}
            </Text>
          </View>
        ))}

        <View
          style={{
            backgroundColor: p.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: p.cardBorder,
            padding: 14,
            marginTop: 4,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 13, color: p.muted, lineHeight: 19 }}>
            No ruler handy? Use the Shoe size method on the previous screen — it is an estimate, but a reasonable one.
          </Text>
        </View>

        <Pressable
          onPress={() => router.back()}
          style={{
            backgroundColor: p.ctaBg,
            borderRadius: 999,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: p.ctaText, fontSize: 15, fontWeight: '800', letterSpacing: 1.5 }}>GOT IT</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

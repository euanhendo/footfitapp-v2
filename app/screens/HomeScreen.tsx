import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Sport = 'football' | 'running';
type Gender = 'mens' | 'womens';

const SPORTS: { id: Sport; label: string; emoji: string; available: boolean }[] = [
  { id: 'football', label: 'Football', emoji: '⚽', available: true },
  { id: 'running', label: 'Running', emoji: '🏃', available: true },
  { id: 'rugby' as Sport, label: 'Rugby', emoji: '🏉', available: false },
];

export default function HomeScreen() {
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);

  const handleGenderSelect = (gender: Gender) => {
    if (!selectedSport) return;
    router.push({
      pathname: '/screens/ManualInputScreen',
      params: { sport: selectedSport, gender },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
      <View style={{ flex: 1, padding: 24 }}>

        <Text style={{ fontSize: 30, fontWeight: '800', color: '#111', marginBottom: 4 }}>
          Find your fit
        </Text>
        <Text style={{ fontSize: 15, color: '#666', marginBottom: 32 }}>
          Get matched to footwear that actually fits your feet.
        </Text>

        <Text style={{ fontSize: 13, fontWeight: '700', color: '#999', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>
          Choose sport
        </Text>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
          {SPORTS.map((sport) => (
            <Pressable
              key={sport.id}
              onPress={() => sport.available && setSelectedSport(sport.id as Sport)}
              style={{
                flex: 1,
                borderRadius: 16,
                padding: 20,
                alignItems: 'center',
                backgroundColor: !sport.available
                  ? '#f0f0f0'
                  : selectedSport === sport.id
                  ? '#111'
                  : '#fff',
                borderWidth: 2,
                borderColor: !sport.available
                  ? '#e0e0e0'
                  : selectedSport === sport.id
                  ? '#111'
                  : '#e8e8e8',
                opacity: sport.available ? 1 : 0.5,
              }}
            >
              <Text style={{ fontSize: 32, marginBottom: 8 }}>{sport.emoji}</Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: !sport.available ? '#aaa' : selectedSport === sport.id ? '#fff' : '#111',
                }}
              >
                {sport.label}
              </Text>
              {!sport.available && (
                <Text style={{ fontSize: 10, color: '#bbb', marginTop: 4 }}>Coming soon</Text>
              )}
            </Pressable>
          ))}
        </View>

        {selectedSport && (
          <>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#999', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>
              I am shopping for
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              {(['mens', 'womens'] as Gender[]).map((gender) => (
                <Pressable
                  key={gender}
                  onPress={() => handleGenderSelect(gender)}
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    padding: 20,
                    alignItems: 'center',
                    backgroundColor: '#fff',
                    borderWidth: 2,
                    borderColor: '#e8e8e8',
                  }}
                >
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>
                    {gender === 'mens' ? '👨' : '👩'}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#111' }}>
                    {gender === 'mens' ? "Men's" : "Women's"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

      </View>
    </SafeAreaView>
  );
}

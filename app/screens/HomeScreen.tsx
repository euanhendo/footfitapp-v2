import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { createFitProfileStore, FitProfile, StorageAdapter } from '../../lib/fitProfile';

type Sport = 'football' | 'running';
type Gender = 'mens' | 'womens';

const SPORTS: { id: Sport; label: string; emoji: string; available: boolean }[] = [
  { id: 'football', label: 'Football', emoji: '⚽', available: true },
  { id: 'running', label: 'Running', emoji: '🏃', available: true },
  { id: 'rugby' as Sport, label: 'Rugby', emoji: '🏉', available: false },
];

const storage: StorageAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
};

const profileStore = createFitProfileStore(storage);

function daysAgo(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
  if (diff === 0) return 'Saved today';
  if (diff === 1) return 'Saved yesterday';
  return `Saved ${diff} days ago`;
}

export default function HomeScreen() {
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [savedProfile, setSavedProfile] = useState<FitProfile | null>(null);

  useEffect(() => {
    profileStore.load().then(setSavedProfile);
  }, []);

  const handleGenderSelect = (gender: Gender) => {
    if (!selectedSport) return;
    router.push({
      pathname: '/screens/ManualInputScreen',
      params: { sport: selectedSport, gender },
    });
  };

  const handleContinue = () => {
    if (!savedProfile) return;
    router.push({
      pathname: '/screens/ResultScreen',
      params: {
        footLength: String(savedProfile.footLength),
        footWidth: String(savedProfile.footWidth),
        sockType: savedProfile.sockType,
        sport: savedProfile.sport,
        gender: savedProfile.gender,
      },
    });
  };

  const handleStartFresh = () => {
    profileStore.clear().then(() => setSavedProfile(null));
  };

  const sportLabel = savedProfile?.sport === 'football' ? 'Football' : 'Running';
  const genderLabel = savedProfile?.gender === 'mens' ? "Men's" : "Women's";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
      <View style={{ flex: 1, padding: 24 }}>

        <Text style={{ fontSize: 30, fontWeight: '800', color: '#111', marginBottom: 4 }}>
          Find your fit
        </Text>
        <Text style={{ fontSize: 15, color: '#666', marginBottom: 32 }}>
          Get matched to footwear that actually fits your feet.
        </Text>

        {savedProfile && (
          <View style={{ marginBottom: 24 }}>
            <Pressable
              onPress={handleContinue}
              style={{
                backgroundColor: '#111',
                borderRadius: 16,
                padding: 20,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 6 }}>
                Continue with your last fit
              </Text>
              <Text style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>
                {genderLabel} {sportLabel}
              </Text>
              <Text style={{ fontSize: 12, color: '#666' }}>
                {daysAgo(savedProfile.savedAt)}
              </Text>
            </Pressable>
            <Pressable onPress={handleStartFresh} style={{ marginTop: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: '#666', textDecorationLine: 'underline' }}>
                Start fresh
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({
                pathname: '/screens/OwnedShoesScreen',
                params: { gender: savedProfile.gender },
              })}
              style={{ marginTop: 6, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 13, color: '#666', textDecorationLine: 'underline' }}>
                My shoes
              </Text>
            </Pressable>
          </View>
        )}

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

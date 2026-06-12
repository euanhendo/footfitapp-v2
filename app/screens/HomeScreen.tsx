import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { createFitProfileStore, FitProfile, StorageAdapter } from '../../lib/fitProfile';

type Sport = 'football' | 'running' | 'rugby';
type Gender = 'mens' | 'womens';

// Boot-level action shots — every hero image is about feet, like the app.
const SPORTS: { id: Sport; label: string; imageUrl: string }[] = [
  {
    id: 'football',
    label: 'Football',
    imageUrl: 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=1200&q=70&fit=crop',
  },
  {
    id: 'running',
    label: 'Running',
    imageUrl: 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=1200&q=70&fit=crop',
  },
  {
    id: 'rugby',
    label: 'Rugby',
    imageUrl: 'https://images.unsplash.com/photo-1558151507-c1aa3d917dbb?w=1200&q=70&fit=crop',
  },
];

// Kids stays visible but disabled until junior boots land in bootDatabase.json.
const GENDER_TABS: { id: Gender | 'kids'; label: string; enabled: boolean }[] = [
  { id: 'mens', label: 'MEN', enabled: true },
  { id: 'womens', label: 'WOMEN', enabled: true },
  { id: 'kids', label: 'KIDS', enabled: false },
];

const storage: StorageAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
};

const profileStore = createFitProfileStore(storage);

const SOURCE_LABEL: Record<string, string> = {
  scanned: 'Scanned',
  estimated: 'From shoe size',
  manual: 'Typed in',
};

function daysAgo(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
  if (diff === 0) return 'saved today';
  if (diff === 1) return 'saved yesterday';
  return `saved ${diff} days ago`;
}

function SportBand({
  label,
  imageUrl,
  onPress,
}: {
  label: string;
  imageUrl: string;
  onPress: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      style={{
        height: 110,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        marginBottom: 12,
      }}
    >
      {!imageFailed && (
        <Image
          source={{ uri: imageUrl }}
          style={{ position: 'absolute', width: '100%', height: '100%' }}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      )}
      <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.32)' }} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900', letterSpacing: 2.5, textTransform: 'uppercase' }}>
          {label}
        </Text>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>→</Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { footLength, footWidth, measureSource } = useLocalSearchParams<{
    footLength: string;
    footWidth: string;
    measureSource: string;
  }>();

  const [genderTab, setGenderTab] = useState<Gender>('mens');
  const [savedProfile, setSavedProfile] = useState<FitProfile | null>(null);

  useEffect(() => {
    profileStore.load().then(setSavedProfile);
  }, []);

  // Measurements handed over from an onboarding scan (Welcome → Scanner → here).
  const scannedLength = Number(footLength);
  const scannedWidth = Number(footWidth);
  const scannedReady =
    measureSource === 'scanned' &&
    Number.isFinite(scannedLength) &&
    Number.isFinite(scannedWidth) &&
    scannedLength > 0 &&
    scannedWidth > 0;

  const handleSportPress = (sport: Sport) => {
    if (scannedReady) {
      router.push({
        pathname: '/screens/SockSelectionScreen',
        params: {
          footLength: String(scannedLength),
          footWidth: String(scannedWidth),
          sport,
          gender: genderTab,
          widthProfile: '',
          measureSource: 'scanned',
        },
      });
      return;
    }
    router.push({
      pathname: '/screens/ManualInputScreen',
      params: { sport, gender: genderTab },
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

  const sportLabel =
    savedProfile?.sport === 'football'
      ? 'Football'
      : savedProfile?.sport === 'rugby'
      ? 'Rugby'
      : 'Running';
  const genderLabel =
    savedProfile?.gender === 'mens'
      ? "Men's"
      : savedProfile?.gender === 'womens'
      ? "Women's"
      : 'Unisex';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>

        <Text style={{ fontSize: 12, fontWeight: '900', color: '#111', letterSpacing: 4, marginBottom: 16 }}>
          FOOTFIT
        </Text>
        <Text style={{ fontSize: 32, fontWeight: '800', color: '#111', marginBottom: 4 }}>
          Find your fit.
        </Text>
        <Text style={{ fontSize: 15, color: '#666', lineHeight: 21, marginBottom: 24 }}>
          Footwear matched to your measured feet — not the size on the box.
        </Text>

        <View style={{
          flexDirection: 'row',
          gap: 24,
          borderBottomWidth: 1,
          borderBottomColor: '#e8e8e8',
          marginBottom: 24,
        }}>
          {GENDER_TABS.map((tab) => {
            const active = tab.enabled && genderTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => tab.enabled && setGenderTab(tab.id as Gender)}
                style={{
                  paddingBottom: 10,
                  borderBottomWidth: 2,
                  borderBottomColor: active ? '#111' : 'transparent',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                }}
              >
                <Text style={{
                  fontSize: 13,
                  fontWeight: '800',
                  letterSpacing: 1.5,
                  color: !tab.enabled ? '#ccc' : active ? '#111' : '#999',
                }}>
                  {tab.label}
                </Text>
                {!tab.enabled && (
                  <Text style={{ fontSize: 8, fontWeight: '800', letterSpacing: 1, color: '#ccc', marginLeft: 3 }}>
                    SOON
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {scannedReady && (
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#ebebeb',
            padding: 16,
            marginBottom: 24,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#2a8a3a', letterSpacing: 1.5, marginBottom: 4 }}>
              ✓ FEET MEASURED
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 4 }}>
              {scannedLength} × {scannedWidth}
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#999' }}>  mm</Text>
            </Text>
            <Text style={{ fontSize: 13, color: '#666' }}>
              Pick a sport below to see what fits.
            </Text>
          </View>
        )}

        {savedProfile && !scannedReady && (
          <View style={{ marginBottom: 28 }}>
            <Pressable
              onPress={handleContinue}
              style={{ backgroundColor: '#111', borderRadius: 16, padding: 20 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#888', letterSpacing: 1.5 }}>
                  YOUR FIT
                </Text>
                {SOURCE_LABEL[savedProfile.source ?? ''] && (
                  <View style={{
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.35)',
                    borderRadius: 999,
                    paddingHorizontal: 9,
                    paddingVertical: 3,
                  }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 1, textTransform: 'uppercase' }}>
                      {SOURCE_LABEL[savedProfile.source ?? '']}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 34, fontWeight: '800', color: '#fff', marginBottom: 2 }}>
                {savedProfile.footLength} × {savedProfile.footWidth}
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#888' }}>  mm</Text>
              </Text>
              <Text style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
                {genderLabel} {sportLabel} · {daysAgo(savedProfile.savedAt)}
              </Text>
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 14 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 1.5 }}>
                  SHOP YOUR FIT
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>→</Text>
              </View>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable
                onPress={() => router.push({
                  pathname: '/screens/OwnedShoesScreen',
                  params: { gender: savedProfile.gender },
                })}
                style={{
                  flex: 1,
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: '#d5d5d5',
                  borderRadius: 4,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#111', letterSpacing: 1 }}>MY SHOES</Text>
              </Pressable>
              <Pressable
                onPress={handleStartFresh}
                style={{
                  flex: 1,
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: '#d5d5d5',
                  borderRadius: 4,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#111', letterSpacing: 1 }}>START FRESH</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text style={{ fontSize: 11, fontWeight: '800', color: '#999', letterSpacing: 1.5, marginBottom: 12 }}>
          CHOOSE YOUR SPORT
        </Text>

        {SPORTS.map((sport) => (
          <SportBand
            key={sport.id}
            label={sport.label}
            imageUrl={sport.imageUrl}
            onPress={() => handleSportPress(sport.id)}
          />
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

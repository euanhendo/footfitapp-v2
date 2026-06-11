import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SectionList,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  getSocksForSport,
  groupSocksByBrand,
  SockBrandSection,
  SockEntry,
} from '../../lib/fitting';
import sockDatabase from '../../sockDatabase.json';

type SockDb = Record<string, SockEntry>;
const socks = sockDatabase as SockDb;

function brandInitials(brand: string): string {
  const words = brand.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function brandColor(brand: string): string {
  let hash = 0;
  for (let i = 0; i < brand.length; i++) hash = (hash * 31 + brand.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 42%)`;
}

function isUsableImage(uri: string): boolean {
  return !!uri && !uri.includes('via.placeholder.com');
}

function SockThumb({ uri, brand }: { uri: string; brand: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const size = 48;
  const showImage = isUsableImage(uri) && !failed;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        marginRight: 12,
        overflow: 'hidden',
        backgroundColor: brandColor(brand),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
        {brandInitials(brand)}
      </Text>
      {showImage && (
        <Image
          source={{ uri }}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            opacity: loaded ? 1 : 0,
          }}
          resizeMode="cover"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}

export default function SockSelectionScreen() {
  const [sockType, setSockType] = useState('');
  const [query, setQuery] = useState('');
  const { footLength, footWidth, sport, gender, widthProfile, measureSource } =
    useLocalSearchParams<{
      footLength: string;
      footWidth: string;
      sport: string;
      gender: string;
      widthProfile: string;
      measureSource: string;
    }>();

  const sockOptions = useMemo(() => getSocksForSport(socks, sport ?? ''), [sport]);

  const sections: SockBrandSection[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? sockOptions.filter(
          (sock) =>
            sock.brand.toLowerCase().includes(q) || sock.name.toLowerCase().includes(q),
        )
      : sockOptions;
    return groupSocksByBrand(filtered);
  }, [sockOptions, query]);

  const handleNext = () => {
    router.push({
      pathname: '/screens/ResultScreen',
      params: {
        footLength,
        footWidth,
        sockType,
        sport,
        gender,
        widthProfile: widthProfile ?? '',
        measureSource: measureSource ?? '',
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f9f9f9' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ padding: 20, flex: 1 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 8 }}>
          Select your sock
        </Text>
        <Text style={{ fontSize: 15, color: '#555', marginBottom: 16 }}>
          Search by brand — sock thickness is added to your foot measurements.
        </Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search brands (e.g. Nike)"
          placeholderTextColor="#999"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={Keyboard.dismiss}
          style={{
            borderWidth: 1,
            borderColor: '#e8e8e8',
            backgroundColor: '#fff',
            borderRadius: 10,
            padding: 12,
            marginBottom: 12,
            fontSize: 16,
          }}
        />

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <Text style={{ color: '#666', padding: 16, textAlign: 'center' }}>
              No socks match &quot;{query}&quot;.
            </Text>
          }
          renderSectionHeader={({ section }) => (
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 1,
                color: '#666',
                marginTop: 12,
                marginBottom: 8,
                textTransform: 'uppercase',
              }}
            >
              {section.brand}
            </Text>
          )}
          renderItem={({ item }) => {
            const selected = item.key === sockType;
            return (
              <Pressable
                onPress={() => setSockType(item.key)}
                style={{
                  padding: 10,
                  borderWidth: 1,
                  borderColor: selected ? '#111' : '#e8e8e8',
                  backgroundColor: selected ? '#111' : '#fff',
                  borderRadius: 14,
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <SockThumb uri={item.imageUrl} brand={item.brand} />
                <Text
                  style={{
                    color: selected ? '#fff' : '#111',
                    fontWeight: '600',
                    fontSize: 15,
                    flex: 1,
                  }}
                >
                  {item.name}
                </Text>
                <Text style={{ color: selected ? '#fff' : '#666', fontSize: 13 }}>
                  +{item.thickness}mm
                </Text>
              </Pressable>
            );
          }}
        />

        <Pressable
          onPress={handleNext}
          disabled={!sockType}
          style={{
            backgroundColor: sockType ? '#111' : '#ccc',
            padding: 14,
            borderRadius: 10,
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Next</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

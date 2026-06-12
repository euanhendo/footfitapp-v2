import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  getSocksForSport,
  groupSocksByBrand,
  SockEntry,
} from '../../lib/fitting';
import { usePalette } from '../../lib/theme';
import sockDatabase from '../../sockDatabase.json';

type SockDb = Record<string, SockEntry>;
const socks = sockDatabase as SockDb;

const ALL_BRANDS = 'All';

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
  const size = 44;
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
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
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
  const p = usePalette();
  const [sockType, setSockType] = useState('');
  const [query, setQuery] = useState('');
  const [activeBrand, setActiveBrand] = useState(ALL_BRANDS);
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

  const brands = useMemo(
    () => [ALL_BRANDS, ...groupSocksByBrand(sockOptions).map((s) => s.brand)],
    [sockOptions],
  );

  const visibleSocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sockOptions.filter((sock) => {
      if (activeBrand !== ALL_BRANDS && sock.brand !== activeBrand) return false;
      if (!q) return true;
      return sock.brand.toLowerCase().includes(q) || sock.name.toLowerCase().includes(q);
    });
  }, [sockOptions, activeBrand, query]);

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
      style={{ flex: 1, backgroundColor: p.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ padding: 20, flex: 1 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search socks (e.g. Nike, grip, crew)"
          placeholderTextColor={p.faint}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={Keyboard.dismiss}
          style={{
            borderWidth: 1,
            borderColor: p.hairline,
            backgroundColor: p.card,
            color: p.text,
            borderRadius: 10,
            padding: 12,
            marginBottom: 14,
            fontSize: 16,
          }}
        />

        <View style={{ flexDirection: 'row', flex: 1 }}>
          <ScrollView
            style={{ width: 92, flexGrow: 0, marginRight: 14 }}
            showsVerticalScrollIndicator={false}
          >
            {brands.map((brand) => {
              const active = activeBrand === brand;
              return (
                <Pressable
                  key={brand}
                  onPress={() => setActiveBrand(brand)}
                  style={{
                    paddingVertical: 12,
                    paddingLeft: 9,
                    borderLeftWidth: 2,
                    borderLeftColor: active ? p.text : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '800',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: active ? p.text : p.faint,
                  }}>
                    {brand}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <FlatList
            style={{ flex: 1 }}
            data={visibleSocks}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={{ color: p.muted, padding: 16, textAlign: 'center' }}>
                No socks match{query ? ` "${query}"` : ' this brand'}.
              </Text>
            }
            renderItem={({ item }) => {
              const selected = item.key === sockType;
              // Thickness gauge: full bar = the thickest sock we carry (2.7 mm).
              const gaugeRatio = Math.min(item.thickness / 2.7, 1);
              return (
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSockType(item.key);
                  }}
                  style={{
                    padding: 10,
                    borderWidth: 1,
                    borderColor: selected ? p.ctaBg : p.cardBorder,
                    backgroundColor: selected ? p.ctaBg : p.card,
                    borderRadius: 12,
                    marginBottom: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <SockThumb uri={item.imageUrl} brand={item.brand} />
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: 9,
                      fontWeight: '800',
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      color: selected ? (p.dark ? '#666' : '#999') : p.faint,
                      marginBottom: 2,
                    }}>
                      {item.brand}
                    </Text>
                    <Text
                      style={{
                        color: selected ? p.ctaText : p.text,
                        fontWeight: '600',
                        fontSize: 14,
                      }}
                    >
                      {item.name}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: selected ? p.ctaText : p.muted, fontSize: 12, marginBottom: 4 }}>
                      +{item.thickness}mm
                    </Text>
                    <View style={{
                      width: 52,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: selected
                        ? 'rgba(127,127,127,0.35)'
                        : p.dark ? '#333' : '#e2e2e2',
                      overflow: 'hidden',
                    }}>
                      <View style={{
                        width: Math.round(52 * gaugeRatio),
                        height: 3,
                        borderRadius: 2,
                        backgroundColor: selected ? p.ctaText : p.text,
                      }} />
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        </View>

        <Pressable
          onPress={handleNext}
          disabled={!sockType}
          style={({ pressed }) => ({
            backgroundColor: sockType ? p.ctaBg : (p.dark ? '#333' : '#ccc'),
            padding: 14,
            borderRadius: 999,
            alignItems: 'center',
            marginTop: 10,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Text style={{ color: sockType ? p.ctaText : '#fff', fontWeight: '700', fontSize: 16 }}>Next</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, Linking, Pressable, Text, View } from 'react-native';
import bootDatabase from '../../bootDatabase.json';
import sockDatabase from '../../sockDatabase.json';

type Boot = {
  brand: string;
  model: string;
  gender: string;
  sport: string;
  width: string;
  minLength: number;
  maxLength: number;
  minWidth: number;
  maxWidth: number;
  price: number;
  notes: string;
  purchaseUrl: string;
  imageUrl: string;
};

type SockEntry = { brand: string; thickness: number };
type SockDb = Record<string, SockEntry>;

const socks = sockDatabase as SockDb;
const boots = bootDatabase as Boot[];

const WIDTH_COLOUR: Record<string, string> = {
  narrow: '#1a6bb5',
  standard: '#2a8a3a',
  wide: '#b55a1a',
};

function BootImage({ uri, label }: { uri: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={{ width: '100%', height: 160, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#aaa', fontSize: 13 }}>{label}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: '100%', height: 160, backgroundColor: '#f5f5f5' }}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

export default function ResultScreen() {
  const { footLength, footWidth, sockType, sport, gender } = useLocalSearchParams<{
    footLength: string;
    footWidth: string;
    sockType: string;
    sport: string;
    gender: string;
  }>();

  const length = Number(footLength);
  const width = Number(footWidth);

  const safeLength = Number.isFinite(length) ? length : 0;
  const safeWidth = Number.isFinite(width) ? width : 0;

  const safeSockType = sockType ?? '';
  const sockEntry = socks[safeSockType];
  const sockAdjustment = sockEntry ? sockEntry.thickness : 0;
  const sockLabel = sockEntry ? sockEntry.brand : 'None';

  const adjustedLength = safeLength + sockAdjustment;
  const adjustedWidth = safeWidth + sockAdjustment;

  const recommendedBoots = boots.filter((boot) => {
    const sportMatch = boot.sport === sport;
    const genderMatch = boot.gender === gender || boot.gender === 'unisex';
    const lengthMatch = adjustedLength >= boot.minLength && adjustedLength <= boot.maxLength;
    const widthMatch = adjustedWidth >= boot.minWidth && adjustedWidth <= boot.maxWidth;
    return sportMatch && genderMatch && lengthMatch && widthMatch;
  });

  const sportLabel = sport === 'football' ? 'Football boots' : 'Running shoes';

  return (
    <View style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
      <View style={{
        backgroundColor: '#111',
        padding: 16,
        margin: 16,
        borderRadius: 14,
      }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Your fit profile
        </Text>
        <Text style={{ color: '#ccc', fontSize: 13, marginBottom: 2 }}>
          {gender === 'mens' ? "Men's" : "Women's"} {sportLabel}
        </Text>
        <Text style={{ color: '#ccc', fontSize: 13, marginBottom: 2 }}>
          Foot: {safeLength} mm long × {safeWidth} mm wide
        </Text>
        <Text style={{ color: '#ccc', fontSize: 13 }}>
          Sock: {sockLabel}{sockAdjustment > 0 ? ` (+${sockAdjustment} mm)` : ''}
        </Text>
      </View>

      <Text style={{ fontSize: 18, fontWeight: '700', color: '#111', paddingHorizontal: 16, marginBottom: 12 }}>
        {recommendedBoots.length > 0
          ? `${recommendedBoots.length} match${recommendedBoots.length === 1 ? '' : 'es'} for you`
          : 'No matches found'}
      </Text>

      <FlatList
        data={recommendedBoots}
        keyExtractor={(item) => `${item.brand}-${item.model}-${item.gender}`}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 14,
            marginBottom: 14,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: '#ebebeb',
          }}>
            <BootImage uri={item.imageUrl} label={`${item.brand} ${item.model}`} />
            <View style={{ padding: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 4 }}>
                {item.brand} {item.model}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>
                  £{item.price}
                </Text>
                <View style={{
                  backgroundColor: WIDTH_COLOUR[item.width] + '18',
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: WIDTH_COLOUR[item.width], textTransform: 'capitalize' }}>
                    {item.width} fit
                  </Text>
                </View>
              </View>
              <Text style={{ color: '#666', fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
                {item.notes}
              </Text>
              <Pressable
                onPress={() => Linking.openURL(item.purchaseUrl)}
                style={{
                  backgroundColor: '#111',
                  borderRadius: 10,
                  paddingVertical: 10,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  Buy now
                </Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ padding: 16, alignItems: 'center' }}>
            <Text style={{ color: '#666', fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
              No {sportLabel.toLowerCase()} in our database match your exact measurements right now.{'\n\n'}Try adjusting your width profile on the previous screen.
            </Text>
          </View>
        }
      />
    </View>
  );
}

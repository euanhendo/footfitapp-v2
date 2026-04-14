import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Linking, Pressable, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { applySocketAdjustment, Boot, SockEntry } from '../../lib/fitting';
import { computeAffinityBoost, getScoreBreakdown, scoreAndRankBoots, ScoredBoot } from '../../lib/fitScore';
import { createFitProfileStore, StorageAdapter } from '../../lib/fitProfile';
import { createOwnedShoesStore, OwnedShoe } from '../../lib/ownedShoes';
import bootDatabase from '../../bootDatabase.json';
import sockDatabase from '../../sockDatabase.json';

type SockDb = Record<string, SockEntry>;

const socks = sockDatabase as SockDb;
const boots = bootDatabase as Boot[];

const storage: StorageAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
};

const profileStore = createFitProfileStore(storage);
const ownedStore = createOwnedShoesStore(storage);

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

function BootCard({
  item,
  muted,
  matchedShoe,
  affinityBoost,
  sockAdjustment,
  sockLabel,
}: {
  item: ScoredBoot;
  muted?: boolean;
  matchedShoe?: OwnedShoe | null;
  affinityBoost: number;
  sockAdjustment: number;
  sockLabel: string;
}) {
  const boot = item.boot;
  const [expanded, setExpanded] = useState(false);
  const breakdown = getScoreBreakdown(item);
  const total = Math.min(100, breakdown.baseScore + affinityBoost);
  return (
    <View style={{
      backgroundColor: '#fff',
      borderRadius: 14,
      marginBottom: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#ebebeb',
      opacity: muted ? 0.85 : 1,
    }}>
      <View>
        <BootImage uri={boot.imageUrl} label={`${boot.brand} ${boot.model}`} />
        <View style={{
          position: 'absolute',
          top: 8,
          right: 8,
          backgroundColor: 'rgba(0,0,0,0.65)',
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 4,
        }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
            {total}% fit
          </Text>
        </View>
      </View>
      <View style={{ padding: 14 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 4 }}>
          {boot.brand} {boot.model}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>
            £{boot.price}
          </Text>
          <View style={{
            backgroundColor: WIDTH_COLOUR[boot.width] + '18',
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: WIDTH_COLOUR[boot.width], textTransform: 'capitalize' }}>
              {boot.width} fit
            </Text>
          </View>
        </View>
        <Text style={{ color: '#666', fontSize: 13, lineHeight: 18, marginBottom: 4 }}>
          {boot.notes}
        </Text>
        <Text style={{ color: muted ? '#b55a1a' : '#999', fontSize: 12, lineHeight: 16, marginBottom: matchedShoe ? 6 : 12 }}>
          {item.explanation}
        </Text>
        {matchedShoe && (
          <View style={{
            backgroundColor: '#2a8a3a18',
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 4,
            alignSelf: 'flex-start',
            marginBottom: 12,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#2a8a3a' }}>
              Similar fit to your {matchedShoe.brand} {matchedShoe.model}
            </Text>
          </View>
        )}
        <Pressable onPress={() => setExpanded((v) => !v)} style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 12, color: '#1a6bb5', fontWeight: '700' }}>
            {expanded ? 'Hide breakdown' : 'Why this score?'}
          </Text>
        </Pressable>
        {expanded && (
          <View style={{
            backgroundColor: '#f5f5f5',
            borderRadius: 10,
            padding: 12,
            marginBottom: 12,
            gap: 4,
          }}>
            <Text style={{ fontSize: 12, color: '#111' }}>
              Length fit: {breakdown.lengthContribution} / {breakdown.lengthMax}
            </Text>
            <Text style={{ fontSize: 12, color: '#111' }}>
              Width fit: {breakdown.widthContribution} / {breakdown.widthMax}
            </Text>
            {sockAdjustment > 0 && (
              <Text style={{ fontSize: 12, color: '#666' }}>
                Sock adjustment: +{sockAdjustment} mm ({sockLabel})
              </Text>
            )}
            {affinityBoost > 0 && (
              <Text style={{ fontSize: 12, color: '#2a8a3a' }}>
                Affinity boost: +{affinityBoost}
                {matchedShoe ? ` (you own ${matchedShoe.brand} ${matchedShoe.model})` : ''}
              </Text>
            )}
            <View style={{ height: 1, backgroundColor: '#e0e0e0', marginVertical: 4 }} />
            <Text style={{ fontSize: 13, color: '#111', fontWeight: '700' }}>
              Total: {total} / 100
            </Text>
          </View>
        )}
        <Pressable
          onPress={() => Linking.openURL(boot.purchaseUrl)}
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

  const { adjustedLength, adjustedWidth } = applySocketAdjustment(safeLength, safeWidth, sockAdjustment);

  const { matches: rawMatches, nearMisses: rawNearMisses } = scoreAndRankBoots(boots, adjustedLength, adjustedWidth, sport ?? '', gender ?? '');

  const [ownedShoes, setOwnedShoes] = useState<OwnedShoe[]>([]);
  useEffect(() => {
    ownedStore.load().then(setOwnedShoes);
  }, []);

  const applyAffinity = (s: ScoredBoot): { scored: ScoredBoot; matchedShoe: OwnedShoe | null; boost: number; total: number } => {
    const { boost, matchedShoe } = computeAffinityBoost(s.boot, ownedShoes, boots);
    return {
      scored: s,
      matchedShoe,
      boost,
      total: Math.min(100, s.score + boost),
    };
  };

  const matches = rawMatches
    .map(applyAffinity)
    .sort((a, b) => b.total - a.total);
  const nearMisses = rawNearMisses
    .map(applyAffinity)
    .sort((a, b) => b.total - a.total);

  useEffect(() => {
    if (sport && gender && safeLength > 0 && safeWidth > 0 && safeSockType) {
      profileStore.save({
        sport,
        gender,
        footLength: safeLength,
        footWidth: safeWidth,
        sockType: safeSockType,
      });
    }
  }, [sport, gender, safeLength, safeWidth, safeSockType]);

  const sportLabel = sport === 'football' ? 'Football boots' : 'Running shoes';

  const headerText = matches.length > 0
    ? `${matches.length} match${matches.length === 1 ? '' : 'es'} for you`
    : nearMisses.length > 0
      ? `No exact matches — ${nearMisses.length} close alternative${nearMisses.length === 1 ? '' : 's'} below`
      : 'No matches found';

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
        {headerText}
      </Text>

      <FlatList
        data={matches}
        keyExtractor={({ scored }) => `${scored.boot.brand}-${scored.boot.model}-${scored.boot.gender}`}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <BootCard
            item={item.scored}
            matchedShoe={item.matchedShoe}
            affinityBoost={item.boost}
            sockAdjustment={sockAdjustment}
            sockLabel={sockLabel}
          />
        )}
        ListFooterComponent={
          matches.length < 3 && nearMisses.length > 0 ? (
            <View>
              <Text style={{
                fontSize: 13,
                fontWeight: '700',
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                marginTop: 8,
                marginBottom: 12,
              }}>
                Close matches
              </Text>
              {nearMisses.map(({ scored, matchedShoe, boost }) => (
                <BootCard
                  key={`${scored.boot.brand}-${scored.boot.model}-${scored.boot.gender}-near`}
                  item={scored}
                  matchedShoe={matchedShoe}
                  affinityBoost={boost}
                  sockAdjustment={sockAdjustment}
                  sockLabel={sockLabel}
                  muted
                />
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          nearMisses.length === 0 ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <Text style={{ color: '#666', fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
                No {sportLabel.toLowerCase()} in our database match your exact measurements right now.{'\n\n'}Try adjusting your width profile on the previous screen.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

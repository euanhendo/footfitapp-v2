import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { applySocketAdjustment, Boot, effectiveSizeOffset, recommendSize, SockEntry } from '../../lib/fitting';
import { computePersonalOffsetMm } from '../../lib/fitCalibration';
import {
  computeAffinityBoost,
  describeLengthFit,
  describeWidthFit,
  getScoreBreakdown,
  scoreAndRankBoots,
  ScoredBoot,
} from '../../lib/fitScore';
import { createFitProfileStore, parseMeasureSource, StorageAdapter } from '../../lib/fitProfile';
import { createOwnedShoesStore, OwnedShoe } from '../../lib/ownedShoes';
import {
  applyBootListControls,
  BootListFilters,
  BootWidth,
  collectBrands,
  SortMode,
  SurfaceFilter,
} from '../../lib/bootListControls';
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

// Swipe-to-match-your-surface selector (football only). The centred card is
// the active filter, like the Adidas shop's surface picker.
const SURFACE_PAGES: {
  key: SurfaceFilter | null;
  title: string;
  desc: string;
  imageUrl: string;
}[] = [
  {
    key: null,
    title: 'All boots',
    desc: 'Match your surface',
    imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=70&fit=crop',
  },
  {
    key: 'FG',
    title: 'Firm Ground',
    desc: 'For natural grass surfaces',
    imageUrl: 'https://images.unsplash.com/photo-1599982890963-3aabd60064d2?w=800&q=70&fit=crop',
  },
  {
    key: 'AG',
    title: 'Artificial Grass',
    desc: 'For long-bladed artificial grass',
    imageUrl: 'https://images.unsplash.com/photo-1624880357913-a8539238245b?w=800&q=70&fit=crop',
  },
  {
    key: 'SG',
    title: 'Soft Ground',
    desc: 'For wet and muddy natural surfaces',
    imageUrl: 'https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=800&q=70&fit=crop',
  },
  {
    key: 'TF',
    title: 'Turf',
    desc: 'For short-bladed artificial turf',
    imageUrl: 'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=800&q=70&fit=crop',
  },
  {
    key: 'IC',
    title: 'Indoor',
    desc: 'For flat indoor surfaces',
    imageUrl: 'https://images.unsplash.com/photo-1505666287802-931dc83948e9?w=800&q=70&fit=crop',
  },
];

function SurfaceCard({ title, desc, imageUrl, width, active }: {
  title: string;
  desc: string;
  imageUrl: string;
  width: number;
  active: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <View style={{ width, marginRight: 12 }}>
      <View style={{
        height: 96,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        marginBottom: 8,
        opacity: active ? 1 : 0.55,
      }}>
        {!imageFailed && (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        )}
      </View>
      <Text style={{
        fontSize: 14,
        fontWeight: '800',
        color: active ? '#111' : '#999',
        alignSelf: 'flex-start',
        borderBottomWidth: 2,
        borderBottomColor: active ? '#111' : 'transparent',
        paddingBottom: 3,
        marginBottom: 2,
      }}>
        {title}
      </Text>
      <Text style={{ fontSize: 12, color: '#666' }}>{desc}</Text>
    </View>
  );
}

function nextHalfSize(uk: string): string {
  const n = Number(uk);
  if (!Number.isFinite(n)) return uk;
  const next = n + 0.5;
  return Number.isInteger(next) ? String(next) : next.toFixed(1);
}

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
  adjustedLength,
  adjustedWidth,
  ownedShoes,
}: {
  item: ScoredBoot;
  muted?: boolean;
  matchedShoe?: OwnedShoe | null;
  affinityBoost: number;
  sockAdjustment: number;
  sockLabel: string;
  adjustedLength: number;
  adjustedWidth: number;
  ownedShoes: OwnedShoe[];
}) {
  const boot = item.boot;
  const [expanded, setExpanded] = useState(false);
  const breakdown = getScoreBreakdown(item);
  const total = Math.min(100, breakdown.baseScore + affinityBoost);
  const personalOffset = computePersonalOffsetMm(ownedShoes, boot.brand);
  const suggestedSize = recommendSize(adjustedLength, effectiveSizeOffset(boot, ownedShoes));
  return (
    <View style={{
      backgroundColor: '#fff',
      borderRadius: 16,
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
          top: 10,
          right: 10,
          backgroundColor: '#111',
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 5,
        }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
            {total}% FIT
          </Text>
        </View>
      </View>
      <View style={{ padding: 14 }}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#999', letterSpacing: 1.5, marginBottom: 3 }}>
          {boot.brand.toUpperCase()}
        </Text>
        <Text style={{ fontSize: 17, fontWeight: '800', color: '#111', marginBottom: 6 }}>
          {boot.model}
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
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#111', marginBottom: 4 }}>
          Suggested size: UK {suggestedSize.uk} · EU {suggestedSize.eu} · US {suggestedSize.us}
        </Text>
        {personalOffset !== 0 && (
          <Text style={{ fontSize: 11, color: '#666', marginBottom: 4, fontStyle: 'italic' }}>
            Adjusted for your {boot.brand} fits
          </Text>
        )}
        {suggestedSize.borderlineTight && (
          <Text style={{ fontSize: 12, color: '#b55a1a', marginBottom: 6 }}>
            With these socks, UK {nextHalfSize(suggestedSize.uk)} may feel better in this boot.
          </Text>
        )}
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
            <Text style={{ fontSize: 11, color: '#666', lineHeight: 15, marginBottom: 2 }}>
              {describeLengthFit(boot, adjustedLength, ownedShoes)}
            </Text>
            <Text style={{ fontSize: 12, color: '#111' }}>
              Width fit: {breakdown.widthContribution} / {breakdown.widthMax}
            </Text>
            <Text style={{ fontSize: 11, color: '#666', lineHeight: 15 }}>
              {describeWidthFit(boot, adjustedWidth)}
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
            borderRadius: 999,
            paddingVertical: 12,
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
  const { footLength, footWidth, sockType, sport, gender, widthProfile, measureSource } =
    useLocalSearchParams<{
      footLength: string;
      footWidth: string;
      sockType: string;
      sport: string;
      gender: string;
      widthProfile: string;
      measureSource: string;
    }>();

  const length = Number(footLength);
  const width = Number(footWidth);

  const safeLength = Number.isFinite(length) ? length : 0;
  const safeWidth = Number.isFinite(width) ? width : 0;

  const safeSockType = sockType ?? '';
  const sockEntry = socks[safeSockType];
  const sockAdjustment = sockEntry ? sockEntry.thickness : 0;
  const sockLabel = sockEntry ? `${sockEntry.brand} ${sockEntry.name}` : 'None';

  const { adjustedLength, adjustedWidth } = applySocketAdjustment(safeLength, safeWidth, sockAdjustment);

  const [ownedShoes, setOwnedShoes] = useState<OwnedShoe[]>([]);
  useEffect(() => {
    ownedStore.load().then(setOwnedShoes);
  }, []);

  const { matches: rawMatches, nearMisses: rawNearMisses } = scoreAndRankBoots(
    boots,
    adjustedLength,
    adjustedWidth,
    sport ?? '',
    gender ?? '',
    ownedShoes,
  );

  const applyAffinity = (s: ScoredBoot): { scored: ScoredBoot; matchedShoe: OwnedShoe | null; boost: number; total: number } => {
    const { boost, matchedShoe } = computeAffinityBoost(s.boot, ownedShoes, boots);
    return {
      scored: s,
      matchedShoe,
      boost,
      total: Math.min(100, s.score + boost),
    };
  };

  const matchesWithAffinity = rawMatches.map(applyAffinity);
  const nearMissesWithAffinity = rawNearMisses.map(applyAffinity);

  const allBrands = useMemo(
    () => collectBrands([...matchesWithAffinity, ...nearMissesWithAffinity]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawMatches, rawNearMisses, ownedShoes],
  );

  const [sort, setSort] = useState<SortMode>('score');
  const [widthFilter, setWidthFilter] = useState<Set<BootWidth>>(
    () => new Set(['narrow', 'standard', 'wide']),
  );
  const [brandFilter, setBrandFilter] = useState<Set<string> | null>(null);
  const [surface, setSurface] = useState<SurfaceFilter | null>(null);
  const surfaceListRef = useRef<FlatList>(null);
  const { width: windowWidth } = useWindowDimensions();
  const surfaceCardWidth = Math.round(windowWidth * 0.6);

  useEffect(() => {
    if (brandFilter === null && allBrands.length > 0) {
      setBrandFilter(new Set(allBrands));
    }
  }, [allBrands, brandFilter]);

  const activeBrandFilter: Set<string> = brandFilter ?? new Set(allBrands);
  const filters: BootListFilters = { widths: widthFilter, brands: activeBrandFilter, surface };

  const matches = useMemo(
    () => applyBootListControls(matchesWithAffinity, filters, sort, widthProfile),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawMatches, ownedShoes, widthFilter, activeBrandFilter, surface, sort, widthProfile],
  );
  const nearMisses = useMemo(
    () => applyBootListControls(nearMissesWithAffinity, filters, sort, widthProfile),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawNearMisses, ownedShoes, widthFilter, activeBrandFilter, surface, sort, widthProfile],
  );

  const filtersActive =
    widthFilter.size < 3 || activeBrandFilter.size < allBrands.length || surface !== null;

  const resetFilters = () => {
    setSort('score');
    setWidthFilter(new Set(['narrow', 'standard', 'wide']));
    setBrandFilter(new Set(allBrands));
    setSurface(null);
    surfaceListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const toggleWidth = (w: BootWidth) => {
    setWidthFilter((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });
  };

  const toggleBrand = (brand: string) => {
    setBrandFilter((prev) => {
      const base = prev ?? new Set(allBrands);
      const next = new Set(base);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return next;
    });
  };

  useEffect(() => {
    if (sport && gender && safeLength > 0 && safeWidth > 0 && safeSockType) {
      profileStore.save({
        sport,
        gender,
        footLength: safeLength,
        footWidth: safeWidth,
        sockType: safeSockType,
        source: parseMeasureSource(measureSource),
      });
    }
  }, [sport, gender, safeLength, safeWidth, safeSockType, measureSource]);

  const sportLabel =
    sport === 'football'
      ? 'Football boots'
      : sport === 'rugby'
      ? 'Rugby boots'
      : 'Running shoes';
  const genderLabel =
    gender === 'mens'
      ? "Men's"
      : gender === 'womens'
      ? "Women's"
      : gender === 'kids'
      ? "Kids'"
      : 'Unisex';

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
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#888', marginBottom: 8, letterSpacing: 1.5 }}>
          YOUR FIT
        </Text>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 }}>
          {adjustedLength.toFixed(1)} × {adjustedWidth.toFixed(1)}
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#888' }}>  mm with socks</Text>
        </Text>
        <Text style={{ color: '#888', fontSize: 12 }}>
          {genderLabel} {sportLabel} · {sockLabel}{sockAdjustment > 0 ? ` (+${sockAdjustment} mm)` : ''}
        </Text>
      </View>

      <Text style={{ fontSize: 18, fontWeight: '700', color: '#111', paddingHorizontal: 16, marginBottom: 12 }}>
        {headerText}
      </Text>

      {widthProfile === 'wide' && (
        <View style={{
          backgroundColor: '#fff',
          borderRadius: 14,
          padding: 14,
          marginHorizontal: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: '#ebebeb',
        }}>
          <Text style={{ fontSize: 13, color: '#666', lineHeight: 18 }}>
            Wide-fit boots are scarcer across brands — here are your closest matches.
          </Text>
        </View>
      )}

      {sport === 'football' && (
        <FlatList
          ref={surfaceListRef}
          horizontal
          data={SURFACE_PAGES}
          keyExtractor={(page) => page.title}
          showsHorizontalScrollIndicator={false}
          snapToInterval={surfaceCardWidth + 12}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: 16, paddingRight: windowWidth - surfaceCardWidth }}
          style={{ flexGrow: 0, marginBottom: 12 }}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / (surfaceCardWidth + 12));
            const page = SURFACE_PAGES[Math.min(Math.max(i, 0), SURFACE_PAGES.length - 1)];
            setSurface(page.key);
          }}
          renderItem={({ item: page }) => (
            <SurfaceCard
              title={page.title}
              desc={page.desc}
              imageUrl={page.imageUrl}
              width={surfaceCardWidth}
              active={surface === page.key}
            />
          )}
        />
      )}

      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', marginBottom: 8, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#d5d5d5' }}>
          {(['score', 'price-asc', 'price-desc'] as SortMode[]).map((mode) => {
            const label = mode === 'score' ? 'BEST FIT' : mode === 'price-asc' ? 'PRICE ↑' : 'PRICE ↓';
            const active = sort === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setSort(mode)}
                style={{
                  flex: 1,
                  backgroundColor: active ? '#111' : '#fff',
                  paddingVertical: 9,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: active ? '#fff' : '#111', fontWeight: '800', fontSize: 11, letterSpacing: 1 }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
          {(['narrow', 'standard', 'wide'] as BootWidth[]).map((w) => {
            const active = widthFilter.has(w);
            return (
              <Pressable
                key={w}
                onPress={() => toggleWidth(w)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: '#d5d5d5',
                  backgroundColor: active ? '#111' : '#fff',
                  marginRight: 8,
                }}
              >
                <Text style={{ color: active ? '#fff' : '#111', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
                  {w}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {allBrands.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {allBrands.map((brand) => {
              const active = activeBrandFilter.has(brand);
              return (
                <Pressable
                  key={brand}
                  onPress={() => toggleBrand(brand)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: '#d5d5d5',
                    backgroundColor: active ? '#111' : '#fff',
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: active ? '#fff' : '#111', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
                    {brand}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

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
            adjustedLength={adjustedLength}
            adjustedWidth={adjustedWidth}
            ownedShoes={ownedShoes}
          />
        )}
        ListFooterComponent={
          matches.length < 3 && nearMisses.length > 0 ? (
            <View>
              <Text style={{
                fontSize: 11,
                fontWeight: '800',
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: 1.5,
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
                  adjustedLength={adjustedLength}
                  adjustedWidth={adjustedWidth}
                  ownedShoes={ownedShoes}
                  muted
                />
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          nearMisses.length === 0 ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <Text style={{ color: '#666', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: filtersActive ? 12 : 0 }}>
                {filtersActive
                  ? 'No matches with current filters.'
                  : `No ${sportLabel.toLowerCase()} in our database match your exact measurements right now.\n\nTry adjusting your width profile on the previous screen.`}
              </Text>
              {filtersActive && (
                <Pressable
                  onPress={resetFilters}
                  style={{ backgroundColor: '#111', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Clear filters</Text>
                </Pressable>
              )}
            </View>
          ) : null
        }
      />
    </View>
  );
}

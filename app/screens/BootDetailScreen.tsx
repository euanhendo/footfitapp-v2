import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Linking, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import {
  applySocketAdjustment,
  Boot,
  effectiveSizeOffset,
  recommendSize,
  SockEntry,
} from '../../lib/fitting';
import { computePersonalOffsetMm } from '../../lib/fitCalibration';
import {
  computeAffinityBoost,
  computeFitScore,
  describeLengthFit,
  describeWidthFit,
  getScoreBreakdown,
} from '../../lib/fitScore';
import { StorageAdapter } from '../../lib/fitProfile';
import { createOwnedShoesStore, OwnedShoe } from '../../lib/ownedShoes';
import { usePalette } from '../../lib/theme';
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
const ownedStore = createOwnedShoesStore(storage);

const WIDTH_COLOUR: Record<string, string> = {
  narrow: '#1a6bb5',
  standard: '#2a8a3a',
  wide: '#b55a1a',
};

const SURFACE_LABEL: Record<string, string> = {
  FG: 'FIRM GROUND',
  SG: 'SOFT GROUND',
  AG: 'ARTIFICIAL GRASS',
  TF: 'TURF',
  IC: 'INDOOR',
};

function isUsableImage(uri: string | undefined): boolean {
  return !!uri && !uri.includes('via.placeholder.com');
}

function nextHalfSize(uk: string): string {
  const n = Number(uk);
  if (!Number.isFinite(n)) return uk;
  const next = n + 0.5;
  return Number.isInteger(next) ? String(next) : next.toFixed(1);
}

function SectionLabel({ children }: { children: string }) {
  const p = usePalette();
  return (
    <Text style={{ fontSize: 11, fontWeight: '800', color: p.faint, letterSpacing: 1.5, marginBottom: 8 }}>
      {children}
    </Text>
  );
}

// Shimmer placeholder while the product photo streams in.
function ImagePulse() {
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: '#dddddd', opacity: v }}
    />
  );
}

// Score contribution as a filling bar — the breakdown you can read at a glance.
function ScoreBar({ value, max }: { value: number; max: number }) {
  const p = usePalette();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.max(0, Math.min(value / max, 1)),
      duration: 650,
      delay: 150,
      useNativeDriver: false,
    }).start();
  }, [anim, value, max]);
  return (
    <View style={{
      height: 4,
      borderRadius: 2,
      backgroundColor: p.dark ? '#333' : '#e4e4e4',
      overflow: 'hidden',
      marginTop: 5,
      marginBottom: 8,
    }}>
      <Animated.View style={{
        height: 4,
        borderRadius: 2,
        backgroundColor: p.text,
        width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      }} />
    </View>
  );
}

export default function BootDetailScreen() {
  const p = usePalette();
  const { brand, model, bootGender, sport, footLength, footWidth, sockType } =
    useLocalSearchParams<{
      brand: string;
      model: string;
      bootGender: string;
      sport: string;
      footLength: string;
      footWidth: string;
      sockType: string;
    }>();

  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [ownedShoes, setOwnedShoes] = useState<OwnedShoe[]>([]);
  const scrollY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    ownedStore.load().then(setOwnedShoes);
  }, []);

  const boot = useMemo(
    () =>
      boots.find(
        (b) =>
          b.brand === brand &&
          b.model === model &&
          b.gender === bootGender &&
          b.sport === sport,
      ) ?? null,
    [brand, model, bootGender, sport],
  );

  const safeLength = Number.isFinite(Number(footLength)) ? Number(footLength) : 0;
  const safeWidth = Number.isFinite(Number(footWidth)) ? Number(footWidth) : 0;
  const sockEntry = socks[sockType ?? ''];
  const sockAdjustment = sockEntry ? sockEntry.thickness : 0;
  const sockLabel = sockEntry ? `${sockEntry.brand} ${sockEntry.name}` : 'no socks selected';
  const { adjustedLength, adjustedWidth } = applySocketAdjustment(safeLength, safeWidth, sockAdjustment);

  if (!boot) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: p.muted, fontSize: 15, textAlign: 'center' }}>
          This boot is no longer in the database.
        </Text>
      </View>
    );
  }

  const scored = computeFitScore(boot, adjustedLength, adjustedWidth, ownedShoes);
  const { boost, matchedShoe } = computeAffinityBoost(boot, ownedShoes, boots);
  const breakdown = getScoreBreakdown(scored);
  const total = Math.min(100, breakdown.baseScore + boost);
  const suggestedSize = recommendSize(adjustedLength, effectiveSizeOffset(boot, ownedShoes));
  const personalOffset = computePersonalOffsetMm(ownedShoes, boot.brand);
  const showImage = isUsableImage(boot.imageUrl) && !imageFailed;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
      >
        {/* Pull down and the photo stretches (GOAT-style rubber-band hero). */}
        <Animated.View style={{
          backgroundColor: '#f5f5f5',
          transform: [
            {
              translateY: scrollY.interpolate({
                inputRange: [-320, 0],
                outputRange: [-160, 0],
                extrapolateRight: 'clamp',
              }),
            },
            {
              scale: scrollY.interpolate({
                inputRange: [-320, 0],
                outputRange: [2, 1],
                extrapolateRight: 'clamp',
              }),
            },
          ],
        }}>
          {showImage ? (
            <View style={{ width: '100%', height: 320 }}>
              {!imageLoaded && <ImagePulse />}
              <Image
                source={{ uri: boot.imageUrl }}
                style={{ width: '100%', height: 320, opacity: imageLoaded ? 1 : 0 }}
                resizeMode="contain"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageFailed(true)}
              />
            </View>
          ) : (
            <View style={{ width: '100%', height: 320, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#999', fontSize: 13, fontWeight: '800', letterSpacing: 2 }}>
                {boot.brand.toUpperCase()}
              </Text>
              <Text style={{ color: '#bbb', fontSize: 12, marginTop: 4 }}>{boot.model}</Text>
            </View>
          )}
          <View style={{
            position: 'absolute',
            top: 14,
            right: 14,
            backgroundColor: '#111',
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
          }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}>
              {total}% FIT
            </Text>
          </View>
        </Animated.View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: p.faint, letterSpacing: 1.5, marginBottom: 4 }}>
            {boot.brand.toUpperCase()}
          </Text>
          <Text style={{ fontSize: 24, fontWeight: '800', color: p.text, marginBottom: 8 }}>
            {boot.model}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: p.text }}>£{boot.price}</Text>
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

          {(boot.surfaces?.length ?? 0) > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
              {(boot.surfaces ?? []).map((s) => (
                <View
                  key={s}
                  style={{
                    borderWidth: 1,
                    borderColor: p.chipBorder,
                    borderRadius: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1, color: p.muted }}>
                    {SURFACE_LABEL[s] ?? s}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={{
            backgroundColor: p.heroBg,
            borderWidth: 1,
            borderColor: p.heroBorder,
            borderRadius: 16,
            padding: 18,
            marginBottom: 18,
            ...(p.dark ? {} : {
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 4,
            }),
          }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#888', letterSpacing: 1.5, marginBottom: 6 }}>
              YOUR SIZE IN THIS BOOT
            </Text>
            <Text style={{ fontSize: 34, fontWeight: '800', color: '#fff' }}>
              UK {suggestedSize.uk}
            </Text>
            <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
              EU {suggestedSize.eu} · US {suggestedSize.us}
            </Text>
            {suggestedSize.borderlineTight && (
              <Text style={{ fontSize: 12, color: '#d98a4a', marginTop: 8, lineHeight: 17 }}>
                With these socks, UK {nextHalfSize(suggestedSize.uk)} may feel better in this boot.
              </Text>
            )}
            {personalOffset !== 0 && (
              <Text style={{ fontSize: 11, color: '#888', marginTop: 6, fontStyle: 'italic' }}>
                Adjusted for how your {boot.brand} shoes fit you
              </Text>
            )}
          </View>

          {matchedShoe && (
            <View style={{
              backgroundColor: '#2a8a3a18',
              borderRadius: 6,
              paddingHorizontal: 10,
              paddingVertical: 6,
              alignSelf: 'flex-start',
              marginBottom: 18,
            }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#2a8a3a' }}>
                Similar fit to your {matchedShoe.brand} {matchedShoe.model}
              </Text>
            </View>
          )}

          <SectionLabel>WHY IT SUITS YOU</SectionLabel>
          <Text style={{ color: p.text, fontSize: 14, lineHeight: 20, marginBottom: 8 }}>
            {scored.explanation}
          </Text>
          <Text style={{ color: p.muted, fontSize: 13, lineHeight: 19, marginBottom: 18 }}>
            {boot.notes}
          </Text>

          <SectionLabel>FIT BREAKDOWN</SectionLabel>
          <View style={{
            backgroundColor: p.panel,
            borderRadius: 12,
            padding: 14,
            gap: 5,
          }}>
            <Text style={{ fontSize: 13, color: p.text, fontWeight: '700' }}>
              Length: {breakdown.lengthContribution} / {breakdown.lengthMax}
            </Text>
            <ScoreBar value={breakdown.lengthContribution} max={breakdown.lengthMax} />
            <Text style={{ fontSize: 12, color: p.muted, lineHeight: 17, marginBottom: 4 }}>
              {describeLengthFit(boot, adjustedLength, ownedShoes)}
            </Text>
            <Text style={{ fontSize: 13, color: p.text, fontWeight: '700' }}>
              Width: {breakdown.widthContribution} / {breakdown.widthMax}
            </Text>
            <ScoreBar value={breakdown.widthContribution} max={breakdown.widthMax} />
            <Text style={{ fontSize: 12, color: p.muted, lineHeight: 17 }}>
              {describeWidthFit(boot, adjustedWidth)}
            </Text>
            {sockAdjustment > 0 && (
              <Text style={{ fontSize: 12, color: p.muted, marginTop: 4 }}>
                Sock allowance: +{sockAdjustment} mm ({sockLabel})
              </Text>
            )}
            {boost > 0 && (
              <Text style={{ fontSize: 12, color: '#2a8a3a', marginTop: 2 }}>
                Brand familiarity: +{boost}
                {matchedShoe ? ` (you own ${matchedShoe.brand} ${matchedShoe.model})` : ''}
              </Text>
            )}
            <View style={{ height: 1, backgroundColor: p.hairline, marginVertical: 6 }} />
            <Text style={{ fontSize: 14, color: p.text, fontWeight: '800' }}>
              Total: {total} / 100
            </Text>
          </View>
        </View>
      </Animated.ScrollView>

      <View style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: 16,
        paddingBottom: 28,
        backgroundColor: p.bg,
        borderTopWidth: 1,
        borderTopColor: p.hairline,
        ...(p.dark ? {} : {
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
          elevation: 8,
        }),
      }}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Linking.openURL(boot.purchaseUrl);
          }}
          style={({ pressed }) => ({
            backgroundColor: p.ctaBg,
            borderRadius: 999,
            paddingVertical: 15,
            alignItems: 'center',
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Text style={{ color: p.ctaText, fontWeight: '700', fontSize: 15 }}>
            Buy — £{boot.price}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '../../lib/theme';

type Sport = 'football' | 'running' | 'rugby';
type Gender = 'mens' | 'womens' | 'unisex';

function confidenceLabel(confidence: number): { label: string; color: string } {
  if (confidence >= 0.8) return { label: 'High confidence', color: '#2a8a3a' };
  if (confidence >= 0.5) return { label: 'Medium confidence', color: '#b55a1a' };
  return { label: 'Low confidence', color: '#b53a3a' };
}

export default function ScanReviewScreen() {
  const p = usePalette();
  const params = useLocalSearchParams<{
    lengthMm: string;
    widthMm: string;
    confidence: string;
    imageUri: string;
    reference: string;
    sport: Sport;
    gender: Gender;
  }>();

  const lengthMm = Number(params.lengthMm);
  const widthMm = Number(params.widthMm);
  const confidence = Number(params.confidence);
  const { sport, gender } = params;

  const valid =
    Number.isFinite(lengthMm) &&
    Number.isFinite(widthMm) &&
    Number.isFinite(confidence) &&
    lengthMm > 0 &&
    widthMm > 0;

  const conf = confidenceLabel(confidence);
  const confPct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  const lowConfidence = valid && confidence < 0.5;

  const [truthLength, setTruthLength] = useState('');
  const [truthWidth, setTruthWidth] = useState('');
  const [lastDelta, setLastDelta] = useState<{ length: number; width: number } | null>(null);

  const handleLogDelta = () => {
    const tl = Number(truthLength);
    const tw = Number(truthWidth);
    if (!Number.isFinite(tl) || !Number.isFinite(tw) || tl <= 0 || tw <= 0) return;
    const delta = { length: lengthMm - tl, width: widthMm - tw };
    setLastDelta(delta);
    console.log('[scan-accuracy]', {
      reportedLengthMm: lengthMm,
      reportedWidthMm: widthMm,
      truthLengthMm: tl,
      truthWidthMm: tw,
      deltaLengthMm: delta.length,
      deltaWidthMm: delta.width,
      confidence,
    });
  };

  // Onboarding scan (Welcome → Scanner): no sport/gender chosen yet, so hand the
  // measurements to Home and let the sport bands carry them forward.
  const onboarding = !sport || !gender;

  const handleUse = () => {
    if (!valid) return;
    if (onboarding) {
      router.replace({
        pathname: '/screens/HomeScreen',
        params: {
          footLength: String(Math.round(lengthMm)),
          footWidth: String(Math.round(widthMm)),
          measureSource: 'scanned',
        },
      });
      return;
    }
    router.replace({
      pathname: '/screens/SockSelectionScreen',
      params: {
        footLength: String(Math.round(lengthMm)),
        footWidth: String(Math.round(widthMm)),
        sport: sport ?? '',
        gender: gender ?? '',
        widthProfile: '',
        measureSource: 'scanned',
      },
    });
  };

  const handleEditManually = () => {
    if (!valid) return;
    if (onboarding) {
      // ManualInput needs a sport — send them to Home to pick one instead.
      router.replace('/screens/HomeScreen');
      return;
    }
    router.replace({
      pathname: '/screens/ManualInputScreen',
      params: {
        sport: sport ?? '',
        gender: gender ?? '',
        footLength: String(Math.round(lengthMm)),
        footWidth: String(Math.round(widthMm)),
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: p.text, marginBottom: 6 }}>
          Scan result
        </Text>
        <Text style={{ fontSize: 14, color: p.muted, marginBottom: 20 }}>
          Review the measurements before continuing. Re-scan if anything looks off.
        </Text>

        {!valid ? (
          <View
            style={{
              backgroundColor: p.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: p.cardBorder,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 14, color: '#b53a3a', fontWeight: '700' }}>
              Scan data missing or invalid. Please re-scan.
            </Text>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: p.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: p.cardBorder,
              padding: 18,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
              <View>
                <Text style={{ fontSize: 12, color: p.faint, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Length
                </Text>
                <Text style={{ fontSize: 28, fontWeight: '800', color: p.text }}>
                  {Math.round(lengthMm)} mm
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: 12, color: p.faint, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Width
                </Text>
                <Text style={{ fontSize: 28, fontWeight: '800', color: p.text }}>
                  {Math.round(widthMm)} mm
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 12, color: p.faint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
              {conf.label} · {confPct}%
            </Text>
            <View
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: p.panel,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${confPct}%`,
                  height: '100%',
                  backgroundColor: conf.color,
                }}
              />
            </View>
          </View>
        )}

        {lowConfidence && (
          <View
            style={{
              backgroundColor: '#fff4ec',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#f2d3b0',
              padding: 12,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 13, color: '#8a4a1a', lineHeight: 18 }}>
              Scan looks low-confidence. Edit the numbers manually or re-scan with the reference
              object fully visible.
            </Text>
          </View>
        )}

        {lowConfidence ? (
          <Pressable
            onPress={handleEditManually}
            disabled={!valid}
            style={{
              backgroundColor: valid ? p.ctaBg : (p.dark ? '#333' : '#ccc'),
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <Text style={{ color: valid ? p.ctaText : '#fff', fontSize: 15, fontWeight: '700' }}>
              {onboarding ? 'Continue without scan' : 'Edit measurements'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleUse}
            disabled={!valid}
            style={{
              backgroundColor: valid ? p.ctaBg : (p.dark ? '#333' : '#ccc'),
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <Text style={{ color: valid ? p.ctaText : '#fff', fontSize: 15, fontWeight: '700' }}>
              Use these measurements
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => router.back()}
          style={{
            backgroundColor: p.card,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: p.hairline,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>Re-scan</Text>
        </Pressable>

        {__DEV__ && valid && (
          <View
            style={{
              marginTop: 24,
              backgroundColor: p.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: p.cardBorder,
              padding: 14,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: p.faint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              Dev · accuracy harness
            </Text>
            <View style={{ flexDirection: 'row', marginBottom: 10 }}>
              <TextInput
                value={truthLength}
                onChangeText={setTruthLength}
                placeholder="True length mm"
                keyboardType="numeric"
                placeholderTextColor={p.faint}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: p.hairline,
                  color: p.text,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  marginRight: 8,
                  fontSize: 14,
                }}
              />
              <TextInput
                value={truthWidth}
                onChangeText={setTruthWidth}
                placeholder="True width mm"
                keyboardType="numeric"
                placeholderTextColor={p.faint}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: p.hairline,
                  color: p.text,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  fontSize: 14,
                }}
              />
            </View>
            <Pressable
              onPress={handleLogDelta}
              style={{
                backgroundColor: p.ctaBg,
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: p.ctaText, fontSize: 13, fontWeight: '700' }}>Log delta to console</Text>
            </Pressable>
            {lastDelta && (
              <Text style={{ marginTop: 8, fontSize: 12, color: p.muted }}>
                Δlength {lastDelta.length.toFixed(1)} mm · Δwidth {lastDelta.width.toFixed(1)} mm
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

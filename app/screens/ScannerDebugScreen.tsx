import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { detectContours as nativeDetectContours } from '../../modules/footfit-vision';
import { CandidateDebug, debugTopCandidates, pickContours } from '../../lib/scanner/contourPicker';
import { Point, ReferenceKind } from '../../lib/scanner/types';

type Result = {
  totalContours: number;
  referencePoints: number;
  footPoints: number;
  rawSample: Point[];
  topCandidates: CandidateDebug[];
};

export default function ScannerDebugScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [kind, setKind] = useState<ReferenceKind>('a4');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const cameraRef = useRef<CameraView | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!busy) {
      progress.setValue(0);
      setElapsed(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    );
    anim.start();
    const start = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 100);
    return () => {
      anim.stop();
      clearInterval(id);
    };
  }, [busy, progress]);

  const handleCapture = async () => {
    if (busy || !cameraRef.current) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: true });
      if (!photo?.uri) {
        setError('Camera returned no image.');
        return;
      }
      const raw = await nativeDetectContours(photo.uri);
      const picked = pickContours(raw, kind);
      const topCandidates = debugTopCandidates(raw, kind, 5);
      setResult({
        totalContours: raw.length,
        referencePoints: picked?.reference.length ?? 0,
        footPoints: picked?.foot.length ?? 0,
        rawSample: raw[0]?.slice(0, 3) ?? [],
        topCandidates,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      Alert.alert('Debug capture failed', message);
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9', justifyContent: 'center' }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 8 }}>
            Camera permission needed
          </Text>
          <Pressable
            onPress={requestPermission}
            style={{ backgroundColor: '#111', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Grant access</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['bottom']}>
      <View style={{ flex: 1 }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      </View>

      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16, backgroundColor: '#111' }}>
        <View style={{ marginBottom: 14, padding: 12, backgroundColor: '#1a1a1a', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a' }}>
          <Text style={{ color: '#7bff9f', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
            How to test (keep consistent)
          </Text>
          <Text style={{ color: '#ddd', fontSize: 12, lineHeight: 18 }}>
            1. Lay A4 flat on a dark, plain surface (wood / dark rug — not white tile).{'\n'}
            2. Stand bare-footed on the A4. Heel at one short edge, toes pointing to the other.{'\n'}
            3. Hold phone directly overhead, parallel to the floor (not tilted).{'\n'}
            4. Frame the whole A4 + foot with ~10% margin around the paper.{'\n'}
            5. Even light, no shadow of you or the phone on the paper. Hold still, then tap Capture.
          </Text>
        </View>

        <Text style={{ color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
          Reference
        </Text>
        <View style={{ flexDirection: 'row', marginBottom: 14 }}>
          {(['a4', 'card', 'coin_gbp_1'] as ReferenceKind[]).map((option, i) => {
            const active = kind === option;
            const label = option === 'a4' ? 'A4' : option === 'card' ? 'Card' : 'Coin';
            return (
              <Pressable
                key={option}
                onPress={() => setKind(option)}
                style={{
                  flex: 1,
                  backgroundColor: active ? '#fff' : '#222',
                  borderRadius: 10,
                  paddingVertical: 8,
                  marginRight: i === 2 ? 0 : 6,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#111' : '#fff' }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={handleCapture}
          disabled={busy}
          style={{
            backgroundColor: busy ? '#555' : '#fff',
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
            marginBottom: busy ? 8 : 14,
          }}
        >
          <Text style={{ color: '#111', fontSize: 15, fontWeight: '700' }}>
            {busy ? 'Detecting…' : 'Capture & detect'}
          </Text>
        </Pressable>

        {busy && (
          <View style={{ marginBottom: 14 }}>
            <View style={{ height: 4, backgroundColor: '#333', borderRadius: 2, overflow: 'hidden' }}>
              <Animated.View
                style={{
                  height: 4,
                  width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  backgroundColor: '#7bff9f',
                }}
              />
            </View>
            <Text style={{ color: '#888', fontSize: 11, marginTop: 4 }}>
              Detecting… {elapsed.toFixed(1)}s
            </Text>
          </View>
        )}

        {error && (
          <Text style={{ color: '#ff7b7b', fontSize: 13, marginBottom: 8 }}>Error: {error}</Text>
        )}

        {result && (
          <View>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 6 }}>
              Total contours: {result.totalContours}
            </Text>
            <Text style={{ color: '#fff', fontSize: 13, marginBottom: 4 }}>
              Reference points: {result.referencePoints}
            </Text>
            <Text style={{ color: '#fff', fontSize: 13, marginBottom: 4 }}>
              Foot points: {result.footPoints}
            </Text>
            {result.rawSample.length > 0 && (
              <Text style={{ color: '#888', fontSize: 11, marginTop: 6 }}>
                First-contour sample: {result.rawSample.map((p) => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join(' ')}
              </Text>
            )}

            {result.topCandidates.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
                  Top 5 candidates (by score)
                </Text>
                {result.topCandidates.map((c, i) => (
                  <Text key={i} style={{ color: i === 0 ? '#7bff9f' : '#ccc', fontSize: 11, fontFamily: 'Courier', marginBottom: 2 }}>
                    {`#${i + 1}  pts=${c.points.toString().padStart(4)}  asp=${c.aspect.toFixed(2)}  fill=${c.fillRatio.toFixed(2)}  area=${c.area.toExponential(1)}  score=${c.score.toFixed(3)}`}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

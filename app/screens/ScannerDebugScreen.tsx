import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { detectScene } from '../../modules/footfit-vision';
import { pickFootFromQuad } from '../../lib/scanner/contourPicker';
import { measureFromQuadAndFoot } from '../../lib/scanner/footMetrics';
import { FootMetrics, Point, ReferenceKind } from '../../lib/scanner/types';

type Result = {
  totalContours: number;
  quadFound: boolean;
  quadAspect: number | null;
  referencePoints: number;
  footPoints: number;
  metrics: FootMetrics | null;
};

function quadAspect(quad: Point[]): number | null {
  if (!quad || quad.length !== 4) return null;
  const [tl, tr, br, bl] = quad;
  const top = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const right = Math.hypot(br.x - tr.x, br.y - tr.y);
  const bottom = Math.hypot(br.x - bl.x, br.y - bl.y);
  const left = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const horiz = (top + bottom) / 2;
  const vert = (right + left) / 2;
  const long = Math.max(horiz, vert);
  const short = Math.min(horiz, vert);
  if (long === 0) return null;
  return short / long;
}

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
      const { quad, contours } = await detectScene(photo.uri);
      const picked = quad ? pickFootFromQuad(quad, contours) : null;
      const metrics = picked ? measureFromQuadAndFoot(picked.reference, picked.foot, kind) : null;
      setResult({
        totalContours: contours.length,
        quadFound: !!quad,
        quadAspect: quad ? quadAspect(quad) : null,
        referencePoints: picked?.reference.length ?? 0,
        footPoints: picked?.foot.length ?? 0,
        metrics,
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
            1. Lay A4 flat on the floor with one <Text style={{ fontWeight: '800' }}>short edge pressed against a wall</Text>.{'\n'}
            2. Stand facing the wall. Slide your foot onto the paper so your <Text style={{ fontWeight: '800' }}>heel presses against the wall</Text> (and the paper edge).{'\n'}
            3. Hold the phone directly overhead, parallel to the floor. Frame the whole A4 and your foot with ~10% margin.{'\n'}
            4. Even light, no shadow of you or the phone on the paper. Tap Capture.
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
            <View style={{ marginBottom: 10, padding: 10, backgroundColor: '#1a1a2a', borderRadius: 8, borderWidth: 1, borderColor: '#2a2a4a' }}>
              <Text style={{ color: '#7b9fff', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' }}>
                A4 quad (VNDetectRectanglesRequest)
              </Text>
              <Text style={{ color: result.quadFound ? '#7b9fff' : '#ff7b7b', fontSize: 13, fontWeight: '700' }}>
                {result.quadFound ? 'Found' : 'Not found'}
                {result.quadAspect !== null && ` · aspect ${result.quadAspect.toFixed(3)} (A4 ≈ 0.707)`}
              </Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 13, marginBottom: 4 }}>
              Total contours: {result.totalContours}
            </Text>
            <Text style={{ color: '#fff', fontSize: 13, marginBottom: 4 }}>
              Foot points (inside quad): {result.footPoints}
            </Text>
            {result.metrics ? (
              <View style={{ marginTop: 10, padding: 10, backgroundColor: '#1a2a1a', borderRadius: 8, borderWidth: 1, borderColor: '#2a4a2a' }}>
                <Text style={{ color: '#7bff9f', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' }}>
                  Measurement (heel-at-wall)
                </Text>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                  Length: {result.metrics.lengthMm.toFixed(1)} mm
                </Text>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                  Width: {result.metrics.widthMm.toFixed(1)} mm
                </Text>
                <Text style={{ color: '#ccc', fontSize: 12, marginTop: 2 }}>
                  Confidence: {(result.metrics.confidence * 100).toFixed(0)}%
                </Text>
                {result.metrics.widthMm > 0 && (
                  <Text style={{ color: '#888', fontSize: 11, marginTop: 2 }}>
                    Foot aspect: {(result.metrics.lengthMm / result.metrics.widthMm).toFixed(2)} (expected 2.2–2.8)
                  </Text>
                )}
              </View>
            ) : (
              <Text style={{ color: '#ff7b7b', fontSize: 12, marginTop: 8 }}>
                No measurement — {result.quadFound ? 'no foot contour inside the quad' : 'no A4 quad detected'}.
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

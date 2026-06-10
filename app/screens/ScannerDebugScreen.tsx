import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { detectScene } from '../../modules/footfit-vision';
import { pickFootFromQuad, pickReferenceQuad } from '../../lib/scanner/contourPicker';
import { denormalizePoints } from '../../lib/scanner/denormalize';
import { findHeelEdge, measureFromQuadAndFoot } from '../../lib/scanner/footMetrics';
import { medianMetrics } from '../../lib/scanner/multiCapture';
import { FootMetrics, Point, ReferenceKind } from '../../lib/scanner/types';

type Result = {
  totalContours: number;
  quadFound: boolean;
  quadAspect: number | null;
  referencePoints: number;
  footPoints: number;
  metrics: FootMetrics | null;
  photoUri: string;
  photoW: number;
  photoH: number;
  quad: Point[] | null;
  foot: Point[] | null;
};

const A4_QUAD_ASPECT = 210 / 297; // ≈ 0.707, short/long

function captureVerdict(r: Result): { ok: boolean; msg: string } {
  if (!r.quadFound) {
    return {
      ok: false,
      msg: "Can't find the paper. Get the whole sheet in frame and avoid glare or shadows across it.",
    };
  }
  if (r.quadAspect !== null && Math.abs(r.quadAspect - A4_QUAD_ASPECT) > 0.12) {
    return {
      ok: false,
      msg: `Paper shape looks skewed (${r.quadAspect.toFixed(2)} vs 0.71) — the phone probably isn't level. Hold it flat, directly overhead.`,
    };
  }
  if (!r.metrics || r.metrics.widthMm <= 0) {
    return {
      ok: false,
      msg: 'Paper found, but no foot outline inside it. Bare foot or a light sock gives better contrast against the paper.',
    };
  }
  const aspect = r.metrics.lengthMm / r.metrics.widthMm;
  if (aspect < 1.8 || aspect > 4) {
    return {
      ok: false,
      msg: `Foot outline looks wrong (aspect ${aspect.toFixed(1)}, expected ~2.0–3.8). Check the paper is flat on the floor and your whole foot is on it.`,
    };
  }
  if (r.metrics.confidence < 0.5) {
    return {
      ok: false,
      msg: 'Low confidence — retake. Phone level, even light, heel pressed to the wall.',
    };
  }
  return { ok: true, msg: 'Clean capture. Take 2–3 in a row — the session median below is the number that counts.' };
}

// Points arrive in pixel coords with origin bottom-left; view space is top-left, so y flips
function SceneOverlay({
  uri,
  photoW,
  photoH,
  quad,
  foot,
}: {
  uri: string;
  photoW: number;
  photoH: number;
  quad: Point[] | null;
  foot: Point[] | null;
}) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const hasDims = photoW > 0 && photoH > 0;
  const aspect = hasDims ? photoW / photoH : 3 / 4;
  const heel = quad && foot ? findHeelEdge(quad, foot) : null;
  const toView = (p: Point, b: { w: number; h: number }) => ({
    x: (p.x / photoW) * b.w,
    y: (1 - p.y / photoH) * b.h,
  });
  return (
    <View
      style={{ width: '100%', aspectRatio: aspect, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' }}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      {box &&
        hasDims &&
        quad &&
        quad.length === 4 &&
        quad.map((a, i) => {
          const b = quad[(i + 1) % 4];
          const { x: ax, y: ay } = toView(a, box);
          const { x: bx, y: by } = toView(b, box);
          const len = Math.hypot(bx - ax, by - ay);
          if (len === 0) return null;
          const angle = Math.atan2(by - ay, bx - ax);
          return (
            <View
              key={`q${i}`}
              style={{
                position: 'absolute',
                left: (ax + bx) / 2 - len / 2,
                top: (ay + by) / 2 - 1.5,
                width: len,
                height: 3,
                backgroundColor: '#7b9fff',
                borderRadius: 2,
                transform: [{ rotateZ: `${angle}rad` }],
              }}
            />
          );
        })}
      {box &&
        hasDims &&
        heel &&
        (() => {
          const { x: ax, y: ay } = toView(heel.a, box);
          const { x: bx, y: by } = toView(heel.b, box);
          const len = Math.hypot(bx - ax, by - ay);
          if (len === 0) return null;
          const angle = Math.atan2(by - ay, bx - ax);
          return (
            <View
              style={{
                position: 'absolute',
                left: (ax + bx) / 2 - len / 2,
                top: (ay + by) / 2 - 2.5,
                width: len,
                height: 5,
                backgroundColor: '#7bff9f',
                borderRadius: 3,
                transform: [{ rotateZ: `${angle}rad` }],
              }}
            />
          );
        })()}
      {box &&
        hasDims &&
        foot &&
        (() => {
          const step = Math.max(1, Math.ceil(foot.length / 120));
          const dots = [];
          for (let i = 0; i < foot.length; i += step) {
            const p = toView(foot[i], box);
            dots.push(
              <View
                key={`f${i}`}
                style={{
                  position: 'absolute',
                  left: p.x - 2,
                  top: p.y - 2,
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#ffb37b',
                }}
              />,
            );
          }
          return dots;
        })()}
    </View>
  );
}

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
  const [preview, setPreview] = useState<{ width: number; height: number } | null>(null);
  const [session, setSession] = useState<FootMetrics[]>([]);
  const [flashOn, setFlashOn] = useState(true);
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
      // skipProcessing would leave EXIF rotation unbaked, breaking overlay coordinate mapping
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) {
        setError('Camera returned no image.');
        return;
      }
      const scene = await detectScene(photo.uri);
      // Vision coords are normalized to a unit square — convert to pixels before any math.
      // Prefer the dims Vision actually analyzed; fall back to camera dims on a stale native build.
      const imgW = scene.width > 0 ? scene.width : (photo.width ?? 0);
      const imgH = scene.height > 0 ? scene.height : (photo.height ?? 0);
      const hasDims = imgW > 0 && imgH > 0;
      // Choose the paper among candidate rectangles (bright + A4-shaped beats dark tiles);
      // fall back to Vision's top pick on a stale native build with no candidates
      const candidatesPx = hasDims
        ? scene.candidates.map((c) => ({ ...c, quad: denormalizePoints(c.quad, imgW, imgH) }))
        : scene.candidates;
      const fallbackQuad = scene.quad && hasDims ? denormalizePoints(scene.quad, imgW, imgH) : scene.quad;
      const quad = pickReferenceQuad(candidatesPx) ?? fallbackQuad;
      const contours = hasDims
        ? scene.contours.map((c) => denormalizePoints(c, imgW, imgH))
        : scene.contours;
      const picked = quad ? pickFootFromQuad(quad, contours) : null;
      const metrics = picked ? measureFromQuadAndFoot(picked.reference, picked.foot, kind) : null;
      if (metrics && metrics.lengthMm > 0 && metrics.confidence >= 0.3) {
        setSession((prev) => [...prev, metrics]);
      }
      const qa = quad ? quadAspect(quad) : null;
      // streams to Metro on the dev machine so capture results can be read remotely
      console.log(
        '[scan-capture]',
        JSON.stringify({
          kind,
          flash: flashOn,
          quadFound: !!quad,
          rectCandidates: scene.candidates.map((c) => Number(c.brightness.toFixed(2))),
          quadAspect: qa === null ? null : Number(qa.toFixed(3)),
          contours: contours.length,
          footPoints: picked?.foot.length ?? 0,
          lengthMm: metrics === null ? null : Number(metrics.lengthMm.toFixed(1)),
          widthMm: metrics === null ? null : Number(metrics.widthMm.toFixed(1)),
          confidence: metrics === null ? null : Number(metrics.confidence.toFixed(2)),
        }),
      );
      setResult({
        totalContours: contours.length,
        quadFound: !!quad,
        quadAspect: qa,
        referencePoints: picked?.reference.length ?? 0,
        footPoints: picked?.foot.length ?? 0,
        metrics,
        photoUri: photo.uri,
        photoW: imgW,
        photoH: imgH,
        quad,
        foot: picked?.foot ?? null,
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
      <View
        style={{ flex: 1 }}
        onLayout={(e) => setPreview({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" flash={flashOn ? 'on' : 'off'} />
        {preview &&
          (() => {
            // A4 portrait in frame: foot points away from the wall, wall edge at top
            const a4Ratio = 210 / 297;
            let guideH = preview.height * 0.86;
            let guideW = guideH * a4Ratio;
            if (guideW > preview.width * 0.82) {
              guideW = preview.width * 0.82;
              guideH = guideW / a4Ratio;
            }
            return (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: guideW,
                    height: guideH,
                    borderWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: '#7bff9f',
                    borderRadius: 6,
                  }}
                >
                  <View style={{ height: 4, backgroundColor: '#7bff9f', borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
                  <Text
                    style={{
                      color: '#7bff9f',
                      fontSize: 11,
                      fontWeight: '700',
                      alignSelf: 'center',
                      marginTop: 2,
                      backgroundColor: 'rgba(0,0,0,0.55)',
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: 4,
                    }}
                  >
                    wall edge (behind you)
                  </Text>
                </View>
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: '700',
                    marginTop: 8,
                    backgroundColor: 'rgba(0,0,0,0.55)',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                  }}
                >
                  Match the paper to this frame
                </Text>
              </View>
            );
          })()}
      </View>

      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16, backgroundColor: '#111' }}>
        <View style={{ marginBottom: 14, padding: 12, backgroundColor: '#1a1a1a', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a' }}>
          <Text style={{ color: '#7bff9f', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
            How to test (keep consistent)
          </Text>
          <Text style={{ color: '#ddd', fontSize: 12, lineHeight: 18 }}>
            1. Lay A4 flat on the floor with one <Text style={{ fontWeight: '800' }}>short edge pressed against a wall</Text>.{'\n'}
            2. Stand with your <Text style={{ fontWeight: '800' }}>back to the wall</Text>, heel pressed against it on the paper&apos;s edge. You should see{' '}
            <Text style={{ fontWeight: '800' }}>white paper beyond your toes</Text> — if not, re-jam your heel.{'\n'}
            3. Hold the phone overhead, parallel to the floor, with the{' '}
            <Text style={{ fontWeight: '800' }}>camera end pointing down your leg</Text> — the green wall-edge bar sits at the top.{'\n'}
            4. Match the paper to the dashed frame, no shadows across it. Tap Capture.
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
                onPress={() => {
                  setKind(option);
                  setSession([]);
                }}
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

        <Text style={{ color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
          Flash (kills shadows; turn off if paper glares)
        </Text>
        <View style={{ flexDirection: 'row', marginBottom: 14 }}>
          {[true, false].map((option) => {
            const active = flashOn === option;
            return (
              <Pressable
                key={option ? 'on' : 'off'}
                onPress={() => setFlashOn(option)}
                style={{
                  flex: 1,
                  backgroundColor: active ? '#fff' : '#222',
                  borderRadius: 10,
                  paddingVertical: 8,
                  marginRight: option ? 6 : 0,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#111' : '#fff' }}>
                  {option ? 'On' : 'Off'}
                </Text>
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
            {(() => {
              const v = captureVerdict(result);
              return (
                <View
                  style={{
                    marginBottom: 10,
                    padding: 10,
                    backgroundColor: v.ok ? '#1a2a1a' : '#2a1a1a',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: v.ok ? '#2a4a2a' : '#4a2a2a',
                  }}
                >
                  <Text style={{ color: v.ok ? '#7bff9f' : '#ff7b7b', fontSize: 13, fontWeight: '700', lineHeight: 18 }}>
                    {v.ok ? '✓ ' : '✕ '}
                    {v.msg}
                  </Text>
                </View>
              );
            })()}
            {!!result.photoUri && (
              <View style={{ marginBottom: 10 }}>
                <Text style={{ color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
                  What the scanner saw
                </Text>
                <SceneOverlay
                  uri={result.photoUri}
                  photoW={result.photoW}
                  photoH={result.photoH}
                  quad={result.quad}
                  foot={result.foot}
                />
                <Text style={{ color: '#888', fontSize: 11, marginTop: 4 }}>
                  <Text style={{ color: '#7b9fff', fontWeight: '700' }}>Blue</Text> = detected paper ·{' '}
                  <Text style={{ color: '#ffb37b', fontWeight: '700' }}>Orange</Text> = detected foot outline ·{' '}
                  <Text style={{ color: '#7bff9f', fontWeight: '700' }}>Green</Text> = heel edge (wall side)
                </Text>
              </View>
            )}
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
                    Foot aspect: {(result.metrics.lengthMm / result.metrics.widthMm).toFixed(2)} (expected ~2.0–3.8)
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

        {session.length > 0 &&
          (() => {
            const m = medianMetrics(session);
            return (
              <View style={{ marginTop: 12, padding: 10, backgroundColor: '#1a1a1a', borderRadius: 8, borderWidth: 1, borderColor: '#3a3a2a' }}>
                <Text style={{ color: '#ffd97b', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' }}>
                  Session median ({session.length} good capture{session.length === 1 ? '' : 's'})
                </Text>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                  Length: {m.lengthMm.toFixed(1)} mm · Width: {m.widthMm.toFixed(1)} mm
                </Text>
                <Text style={{ color: '#ccc', fontSize: 12, marginTop: 2 }}>
                  Median confidence: {(m.confidence * 100).toFixed(0)}%
                </Text>
                <Pressable onPress={() => setSession([])} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                  <Text style={{ color: '#888', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' }}>
                    Reset session
                  </Text>
                </Pressable>
              </View>
            );
          })()}
      </ScrollView>
    </SafeAreaView>
  );
}

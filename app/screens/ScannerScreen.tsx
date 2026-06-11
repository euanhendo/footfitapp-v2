import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { assessGuideFit, GuideFitStatus } from '../../lib/scanner/guideFit';
import { isTrustedCapture, medianMetrics } from '../../lib/scanner/multiCapture';
import { FootMetrics } from '../../lib/scanner/types';
import { visionKitAdapter } from '../../lib/scanner/visionKitAdapter';

type Sport = 'football' | 'running' | 'rugby';
type Gender = 'mens' | 'womens' | 'unisex';

const COACHING: Record<GuideFitStatus, string> = {
  'no-paper': 'Looking for the paper…',
  tilted: 'Hold the phone flat and level above the paper',
  'too-small': 'Bring the phone closer',
  'too-close': 'Lift the phone a little higher',
  'off-centre': 'Centre the paper in the frame',
  locked: 'Hold steady…',
};

export default function ScannerScreen() {
  const { sport, gender } = useLocalSearchParams<{ sport: Sport; gender: Gender }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState('Looking for the paper…');
  const [bursting, setBursting] = useState(false);
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<{ width: number; height: number } | null>(null);
  const cameraRef = useRef<CameraView | null>(null);

  // The probe loop must stop while ScanReview is on top and restart on re-scan
  useFocusEffect(
    useCallback(() => {
      setRunning(true);
      return () => setRunning(false);
    }, []),
  );

  useEffect(() => {
    if (!running || !permission?.granted) return;
    let cancelled = false;
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Cheap low-quality shot, flash off — just enough to find the paper
    const probe = async (): Promise<GuideFitStatus> => {
      if (!cameraRef.current) return 'no-paper';
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.2 });
      if (!photo?.uri) return 'no-paper';
      const { quad, width, height } = await visionKitAdapter.detectQuad(photo.uri);
      return assessGuideFit(quad, width, height);
    };

    (async () => {
      let hits = 0;
      while (!cancelled) {
        let fit: GuideFitStatus = 'no-paper';
        try {
          fit = await probe();
        } catch {
          fit = 'no-paper';
        }
        if (cancelled) return;
        hits = fit === 'locked' ? hits + 1 : 0;
        setStatus(fit === 'locked' && hits >= 2 ? 'Locked — measuring…' : COACHING[fit]);

        if (hits >= 2) {
          // Keep shooting until 3 captures clear the trust gate — shadow-
          // inflated outlines are rejected and retried
          setBursting(true);
          await delay(300); // let the flash setting take effect
          const trusted: FootMetrics[] = [];
          let lastUri = '';
          for (let shot = 0; shot < 7 && trusted.length < 3 && !cancelled; shot++) {
            setStatus(`Measuring — hold steady (${trusted.length} of 3)…`);
            try {
              const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
              if (photo?.uri) {
                lastUri = photo.uri;
                const metrics = await visionKitAdapter.measureFoot(photo.uri, 'a4');
                if (metrics && isTrustedCapture(metrics)) {
                  trusted.push(metrics);
                } else if (metrics && metrics.lengthMm > 0) {
                  setStatus('Shadow spotted — going again…');
                }
              }
            } catch {
              // a failed shot just costs one of the 7 attempts
            }
            await delay(400);
          }
          setBursting(false);
          if (cancelled) return;

          if (trusted.length >= 3) {
            const m = medianMetrics(trusted);
            setStatus('Done');
            router.push({
              pathname: '/screens/ScanReviewScreen',
              params: {
                lengthMm: m.lengthMm.toFixed(1),
                widthMm: m.widthMm.toFixed(1),
                confidence: m.confidence.toFixed(2),
                imageUri: lastUri,
                reference: 'a4',
                sport: sport ?? '',
                gender: gender ?? '',
              },
            });
            return;
          }
          setStatus("Couldn't get a clean read — shift so your shadow falls away from the paper");
          hits = 0;
          await delay(1500);
          continue;
        }
        await delay(700);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [running, permission?.granted, sport, gender]);

  if (!permission) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9', justifyContent: 'center' }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }} edges={['bottom']}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#111', marginBottom: 6 }}>
            Camera permission needed
          </Text>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 20 }}>
            FootFit uses the camera to scan your foot on a sheet of A4 paper so we can measure
            length and width in millimetres.
          </Text>
          <Pressable
            onPress={requestPermission}
            style={{
              backgroundColor: '#111',
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
              Grant camera access
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            style={{
              backgroundColor: '#fff',
              borderRadius: 14,
              borderWidth: 2,
              borderColor: '#e8e8e8',
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#111', fontSize: 15, fontWeight: '700' }}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['bottom']}>
      <View
        style={{ flex: 1 }}
        onLayout={(e) =>
          setPreview({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
        }
      >
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
          // flash off while probing, always on for the measuring burst —
          // standardized illumination is what the trust gate was tuned on
          flash={bursting ? 'on' : 'off'}
        />
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
                  <View
                    style={{
                      height: 4,
                      backgroundColor: '#7bff9f',
                      borderTopLeftRadius: 6,
                      borderTopRightRadius: 6,
                    }}
                  />
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
                    fontSize: 13,
                    fontWeight: '700',
                    marginTop: 10,
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  {status}
                </Text>
              </View>
            );
          })()}
      </View>

      <View style={{ backgroundColor: '#111', padding: 16 }}>
        <Text style={{ color: '#ddd', fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
          1. Lay A4 paper flat on the floor, one{' '}
          <Text style={{ fontWeight: '800' }}>short edge against the wall</Text>.{'\n'}
          2. Heel back against the wall on the paper&apos;s edge —{' '}
          <Text style={{ fontWeight: '800' }}>white paper visible beyond your toes</Text>.{'\n'}
          3. Hold the phone flat overhead, camera end pointing down your leg. It scans by itself
          when the paper matches the frame.
        </Text>
        <Pressable onPress={() => router.back()} style={{ alignSelf: 'flex-start' }}>
          <Text
            style={{
              color: '#888',
              fontSize: 13,
              fontWeight: '700',
              textDecorationLine: 'underline',
            }}
          >
            Prefer to type them in? Enter manually
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, LayoutChangeEvent, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { pixelsPerMm, calibrationConfidence } from '../../lib/scanner/calibration';
import { computeFootMetrics } from '../../lib/scanner/footMetrics';
import { getReferenceObject } from '../../lib/scanner/referenceObjects';
import { tfliteVisionAdapter } from '../../lib/scanner/tfliteVisionAdapter';
import { BBox, ReferenceKind } from '../../lib/scanner/types';

type Sport = 'football' | 'running' | 'rugby';
type Gender = 'mens' | 'womens' | 'unisex';

const REFERENCE_OPTIONS: { kind: ReferenceKind; label: string; hint: string }[] = [
  { kind: 'a4', label: 'A4 paper', hint: 'Most accurate. 297 × 210 mm.' },
  { kind: 'card', label: 'Credit / ID card', hint: 'Good fallback. 85.6 × 54 mm.' },
  { kind: 'coin_gbp_1', label: 'UK £1 coin', hint: 'Lowest precision. 23.4 mm.' },
];

export default function ScannerScreen() {
  const { sport, gender } = useLocalSearchParams<{ sport: Sport; gender: Gender }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [reference, setReference] = useState<ReferenceKind>('a4');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('auto');
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const previewLayoutRef = useRef<{ width: number; height: number } | null>(null);
  const overlayLayoutRef = useRef<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );

  const onPreviewLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    previewLayoutRef.current = { width, height };
  };

  const onOverlayLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    overlayLayoutRef.current = { x, y, width, height };
  };

  const computeOverlayHint = (photoWidth: number, photoHeight: number): BBox | undefined => {
    const preview = previewLayoutRef.current;
    const overlay = overlayLayoutRef.current;
    if (!preview || !overlay || preview.width === 0 || preview.height === 0) {
      return undefined;
    }
    return {
      x: Math.round((overlay.x / preview.width) * photoWidth),
      y: Math.round((overlay.y / preview.height) * photoHeight),
      width: Math.round((overlay.width / preview.width) * photoWidth),
      height: Math.round((overlay.height / preview.height) * photoHeight),
    };
  };

  const runPipeline = async (imageUri: string, photoWidth: number, photoHeight: number) => {
    const ref = getReferenceObject(reference);
    const hint = computeOverlayHint(photoWidth, photoHeight);
    const detected = await tfliteVisionAdapter.detectReference(imageUri, reference, hint);
    if (!detected) {
      Alert.alert('Reference not found', `Could not find ${ref.label} in the frame.`);
      return;
    }
    const pxPerMm = pixelsPerMm(ref, detected);
    const calibration = calibrationConfidence(ref, detected);
    const mask = await tfliteVisionAdapter.segmentFoot(imageUri);
    const metrics = computeFootMetrics(mask, pxPerMm);
    const combinedConfidence = Math.max(0, Math.min(1, metrics.confidence * calibration));

    router.push({
      pathname: '/screens/ScanReviewScreen',
      params: {
        lengthMm: String(metrics.lengthMm),
        widthMm: String(metrics.widthMm),
        confidence: String(combinedConfidence),
        imageUri,
        reference,
        sport: sport ?? '',
        gender: gender ?? '',
      },
    });
  };

  const handleCapture = async () => {
    if (busy) return;
    if (!cameraRef.current) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });
      if (!photo?.uri) {
        Alert.alert('Capture failed', 'The camera did not return an image.');
        return;
      }
      await runPipeline(photo.uri, photo.width ?? 0, photo.height ?? 0);
    } catch (err) {
      Alert.alert('Scan failed', err instanceof Error ? err.message : 'Unknown error');
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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }} edges={['bottom']}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#111', marginBottom: 6 }}>
            Camera permission needed
          </Text>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 20 }}>
            FootFit uses the camera to scan your foot alongside a reference object (A4 paper or
            card) so we can measure length and width in millimetres.
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

  const ref = getReferenceObject(reference);
  const overlayAspect = ref.shortMm / ref.longMm;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['bottom']}>
      <View style={{ flex: 1 }} onLayout={onPreviewLayout}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" flash={flash} />

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            onLayout={onOverlayLayout}
            style={{
              width: '60%',
              aspectRatio: overlayAspect,
              borderWidth: 2,
              borderColor: '#fff',
              borderStyle: 'dashed',
              borderRadius: 6,
              opacity: 0.85,
            }}
          />
          <Text
            style={{
              color: '#fff',
              fontSize: 12,
              marginTop: 10,
              backgroundColor: 'rgba(0,0,0,0.45)',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 6,
            }}
          >
            Place {ref.label} fully visible, next to your foot
          </Text>
        </View>
      </View>

      <View style={{ backgroundColor: '#111', padding: 16 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: '#888',
            letterSpacing: 1,
            marginBottom: 8,
            textTransform: 'uppercase',
          }}
        >
          Reference object
        </Text>
        <View style={{ flexDirection: 'row', marginBottom: 14 }}>
          {REFERENCE_OPTIONS.map((option) => {
            const active = reference === option.kind;
            return (
              <Pressable
                key={option.kind}
                onPress={() => setReference(option.kind)}
                style={{
                  flex: 1,
                  backgroundColor: active ? '#fff' : '#222',
                  borderRadius: 10,
                  paddingVertical: 8,
                  paddingHorizontal: 6,
                  marginRight: option.kind === 'coin_gbp_1' ? 0 : 6,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: active ? '#111' : '#fff',
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: '#888',
            letterSpacing: 1,
            marginBottom: 8,
            textTransform: 'uppercase',
          }}
        >
          Flash
        </Text>
        <View style={{ flexDirection: 'row', marginBottom: 14 }}>
          {(['off', 'auto', 'on'] as const).map((mode, index) => {
            const active = flash === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setFlash(mode)}
                style={{
                  flex: 1,
                  backgroundColor: active ? '#fff' : '#222',
                  borderRadius: 10,
                  paddingVertical: 8,
                  paddingHorizontal: 6,
                  marginRight: index === 2 ? 0 : 6,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: active ? '#111' : '#fff',
                    textTransform: 'capitalize',
                  }}
                >
                  {mode}
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
          }}
        >
          <Text style={{ color: '#111', fontSize: 15, fontWeight: '700' }}>
            {busy ? 'Processing…' : 'Capture'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

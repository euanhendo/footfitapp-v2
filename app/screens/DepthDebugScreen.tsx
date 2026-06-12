import { useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  arkitDepthAdapter,
  isDepthScanSupported,
} from '../../lib/scanner/depth/arkitDepthAdapter';
import {
  DepthMeasureDebug,
  measureFootFromDepthFrameDebug,
} from '../../lib/scanner/depth/footFromDepth';
import FootfitDepthView, { DepthStatus } from '../../modules/footfit-vision/depthView';

// Scanner v3 instrumentation — like ScannerDebugScreen, this deliberately
// pokes the raw pipeline so device captures can be judged against tape
// measurements before any production flow exists. The live AR view streams
// centre depth + phone tilt so the user can hold the 50–70 cm sweet spot;
// capture grabs the running session's current frame instantly.
type CaptureRow = {
  id: number;
  debug?: DepthMeasureDebug;
  error?: string;
};

const HEIGHT_MIN_MM = 500;
const HEIGHT_MAX_MM = 700;
const FLAT_MAX_DEG = 12;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function coach(status: DepthStatus | null): { text: string; ready: boolean } {
  if (!status || !status.hasDepth || status.centerDepthMm <= 0) {
    return { text: 'Waiting for the depth sensor…', ready: false };
  }
  if (status.centerDepthMm < 280) return { text: 'Too close — lift higher', ready: false };
  if (status.centerDepthMm < HEIGHT_MIN_MM) return { text: 'Lift a little higher', ready: false };
  if (status.centerDepthMm > HEIGHT_MAX_MM) return { text: 'Lower a little', ready: false };
  if (status.flatTiltDeg > FLAT_MAX_DEG) return { text: 'Hold the phone flat', ready: false };
  return { text: 'Good — hold steady', ready: true };
}

export default function DepthDebugScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [rows, setRows] = useState<CaptureRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [burstProgress, setBurstProgress] = useState(0);
  const [status, setStatus] = useState<DepthStatus | null>(null);
  const [preview, setPreview] = useState<{ width: number; height: number } | null>(null);
  const supported = isDepthScanSupported();

  const captureOne = async () => {
    const id = Date.now();
    try {
      const frame = await arkitDepthAdapter.captureDepthFrame();
      if (!frame) {
        setRows((prev) => [{ id, error: 'Bridge returned no frame' }, ...prev]);
        return;
      }
      const debug = measureFootFromDepthFrameDebug(frame);
      setRows((prev) => [{ id, debug }, ...prev]);
    } catch (e) {
      setRows((prev) => [{ id, error: e instanceof Error ? e.message : String(e) }, ...prev]);
    }
  };

  // Production pattern (mirrors v2's trusted burst): several spaced frames,
  // medianed — single dud frames can't drag the session.
  const BURST_SIZE = 5;
  const captureBurst = async () => {
    setBusy(true);
    try {
      for (let i = 1; i <= BURST_SIZE; i++) {
        setBurstProgress(i);
        await captureOne();
        if (i < BURST_SIZE) await delay(400);
      }
    } finally {
      setBurstProgress(0);
      setBusy(false);
    }
  };

  const good = rows
    .map((r) => r.debug)
    .filter((d): d is DepthMeasureDebug => !!d && d.metrics.lengthMm > 0);
  const medianLength = good.length ? median(good.map((d) => d.metrics.lengthMm)) : 0;
  const medianWidth = good.length ? median(good.map((d) => d.metrics.widthMm)) : 0;
  const latest = rows[0];
  const { text: coaching, ready } = coach(status);
  const guideColor = ready ? '#7bff9f' : '#ffcc66';

  if (!supported) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }} edges={['bottom']}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#111', marginBottom: 6 }}>
            No LiDAR on this device
          </Text>
          <Text style={{ fontSize: 14, color: '#666', lineHeight: 20 }}>
            Scene depth needs an iPhone/iPad Pro. The paper scanner remains the way to measure.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
            The depth scanner uses the camera and LiDAR to measure your foot on the bare floor —
            no paper needed.
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
        <FootfitDepthView
          style={{ flex: 1 }}
          onDepthStatus={(e) => setStatus(e.nativeEvent)}
        />
        {preview && (
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
                width: preview.height * 0.62 * 0.43,
                height: preview.height * 0.62,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: guideColor,
                borderRadius: 40,
              }}
            />
            <Text
              style={{
                color: guideColor,
                fontSize: 14,
                fontWeight: '800',
                marginTop: 10,
                backgroundColor: 'rgba(0,0,0,0.65)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              {coaching}
            </Text>
            {status && status.centerDepthMm > 0 && (
              <Text
                style={{
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: '700',
                  marginTop: 6,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 6,
                }}
              >
                height {(status.centerDepthMm / 10).toFixed(0)} cm · tilt{' '}
                {status.flatTiltDeg.toFixed(0)}°
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={{ backgroundColor: '#111', padding: 16 }}>
        {good.length >= 2 && (
          <Text style={{ color: '#7bff9f', fontSize: 13, fontWeight: '800', marginBottom: 6 }}>
            MEDIAN ({good.length} good): {medianLength.toFixed(1)} × {medianWidth.toFixed(1)} mm
          </Text>
        )}
        {latest?.error && (
          <Text style={{ color: '#ff9f7b', fontSize: 12, marginBottom: 8 }}>{latest.error}</Text>
        )}
        {latest?.debug && (
          <Text style={{ color: '#ddd', fontSize: 12, lineHeight: 18, marginBottom: 8 }}>
            Last:{' '}
            {latest.debug.metrics.lengthMm > 0
              ? `${latest.debug.metrics.lengthMm.toFixed(1)} × ${latest.debug.metrics.widthMm.toFixed(1)} mm · conf ${(latest.debug.metrics.confidence * 100).toFixed(0)}%`
              : 'no foot found'}
            {'\n'}floor {(latest.debug.floorInlierRatio * 100).toFixed(0)}% · camera{' '}
            {latest.debug.cameraHeightMm.toFixed(0)} mm up · foot {latest.debug.footPoints}/
            {latest.debug.bandPoints} pts · cloud {latest.debug.cloudPoints} pts
            {'\n'}sensor centre {latest.debug.centerDepthMm.toFixed(0)} mm · fx{' '}
            {latest.debug.fxPx.toFixed(1)} px · plane tilt{' '}
            {latest.debug.gravityTiltDeg === null
              ? 'n/a'
              : `${latest.debug.gravityTiltDeg.toFixed(1)}°`}
          </Text>
        )}
        <Pressable
          onPress={captureBurst}
          disabled={busy}
          style={{
            backgroundColor: busy ? '#555' : ready ? '#7bff9f' : '#fff',
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: busy ? '#fff' : '#111', fontSize: 15, fontWeight: '800' }}>
            {busy
              ? `Capturing ${burstProgress} of ${BURST_SIZE} — hold steady…`
              : 'Capture burst (5 frames)'}
          </Text>
        </Pressable>
        {rows.length > 0 && (
          <Pressable onPress={() => setRows([])} style={{ alignSelf: 'center', marginTop: 10 }}>
            <Text
              style={{
                color: '#888',
                fontSize: 12,
                fontWeight: '700',
                textDecorationLine: 'underline',
              }}
            >
              Reset session
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

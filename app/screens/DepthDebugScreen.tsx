import { CameraView, useCameraPermissions } from 'expo-camera';
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

// Scanner v3 instrumentation — like ScannerDebugScreen, this deliberately
// pokes the raw pipeline so device captures can be judged against tape
// measurements before any production flow exists. The camera preview is for
// aiming only: ARKit needs the camera to itself, so on capture the preview
// unmounts, the depth session takes over for ~a second, then the preview
// returns.
type CaptureRow = {
  id: number;
  debug?: DepthMeasureDebug;
  error?: string;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function DepthDebugScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [rows, setRows] = useState<CaptureRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ width: number; height: number } | null>(null);
  const supported = isDepthScanSupported();

  const capture = async () => {
    setBusy(true); // unmounts the CameraView so ARKit can take the camera
    const id = Date.now();
    try {
      await delay(500); // let the preview session release the camera
      const frame = await arkitDepthAdapter.captureDepthFrame();
      if (!frame) {
        setRows((prev) => [{ id, error: 'Bridge returned no frame' }, ...prev]);
        return;
      }
      const debug = measureFootFromDepthFrameDebug(frame);
      setRows((prev) => [{ id, debug }, ...prev]);
    } catch (e) {
      setRows((prev) => [{ id, error: e instanceof Error ? e.message : String(e) }, ...prev]);
    } finally {
      setBusy(false);
    }
  };

  const good = rows
    .map((r) => r.debug)
    .filter((d): d is DepthMeasureDebug => !!d && d.metrics.lengthMm > 0);
  const medianLength = good.length ? median(good.map((d) => d.metrics.lengthMm)) : 0;
  const medianWidth = good.length ? median(good.map((d) => d.metrics.widthMm)) : 0;
  const latest = rows[0];

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
        {busy ? (
          <View
            style={{
              flex: 1,
              backgroundColor: '#000',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator color="#7bff9f" size="large" />
            <Text style={{ color: '#7bff9f', fontSize: 13, fontWeight: '700', marginTop: 12 }}>
              Depth sensor measuring — hold still…
            </Text>
          </View>
        ) : (
          <CameraView style={{ flex: 1 }} facing="back" />
        )}
        {preview && !busy && (
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
                borderColor: '#7bff9f',
                borderRadius: 40,
              }}
            />
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
              Foot in the box · phone flat · ~60 cm up
            </Text>
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
            {latest.debug.cameraHeightMm.toFixed(0)} mm up · foot {latest.debug.footPoints} pts ·
            cloud {latest.debug.cloudPoints} pts
            {'\n'}sensor centre {latest.debug.centerDepthMm.toFixed(0)} mm · fx{' '}
            {latest.debug.fxPx.toFixed(1)} px · plane tilt{' '}
            {latest.debug.gravityTiltDeg === null
              ? 'n/a'
              : `${latest.debug.gravityTiltDeg.toFixed(1)}°`}
          </Text>
        )}
        <Pressable
          onPress={capture}
          disabled={busy}
          style={{
            backgroundColor: busy ? '#555' : '#fff',
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#111', fontSize: 15, fontWeight: '800' }}>
            {busy ? 'Measuring…' : `Capture depth frame${rows.length ? ` (${rows.length + 1})` : ''}`}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

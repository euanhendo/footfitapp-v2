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
// measurements before any production flow exists.
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

export default function DepthDebugScreen() {
  const [rows, setRows] = useState<CaptureRow[]>([]);
  const [busy, setBusy] = useState(false);
  const supported = isDepthScanSupported();

  const capture = async () => {
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  };

  const good = rows
    .map((r) => r.debug)
    .filter((d): d is DepthMeasureDebug => !!d && d.metrics.lengthMm > 0);
  const medianLength = good.length ? median(good.map((d) => d.metrics.lengthMm)) : 0;
  const medianWidth = good.length ? median(good.map((d) => d.metrics.widthMm)) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
          Hold the phone flat about 60 cm above the floor with your foot in frame, then capture.
          Compare against tape: ~265 long, ~110 wide.
        </Text>

        {!supported && (
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#e8e8e8',
              padding: 16,
            }}
          >
            <Text style={{ fontSize: 14, color: '#111', fontWeight: '700' }}>
              No LiDAR on this device
            </Text>
            <Text style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
              Scene depth needs an iPhone/iPad Pro. The paper scanner remains the way to measure.
            </Text>
          </View>
        )}

        {supported && (
          <Pressable
            onPress={capture}
            disabled={busy}
            style={{
              backgroundColor: busy ? '#555' : '#111',
              borderRadius: 10,
              paddingVertical: 14,
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                Capture depth frame
              </Text>
            )}
          </Pressable>
        )}

        {good.length >= 2 && (
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#e8e8e8',
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
              SESSION MEDIAN ({good.length} captures)
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#111' }}>
              {medianLength.toFixed(1)} × {medianWidth.toFixed(1)} mm
            </Text>
          </View>
        )}

        {rows.map((row) => (
          <View
            key={row.id}
            style={{
              backgroundColor: '#fff',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: row.error ? '#b55a1a' : '#e8e8e8',
              padding: 14,
              marginBottom: 10,
            }}
          >
            {row.error && (
              <Text style={{ fontSize: 13, color: '#b55a1a', fontWeight: '700' }}>
                {row.error}
              </Text>
            )}
            {row.debug && (
              <>
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#111' }}>
                  {row.debug.metrics.lengthMm > 0
                    ? `${row.debug.metrics.lengthMm.toFixed(1)} × ${row.debug.metrics.widthMm.toFixed(1)} mm`
                    : 'No foot found'}
                  {row.debug.metrics.lengthMm > 0 &&
                    `  ·  conf ${(row.debug.metrics.confidence * 100).toFixed(0)}%`}
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  floor {(row.debug.floorInlierRatio * 100).toFixed(0)}% · camera{' '}
                  {row.debug.cameraHeightMm.toFixed(0)} mm up · foot {row.debug.footPoints} pts ·
                  cloud {row.debug.cloudPoints} pts
                </Text>
              </>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

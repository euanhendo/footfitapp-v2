import { useCameraPermissions } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  arkitDepthAdapter,
  captureRawDepthFrameForExport,
  decodeNativeDepthFrame,
  isDepthScanSupported,
} from '../../lib/scanner/depth/arkitDepthAdapter';
import {
  DepthMeasureDebug,
  measureFootFromDepthFrameDebug,
  TRUST_MIN_CONFIDENCE_V3,
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

// Capture height: tightened 2026-06-17 from a loose 500–700 (200 mm) window to
// 525–585 (60 mm). Height does NOT bias the unprojected mm — the pipeline turns
// depth into mm via the camera intrinsics regardless of distance — but a
// tighter, lower hold packs more LiDAR points onto the foot (smoother contour,
// less per-frame noise) and shrinks the FOV footprint so the leg falls outside
// the frame. Centre ~555 mm frames a 263 mm foot with margin while staying well
// above the ~250 mm LiDAR minimum. Re-centre tightly once a good frame's saved
// pose tells us the proven height — don't guess the centre blind.
const HEIGHT_MIN_MM = 525;
const HEIGHT_MAX_MM = 585;
// Tilt IS an accuracy lever (unlike height): 2026-06-13 device data — a 5° hold
// read 261.2, a 9° hold read 285.6 (truth 263), length inflating with tilt as
// the floor-plane geometry skews. Tightened 8° → 5° to admit only the
// proven-accurate pose; this is the measurement-quality gate that matters most.
const FLAT_MAX_DEG = 5;

// Shin verticality is the dominant accuracy factor but can't be sensed live
// (it needs the full pipeline on the foot), so it's a persistent instruction
// rather than a gate. Wording is the user's own cue (2026-06-13): you can't
// stand fully upright while aiming at your own foot, so bend the knee forward.
const STANCE_CUE = 'Soft bend in the knee — push your knee forward over your ankle so your shin is vertical (leaning your body is fine).';

// Failure mode #2 (2026-06-16 replay): the shin filled the right half of every
// saved frame, the forefoot dropped to low confidence, and the foot split — so
// the read came back stubby and the gate rejected it. Not tunable by math (the
// decision note proves a confidence sweep can't recover it); the fix is to aim
// the phone down at the foot so the leg leaves the frame. This cue addresses
// that directly — it is the missing half of the capture coaching.
const AIM_CUE = 'Aim straight down at your foot, not along your leg — keep your shin out of frame and the whole foot inside the guide.';

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

  // Save a raw capture (compact base64 payload + the debug result the pipeline
  // produced) to a JSON file and open the share sheet so it can be AirDropped
  // to a Mac. Frames replay through decodeNativeDepthFrame in a test, letting
  // the heel/length maths be tuned against real data offline. Tag with the
  // live status so each file records the pose it was taken in.
  const saveFrame = async () => {
    setBusy(true);
    try {
      const raw = await captureRawDepthFrameForExport();
      const frame = decodeNativeDepthFrame(raw);
      const debug = frame ? measureFootFromDepthFrameDebug(frame) : null;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const payload = {
        savedAt: stamp,
        pose: status
          ? { heightMm: status.centerDepthMm, tiltDeg: status.flatTiltDeg }
          : null,
        debug: debug
          ? { ...debug, metrics: debug.metrics }
          : null,
        raw,
      };
      const file = new File(Paths.document, `depthframe-${stamp}.json`);
      file.write(JSON.stringify(payload));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Save depth frame',
        });
      }
      setRows((prev) => [
        { id: Date.now(), debug: debug ?? undefined, error: debug ? undefined : 'saved (no metrics)' },
        ...prev,
      ]);
    } catch (e) {
      setRows((prev) => [
        { id: Date.now(), error: `save failed: ${e instanceof Error ? e.message : String(e)}` },
        ...prev,
      ]);
    } finally {
      setBusy(false);
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

  // Reject, don't repair (v2's trust-gate lesson): only frames that clear the
  // v3 confidence gate feed the median — leaning over-reads and forefoot-
  // dropout under-reads are discarded rather than dragged into the average.
  const measured = rows
    .map((r) => r.debug)
    .filter((d): d is DepthMeasureDebug => !!d && d.metrics.lengthMm > 0);
  const good = measured.filter((d) => d.metrics.confidence >= TRUST_MIN_CONFIDENCE_V3);
  const rejected = measured.length - good.length;
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
                position: 'absolute',
                top: 16,
                left: 16,
                right: 16,
                backgroundColor: 'rgba(0,0,0,0.6)',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: '700',
                  textAlign: 'center',
                  lineHeight: 18,
                }}
              >
                {AIM_CUE}
              </Text>
              <Text
                style={{
                  color: '#cfcfcf',
                  fontSize: 12,
                  fontWeight: '600',
                  textAlign: 'center',
                  lineHeight: 17,
                  marginTop: 6,
                }}
              >
                {STANCE_CUE}
              </Text>
            </View>
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
            MEDIAN ({good.length} trusted): {medianLength.toFixed(1)} × {medianWidth.toFixed(1)} mm
          </Text>
        )}
        {rejected > 0 && (
          <Text style={{ color: '#ff9f7b', fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
            {rejected} frame{rejected > 1 ? 's' : ''} rejected (low trust){good.length < 2 ? ' — reshoot' : ''}
          </Text>
        )}
        {latest?.error && (
          <Text style={{ color: '#ff9f7b', fontSize: 12, marginBottom: 8 }}>{latest.error}</Text>
        )}
        {latest?.debug && (
          <Text style={{ color: '#ddd', fontSize: 12, lineHeight: 18, marginBottom: 8 }}>
            Last:{' '}
            {latest.debug.metrics.lengthMm > 0
              ? `${latest.debug.metrics.lengthMm.toFixed(1)} × ${latest.debug.metrics.widthMm.toFixed(1)} mm · conf ${(latest.debug.metrics.confidence * 100).toFixed(0)}% ${latest.debug.metrics.confidence >= TRUST_MIN_CONFIDENCE_V3 ? '✓ TRUST' : '✗ REJECT'}`
              : 'no foot found'}
            {'\n'}heel rear {latest.debug.rearHeelWidthMm.toFixed(0)} mm{' '}
            {latest.debug.rearHeelWidthMm < 20 ? '(leg tail — leaning)' : '(heel ok)'}
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
        <Pressable
          onPress={saveFrame}
          disabled={busy}
          style={{
            backgroundColor: '#1a1a1a',
            borderWidth: 1,
            borderColor: '#1a6bb5',
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: 'center',
            marginTop: 10,
          }}
        >
          <Text style={{ color: '#6db3ff', fontSize: 14, fontWeight: '800' }}>
            Save frame (AirDrop to Mac)
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

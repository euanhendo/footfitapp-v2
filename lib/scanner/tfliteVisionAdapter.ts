import { Asset } from 'expo-asset';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';

import { BBox, Mask, ReferenceKind } from './types';
import { VisionAdapter } from './visionAdapter';

const MODEL_INPUT_SIZE = 256;
const SEGMENTATION_THRESHOLD = 0.5;
const FOOT_REGION_TOP_FRACTION = 0.5;

const SELFIE_SEG_MODEL = require('../../assets/models/selfie-segmentation.tflite');

let modelPromise: Promise<TensorflowModel> | null = null;

async function getModel(): Promise<TensorflowModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const asset = Asset.fromModule(SELFIE_SEG_MODEL);
      await asset.downloadAsync();
      const url = asset.localUri ?? asset.uri;
      if (!url) {
        modelPromise = null;
        throw new Error('foot-seg model not bundled (asset has no uri)');
      }
      return loadTensorflowModel({ url });
    })();
  }
  return modelPromise;
}

async function decodeImageToRgb(
  uri: string,
  size: number,
): Promise<{ rgb: Uint8Array; sourceWidth: number; sourceHeight: number }> {
  const resized = await manipulateAsync(uri, [{ resize: { width: size, height: size } }], {
    base64: true,
    format: SaveFormat.JPEG,
    compress: 0.92,
  });
  if (!resized.base64) {
    throw new Error('expo-image-manipulator returned no base64');
  }
  const bytes = base64ToUint8(resized.base64);
  const decoded = decodeJpeg(bytes, { useTArray: true });
  const rgb = rgbaToRgb(decoded.data, decoded.width, decoded.height);
  return { rgb, sourceWidth: decoded.width, sourceHeight: decoded.height };
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = globalThis.atob ? globalThis.atob(b64) : decodeBase64Polyfill(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function decodeBase64Polyfill(b64: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let str = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < b64.length; i++) {
    const c = b64[i];
    if (c === '=') break;
    const v = chars.indexOf(c);
    if (v < 0) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      str += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return str;
}

function rgbaToRgb(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    out[j] = rgba[i];
    out[j + 1] = rgba[i + 1];
    out[j + 2] = rgba[i + 2];
  }
  return out;
}

function rgbToFloat32(rgb: Uint8Array): Float32Array {
  const tensor = new Float32Array(rgb.length);
  for (let i = 0; i < rgb.length; i++) {
    tensor[i] = rgb[i] / 255;
  }
  return tensor;
}

function thresholdToMask(
  output: Float32Array,
  width: number,
  height: number,
  threshold: number,
): Mask {
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) {
    data[i] = output[i] >= threshold ? 1 : 0;
  }
  return { width, height, data };
}

function cropMaskToFootRegion(mask: Mask, topFraction: number): Mask {
  const startY = Math.floor(mask.height * topFraction);
  const data = new Uint8Array(mask.data.length);
  for (let y = startY; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      const idx = y * mask.width + x;
      data[idx] = mask.data[idx];
    }
  }
  return { width: mask.width, height: mask.height, data };
}

export const tfliteVisionAdapter: VisionAdapter = {
  async segmentFoot(uri: string): Promise<Mask> {
    const model = await getModel();
    const { rgb } = await decodeImageToRgb(uri, MODEL_INPUT_SIZE);
    const tensor = rgbToFloat32(rgb);
    const outputs = model.runSync([tensor]);
    const raw = outputs[0] as Float32Array;
    const segMask = thresholdToMask(raw, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, SEGMENTATION_THRESHOLD);
    return cropMaskToFootRegion(segMask, FOOT_REGION_TOP_FRACTION);
  },

  async detectReference(_uri: string, _kind: ReferenceKind, hint?: BBox): Promise<BBox | null> {
    if (hint) return hint;
    return null;
  },
};

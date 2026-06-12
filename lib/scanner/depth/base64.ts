// Minimal base64 decoder — React Native's Hermes has no atob, and the depth
// bridge ships its Float32 buffer as base64. Pure so it stays testable.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Int16Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) {
  LOOKUP[ALPHABET.charCodeAt(i)] = i;
}

export function base64ToBytes(b64: string): Uint8Array {
  let end = b64.length;
  while (end > 0 && b64.charCodeAt(end - 1) === 61) end--; // trailing '='
  const byteLength = Math.floor((end * 3) / 4);
  const out = new Uint8Array(byteLength);
  let outIndex = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < end; i++) {
    const code = b64.charCodeAt(i);
    const value = code < 128 ? LOOKUP[code] : -1;
    if (value < 0) continue; // skip whitespace/invalid
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[outIndex++] = (buffer >> bits) & 0xff;
    }
  }
  return outIndex === byteLength ? out : out.subarray(0, outIndex);
}

import { base64ToBytes } from '../../../scanner/depth/base64';

describe('base64ToBytes', () => {
  it('round-trips arbitrary bytes against Node base64', () => {
    const bytes = new Uint8Array(257);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37 + 11) % 256;
    const b64 = Buffer.from(bytes).toString('base64');
    expect(Array.from(base64ToBytes(b64))).toEqual(Array.from(bytes));
  });

  it('handles padded and unpadded short inputs', () => {
    expect(Array.from(base64ToBytes('TQ=='))).toEqual([77]);
    expect(Array.from(base64ToBytes('TWE='))).toEqual([77, 97]);
    expect(Array.from(base64ToBytes('TWFu'))).toEqual([77, 97, 110]);
    expect(Array.from(base64ToBytes(''))).toEqual([]);
  });

  it('reconstructs Float32 depth values exactly', () => {
    const floats = new Float32Array([0, 0.6, 1.25, 2.9999, 600.5]);
    const b64 = Buffer.from(floats.buffer).toString('base64');
    const bytes = base64ToBytes(b64);
    const decoded = new Float32Array(bytes.buffer, bytes.byteOffset, floats.length);
    expect(Array.from(decoded)).toEqual(Array.from(floats));
  });
});

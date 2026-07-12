import { describe, expect, it } from '@jest/globals';
import { decodeWavveVitalData } from './wavve-codec';

describe('Wavve vital-data decoder', () => {
  it('decodes the documented 0x03E8 vital payload in big-endian order', () => {
    const payload = Buffer.from([
      0x41, 0x3b, 0x80, 0x00,
      0x3e, 0x1c, 0x0b, 0xc0,
      0x42, 0x96, 0x00, 0x00,
      0xbe, 0xdb, 0xa4, 0xf6,
      0x3f, 0xc0, 0x00, 0x00,
      0x42, 0x0f, 0xa6, 0x20,
      0x00, 0x00, 0x00, 0x02,
      0x41, 0xb3, 0xc7, 0x13,
      0x40, 0x53, 0x33, 0x34,
    ]);

    const result = decodeWavveVitalData(payload);
    expect(result.respirationRateBrpm).toBeCloseTo(11.71875, 5);
    expect(result.breathCurve).toBeCloseTo(0.152, 3);
    expect(result.heartRateBpm).toBe(75);
    expect(result.heartCurve).toBeCloseTo(-0.428992927, 6);
    expect(result.targetDistanceM).toBe(1.5);
    expect(result.bedSignalStrength).toBeCloseTo(35.912, 3);
    expect(result.validBit).toBe(2);
    expect(result.bodyMoveEnergy).toBeCloseTo(22.472, 3);
    expect(result.bodyMoveRange).toBeCloseTo(3.3, 3);
  });

  it('rejects a payload with an unsupported validity value', () => {
    const payload = Buffer.alloc(36);
    payload.writeUInt32BE(3, 24);

    expect(() => decodeWavveVitalData(payload)).toThrow('Invalid Wavve validity value');
  });
});

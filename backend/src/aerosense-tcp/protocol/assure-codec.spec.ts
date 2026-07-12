import { describe, expect, it } from '@jest/globals';
import { AeroSenseFrame } from './aerosense-frame';
import { decodeAssureEvent } from './assure-codec';

function assureFrame(functionCode: number, data: Buffer): AeroSenseFrame {
  return {
    protocol: 'assure',
    type: 1,
    command: 1,
    requestId: 42,
    timeoutOrStatus: 10_000,
    functionCode,
    data,
  };
}

describe('decodeAssureEvent', () => {
  it('decodes fall coordinates in metres', () => {
    const data = Buffer.alloc(8);
    data.writeFloatBE(3, 0);
    data.writeFloatBE(5, 4);

    expect(decodeAssureEvent(assureFrame(0x0009, data))).toEqual({ kind: 'fall', xM: 3, yM: 5 });
  });

  it('recognizes a fall-elimination notification', () => {
    expect(decodeAssureEvent(assureFrame(0x0017, Buffer.alloc(4)))).toEqual({ kind: 'fall_eliminated' });
  });

  it('decodes presence without retaining raw ADC bytes', () => {
    const data = Buffer.alloc(212, 0xab);
    data.writeUInt32BE(1, 0);
    data.writeFloatBE(4.5, 4);
    data.writeFloatBE(100, 8);

    expect(decodeAssureEvent(assureFrame(0x0018, data))).toEqual({
      kind: 'presence',
      occupied: true,
      rangeM: 4.5,
      energy: 100,
    });
  });

  it.each([12, 28, 32])('decodes the documented %i-byte position report', (length) => {
    const data = Buffer.alloc(length);
    [1.5, 2, 0.8, 1.5, 2, 1.8, 60].forEach((value, index) => {
      if (index * 4 < length) data.writeFloatBE(value, index * 4);
    });
    if (length === 32) data.writeUInt32BE(3, 28);

    expect(decodeAssureEvent(assureFrame(0x001c, data))).toMatchObject({
      kind: 'position',
      xM: 1.5,
      yM: 2,
      zM: expect.closeTo(0.8, 5),
      ...(length >= 28 && {
        motion: { xM: 1.5, yM: 2, zM: expect.closeTo(1.8, 5), snrDb: 60 },
      }),
      ...(length === 32 && { targetCount: 3 }),
    });
  });

  it('rejects malformed fall payloads', () => {
    expect(() => decodeAssureEvent(assureFrame(0x0009, Buffer.alloc(4)))).toThrow('fall payload length');
  });
});

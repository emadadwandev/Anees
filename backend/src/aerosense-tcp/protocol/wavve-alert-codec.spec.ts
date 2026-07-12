import { describe, expect, it } from '@jest/globals';
import { AeroSenseFrame } from './aerosense-frame';
import { decodeWavveAlertEvent } from './wavve-alert-codec';

function frame(functionCode: number, data = Buffer.alloc(4)): AeroSenseFrame {
  return { protocol: 'wavve', type: 1, command: 1, requestId: 1, timeoutOrStatus: 10_000, functionCode, data };
}

describe('decodeWavveAlertEvent', () => {
  it.each([
    [0x03f0, 'vital.no_breath'], [0x03f3, 'vital.low_breath'], [0x03f6, 'vital.high_breath'],
    [0x03fb, 'vital.no_heart'], [0x03fe, 'vital.low_heart'], [0x0401, 'vital.high_heart'],
    [0x0406, 'bed.exit'], [0x040c, 'bed.turn_over'],
  ])('maps Wavve function 0x%s to %s', (functionCode, kind) => {
    expect(decodeWavveAlertEvent(frame(functionCode))).toEqual({ kind });
  });

  it('decodes body-movement energy', () => {
    const data = Buffer.alloc(4);
    data.writeFloatBE(95, 0);
    expect(decodeWavveAlertEvent(frame(0x040f, data))).toEqual({ kind: 'bed.movement', energy: 95 });
  });

  it('decodes signed Wi-Fi signal dBm', () => {
    const data = Buffer.alloc(4);
    data.writeInt32BE(-58, 0);
    expect(decodeWavveAlertEvent(frame(0xffff, data))).toEqual({ kind: 'system.wifi_signal', dbm: -58 });
  });

  it('rejects a malformed alert payload', () => {
    expect(() => decodeWavveAlertEvent(frame(0x03f0, Buffer.alloc(3)))).toThrow('payload length');
  });
});

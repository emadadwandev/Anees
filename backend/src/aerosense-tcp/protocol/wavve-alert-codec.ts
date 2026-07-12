import { AeroSenseFrame } from './aerosense-frame';

export type WavveAlertEvent =
  | { kind: 'vital.no_breath' | 'vital.low_breath' | 'vital.high_breath' | 'vital.no_heart' | 'vital.low_heart' | 'vital.high_heart' | 'bed.exit' | 'bed.turn_over' }
  | { kind: 'bed.movement'; energy: number }
  | { kind: 'system.wifi_signal'; dbm: number };

type SimpleWavveAlertKind = Exclude<WavveAlertEvent['kind'], 'bed.movement' | 'system.wifi_signal'>;

const ALERT_KINDS: Record<number, SimpleWavveAlertKind> = {
  0x03f0: 'vital.no_breath',
  0x03f3: 'vital.low_breath',
  0x03f6: 'vital.high_breath',
  0x03fb: 'vital.no_heart',
  0x03fe: 'vital.low_heart',
  0x0401: 'vital.high_heart',
  0x0406: 'bed.exit',
  0x040c: 'bed.turn_over',
};

function expectFourBytePayload(frame: AeroSenseFrame): void {
  if (frame.data.length !== 4) throw new Error(`Invalid Wavve alert payload length: ${frame.data.length}`);
}

export function decodeWavveAlertEvent(frame: AeroSenseFrame): WavveAlertEvent | null {
  if (frame.protocol !== 'wavve') throw new Error('Expected a Wavve frame');
  expectFourBytePayload(frame);

  const kind = ALERT_KINDS[frame.functionCode];
  if (kind) return { kind };
  if (frame.functionCode === 0x040f) {
    const energy = frame.data.readFloatBE(0);
    if (!Number.isFinite(energy)) throw new Error('Invalid Wavve body-movement energy');
    return { kind: 'bed.movement', energy };
  }
  if (frame.functionCode === 0xffff) return { kind: 'system.wifi_signal', dbm: frame.data.readInt32BE(0) };
  return null;
}

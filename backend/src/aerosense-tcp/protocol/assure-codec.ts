import { AeroSenseFrame } from './aerosense-frame';

export type AssureEvent =
  | { kind: 'fall'; xM: number; yM: number }
  | { kind: 'fall_eliminated' }
  | { kind: 'presence'; occupied: boolean; rangeM: number; energy: number }
  | {
      kind: 'position';
      xM: number;
      yM: number;
      zM: number;
      motion?: { xM: number; yM: number; zM: number; snrDb: number };
      targetCount?: number;
    };

function expectLength(data: Buffer, expected: number | number[], label: string): void {
  const lengths = Array.isArray(expected) ? expected : [expected];
  if (!lengths.includes(data.length)) {
    throw new Error(`Invalid Assure ${label} payload length: ${data.length}`);
  }
}

function readFiniteFloat(data: Buffer, offset: number, label: string): number {
  const value = data.readFloatBE(offset);
  if (!Number.isFinite(value)) throw new Error(`Invalid Assure ${label} value`);
  return value;
}

export function decodeAssureEvent(frame: AeroSenseFrame): AssureEvent | null {
  if (frame.protocol !== 'assure') throw new Error('Expected an Assure frame');

  switch (frame.functionCode) {
    case 0x0009:
      expectLength(frame.data, 8, 'fall');
      return {
        kind: 'fall',
        xM: readFiniteFloat(frame.data, 0, 'fall X coordinate'),
        yM: readFiniteFloat(frame.data, 4, 'fall Y coordinate'),
      };
    case 0x0017:
      expectLength(frame.data, 4, 'fall-elimination');
      return { kind: 'fall_eliminated' };
    case 0x0018: {
      expectLength(frame.data, 212, 'presence');
      const presence = frame.data.readUInt32BE(0);
      if (presence !== 0 && presence !== 1) throw new Error(`Invalid Assure presence status: ${presence}`);
      return {
        kind: 'presence',
        occupied: presence === 1,
        rangeM: readFiniteFloat(frame.data, 4, 'presence range'),
        energy: readFiniteFloat(frame.data, 8, 'presence energy'),
      };
    }
    case 0x001c: {
      expectLength(frame.data, [12, 28, 32], 'position');
      const position: Extract<AssureEvent, { kind: 'position' }> = {
        kind: 'position',
        xM: readFiniteFloat(frame.data, 0, 'position X coordinate'),
        yM: readFiniteFloat(frame.data, 4, 'position Y coordinate'),
        zM: readFiniteFloat(frame.data, 8, 'position Z coordinate'),
      };
      if (frame.data.length >= 28) {
        position.motion = {
          xM: readFiniteFloat(frame.data, 12, 'motion X coordinate'),
          yM: readFiniteFloat(frame.data, 16, 'motion Y coordinate'),
          zM: readFiniteFloat(frame.data, 20, 'motion Z coordinate'),
          snrDb: readFiniteFloat(frame.data, 24, 'motion SNR'),
        };
      }
      if (frame.data.length === 32) position.targetCount = frame.data.readUInt32BE(28);
      return position;
    }
    default:
      return null;
  }
}

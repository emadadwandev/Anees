import { describe, expect, it } from '@jest/globals';
import { AeroSenseEventSchema } from './aerosense-event.schema';

const vitalReading = {
  kind: 'wavve.vitals',
  deviceId: '7b1c8f21-bd66-4a81-8b9f-620e5fed2c76',
  patientId: 'ce54a4f9-50ad-4527-8652-1edc5daec281',
  timestamp: 1_720_672_000_000,
  heartRateBpm: 72.4,
  respirationRateBrpm: 16.2,
  validBit: 1,
  targetDistanceM: 1.8,
  bedSignalStrength: 0.92,
  breathCurve: -0.15,
  heartCurve: 0.08,
  bodyMoveEnergy: 0.01,
  bodyMoveRange: 0.2,
};

describe('AeroSenseEventSchema', () => {
  it('accepts a complete Wavve vital reading', () => {
    expect(AeroSenseEventSchema.parse(vitalReading)).toEqual(vitalReading);
  });

  it.each([
    { validBit: 3 },
    { validBit: -1 },
    { deviceId: 'not-a-uuid' },
    { patientId: 'not-a-uuid' },
    { heartRateBpm: Infinity },
    { bodyMoveEnergy: Number.NaN },
  ])('rejects invalid Wavve vital readings: %o', (override) => {
    expect(AeroSenseEventSchema.safeParse({ ...vitalReading, ...override }).success).toBe(false);
  });
});

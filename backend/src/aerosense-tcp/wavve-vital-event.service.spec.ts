import { describe, expect, it, jest } from '@jest/globals';
import { AeroSenseEventService } from './aerosense-event.service';
import { WavveVitalData } from './protocol/wavve-codec';

const session = {
  deviceId: '7b1c8f21-bd66-4a81-8b9f-620e5fed2c76',
  patientId: 'ce54a4f9-50ad-4527-8652-1edc5daec281',
};

const vital: WavveVitalData = {
  respirationRateBrpm: 16,
  breathCurve: 0.15,
  heartRateBpm: 72,
  heartCurve: -0.42,
  targetDistanceM: 1.5,
  bedSignalStrength: 36,
  validBit: 2,
  bodyMoveEnergy: 22,
  bodyMoveRange: 3.3,
};

describe('AeroSenseEventService', () => {
  it('persists Wavve diagnostics and publishes a complete vital reading', async () => {
    const prisma = { $executeRaw: jest.fn<() => Promise<number>>().mockResolvedValue(1) };
    const redis = { publish: jest.fn<(channel: string, payload: string) => Promise<number>>().mockResolvedValue(1) };
    const service = new AeroSenseEventService(prisma as never, redis as never, {} as never);

    await service.handleWavveVital(session, vital, 1_720_672_000_000);

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(redis.publish).toHaveBeenCalledWith(
      `vitals:${session.patientId}`,
      JSON.stringify({
        device_id: session.deviceId,
        patient_id: session.patientId,
        timestamp: 1_720_672_000_000,
        heart_rate_bpm: 72,
        resp_rate_brpm: 16,
        signal_quality: 1,
      }),
    );
  });

  it('stores partial Wavve readings without publishing clinical vitals', async () => {
    const prisma = { $executeRaw: jest.fn<() => Promise<number>>().mockResolvedValue(1) };
    const redis = { publish: jest.fn<(channel: string, payload: string) => Promise<number>>().mockResolvedValue(1) };
    const service = new AeroSenseEventService(prisma as never, redis as never, {} as never);

    await service.handleWavveVital(session, { ...vital, validBit: 1 }, 1_720_672_000_000);

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(redis.publish).not.toHaveBeenCalled();
  });
});

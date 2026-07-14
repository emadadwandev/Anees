import { describe, expect, it, jest } from '@jest/globals';
import { AeroSenseEventService } from './aerosense-event.service';

describe('AeroSenseEventService assignment handling', () => {
  it('does not persist or publish clinical vitals for an unassigned session', async () => {
    const prisma = {
      $executeRaw: jest.fn<(...args: unknown[]) => Promise<number>>(),
      alertEvent: { create: jest.fn(), findFirst: jest.fn() },
      auditLog: { create: jest.fn() },
      systemEvent: { create: jest.fn() },
    };
    const redis = {
      publish: jest.fn<(...args: unknown[]) => Promise<number>>(),
      set: jest.fn<(...args: unknown[]) => Promise<string | null>>(),
    };
    const service = new AeroSenseEventService(
      prisma as never,
      redis as never,
      { add: jest.fn(), getJobs: jest.fn() } as never,
    );

    await service.handleWavveVital(
      { deviceId: 'device-1', patientId: null as never },
      {
        breathCurve: 1,
        heartCurve: 2,
        targetDistanceM: 1,
        bedSignalStrength: 1,
        validBit: 2,
        bodyMoveEnergy: 0,
        bodyMoveRange: 0,
        heartRateBpm: 70,
        respirationRateBrpm: 14,
      },
      Date.now(),
    );

    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(redis.publish).not.toHaveBeenCalled();
  });
});

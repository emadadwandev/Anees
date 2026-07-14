import { describe, expect, it, jest } from '@jest/globals';
import { AeroSenseSessionService } from './aerosense-session.service';

describe('AeroSenseSessionService assignment handling', () => {
  it('records an unassigned device offline without publishing a patient alert', async () => {
    const prisma = {
      device: { update: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
      systemEvent: { create: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
    };
    const redis = { publish: jest.fn<(...args: unknown[]) => Promise<number>>() };
    const service = new AeroSenseSessionService(
      {} as never,
      prisma as never,
      { get: jest.fn().mockReturnValue(1) } as never,
      redis as never,
      undefined,
    );

    await (service as any).markOfflineIfDisconnected({ deviceId: 'device-1', patientId: null });

    expect(prisma.device.update).toHaveBeenCalled();
    expect(redis.publish).not.toHaveBeenCalled();
  });
});

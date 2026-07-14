import { describe, expect, it, jest } from '@jest/globals';
import { AeroSenseEventService } from './aerosense-event.service';

describe('AeroSense management-state gating', () => {
  it('accepts maintenance diagnostics but suppresses clinical escalation', async () => {
    const prisma = {
      device: {
        findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>()
          .mockResolvedValue({ managementState: 'maintenance', userId: 'patient-1', deprovisionedAt: null }),
      },
      alertEvent: { create: jest.fn(), findFirst: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const redis = {
      set: jest.fn<(...args: unknown[]) => Promise<string | null>>(),
      publish: jest.fn<(...args: unknown[]) => Promise<number>>(),
    };
    const service = new AeroSenseEventService(
      prisma as never,
      redis as never,
      { add: jest.fn() } as never,
      { allowClinicalProcessing: jest.fn().mockReturnValue(false) } as never,
    );

    await service.handleWavveClinicalAlert(
      { deviceId: 'device-1', patientId: 'patient-1' },
      'vital.high_heart',
      Date.now(),
    );

    expect(prisma.alertEvent.create).not.toHaveBeenCalled();
    expect(redis.publish).not.toHaveBeenCalled();
  });
});

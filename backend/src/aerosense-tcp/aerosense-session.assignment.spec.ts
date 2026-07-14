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

  it('rejects disabled registration and records a bounded suppression event', async () => {
    const devices = {
      resolveAeroSenseDevice: jest.fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue({ id: 'device-1', userId: 'patient-1', managementState: 'disabled', deprovisionedAt: null }),
    };
    const prisma = {
      device: { update: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
      systemEvent: { create: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
    };
    const service = new AeroSenseSessionService(
      devices as never,
      prisma as never,
      {} as never,
      {} as never,
      undefined,
      { acceptTelemetry: jest.fn().mockReturnValue(false) } as never,
    );

    const frame = {
      protocol: 'wavve', type: 1, command: 1, requestId: 1, timeoutOrStatus: 10000,
      functionCode: 0x0001,
      data: Buffer.from([0x01, 0x02, 0x08, 0x02, 0x03, ...Buffer.from('13CECDA0000040C11D13155507', 'hex')]),
    } as never;
    await expect(service.register({} as never, frame)).resolves.toBe(false);
    expect(prisma.systemEvent.create).toHaveBeenCalledWith({
      data: {
        deviceId: 'device-1',
        type: 'device.ingress_suppressed',
        payload: { transport: 'aerosense_tcp', reason: 'disabled' },
      },
    });
  });
});

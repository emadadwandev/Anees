import { describe, expect, it, jest } from '@jest/globals';
import { DeviceHealthService } from './device-health.service';

describe('DeviceHealthService assignment handling', () => {
  it('does not publish a patient offline alert for an unassigned device', async () => {
    const prisma = {
      device: {
        findMany: jest.fn<(...args: unknown[]) => Promise<unknown[]>>()
          .mockResolvedValueOnce([{
            id: 'device-1',
            userId: null,
            status: 'online',
            lastHeartbeat: null,
          }])
          .mockResolvedValueOnce([]),
        update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      systemEvent: { create: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
    };
    const redis = { publish: jest.fn<(...args: unknown[]) => Promise<number>>() };
    const service = new DeviceHealthService(prisma as never, redis as never);

    await service.checkDeviceHealth();

    expect(redis.publish).not.toHaveBeenCalled();
    expect(prisma.systemEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ deviceId: 'device-1', type: 'device_offline' }),
    }));
  });
});

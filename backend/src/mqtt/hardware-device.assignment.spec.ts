import { describe, expect, it, jest } from '@jest/globals';
import { HardwareDeviceService } from './hardware-device.service';

describe('HardwareDeviceService assignment handling', () => {
  it('updates connectivity without publishing a patient alert for unassigned devices', async () => {
    const prisma = { device: { update: jest.fn<(...args: unknown[]) => Promise<unknown>>() } };
    const redis = { publish: jest.fn<(...args: unknown[]) => Promise<number>>() };
    const service = new HardwareDeviceService(
      { get: jest.fn() } as never,
      prisma as never,
      {} as never,
      { mqttMessagesReceived: { inc: jest.fn() } } as never,
      redis as never,
      {} as never,
    );

    await (service as any).handleOnlineStatus(
      { id: 'device-1', serial: 'SERIAL-1', userId: null },
      { online: '0' },
    );

    expect(prisma.device.update).toHaveBeenCalled();
    expect(redis.publish).not.toHaveBeenCalled();
  });
});

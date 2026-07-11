import { describe, expect, it, jest } from '@jest/globals';
import { DevicesService } from '../devices/devices.service';

describe('DevicesService', () => {
  it('resolves only a registered Wavve device by TCP transport and vendor ID', async () => {
    const wavveDevice = {
      id: 'wavve-device-id',
      externalId: '13CECDA0000040C11D13155507',
      transport: 'aerosense_tcp',
    };
    const prisma = {
      device: {
        findUnique: jest
          .fn<(args: { where: { externalId: string } }) => Promise<typeof wavveDevice>>()
          .mockResolvedValue(wavveDevice),
      },
    };
    const redis = {
      get: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
      set: jest.fn<() => Promise<string>>().mockResolvedValue('OK'),
    };
    const devices = new DevicesService(prisma as any, redis as any) as DevicesService & {
      resolveAeroSenseDevice(externalId: string): Promise<typeof wavveDevice | null>;
    };

    await expect(devices.resolveAeroSenseDevice('13cecda0000040c11d13155507'))
      .resolves.toMatchObject({ id: wavveDevice.id, transport: 'aerosense_tcp' });
    expect(prisma.device.findUnique).toHaveBeenCalledWith({
      where: { externalId: wavveDevice.externalId },
    });
  });
});

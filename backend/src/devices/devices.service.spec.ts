import { describe, expect, it, jest } from '@jest/globals';
import { DevicesService } from './devices.service';

describe('DevicesService identity resolution', () => {
  it('does not resolve a deprovisioned AeroSense identity', async () => {
    const prisma = {
      device: {
        findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
          id: 'device-1',
          transport: 'aerosense_tcp',
          deprovisionedAt: new Date(),
        }),
      },
    };
    const redis = {
      get: jest.fn<(...args: unknown[]) => Promise<string | null>>().mockResolvedValue(null),
      set: jest.fn<(...args: unknown[]) => Promise<string>>(),
    };
    const service = new DevicesService(prisma as never, redis as never);

    await expect(service.resolveAeroSenseDevice('radar-1')).resolves.toBeNull();
    expect(prisma.device.findUnique).toHaveBeenCalledWith({
      where: { externalId: 'RADAR-1' },
    });
  });
});

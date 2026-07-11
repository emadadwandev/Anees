import { describe, expect, it, jest } from '@jest/globals';
import { DevicesService } from '../devices/devices.service';

describe('DevicesService', () => {
  it('resolves lowercase input to a registered uppercase Wavve TCP device', async () => {
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

  it('returns null when an external ID belongs to an MQTT device', async () => {
    const mqttDevice = {
      id: 'mqtt-device-id',
      externalId: '13CECDA0000040C11D13155507',
      transport: 'mqtt',
    };
    const prisma = {
      device: {
        findUnique: jest
          .fn<(args: { where: { externalId: string } }) => Promise<typeof mqttDevice>>()
          .mockResolvedValue(mqttDevice),
      },
    };
    const redis = {
      get: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
      set: jest.fn<() => Promise<string>>().mockResolvedValue('OK'),
    };
    const devices = new DevicesService(prisma as any, redis as any);

    await expect(devices.resolveAeroSenseDevice(mqttDevice.externalId)).resolves.toBeNull();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('canonicalizes a lowercase vendor ID before persisting an AeroSense device', async () => {
    const prisma = {
      device: {
        create: jest
          .fn<(args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>>()
          .mockImplementation(async ({ data }) => data),
      },
    };
    const devices = new DevicesService(prisma as any, {} as any) as DevicesService & {
      registerAeroSenseDevice(input: {
        serial: string;
        userId: string;
        roomLabel: string;
        firmwareVersion: string;
        externalId: string;
        vendor: string;
        capabilities?: Record<string, unknown>;
      }): Promise<Record<string, unknown>>;
    };

    await devices.registerAeroSenseDevice({
      serial: 'wavve-serial',
      userId: 'patient-id',
      roomLabel: 'Room 12',
      firmwareVersion: '1.0.0',
      externalId: '13ceCda0000040c11d13155507',
      vendor: 'wavve',
      capabilities: { diagnostics: true },
    });

    expect(prisma.device.create).toHaveBeenCalledWith({
      data: {
        serial: 'wavve-serial',
        userId: 'patient-id',
        roomLabel: 'Room 12',
        firmwareVersion: '1.0.0',
        externalId: '13CECDA0000040C11D13155507',
        vendor: 'wavve',
        capabilities: { diagnostics: true },
        transport: 'aerosense_tcp',
      },
    });
  });
});

import { describe, expect, it, jest } from '@jest/globals';
import { DeviceLifecycleService } from './device-lifecycle.service';

describe('DeviceLifecycleService', () => {
  function createService() {
    const prisma = {
      device: {
        findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        findMany: jest.fn<(...args: unknown[]) => Promise<unknown[]>>(),
        create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      auditLog: { create: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
    };
    const redis = {
      del: jest.fn<(...args: unknown[]) => Promise<number>>(),
      get: jest.fn<(...args: unknown[]) => Promise<string | null>>(),
      set: jest.fn<(...args: unknown[]) => Promise<string>>(),
    };
    const service = new DeviceLifecycleService(prisma as never, redis as never);
    return { service, prisma, redis };
  }

  it('rejects a lifecycle transition without a reason', async () => {
    const { service } = createService();

    await expect(service.transition('device-1', 'maintenance', '   ', 'actor-1'))
      .rejects.toThrow('reason');
  });

  it('records the old and new state, reason, and invalidates identity caches', async () => {
    const { service, prisma, redis } = createService();
    prisma.device.findUnique.mockResolvedValue({
      id: 'device-1',
      serial: 'SERIAL-1',
      externalId: 'RADAR-1',
      managementState: 'enabled',
      deprovisionedAt: null,
    });
    prisma.device.update.mockResolvedValue({
      id: 'device-1',
      serial: 'SERIAL-1',
      externalId: 'RADAR-1',
      managementState: 'maintenance',
      managementStateReason: 'bench test',
    });
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    await expect(service.transition('device-1', 'maintenance', 'bench test', 'actor-1'))
      .resolves.toMatchObject({ managementState: 'maintenance' });

    expect(prisma.device.update).toHaveBeenCalledWith({
      where: { id: 'device-1' },
      data: {
        managementState: 'maintenance',
        managementStateReason: 'bench test',
        managementStateChangedAt: expect.any(Date),
      },
    });
    expect(redis.del).toHaveBeenCalledWith(
      'device:id:device-1',
      'device:serial:SERIAL-1',
      'device:aerosense:RADAR-1',
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'actor-1',
        action: 'device.management_state_changed',
        resourceType: 'device',
        resourceId: 'device-1',
        details: {
          oldState: 'enabled',
          newState: 'maintenance',
          reason: 'bench test',
        },
      }),
    });
  });

  it('deprovisions without deleting the device or its history', async () => {
    const { service, prisma, redis } = createService();
    prisma.device.findUnique.mockResolvedValue({
      id: 'device-1',
      serial: 'SERIAL-1',
      externalId: null,
      managementState: 'enabled',
      deprovisionedAt: null,
    });
    prisma.device.update.mockResolvedValue({
      id: 'device-1',
      deprovisionedAt: new Date(),
      managementState: 'disabled',
    });

    await service.deprovision('device-1', 'retired from staging', 'actor-1');

    expect(prisma.device.update).toHaveBeenCalledWith({
      where: { id: 'device-1' },
      data: {
        deprovisionedAt: expect.any(Date),
        managementState: 'disabled',
        managementStateReason: 'retired from staging',
        managementStateChangedAt: expect.any(Date),
      },
    });
    expect(redis.del).toHaveBeenCalledWith('device:id:device-1', 'device:serial:SERIAL-1');
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'device.deprovisioned',
        details: { reason: 'retired from staging' },
      }),
    });
  });

  it('creates an unassigned device with enabled management state', async () => {
    const { service, prisma } = createService();
    prisma.device.create.mockResolvedValue({
      id: 'device-1',
      userId: null,
      serial: 'SERIAL-1',
      transport: 'mqtt',
      managementState: 'enabled',
    });

    await expect(service.create({
      serial: 'SERIAL-1',
      firmwareVersion: '1.0.0',
      roomLabel: 'Staging',
      transport: 'mqtt',
      deviceType: 'fall_sensor',
    }, 'actor-1')).resolves.toMatchObject({ assignmentState: 'unassigned' });

    expect(prisma.device.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serial: 'SERIAL-1',
        userId: null,
        managementState: 'enabled',
      }),
    });
  });
});

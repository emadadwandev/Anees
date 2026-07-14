import { DeviceManagementState, PrismaClient, Role } from '@prisma/client';
import { afterAll, describe, expect, it } from '@jest/globals';

const prisma = new PrismaClient();

describe('device lifecycle schema', () => {
  afterAll(async () => prisma.$disconnect());

  it('exports the super-admin role and independent management states', () => {
    expect(Role.super_admin).toBe('super_admin');
    expect(DeviceManagementState).toEqual({
      enabled: 'enabled',
      maintenance: 'maintenance',
      disabled: 'disabled',
    });
  });

  it('allows a provisioned device to exist without a patient assignment', async () => {
    const serial = `schema-unassigned-${Date.now()}`;
    const device = await prisma.device.create({
      data: {
        serial,
        firmwareVersion: '0.0.0',
        roomLabel: 'Staging',
      },
    });

    try {
      expect(device.userId).toBeNull();
      expect(device.managementState).toBe(DeviceManagementState.enabled);
    } finally {
      await prisma.device.delete({ where: { id: device.id } });
    }
  });
});

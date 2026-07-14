import 'reflect-metadata';
import { describe, expect, it, jest } from '@jest/globals';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { SuperAdminController } from './super-admin.controller';

describe('SuperAdminController', () => {
  it('requires the super_admin role on every handler', () => {
    const methods = [
      'list', 'summary', 'create', 'get', 'transition', 'restore',
      'deprovision', 'deviceAudit', 'globalAudit', 'systemHealth', 'command',
    ];
    for (const method of methods) {
      expect(Reflect.getMetadata(ROLES_KEY, SuperAdminController.prototype[method])).toEqual([Role.super_admin]);
    }
  });

  it('returns a provisioned device with an immutable UUID and unassigned state', async () => {
    const service = {
      createDevice: jest.fn<(...args: any[]) => Promise<any>>()
        .mockResolvedValue({ id: 'device-1', uuid: 'device-1', assignmentState: 'unassigned' }),
    };
    const controller = new SuperAdminController(service as never);

    await expect(controller.create({ serial: 'SERIAL-1' } as never, { id: 'actor-1' }))
      .resolves.toEqual(expect.objectContaining({ uuid: 'device-1', assignmentState: 'unassigned' }));
  });

  it('requires a lifecycle reason when transitioning a device', async () => {
    const service = { transition: jest.fn() };
    const controller = new SuperAdminController(service as never);

    await expect(Promise.resolve().then(() => controller.transition('device-1', { state: 'maintenance', reason: '' } as never, { id: 'actor-1' })))
      .rejects.toThrow('reason');
    expect(service.transition).not.toHaveBeenCalled();
  });
});

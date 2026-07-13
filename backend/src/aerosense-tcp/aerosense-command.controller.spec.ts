import { describe, expect, it, jest } from '@jest/globals';
import { AeroSenseCommandController } from './aerosense-command.controller';

describe('AeroSenseCommandController', () => {
  it('runs an admin Wavve command and writes its requested value, success status, and elapsed time to the audit log', async () => {
    const commands = { setWavveReportInterval: jest.fn<(deviceId: string, ticks: number) => Promise<void>>().mockResolvedValue() };
    const prisma = { auditLog: { create: jest.fn<(input: unknown) => Promise<void>>().mockResolvedValue() } };
    const controller = new AeroSenseCommandController(commands as never, prisma as never);

    await expect(controller.setWavveReportInterval('device-id', { ticks: 20 }, { id: 'admin-id' })).resolves.toEqual({ ok: true });
    expect(commands.setWavveReportInterval).toHaveBeenCalledWith('device-id', 20);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorId: 'admin-id',
        action: 'aerosense.command.wavve.report_interval.set',
        resourceType: 'aerosense_device',
        resourceId: 'device-id',
        details: expect.objectContaining({ requestedValues: { ticks: 20 }, responseStatus: 'succeeded' }),
      }),
    }));
  });

  it('records failed configuration commands before rethrowing the sensor error', async () => {
    const commands = { setAssureFallBufferTime: jest.fn<(deviceId: string, seconds: number) => Promise<void>>().mockRejectedValue(new Error('AeroSense command timed out')) };
    const prisma = { auditLog: { create: jest.fn<(input: unknown) => Promise<void>>().mockResolvedValue() } };
    const controller = new AeroSenseCommandController(commands as never, prisma as never);

    await expect(controller.setAssureFallBufferTime('device-id', { seconds: 60 }, { id: 'admin-id' }))
      .rejects.toThrow('AeroSense command timed out');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'aerosense.command.assure.fall_buffer_time.set',
        details: expect.objectContaining({ requestedValues: { seconds: 60 }, responseStatus: 'failed' }),
      }),
    }));
  });

  it('exposes only the remaining bounded Wavve and Assure commands and audits their read and write operations', async () => {
    const commands = {
      setWavveBedExitTimer: jest.fn<(deviceId: string, seconds: number) => Promise<void>>().mockResolvedValue(),
      getWavveReportInterval: jest.fn<(deviceId: string) => Promise<number>>().mockResolvedValue(20),
      getWavveBedExitTimer: jest.fn<(deviceId: string) => Promise<number>>().mockResolvedValue(60),
      setAssureInstallationHeight: jest.fn<(deviceId: string, meters: number) => Promise<void>>().mockResolvedValue(),
      getAssureInstallationHeight: jest.fn<(deviceId: string) => Promise<number>>().mockResolvedValue(1.8),
      setAssureWorkingRange: jest.fn<(deviceId: string, meters: number) => Promise<void>>().mockResolvedValue(),
      getAssureWorkingRange: jest.fn<(deviceId: string) => Promise<number>>().mockResolvedValue(4),
      getAssureFallBufferTime: jest.fn<(deviceId: string) => Promise<number>>().mockResolvedValue(60),
      setAssureFallMode: jest.fn<(deviceId: string, mode: 'high_sensitivity' | 'low_false_alert') => Promise<void>>().mockResolvedValue(),
      getAssureFallMode: jest.fn<(deviceId: string) => Promise<'high_sensitivity' | 'low_false_alert'>>().mockResolvedValue('low_false_alert'),
    };
    const prisma = { auditLog: { create: jest.fn<(input: unknown) => Promise<void>>().mockResolvedValue() } };
    const controller = new AeroSenseCommandController(commands as never, prisma as never);
    const admin = { id: 'admin-id' };

    await expect(controller.setWavveBedExitTimer('device-id', { seconds: 60 }, admin)).resolves.toEqual({ ok: true });
    await expect(controller.getWavveReportInterval('device-id', admin)).resolves.toEqual({ value: 20 });
    await expect(controller.getWavveBedExitTimer('device-id', admin)).resolves.toEqual({ value: 60 });
    await expect(controller.setAssureInstallationHeight('device-id', { meters: 1.8 }, admin)).resolves.toEqual({ ok: true });
    await expect(controller.getAssureInstallationHeight('device-id', admin)).resolves.toEqual({ value: 1.8 });
    await expect(controller.setAssureWorkingRange('device-id', { meters: 4 }, admin)).resolves.toEqual({ ok: true });
    await expect(controller.getAssureWorkingRange('device-id', admin)).resolves.toEqual({ value: 4 });
    await expect(controller.getAssureFallBufferTime('device-id', admin)).resolves.toEqual({ value: 60 });
    await expect(controller.setAssureFallMode('device-id', { mode: 'low_false_alert' }, admin)).resolves.toEqual({ ok: true });
    await expect(controller.getAssureFallMode('device-id', admin)).resolves.toEqual({ value: 'low_false_alert' });

    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'aerosense.command.assure.fall_mode.get',
        details: expect.objectContaining({ requestedValues: {}, responseStatus: 'succeeded' }),
      }),
    }));
  });
});

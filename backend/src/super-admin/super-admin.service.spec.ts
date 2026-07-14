import { describe, expect, it, jest } from '@jest/globals';
import { SuperAdminService } from './super-admin.service';

describe('SuperAdminService', () => {
  function createService() {
    const lifecycle = {
      list: jest.fn<(...args: any[]) => Promise<any>>(),
      create: jest.fn<(...args: any[]) => Promise<any>>(),
      transition: jest.fn<(...args: any[]) => Promise<any>>(),
      restore: jest.fn<(...args: any[]) => Promise<any>>(),
      deprovision: jest.fn<(...args: any[]) => Promise<any>>(),
    };
    const commands = {
      setWavveReportInterval: jest.fn<(...args: any[]) => Promise<any>>(),
      getWavveReportInterval: jest.fn<(...args: any[]) => Promise<any>>(),
      setWavveBedExitTimer: jest.fn<(...args: any[]) => Promise<any>>(),
      getWavveBedExitTimer: jest.fn<(...args: any[]) => Promise<any>>(),
      setAssureInstallationHeight: jest.fn<(...args: any[]) => Promise<any>>(),
      getAssureInstallationHeight: jest.fn<(...args: any[]) => Promise<any>>(),
      setAssureFallBufferTime: jest.fn<(...args: any[]) => Promise<any>>(),
      getAssureFallBufferTime: jest.fn<(...args: any[]) => Promise<any>>(),
      setAssureWorkingRange: jest.fn<(...args: any[]) => Promise<any>>(),
      getAssureWorkingRange: jest.fn<(...args: any[]) => Promise<any>>(),
      setAssureFallMode: jest.fn<(...args: any[]) => Promise<any>>(),
      getAssureFallMode: jest.fn<(...args: any[]) => Promise<any>>(),
    };
    const prisma = {
      device: {
        findUnique: jest.fn<(...args: any[]) => Promise<any>>(),
        count: jest.fn<(...args: any[]) => Promise<any>>(),
      },
      auditLog: {
        findMany: jest.fn<(...args: any[]) => Promise<any>>(),
        count: jest.fn<(...args: any[]) => Promise<any>>(),
        create: jest.fn<(...args: any[]) => Promise<any>>(),
      },
      $queryRaw: jest.fn<(...args: any[]) => Promise<any>>(),
    };
    const redis = { ping: jest.fn<(...args: any[]) => Promise<any>>() };
    const metrics = { registry: { metrics: jest.fn<(...args: any[]) => Promise<any>>() } };
    const mqtt = { isConnected: jest.fn<() => boolean>().mockReturnValue(true) };
    const hardware = { isConnected: jest.fn<() => boolean>().mockReturnValue(true) };
    const tcp = { isListening: jest.fn<() => boolean>().mockReturnValue(true) };
    const service = new SuperAdminService(
      lifecycle as never,
      commands as never,
      prisma as never,
      redis as never,
      metrics as never,
      mqtt as never,
      hardware as never,
      tcp as never,
    );
    return { service, lifecycle, commands, prisma, redis, metrics, mqtt, hardware, tcp };
  }

  it('delegates fleet listing to the lifecycle service', async () => {
    const { service, lifecycle } = createService();
    lifecycle.list.mockResolvedValue([{ id: 'device-1' }]);

    await expect(service.listDevices({ transport: 'mqtt' })).resolves.toEqual([{ id: 'device-1' }]);
    expect(lifecycle.list).toHaveBeenCalledWith({ transport: 'mqtt' });
  });

  it('executes and audits an allowlisted AeroSense command', async () => {
    const { service, commands, prisma } = createService();
    commands.setWavveReportInterval.mockResolvedValue(undefined);
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    await expect(service.executeCommand(
      'device-1',
      'wavve.report_interval.set',
      { ticks: 20 },
      'actor-1',
    )).resolves.toEqual({ ok: true });

    expect(commands.setWavveReportInterval).toHaveBeenCalledWith('device-1', 20);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'aerosense.command.wavve.report_interval.set',
        details: expect.objectContaining({
          requestedValues: { ticks: 20 },
          responseStatus: 'succeeded',
          elapsedMs: expect.any(Number),
        }),
      }),
    }));
  });

  it('rejects commands outside the explicit allowlist', async () => {
    const { service } = createService();

    await expect(service.executeCommand('device-1', 'raw.function_code', {}, 'actor-1'))
      .rejects.toThrow('allowlist');
  });

  it('audits a failed allowlisted command with response status and elapsed time', async () => {
    const { service, commands, prisma } = createService();
    commands.getWavveBedExitTimer.mockRejectedValue(new Error('timeout'));
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-2' });

    await expect(service.executeCommand('device-1', 'wavve.bed_exit_timer.get', {}, 'actor-1'))
      .rejects.toThrow('timeout');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        details: expect.objectContaining({
          requestedValues: {},
          responseStatus: 'failed',
          elapsedMs: expect.any(Number),
          errorName: 'Error',
        }),
      }),
    }));
  });

  it('returns fleet summary, global audit, and dependency health', async () => {
    const { service, prisma, redis, metrics } = createService();
    prisma.device.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'audit-1' }]);
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockResolvedValue('PONG');
    metrics.registry.metrics.mockResolvedValue('anees_tcp_frames_rejected_total 2\n');

    await expect(service.getFleetSummary()).resolves.toEqual(expect.objectContaining({ total: 4 }));
    await expect(service.getGlobalAudit({ limit: 25 })).resolves.toEqual([{ id: 'audit-1' }]);
    await expect(service.getSystemHealth()).resolves.toEqual(expect.objectContaining({
      status: 'healthy',
      dependencies: expect.objectContaining({ database: 'healthy', redis: 'healthy', mqtt: 'healthy', aerosenseTcp: 'healthy' }),
    }));
  });
});

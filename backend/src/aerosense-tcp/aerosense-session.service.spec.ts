import { describe, expect, it, jest } from '@jest/globals';
import { Socket } from 'net';
import { AeroSenseFrame } from './protocol/aerosense-frame';
import { AeroSenseSessionService } from './aerosense-session.service';

const deviceId = '7b1c8f21-bd66-4a81-8b9f-620e5fed2c76';
const radarId = '13CECDA0000040C11D13155507';

function registrationFrame(): AeroSenseFrame {
  return {
    protocol: 'wavve',
    type: 1,
    command: 1,
    requestId: 1,
    timeoutOrStatus: 10000,
    functionCode: 0x0001,
    data: Buffer.from([0x01, 0x02, 0x08, 0x02, 0x03, ...Buffer.from(radarId, 'hex')]),
  };
}

function assureRegistrationFrame(): AeroSenseFrame {
  return {
    protocol: 'assure',
    type: 1,
    command: 1,
    requestId: 1,
    timeoutOrStatus: 10000,
    functionCode: 0x0012,
    data: Buffer.from([0x00, ...Buffer.from(radarId, 'hex')]),
  };
}

describe('AeroSenseSessionService', () => {
  it('binds a registered radar ID and records its firmware version', async () => {
    const devices = {
      resolveAeroSenseDevice: jest.fn<(externalId: string) => Promise<{ id: string; userId: string } | null>>().mockResolvedValue({ id: deviceId, userId: 'ce54a4f9-50ad-4527-8652-1edc5daec281' }),
    };
    const prisma = { device: { update: jest.fn<(args: unknown) => Promise<Record<string, never>>>().mockResolvedValue({}) } };
    const sessions = new AeroSenseSessionService(devices as never, prisma as never, {} as never, {} as never);
    const socket = {} as Socket;

    await expect(sessions.register(socket, registrationFrame())).resolves.toBe(true);

    expect(devices.resolveAeroSenseDevice).toHaveBeenCalledWith(radarId);
    expect(prisma.device.update).toHaveBeenCalledWith({
      where: { id: deviceId },
      data: { firmwareVersion: '2.8.2.3', lastHeartbeat: expect.any(Date), status: 'online' },
    });
    expect(sessions.getDeviceId(socket)).toBe(deviceId);
  });

  it('rejects an unknown radar ID without creating a session', async () => {
    const devices = { resolveAeroSenseDevice: jest.fn<(externalId: string) => Promise<{ id: string; userId: string } | null>>().mockResolvedValue(null) };
    const prisma = { device: { update: jest.fn<(args: unknown) => Promise<Record<string, never>>>() } };
    const sessions = new AeroSenseSessionService(devices as never, prisma as never, {} as never, {} as never);
    const socket = {} as Socket;

    await expect(sessions.register(socket, registrationFrame())).resolves.toBe(false);
    expect(prisma.device.update).not.toHaveBeenCalled();
    expect(sessions.getDeviceId(socket)).toBeUndefined();
  });

  it('binds an Assure radar using its 0x0012 registration format', async () => {
    const devices = {
      resolveAeroSenseDevice: jest
        .fn<(externalId: string) => Promise<{ id: string; userId: string } | null>>()
        .mockResolvedValue({ id: deviceId, userId: 'ce54a4f9-50ad-4527-8652-1edc5daec281' }),
    };
    const prisma = { device: { update: jest.fn<(args: unknown) => Promise<Record<string, never>>>().mockResolvedValue({}) } };
    const sessions = new AeroSenseSessionService(devices as never, prisma as never, {} as never, {} as never);
    const socket = {} as Socket;

    await expect(sessions.register(socket, assureRegistrationFrame())).resolves.toBe(true);

    expect(devices.resolveAeroSenseDevice).toHaveBeenCalledWith(radarId);
    expect(prisma.device.update).toHaveBeenCalledWith({
      where: { id: deviceId },
      data: { lastHeartbeat: expect.any(Date), status: 'online' },
    });
    expect(sessions.getSession(socket)).toEqual({ deviceId, patientId: 'ce54a4f9-50ad-4527-8652-1edc5daec281' });
  });

  it('marks a disconnected device offline after the TCP grace period', async () => {
    jest.useFakeTimers();
    try {
      const prisma = {
        device: { update: jest.fn<(...args: unknown[]) => Promise<Record<string, never>>>().mockResolvedValue({}) },
        systemEvent: { create: jest.fn<(...args: unknown[]) => Promise<Record<string, never>>>().mockResolvedValue({}) },
      };
      const redis = { publish: jest.fn<(...args: unknown[]) => Promise<number>>().mockResolvedValue(1) };
      const sessions = new AeroSenseSessionService(
        {} as never,
        prisma as never,
        { get: () => 5_000 } as never,
        redis as never,
      );
      const logger = { log: jest.fn() };
      (sessions as any).logger = logger;
      const socket = {} as Socket;
      (sessions as any).sessions.set(socket, { deviceId, patientId: 'ce54a4f9-50ad-4527-8652-1edc5daec281' });

      sessions.unregister(socket);
      await jest.advanceTimersByTimeAsync(5_000);

      expect(prisma.device.update).toHaveBeenCalledWith({ where: { id: deviceId }, data: { status: 'offline' } });
      expect(redis.publish).toHaveBeenCalledWith('alerts:caregiver', expect.stringContaining('system.device_offline'));
      expect(logger.log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'device_offline', deviceId, source: 'aerosense_tcp' }),
        'AeroSense device offline',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('sends a command through the active device socket and resolves its matching response', async () => {
    const metrics = { tcpCommandDuration: { observe: jest.fn() } };
    const sessions = new AeroSenseSessionService({} as never, {} as never, { get: () => 5_000 } as never, {} as never, metrics as never);
    const socket = { write: jest.fn() } as unknown as Socket;
    const response = {
      protocol: 'wavve' as const, type: 0 as const, command: 2 as const, requestId: 44,
      timeoutOrStatus: 0, functionCode: 0x03e9, data: Buffer.from([0, 0, 0, 1]),
    };
    (sessions as any).sessions.set(socket, { deviceId, patientId: 'ce54a4f9-50ad-4527-8652-1edc5daec281' });
    (sessions as any).deviceSockets.set(deviceId, socket);

    const pending = sessions.sendCommand(deviceId, {
      protocol: 'wavve', requestId: 44, timeoutOrStatus: 10_000, functionCode: 0x03e9, data: Buffer.from([0, 0, 0, 60]),
    });
    expect(socket.write).toHaveBeenCalledTimes(1);
    expect(sessions.resolveCommandResponse(socket, response)).toBe(true);
    await expect(pending).resolves.toEqual(response);
    expect(metrics.tcpCommandDuration.observe).toHaveBeenCalledWith(
      { protocol: 'wavve', function_code: '0x03e9', result: 'succeeded' },
      expect.any(Number),
    );
  });
});

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

describe('AeroSenseSessionService', () => {
  it('binds a registered radar ID and records its firmware version', async () => {
    const devices = {
      resolveAeroSenseDevice: jest.fn<(externalId: string) => Promise<{ id: string; userId: string } | null>>().mockResolvedValue({ id: deviceId, userId: 'ce54a4f9-50ad-4527-8652-1edc5daec281' }),
    };
    const prisma = { device: { update: jest.fn<(args: unknown) => Promise<Record<string, never>>>().mockResolvedValue({}) } };
    const sessions = new AeroSenseSessionService(devices as never, prisma as never);
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
    const sessions = new AeroSenseSessionService(devices as never, prisma as never);
    const socket = {} as Socket;

    await expect(sessions.register(socket, registrationFrame())).resolves.toBe(false);
    expect(prisma.device.update).not.toHaveBeenCalled();
    expect(sessions.getDeviceId(socket)).toBeUndefined();
  });
});

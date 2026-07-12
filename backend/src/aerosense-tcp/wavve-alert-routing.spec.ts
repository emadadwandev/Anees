import { describe, expect, it, jest } from '@jest/globals';
import { AeroSenseTcpServerService } from './aerosense-tcp-server.service';

describe('Wavve alert TCP routing', () => {
  it('routes a high-heart frame to the clinical-alert policy without replying', async () => {
    const session = { deviceId: '7b1c8f21-bd66-4a81-8b9f-620e5fed2c76', patientId: 'ce54a4f9-50ad-4527-8652-1edc5daec281' };
    const sessions = { getSession: jest.fn().mockReturnValue(session) };
    const events = {
      handleWavveClinicalAlert: jest
        .fn<(session: object, subtype: string, timestamp: number) => Promise<void>>()
        .mockResolvedValue(),
    };
    const service = new AeroSenseTcpServerService({} as never, sessions as never, events as never);
    const wire = Buffer.from([
      0x13, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x06,
      0x04, 0x01, 0x00, 0x00, 0x00, 0x00,
    ]);
    const socket = { write: jest.fn() };

    await (service as any).handleFrame(socket, wire);

    expect(events.handleWavveClinicalAlert).toHaveBeenCalledWith(session, 'vital.high_heart', expect.any(Number));
    expect(socket.write).not.toHaveBeenCalled();
  });

  it('routes a bed-exit frame to the non-clinical observation policy', async () => {
    const session = { deviceId: '7b1c8f21-bd66-4a81-8b9f-620e5fed2c76', patientId: 'ce54a4f9-50ad-4527-8652-1edc5daec281' };
    const sessions = { getSession: jest.fn().mockReturnValue(session) };
    const events = {
      handleWavveObservation: jest.fn<(session: object, event: object, timestamp: number) => Promise<void>>().mockResolvedValue(),
    };
    const service = new AeroSenseTcpServerService({} as never, sessions as never, events as never);
    const wire = Buffer.from([
      0x13, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x2b, 0x00, 0x00, 0x00, 0x00, 0x00, 0x06,
      0x04, 0x06, 0x00, 0x00, 0x00, 0x00,
    ]);
    const socket = { write: jest.fn() };

    await (service as any).handleFrame(socket, wire);

    expect(events.handleWavveObservation).toHaveBeenCalledWith(session, { kind: 'bed.exit' }, expect.any(Number));
    expect(socket.write).not.toHaveBeenCalled();
  });
});

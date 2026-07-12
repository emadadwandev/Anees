import { createConnection } from 'net';
import { describe, expect, it, jest } from '@jest/globals';
import { configSchema } from '../config/config.schema';
import { decodeFrame } from './protocol/frame-codec';
import { AeroSenseTcpServerService } from './aerosense-tcp-server.service';

function wavveVitalFrame(): Buffer {
  const payload = Buffer.alloc(36);
  payload.writeFloatBE(16, 0);
  payload.writeFloatBE(0.15, 4);
  payload.writeFloatBE(72, 8);
  payload.writeFloatBE(-0.42, 12);
  payload.writeFloatBE(1.5, 16);
  payload.writeFloatBE(36, 20);
  payload.writeUInt32BE(2, 24);
  payload.writeFloatBE(22, 28);
  payload.writeFloatBE(3.3, 32);

  const frame = Buffer.alloc(52);
  frame.writeUInt8(0x13, 0);
  frame.writeUInt8(0x01, 1);
  frame.writeUInt8(0x01, 2);
  frame.writeUInt8(0x01, 3);
  frame.writeUInt32BE(43, 4);
  frame.writeUInt16BE(10_000, 8);
  frame.writeUInt32BE(38, 10);
  frame.writeUInt16BE(0x03e8, 14);
  payload.copy(frame, 16);
  return frame;
}

function assureFallFrame(): Buffer {
  const frame = Buffer.alloc(24);
  frame.writeUInt8(0x12, 0);
  frame.writeUInt8(0x01, 1);
  frame.writeUInt8(0x01, 2);
  frame.writeUInt8(0x01, 3);
  frame.writeUInt32BE(44, 4);
  frame.writeUInt16BE(10_000, 8);
  frame.writeUInt32BE(10, 10);
  frame.writeUInt16BE(0x0009, 14);
  frame.writeFloatBE(3, 16);
  frame.writeFloatBE(5, 20);
  return frame;
}

function assurePresenceFrame(): Buffer {
  const frame = Buffer.alloc(228);
  frame.writeUInt8(0x12, 0);
  frame.writeUInt8(0x01, 1);
  frame.writeUInt8(0x01, 2);
  frame.writeUInt8(0x01, 3);
  frame.writeUInt32BE(45, 4);
  frame.writeUInt16BE(10_000, 8);
  frame.writeUInt32BE(214, 10);
  frame.writeUInt16BE(0x0018, 14);
  frame.writeUInt32BE(1, 16);
  frame.writeFloatBE(4.5, 20);
  frame.writeFloatBE(100, 24);
  return frame;
}

function assurePositionFrame(): Buffer {
  const frame = Buffer.alloc(28);
  frame.writeUInt8(0x12, 0);
  frame.writeUInt8(0x01, 1);
  frame.writeUInt8(0x02, 2);
  frame.writeUInt8(0x01, 3);
  frame.writeUInt32BE(46, 4);
  frame.writeUInt16BE(10_000, 8);
  frame.writeUInt32BE(14, 10);
  frame.writeUInt16BE(0x001c, 14);
  frame.writeFloatBE(1.5, 16);
  frame.writeFloatBE(2, 20);
  frame.writeFloatBE(0.8, 24);
  return frame;
}

const requiredConfig = {
  DATABASE_URL: 'postgresql://anees:anees_dev_secret@localhost:5432/anees',
  REDIS_URL: 'redis://:anees_redis_dev@localhost:6379',
  MQTT_BROKER_URL: 'mqtt://localhost:1883',
  JWT_ACCESS_SECRET: '1234567890123456',
  JWT_REFRESH_SECRET: '1234567890123456',
  LIVEKIT_API_KEY: 'devkey',
  LIVEKIT_API_SECRET: 'devsecret',
  LIVEKIT_WS_URL: 'ws://localhost:7880',
  DSP_SERVICE_URL: 'http://localhost:8001',
};

describe('AeroSense TCP listener configuration', () => {
  it('uses a safe local listener default configuration', () => {
    const config = configSchema.parse(requiredConfig);

    expect(config).toMatchObject({
      TCP_BIND_HOST: '0.0.0.0',
      TCP_PORT: 8899,
      TCP_IDLE_TIMEOUT_MS: 120000,
      TCP_ALLOWED_CIDRS: '',
    });
  });

  it('rejects a privileged TCP port', () => {
    expect(() => configSchema.parse({ ...requiredConfig, TCP_PORT: 443 })).toThrow();
  });

  it('accepts a local TCP connection and stops cleanly', async () => {
    const config = {
      get: (key: string) => ({
        TCP_BIND_HOST: '127.0.0.1',
        TCP_PORT: 0,
        TCP_IDLE_TIMEOUT_MS: 30_000,
      }[key]),
    };
    const service = new AeroSenseTcpServerService(
      config as never,
      { register: jest.fn(), unregister: jest.fn() } as never,
      { handleWavveVital: jest.fn() } as never,
    );
    const port = await service.start();
    const socket = createConnection({ host: '127.0.0.1', port });

    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });

    socket.end();
    await service.stop();
    expect(service.isListening()).toBe(false);
  });

  it('acknowledges a registered sensor frame using the same request ID', async () => {
    const session = { register: jest.fn<() => Promise<boolean>>().mockResolvedValue(true), unregister: jest.fn() };
    const config = {
      get: (key: string) => ({
        TCP_BIND_HOST: '127.0.0.1',
        TCP_PORT: 0,
        TCP_IDLE_TIMEOUT_MS: 30_000,
      }[key]),
    };
    const service = new AeroSenseTcpServerService(config as never, session as never, { handleWavveVital: jest.fn() } as never);
    const port = await service.start();
    const socket = createConnection({ host: '127.0.0.1', port });

    const response = new Promise<Buffer>((resolve, reject) => {
      socket.once('data', resolve);
      socket.once('error', reject);
    });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    socket.write(Buffer.from([
      0x13, 0x01, 0x01, 0x01,
      0x00, 0x00, 0x00, 0x2a,
      0x00, 0x0a,
      0x00, 0x00, 0x00, 0x02,
      0x00, 0x01,
    ]));

    expect(decodeFrame(await response)).toMatchObject({
      protocol: 'wavve',
      type: 0,
      command: 2,
      requestId: 42,
      functionCode: 1,
      data: Buffer.from([0, 0, 0, 1]),
    });
    expect(session.register).toHaveBeenCalledTimes(1);

    socket.end();
    await service.stop();
  });

  it('routes Wavve vital frames from a registered sensor to the ingestion service', async () => {
    const sensorSession = {
      deviceId: '7b1c8f21-bd66-4a81-8b9f-620e5fed2c76',
      patientId: 'ce54a4f9-50ad-4527-8652-1edc5daec281',
    };
    const sessions = { register: jest.fn(), unregister: jest.fn(), getSession: jest.fn().mockReturnValue(sensorSession) };
    let resolveHandled!: () => void;
    const handled = new Promise<void>((resolve) => {
      resolveHandled = resolve;
    });
    const events = {
      handleWavveVital: jest
        .fn<(session: object, vital: object, timestamp: number) => Promise<void>>()
        .mockImplementation(async () => resolveHandled()),
    };
    const config = {
      get: (key: string) => ({
        TCP_BIND_HOST: '127.0.0.1',
        TCP_PORT: 0,
        TCP_IDLE_TIMEOUT_MS: 30_000,
      }[key]),
    };
    const service = new AeroSenseTcpServerService(config as never, sessions as never, events as never);
    const port = await service.start();
    const socket = createConnection({ host: '127.0.0.1', port });

    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    socket.write(wavveVitalFrame());
    await handled;

    expect(events.handleWavveVital).toHaveBeenCalledWith(
      sensorSession,
      expect.objectContaining({ heartRateBpm: 72, respirationRateBrpm: 16, validBit: 2 }),
      expect.any(Number),
    );

    socket.end();
    await service.stop();
  });

  it('acknowledges an Assure fall after it enters the alert workflow', async () => {
    const sensorSession = {
      deviceId: '7b1c8f21-bd66-4a81-8b9f-620e5fed2c76',
      patientId: 'ce54a4f9-50ad-4527-8652-1edc5daec281',
    };
    const sessions = { register: jest.fn(), unregister: jest.fn(), getSession: jest.fn().mockReturnValue(sensorSession) };
    const events = {
      handleAssureFall: jest.fn<(session: object, position: object, timestamp: number) => Promise<void>>().mockResolvedValue(),
      handleWavveVital: jest.fn(),
    };
    const config = {
      get: (key: string) => ({
        TCP_BIND_HOST: '127.0.0.1',
        TCP_PORT: 0,
        TCP_IDLE_TIMEOUT_MS: 30_000,
      }[key]),
    };
    const service = new AeroSenseTcpServerService(config as never, sessions as never, events as never);
    const port = await service.start();
    const socket = createConnection({ host: '127.0.0.1', port });
    const response = new Promise<Buffer>((resolve, reject) => {
      socket.once('data', resolve);
      socket.once('error', reject);
    });

    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    socket.write(assureFallFrame());

    expect(decodeFrame(await response)).toMatchObject({
      protocol: 'assure',
      type: 0,
      command: 2,
      requestId: 44,
      functionCode: 0x0009,
      data: Buffer.from([0, 0, 0, 1]),
    });
    expect(events.handleAssureFall).toHaveBeenCalledWith(
      sensorSession,
      { kind: 'fall', xM: 3, yM: 5 },
      expect.any(Number),
    );

    socket.end();
    await service.stop();
  });

  it('acknowledges an Assure presence report after safe presence handling', async () => {
    const sensorSession = {
      deviceId: '7b1c8f21-bd66-4a81-8b9f-620e5fed2c76',
      patientId: 'ce54a4f9-50ad-4527-8652-1edc5daec281',
    };
    const sessions = { register: jest.fn(), unregister: jest.fn(), getSession: jest.fn().mockReturnValue(sensorSession) };
    const events = {
      handleAssurePresence: jest.fn<(session: object, presence: object, timestamp: number) => Promise<void>>().mockResolvedValue(),
      handleWavveVital: jest.fn(),
    };
    const config = {
      get: (key: string) => ({
        TCP_BIND_HOST: '127.0.0.1',
        TCP_PORT: 0,
        TCP_IDLE_TIMEOUT_MS: 30_000,
      }[key]),
    };
    const service = new AeroSenseTcpServerService(config as never, sessions as never, events as never);
    const port = await service.start();
    const socket = createConnection({ host: '127.0.0.1', port });
    const response = new Promise<Buffer>((resolve, reject) => {
      socket.once('data', resolve);
      socket.once('error', reject);
    });

    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    socket.write(assurePresenceFrame());

    expect(decodeFrame(await response)).toMatchObject({ functionCode: 0x0018, requestId: 45, data: Buffer.from([0, 0, 0, 1]) });
    expect(events.handleAssurePresence).toHaveBeenCalledWith(
      sensorSession,
      { kind: 'presence', occupied: true, rangeM: 4.5, energy: 100 },
      expect.any(Number),
    );

    socket.end();
    await service.stop();
  });

  it('routes one-way Assure position frames without an acknowledgement', async () => {
    const sensorSession = {
      deviceId: '7b1c8f21-bd66-4a81-8b9f-620e5fed2c76',
      patientId: 'ce54a4f9-50ad-4527-8652-1edc5daec281',
    };
    const sessions = { register: jest.fn(), unregister: jest.fn(), getSession: jest.fn().mockReturnValue(sensorSession) };
    let resolveHandled!: () => void;
    const handled = new Promise<void>((resolve) => {
      resolveHandled = resolve;
    });
    const events = {
      handleAssurePosition: jest
        .fn<(session: object, position: object, timestamp: number) => Promise<void>>()
        .mockImplementation(async () => resolveHandled()),
      handleWavveVital: jest.fn(),
    };
    const config = {
      get: (key: string) => ({
        TCP_BIND_HOST: '127.0.0.1',
        TCP_PORT: 0,
        TCP_IDLE_TIMEOUT_MS: 30_000,
      }[key]),
    };
    const service = new AeroSenseTcpServerService(config as never, sessions as never, events as never);
    const port = await service.start();
    const socket = createConnection({ host: '127.0.0.1', port });
    let receivedResponse = false;
    socket.on('data', () => {
      receivedResponse = true;
    });

    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    socket.write(assurePositionFrame());
    await handled;
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(events.handleAssurePosition).toHaveBeenCalledWith(
      sensorSession,
      expect.objectContaining({ kind: 'position', xM: 1.5, yM: 2, zM: expect.closeTo(0.8, 5) }),
      expect.any(Number),
    );
    expect(receivedResponse).toBe(false);

    socket.end();
    await service.stop();
  });
});

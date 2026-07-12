import { createConnection } from 'net';
import { describe, expect, it, jest } from '@jest/globals';
import { configSchema } from '../config/config.schema';
import { decodeFrame } from './protocol/frame-codec';
import { AeroSenseTcpServerService } from './aerosense-tcp-server.service';

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
    const service = new AeroSenseTcpServerService(config as never, { register: jest.fn(), unregister: jest.fn() } as never);
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
    const service = new AeroSenseTcpServerService(config as never, session as never);
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
});

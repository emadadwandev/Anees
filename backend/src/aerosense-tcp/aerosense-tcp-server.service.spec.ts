import { describe, expect, it } from '@jest/globals';
import { configSchema } from '../config/config.schema';

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
});

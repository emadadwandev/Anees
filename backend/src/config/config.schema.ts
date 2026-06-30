import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().url(),

  REDIS_URL: z.string().url(),

  MQTT_BROKER_URL: z.string(),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(604800),

  LIVEKIT_API_KEY: z.string(),
  LIVEKIT_API_SECRET: z.string(),
  LIVEKIT_API_URL: z.string().default('http://livekit:7880'),  // server-to-server Twirp RPC
  LIVEKIT_WS_URL: z.string(),                                  // returned to clients

  FCM_PROJECT_ID: z.string().optional(),
  FCM_CLIENT_EMAIL: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),

  DSP_SERVICE_URL: z.string().url(),

  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4317'),

  TURN_URL: z.string().optional(),
  TURN_USERNAME: z.string().optional(),
  TURN_PASSWORD: z.string().optional(),

  CORS_ORIGIN: z.string().default('*'),
});

export type Config = z.infer<typeof configSchema>;

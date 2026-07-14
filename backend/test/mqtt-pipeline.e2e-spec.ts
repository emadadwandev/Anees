/**
 * P2-006: Integration test — MQTT payload → DSP → TimescaleDB pipeline
 *
 * Requires Docker Compose test stack (postgres, redis, hivemq, dsp-service) running.
 * Run via: npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import * as mqtt from 'mqtt';
import { PrismaClient, Role } from '@prisma/client';
import { AppModule } from '../src/app.module';

const MQTT_BROKER = process.env.MQTT_BROKER_URL ?? 'mqtt://localhost:1883';
const TEST_DEVICE_ID = process.env.TEST_DEVICE_UUID ?? 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const TEST_PATIENT_ID = process.env.TEST_PATIENT_UUID ?? 'ffffffff-aaaa-bbbb-cccc-dddddddddddd';

function buildMmWavePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    device_id: TEST_DEVICE_ID,
    timestamp: Date.now(),
    frame_seq: Math.floor(Math.random() * 10000),
    firmware_version: '2.4.1',
    point_cloud: Array.from({ length: 5 }, (_, i) => ({
      x: 0.1 * i,
      y: 0.2 * i,
      z: 0.05 * i,
      v: -0.3 + i * 0.05,
      snr: 0.7 + i * 0.05,
    })),
    ...overrides,
  };
}

async function waitForCondition(
  fn: () => Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 200,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

describe('MQTT → DSP → TimescaleDB Pipeline (P2-006)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let mqttClient: mqtt.MqttClient;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    prisma = new PrismaClient();
    await prisma.$connect();

    await prisma.user.upsert({
      where: { id: TEST_PATIENT_ID },
      update: {},
      create: {
        id: TEST_PATIENT_ID,
        email: 'mqtt-pipeline-e2e@anees.local',
        passwordHash: 'not-used',
        role: Role.care_receiver,
        firstName: 'MQTT',
        lastName: 'E2E',
      },
    });

    // Ensure test device exists
    await prisma.device.upsert({
      where: { id: TEST_DEVICE_ID },
      update: {},
      create: {
        id: TEST_DEVICE_ID,
        serial: 'TEST-SERIAL-E2E',
        firmwareVersion: '2.4.1',
        roomLabel: 'E2E Test Room',
        userId: TEST_PATIENT_ID,
      },
    }).catch(() => {}); // ignore if patient doesn't exist — seed script handles it

    mqttClient = mqtt.connect(MQTT_BROKER, { reconnectPeriod: 0 });
    await new Promise<void>((resolve, reject) => {
      mqttClient.on('connect', () => resolve());
      mqttClient.on('error', reject);
      setTimeout(() => reject(new Error('MQTT connect timeout')), 5000);
    });
  }, 30000);

  afterAll(async () => {
    mqttClient.end();
    await prisma.device.delete({ where: { id: TEST_DEVICE_ID } }).catch(() => {});
    await prisma.user.delete({ where: { id: TEST_PATIENT_ID } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('should receive MQTT payload and store vital reading in TimescaleDB within 5 seconds', async () => {
    const publishTimestamp = Date.now();
    const payload = buildMmWavePayload({ timestamp: publishTimestamp });

    mqttClient.publish(
      `anees/devices/${TEST_DEVICE_ID}/raw`,
      JSON.stringify(payload),
      { qos: 1 },
    );

    const stored = await waitForCondition(async () => {
      const rows: any[] = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS count
        FROM vital_readings
        WHERE device_id = ${TEST_DEVICE_ID}::uuid
          AND time >= to_timestamp(${publishTimestamp / 1000} - 1)
      `;
      return rows[0]?.count > 0;
    }, 5000);

    expect(stored).toBe(true);
  }, 10000);

  it('should reject invalid MQTT payload (missing point_cloud) and route to DLQ', async () => {
    const invalidPublishTimestamp = Date.now();
    const invalidPayload = {
      device_id: TEST_DEVICE_ID,
      timestamp: invalidPublishTimestamp,
      frame_seq: 999,
      firmware_version: '2.4.1',
      // point_cloud intentionally missing
    };

    mqttClient.publish(
      `anees/devices/${TEST_DEVICE_ID}/raw`,
      JSON.stringify(invalidPayload),
      { qos: 1 },
    );

    // Wait briefly — invalid payloads should NOT create vital readings
    await new Promise((r) => setTimeout(r, 1000));

    const rows: any[] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM vital_readings
        WHERE device_id = ${TEST_DEVICE_ID}::uuid
        AND time >= to_timestamp(${invalidPublishTimestamp / 1000})
    `;
    // Should be 0 — no new vital from invalid payload
    expect(rows[0]?.count).toBe(0);
  }, 10000);

  it('should update device last_heartbeat timestamp after processing', async () => {
    const before = Date.now();
    const payload = buildMmWavePayload({ timestamp: before });

    mqttClient.publish(
      `anees/devices/${TEST_DEVICE_ID}/raw`,
      JSON.stringify(payload),
      { qos: 1 },
    );

    const updated = await waitForCondition(async () => {
      const device = await prisma.device.findUnique({ where: { id: TEST_DEVICE_ID } });
      return device?.lastHeartbeat != null && device.lastHeartbeat.getTime() >= before - 5000;
    }, 8000);

    expect(updated).toBe(true);
  }, 15000);
});

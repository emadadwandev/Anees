import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { DeviceTransport, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request = require('supertest');
import { AppModule } from '../src/app.module';

const SUPER_ADMIN_ID = 'eeeeeeee-2222-4222-8333-444444444444';
const ADMIN_ID = 'eeeeeeee-2222-4222-8333-555555555555';

describe('Super-admin device API (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let superAdminToken: string;
  let adminToken: string;

  beforeAll(async () => {
    process.env.TCP_BIND_HOST = '127.0.0.1';
    process.env.TCP_PORT = '18899';
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.user.upsert({
      where: { id: SUPER_ADMIN_ID },
      update: { role: Role.super_admin, passwordHash: await bcrypt.hash('e2e-super-password', 10) },
      create: {
        id: SUPER_ADMIN_ID,
        email: 'super-admin.e2e@anees.local',
        passwordHash: await bcrypt.hash('e2e-super-password', 10),
        role: Role.super_admin,
        firstName: 'E2E',
        lastName: 'Super Admin',
      },
    });
    await prisma.user.upsert({
      where: { id: ADMIN_ID },
      update: { role: Role.admin, passwordHash: await bcrypt.hash('e2e-admin-password', 10) },
      create: {
        id: ADMIN_ID,
        email: 'admin.e2e@anees.local',
        passwordHash: await bcrypt.hash('e2e-admin-password', 10),
        role: Role.admin,
        firstName: 'E2E',
        lastName: 'Admin',
      },
    });

    superAdminToken = (await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'super-admin.e2e@anees.local', password: 'e2e-super-password' })
      .expect(200)).body.accessToken;
    adminToken = (await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'admin.e2e@anees.local', password: 'e2e-admin-password' })
      .expect(200)).body.accessToken;
  }, 30_000);

  afterAll(async () => {
    await prisma?.device.deleteMany({ where: { serial: { startsWith: 'E2E-SUPER-' } } });
    await prisma?.$disconnect();
    await app?.close();
  });

  it('provisions MQTT and AeroSense TCP devices with immutable UUIDs and no assignment', async () => {
    const mqttResponse = await request(app.getHttpServer())
      .post('/v1/super-admin/devices')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        serial: 'E2E-SUPER-MQTT',
        firmwareVersion: '1.0.0',
        roomLabel: 'Staging MQTT',
        deviceType: 'fall_sensor',
        transport: 'mqtt',
        vendor: 'Anees Test',
      })
      .expect(201);
    const mqttDevice = mqttResponse.body;
    expect(mqttDevice.uuid).toBe(mqttDevice.id);
    expect(mqttDevice.assignmentState).toBe('unassigned');

    const tcpResponse = await request(app.getHttpServer())
      .post('/v1/super-admin/devices')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        serial: 'E2E-SUPER-TCP',
        firmwareVersion: '2.8.2.3',
        roomLabel: 'Staging TCP',
        deviceType: 'sleep_sensor',
        transport: DeviceTransport.aerosense_tcp,
        vendor: 'AeroSense Wavve',
        externalId: '13CECDA0000040C11D13155508',
      })
      .expect(201);
    expect(tcpResponse.body.uuid).toBe(tcpResponse.body.id);
    expect(tcpResponse.body.assignmentState).toBe('unassigned');
  }, 20_000);

  it('protects lifecycle transitions and exposes immutable audit history', async () => {
    const device = await prisma.device.findUnique({ where: { serial: 'E2E-SUPER-MQTT' } });
    expect(device).not.toBeNull();

    await request(app.getHttpServer())
      .post(`/v1/super-admin/devices/${device!.id}/state`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ state: 'maintenance', reason: 'E2E bench test' })
      .expect(201)
      .expect(({ body }) => expect(body.managementState).toBe('maintenance'));

    await request(app.getHttpServer())
      .get(`/v1/super-admin/devices/${device!.id}/audit`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200)
      .expect(({ body }) => expect(body.some((entry: { action: string }) => entry.action === 'device.management_state_changed')).toBe(true));

    await request(app.getHttpServer())
      .get('/v1/super-admin/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  }, 20_000);
});

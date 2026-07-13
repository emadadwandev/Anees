import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeviceTransport, PrismaClient, Role } from '@prisma/client';
import { createConnection, Socket } from 'net';
import { AppModule } from '../src/app.module';
import { AeroSenseTcpServerService } from '../src/aerosense-tcp/aerosense-tcp-server.service';
import { WAVVE_E2E_RADAR_ID, wavveRegistrationFrame, wavveVitalFrame } from './fixtures/aerosense-frames';

const TEST_DEVICE_ID = 'eeeeeeee-1111-4222-8333-444444444444';
const TEST_PATIENT_ID = 'eeeeeeee-1111-4222-8333-555555555555';

async function waitFor<T>(read: () => Promise<T | null>, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for AeroSense TCP E2E result');
}

describe('AeroSense TCP ingress (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let socket: Socket;

  beforeAll(async () => {
    process.env.TCP_BIND_HOST = '127.0.0.1';
    process.env.TCP_PORT = '0';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.user.upsert({
      where: { id: TEST_PATIENT_ID },
      update: {},
      create: { id: TEST_PATIENT_ID, email: 'aerosense-tcp-e2e@anees.local', passwordHash: 'not-used', role: Role.care_receiver },
    });
    await prisma.device.upsert({
      where: { id: TEST_DEVICE_ID },
      update: { transport: DeviceTransport.aerosense_tcp, externalId: WAVVE_E2E_RADAR_ID },
      create: {
        id: TEST_DEVICE_ID, userId: TEST_PATIENT_ID, serial: 'AEROSENSE-TCP-E2E', firmwareVersion: '2.8.2.3',
        roomLabel: 'TCP E2E', transport: DeviceTransport.aerosense_tcp, vendor: 'AeroSense Wavve', externalId: WAVVE_E2E_RADAR_ID,
      },
    });
  }, 30_000);

  afterAll(async () => {
    socket?.destroy();
    await prisma?.device.delete({ where: { id: TEST_DEVICE_ID } }).catch(() => {});
    await prisma?.user.delete({ where: { id: TEST_PATIENT_ID } }).catch(() => {});
    await prisma?.$disconnect();
    await app?.close();
  });

  it('stores a valid Wavve vital frame and publishes the live vital cache entry', async () => {
    const listener = app.get(AeroSenseTcpServerService);
    const port = await listener.start();
    socket = createConnection({ host: '127.0.0.1', port });
    await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
    socket.write(Buffer.concat([wavveRegistrationFrame(), wavveVitalFrame()]));

    await waitFor(async () => {
      const rows: Array<{ count: number }> = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS count FROM wavve_vital_details WHERE device_id = ${TEST_DEVICE_ID}::uuid
      `;
      return rows[0]?.count ? rows[0] : null;
    });
    const redis = app.get('default_IORedisModuleConnectionToken' as never) as { get: (key: string) => Promise<string | null> };
    await expect(waitFor(() => redis.get(`vitals:live:${TEST_PATIENT_ID}`))).resolves.toContain('"heart_rate_bpm":72');
  }, 20_000);
});

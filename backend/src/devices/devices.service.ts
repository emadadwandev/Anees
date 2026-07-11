import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

const DEVICE_CACHE_TTL = 3600;

interface RegisterAeroSenseDeviceInput {
  serial: string;
  userId: string;
  roomLabel: string;
  firmwareVersion: string;
  externalId: string;
  vendor: string;
  capabilities?: Prisma.InputJsonValue;
}

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // MQTT payloads send device_id as DB UUID (hardware provisioned with its UUID at registration)
  async resolveDeviceById(deviceId: string) {
    const cacheKey = `device:id:${deviceId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (device) {
      await this.redis.set(cacheKey, JSON.stringify(device), 'EX', DEVICE_CACHE_TTL);
    }
    return device;
  }

  // Kept for admin lookup by hardware serial (device management UI)
  async resolveDeviceBySerial(serial: string) {
    const cacheKey = `device:serial:${serial}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const device = await this.prisma.device.findUnique({ where: { serial } });
    if (device) {
      await this.redis.set(cacheKey, JSON.stringify(device), 'EX', DEVICE_CACHE_TTL);
    }
    return device;
  }

  async resolveAeroSenseDevice(externalId: string) {
    const normalized = externalId.toUpperCase();
    const cacheKey = `device:aerosense:${normalized}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        const device = JSON.parse(cached);
        if (device.transport === 'aerosense_tcp') return device;
      } catch {
        // Ignore malformed cache data and resolve from the source of truth.
      }
    }

    const device = await this.prisma.device.findUnique({ where: { externalId: normalized } });
    if (!device || device.transport !== 'aerosense_tcp') return null;

    await this.redis.set(cacheKey, JSON.stringify(device), 'EX', DEVICE_CACHE_TTL);
    return device;
  }

  async register(serial: string, userId: string, roomLabel: string, firmwareVersion: string) {
    return this.prisma.device.create({
      data: { serial, userId, roomLabel, firmwareVersion },
    });
  }

  async registerAeroSenseDevice(input: RegisterAeroSenseDeviceInput) {
    const { externalId, ...device } = input;
    return this.prisma.device.create({
      data: {
        ...device,
        externalId: externalId.toUpperCase(),
        transport: 'aerosense_tcp',
      },
    });
  }

  async getStatus(deviceId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async updateRoomLabel(deviceId: string, roomLabel: string) {
    return this.prisma.device.update({ where: { id: deviceId }, data: { roomLabel } });
  }

  async getFleet() {
    return this.prisma.device.findMany({ include: { user: true } });
  }

  async updateHeartbeat(deviceId: string) {
    return this.prisma.device.update({
      where: { id: deviceId },
      data: { lastHeartbeat: new Date(), status: 'online' },
    });
  }
}

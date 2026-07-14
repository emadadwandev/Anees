import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { DeviceStatus } from '@prisma/client';

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

@Injectable()
export class DeviceHealthService {
  private readonly logger = new Logger(DeviceHealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkDeviceHealth() {
    const cutoff = new Date(Date.now() - OFFLINE_THRESHOLD_MS);

    const staleDevices = await this.prisma.device.findMany({
      where: {
        status: DeviceStatus.online,
        OR: [{ lastHeartbeat: { lt: cutoff } }, { lastHeartbeat: null }],
      },
    });

    for (const device of staleDevices) {
      await this.prisma.device.update({
        where: { id: device.id },
        data: { status: DeviceStatus.offline },
      });

      await this.prisma.systemEvent.create({
        data: {
          deviceId: device.id,
          type: 'device_offline',
          payload: { lastHeartbeat: device.lastHeartbeat?.toISOString() ?? null },
        },
      });

      if (device.userId) {
        await this.redis.publish(
          'alerts:caregiver',
          JSON.stringify({
            type: 'system.device_offline',
            deviceId: device.id,
            patientId: device.userId,
            lastSeen: device.lastHeartbeat?.toISOString() ?? null,
          }),
        );
      }

      this.logger.warn({ deviceId: device.id, patientId: device.userId }, 'Device marked offline');
    }

    // Push notification for devices offline > 15 minutes
    const longOfflineCutoff = new Date(Date.now() - 15 * 60 * 1000);
    const longOfflineDevices = await this.prisma.device.findMany({
      where: { status: DeviceStatus.offline, lastHeartbeat: { lt: longOfflineCutoff } },
    });

    for (const device of longOfflineDevices) {
      const lastPush = await this.prisma.systemEvent.findFirst({
        where: { deviceId: device.id, type: 'device_offline_push_sent' },
        orderBy: { createdAt: 'desc' },
      });

      const hourAgo = Date.now() - 60 * 60 * 1000;
      if (device.userId && (!lastPush || lastPush.createdAt.getTime() < hourAgo)) {
        await this.redis.publish(
          'alerts:caregiver',
          JSON.stringify({ type: 'device.offline_15min', deviceId: device.id, patientId: device.userId }),
        );
        await this.prisma.systemEvent.create({
          data: { deviceId: device.id, type: 'device_offline_push_sent' },
        });
      }
    }
  }
}

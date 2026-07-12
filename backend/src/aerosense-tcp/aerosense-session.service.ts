import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DeviceStatus } from '@prisma/client';
import Redis from 'ioredis';
import { Socket } from 'net';
import { Config } from '../config/config.schema';
import { DevicesService } from '../devices/devices.service';
import { PrismaService } from '../prisma/prisma.service';
import { AeroSenseFrame } from './protocol/aerosense-frame';
import type { AeroSenseSession } from './aerosense-event.service';

@Injectable()
export class AeroSenseSessionService {
  private readonly sessions = new Map<Socket, AeroSenseSession>();
  private readonly offlineTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly devices: DevicesService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Config>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  getDeviceId(socket: Socket): string | undefined {
    return this.sessions.get(socket)?.deviceId;
  }

  getSession(socket: Socket): AeroSenseSession | undefined {
    return this.sessions.get(socket);
  }

  unregister(socket: Socket): void {
    const session = this.sessions.get(socket);
    this.sessions.delete(socket);
    if (!session || this.hasActiveSession(session.deviceId)) return;

    this.offlineTimers.get(session.deviceId) && clearTimeout(this.offlineTimers.get(session.deviceId));
    const timer = setTimeout(() => void this.markOfflineIfDisconnected(session), this.config.get('TCP_DISCONNECT_GRACE_MS')!);
    this.offlineTimers.set(session.deviceId, timer);
  }

  async register(socket: Socket, frame: AeroSenseFrame): Promise<boolean> {
    const isWavveRegistration = frame.protocol === 'wavve' && frame.functionCode === 0x0001 && frame.data.length === 18;
    const isAssureRegistration = frame.protocol === 'assure' && frame.functionCode === 0x0012 && frame.data.length === 14;
    if (!isWavveRegistration && !isAssureRegistration) return false;

    const firmwareVersion = isWavveRegistration ? Array.from(frame.data.subarray(1, 5)).join('.') : undefined;
    const externalId = frame.data.subarray(isWavveRegistration ? 5 : 1).toString('hex').toUpperCase();
    const device = await this.devices.resolveAeroSenseDevice(externalId);
    if (!device) return false;

    const offlineTimer = this.offlineTimers.get(device.id);
    if (offlineTimer) clearTimeout(offlineTimer);
    this.offlineTimers.delete(device.id);

    await this.prisma.device.update({
      where: { id: device.id },
      data: {
        ...(firmwareVersion && { firmwareVersion }),
        lastHeartbeat: new Date(),
        status: DeviceStatus.online,
      },
    });
    this.sessions.set(socket, { deviceId: device.id, patientId: device.userId });
    return true;
  }

  private hasActiveSession(deviceId: string): boolean {
    return [...this.sessions.values()].some((session) => session.deviceId === deviceId);
  }

  private async markOfflineIfDisconnected(session: AeroSenseSession): Promise<void> {
    if (this.hasActiveSession(session.deviceId)) return;
    this.offlineTimers.delete(session.deviceId);
    await this.prisma.device.update({ where: { id: session.deviceId }, data: { status: DeviceStatus.offline } });
    await this.prisma.systemEvent.create({
      data: { deviceId: session.deviceId, type: 'device_offline', payload: { source: 'aerosense_tcp' } },
    });
    await this.redis.publish('alerts:caregiver', JSON.stringify({
      type: 'system.device_offline', deviceId: session.deviceId, patientId: session.patientId,
      lastSeen: new Date().toISOString(), source: 'aerosense_tcp',
    }));
  }
}

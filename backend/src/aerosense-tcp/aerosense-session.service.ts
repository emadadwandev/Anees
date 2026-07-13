import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DeviceStatus } from '@prisma/client';
import Redis from 'ioredis';
import { Socket } from 'net';
import { Config } from '../config/config.schema';
import { DevicesService } from '../devices/devices.service';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AeroSenseFrame } from './protocol/aerosense-frame';
import { encodeCommandRequest } from './protocol/frame-codec';
import type { AeroSenseSession } from './aerosense-event.service';

@Injectable()
export class AeroSenseSessionService {
  private readonly logger = new Logger(AeroSenseSessionService.name);
  private readonly sessions = new Map<Socket, AeroSenseSession>();
  private readonly deviceSockets = new Map<string, Socket>();
  private readonly offlineTimers = new Map<string, NodeJS.Timeout>();
  private readonly pendingCommands = new Map<string, { socket: Socket; resolve: (frame: AeroSenseFrame) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();

  constructor(
    private readonly devices: DevicesService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Config>,
    @InjectRedis() private readonly redis: Redis,
    private readonly metrics?: MetricsService,
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
    if (session && this.deviceSockets.get(session.deviceId) === socket) this.deviceSockets.delete(session.deviceId);
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
    this.deviceSockets.set(device.id, socket);
    return true;
  }

  sendCommand(deviceId: string, frame: Pick<AeroSenseFrame, 'protocol' | 'requestId' | 'timeoutOrStatus' | 'functionCode' | 'data'>): Promise<AeroSenseFrame> {
    const startedAt = performance.now();
    const observe = (result: 'succeeded' | 'failed') => {
      this.metrics?.tcpCommandDuration.observe({
        protocol: frame.protocol,
        function_code: `0x${frame.functionCode.toString(16).padStart(4, '0')}`,
        result,
      }, (performance.now() - startedAt) / 1000);
    };
    const socket = this.deviceSockets.get(deviceId);
    if (!socket || socket.destroyed) {
      observe('failed');
      return Promise.reject(new Error('AeroSense device is not connected'));
    }
    const key = `${deviceId}:${frame.requestId}`;
    if (this.pendingCommands.has(key)) {
      observe('failed');
      return Promise.reject(new Error('AeroSense command request ID is already pending'));
    }

    return new Promise<AeroSenseFrame>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(key);
        reject(new Error('AeroSense command timed out'));
      }, frame.timeoutOrStatus);
      this.pendingCommands.set(key, { socket, resolve, reject, timer });
      socket.write(encodeCommandRequest(frame));
    }).then(
      (response) => {
        observe('succeeded');
        return response;
      },
      (error: Error) => {
        observe('failed');
        throw error;
      },
    );
  }

  resolveCommandResponse(socket: Socket, frame: AeroSenseFrame): boolean {
    const session = this.sessions.get(socket);
    if (!session || frame.type !== 0 || frame.command !== 2) return false;
    const key = `${session.deviceId}:${frame.requestId}`;
    const pending = this.pendingCommands.get(key);
    if (!pending || pending.socket !== socket) return false;
    clearTimeout(pending.timer);
    this.pendingCommands.delete(key);
    pending.resolve(frame);
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
    this.logger.log(
      { event: 'device_offline', deviceId: session.deviceId, patientId: session.patientId, source: 'aerosense_tcp' },
      'AeroSense device offline',
    );
    await this.redis.publish('alerts:caregiver', JSON.stringify({
      type: 'system.device_offline', deviceId: session.deviceId, patientId: session.patientId,
      lastSeen: new Date().toISOString(), source: 'aerosense_tcp',
    }));
  }
}

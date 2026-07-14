import { BadRequestException, Injectable } from '@nestjs/common';
import { DeviceManagementState, DeviceTransport, DeviceType, Prisma } from '@prisma/client';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceLifecycleService, DeviceListFilter, CreateManagedDeviceInput } from '../devices/device-lifecycle.service';
import { MetricsService } from '../metrics/metrics.service';
import { AeroSenseCommandService, AssureFallMode } from '../aerosense-tcp/aerosense-command.service';
import { AeroSenseTcpServerService } from '../aerosense-tcp/aerosense-tcp-server.service';
import { MqttConsumerService } from '../mqtt/mqtt-consumer.service';
import { HardwareDeviceService } from '../mqtt/hardware-device.service';

export type SuperAdminCommandName =
  | 'wavve.report_interval.set'
  | 'wavve.report_interval.get'
  | 'wavve.bed_exit_timer.set'
  | 'wavve.bed_exit_timer.get'
  | 'assure.installation_height.set'
  | 'assure.installation_height.get'
  | 'assure.fall_buffer_time.set'
  | 'assure.fall_buffer_time.get'
  | 'assure.working_range.set'
  | 'assure.working_range.get'
  | 'assure.fall_mode.set'
  | 'assure.fall_mode.get';

const COMMANDS = new Set<string>([
  'wavve.report_interval.set',
  'wavve.report_interval.get',
  'wavve.bed_exit_timer.set',
  'wavve.bed_exit_timer.get',
  'assure.installation_height.set',
  'assure.installation_height.get',
  'assure.fall_buffer_time.set',
  'assure.fall_buffer_time.get',
  'assure.working_range.set',
  'assure.working_range.get',
  'assure.fall_mode.set',
  'assure.fall_mode.get',
]);

export interface GlobalAuditFilter {
  cursor?: string;
  limit?: number;
  action?: string;
  deviceId?: string;
}

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly lifecycle: DeviceLifecycleService,
    private readonly commands: AeroSenseCommandService,
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly metrics: MetricsService,
    private readonly mqtt: MqttConsumerService,
    private readonly hardware: HardwareDeviceService,
    private readonly tcp: AeroSenseTcpServerService,
  ) {}

  listDevices(filter: DeviceListFilter) {
    return this.lifecycle.list(filter);
  }

  createDevice(input: CreateManagedDeviceInput, actorId: string) {
    return this.lifecycle.create(input, actorId);
  }

  getDevice(deviceId: string) {
    return this.lifecycle.get(deviceId);
  }

  transition(deviceId: string, state: DeviceManagementState, reason: string, actorId: string) {
    return this.lifecycle.transition(deviceId, state, reason, actorId);
  }

  restore(deviceId: string, reason: string, actorId: string) {
    return this.lifecycle.restore(deviceId, reason, actorId);
  }

  deprovision(deviceId: string, reason: string, actorId: string) {
    return this.lifecycle.deprovision(deviceId, reason, actorId);
  }

  async getDeviceAudit(deviceId: string, limit = 50) {
    const rows = await this.prisma.auditLog.findMany({
      where: { resourceId: deviceId },
      orderBy: { timestamp: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      select: {
        id: true,
        actorId: true,
        action: true,
        resourceType: true,
        resourceId: true,
        details: true,
        timestamp: true,
      },
    });
    return rows;
  }

  async getGlobalAudit(filter: GlobalAuditFilter = {}) {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(filter.action && { action: filter.action }),
        ...(filter.deviceId && { resourceId: filter.deviceId }),
      },
      ...(filter.cursor && { skip: 1, cursor: { id: filter.cursor } }),
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        id: true,
        actorId: true,
        action: true,
        resourceType: true,
        resourceId: true,
        details: true,
        timestamp: true,
      },
    });
    return rows;
  }

  async getFleetSummary() {
    const active = { deprovisionedAt: null };
    const [total, mqtt, aerosenseTcp, enabled, maintenance, disabled, online, offline] = await Promise.all([
      this.prisma.device.count({ where: active }),
      this.prisma.device.count({ where: { ...active, transport: DeviceTransport.mqtt } }),
      this.prisma.device.count({ where: { ...active, transport: DeviceTransport.aerosense_tcp } }),
      this.prisma.device.count({ where: { ...active, managementState: DeviceManagementState.enabled } }),
      this.prisma.device.count({ where: { ...active, managementState: DeviceManagementState.maintenance } }),
      this.prisma.device.count({ where: { ...active, managementState: DeviceManagementState.disabled } }),
      this.prisma.device.count({ where: { ...active, status: 'online' } }),
      this.prisma.device.count({ where: { ...active, status: { not: 'online' } } }),
    ]);

    return {
      total,
      transports: { mqtt, aerosenseTcp },
      managementStates: { enabled, maintenance, disabled },
      connectivity: { online, offline },
    };
  }

  async getSystemHealth() {
    const [database, redis, metrics] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => 'healthy' as const).catch(() => 'unhealthy' as const),
      this.redis.ping().then((value) => value === 'PONG' ? 'healthy' as const : 'unhealthy' as const)
        .catch(() => 'unhealthy' as const),
      this.metrics.registry.metrics().then((value) => ({ status: 'healthy' as const, rejectedFrames: this.readRejectedFrames(value) }))
        .catch(() => ({ status: 'unhealthy' as const, rejectedFrames: null })),
    ]);
    const mqttHealthy = this.mqtt.isConnected() || this.hardware.isConnected();
    const tcpHealthy = this.tcp.isListening();
    const statuses = [database, redis, metrics.status, mqttHealthy ? 'healthy' : 'unhealthy', tcpHealthy ? 'healthy' : 'unhealthy'];

    return {
      status: statuses.every((status) => status === 'healthy') ? 'healthy' : 'degraded',
      checkedAt: new Date().toISOString(),
      dependencies: {
        database,
        redis,
        mqtt: mqttHealthy ? 'healthy' : 'unhealthy',
        aerosenseTcp: tcpHealthy ? 'healthy' : 'unhealthy',
      },
      metrics: { rejectedFrames: metrics.rejectedFrames },
    };
  }

  async executeCommand(
    deviceId: string,
    command: string,
    values: Record<string, unknown>,
    actorId: string,
  ) {
    if (!COMMANDS.has(command)) throw new BadRequestException(`Command is not in the AeroSense allowlist: ${command}`);

    const startedAt = Date.now();
    let responseStatus: 'succeeded' | 'failed' = 'succeeded';
    let errorName: string | undefined;
    try {
      const result = await this.dispatchCommand(deviceId, command as SuperAdminCommandName, values);
      return typeof result === 'undefined' ? { ok: true as const } : { value: result };
    } catch (error) {
      responseStatus = 'failed';
      errorName = error instanceof Error ? error.name : 'UnknownError';
      throw error;
    } finally {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: `aerosense.command.${command}`,
          resourceType: 'aerosense_device',
          resourceId: deviceId,
          details: {
            requestedValues: values as Prisma.InputJsonValue,
            responseStatus,
            elapsedMs: Date.now() - startedAt,
            ...(errorName && { errorName }),
          },
        },
      });
    }
  }

  private dispatchCommand(deviceId: string, command: SuperAdminCommandName, values: Record<string, unknown>) {
    switch (command) {
      case 'wavve.report_interval.set': return this.commands.setWavveReportInterval(deviceId, this.numberValue(values, 'ticks'));
      case 'wavve.report_interval.get': return this.commands.getWavveReportInterval(deviceId);
      case 'wavve.bed_exit_timer.set': return this.commands.setWavveBedExitTimer(deviceId, this.numberValue(values, 'seconds'));
      case 'wavve.bed_exit_timer.get': return this.commands.getWavveBedExitTimer(deviceId);
      case 'assure.installation_height.set': return this.commands.setAssureInstallationHeight(deviceId, this.numberValue(values, 'meters'));
      case 'assure.installation_height.get': return this.commands.getAssureInstallationHeight(deviceId);
      case 'assure.fall_buffer_time.set': return this.commands.setAssureFallBufferTime(deviceId, this.numberValue(values, 'seconds'));
      case 'assure.fall_buffer_time.get': return this.commands.getAssureFallBufferTime(deviceId);
      case 'assure.working_range.set': return this.commands.setAssureWorkingRange(deviceId, this.numberValue(values, 'meters'));
      case 'assure.working_range.get': return this.commands.getAssureWorkingRange(deviceId);
      case 'assure.fall_mode.set': return this.commands.setAssureFallMode(deviceId, this.stringValue(values, 'mode') as AssureFallMode);
      case 'assure.fall_mode.get': return this.commands.getAssureFallMode(deviceId);
    }
  }

  private numberValue(values: Record<string, unknown>, key: string): number {
    const value = values[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new BadRequestException(`${key} must be a number`);
    return value;
  }

  private stringValue(values: Record<string, unknown>, key: string): string {
    const value = values[key];
    if (typeof value !== 'string' || !value) throw new BadRequestException(`${key} must be a string`);
    return value;
  }

  private readRejectedFrames(metrics: string): number {
    const match = metrics.match(/anees_tcp_frames_rejected_total(?:\{[^}]*\})?\s+([\d.]+)/);
    return match ? Number(match[1]) : 0;
  }
}

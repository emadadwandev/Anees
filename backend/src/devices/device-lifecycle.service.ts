import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeviceManagementState, DeviceTransport, DeviceType, Prisma } from '@prisma/client';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

const DEVICE_CACHE_TTL = 3600;

export interface CreateManagedDeviceInput {
  serial: string;
  firmwareVersion: string;
  roomLabel: string;
  deviceType: DeviceType;
  transport: DeviceTransport;
  vendor?: string;
  externalId?: string;
  capabilities?: Prisma.InputJsonValue;
}

export interface DeviceListFilter {
  transport?: DeviceTransport;
  managementState?: DeviceManagementState;
  status?: string;
  search?: string;
  includeDeprovisioned?: boolean;
}

@Injectable()
export class DeviceLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async list(filter: DeviceListFilter = {}) {
    const search = filter.search?.trim();
    const devices = await this.prisma.device.findMany({
      where: {
        ...(filter.transport && { transport: filter.transport }),
        ...(filter.managementState && { managementState: filter.managementState }),
        ...(filter.status && { status: filter.status as never }),
        ...(filter.includeDeprovisioned ? {} : { deprovisionedAt: null }),
        ...(search && {
          OR: [
            { id: { contains: search, mode: 'insensitive' } },
            { serial: { contains: search, mode: 'insensitive' } },
            { externalId: { contains: search, mode: 'insensitive' } },
            { vendor: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return devices.map((device) => this.sanitize(device));
  }

  async get(deviceId: string) {
    const device = await this.findDevice(deviceId);
    return this.sanitize(device);
  }

  async create(input: CreateManagedDeviceInput, actorId: string) {
    const externalId = input.externalId?.trim().toUpperCase() || undefined;
    const device = await this.prisma.device.create({
      data: {
        serial: input.serial.trim(),
        firmwareVersion: input.firmwareVersion.trim(),
        roomLabel: input.roomLabel.trim(),
        deviceType: input.deviceType,
        transport: input.transport,
        userId: null,
        vendor: input.vendor?.trim() || null,
        externalId,
        capabilities: input.capabilities,
        managementState: DeviceManagementState.enabled,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'device.created',
        resourceType: 'device',
        resourceId: device.id,
        details: {
          transport: device.transport,
          vendor: device.vendor,
          externalId: device.externalId,
          assignmentState: 'unassigned',
        },
      },
    });

    return this.sanitize(device);
  }

  async transition(
    deviceId: string,
    state: DeviceManagementState,
    reason: string,
    actorId: string,
  ) {
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new BadRequestException('A lifecycle transition reason is required');

    const device = await this.findDevice(deviceId);
    if (device.deprovisionedAt) throw new ConflictException('Deprovisioned devices cannot be restored by state transition');

    const updated = await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        managementState: state,
        managementStateReason: normalizedReason,
        managementStateChangedAt: new Date(),
      },
    });

    await this.invalidateIdentityCaches(device);
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'device.management_state_changed',
        resourceType: 'device',
        resourceId: deviceId,
        details: {
          oldState: device.managementState,
          newState: state,
          reason: normalizedReason,
        },
      },
    });

    return this.sanitize(updated);
  }

  restore(deviceId: string, reason: string, actorId: string) {
    return this.transition(deviceId, DeviceManagementState.enabled, reason, actorId);
  }

  async deprovision(deviceId: string, reason: string, actorId: string) {
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new BadRequestException('A deprovision reason is required');

    const device = await this.findDevice(deviceId);
    if (device.deprovisionedAt) return this.sanitize(device);

    const now = new Date();
    const updated = await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        deprovisionedAt: now,
        managementState: DeviceManagementState.disabled,
        managementStateReason: normalizedReason,
        managementStateChangedAt: now,
      },
    });

    await this.invalidateIdentityCaches(device);
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'device.deprovisioned',
        resourceType: 'device',
        resourceId: deviceId,
        details: { reason: normalizedReason },
      },
    });

    return this.sanitize(updated);
  }

  requireAssignedPatient(device: { userId: string | null }): string {
    if (!device.userId) throw new ConflictException('Device is not assigned to a patient');
    return device.userId;
  }

  async invalidateIdentityCaches(device: { id: string; serial: string; externalId?: string | null }) {
    const keys = [`device:id:${device.id}`, `device:serial:${device.serial}`];
    if (device.externalId) keys.push(`device:aerosense:${device.externalId.toUpperCase()}`);
    await this.redis.del(...keys);
  }

  private async findDevice(deviceId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  private sanitize<T extends {
    id: string;
    userId: string | null;
    serial: string;
    transport: DeviceTransport;
    vendor: string | null;
    externalId: string | null;
    firmwareVersion: string;
    status: string;
    managementState: DeviceManagementState;
    managementStateReason: string | null;
    managementStateChangedAt: Date;
    deprovisionedAt: Date | null;
    lastHeartbeat: Date | null;
    roomLabel: string;
    deviceType: DeviceType;
    signalQuality: number | null;
    capabilities: Prisma.JsonValue | null;
  }>(device: T) {
    return {
      id: device.id,
      uuid: device.id,
      serial: device.serial,
      transport: device.transport,
      vendor: device.vendor,
      externalId: device.externalId,
      firmwareVersion: device.firmwareVersion,
      status: device.status,
      managementState: device.managementState,
      managementStateReason: device.managementStateReason,
      managementStateChangedAt: device.managementStateChangedAt,
      deprovisionedAt: device.deprovisionedAt,
      lastHeartbeat: device.lastHeartbeat,
      roomLabel: device.roomLabel,
      deviceType: device.deviceType,
      signalQuality: device.signalQuality,
      capabilities: device.capabilities,
      assignmentState: device.userId ? 'assigned' : 'unassigned',
    };
  }
}

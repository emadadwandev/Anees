import { Injectable } from '@nestjs/common';
import { DeviceStatus } from '@prisma/client';
import { Socket } from 'net';
import { DevicesService } from '../devices/devices.service';
import { PrismaService } from '../prisma/prisma.service';
import { AeroSenseFrame } from './protocol/aerosense-frame';
import type { AeroSenseSession } from './aerosense-event.service';

@Injectable()
export class AeroSenseSessionService {
  private readonly sessions = new Map<Socket, AeroSenseSession>();

  constructor(
    private readonly devices: DevicesService,
    private readonly prisma: PrismaService,
  ) {}

  getDeviceId(socket: Socket): string | undefined {
    return this.sessions.get(socket)?.deviceId;
  }

  getSession(socket: Socket): AeroSenseSession | undefined {
    return this.sessions.get(socket);
  }

  unregister(socket: Socket): void {
    this.sessions.delete(socket);
  }

  async register(socket: Socket, frame: AeroSenseFrame): Promise<boolean> {
    const isWavveRegistration = frame.protocol === 'wavve' && frame.functionCode === 0x0001 && frame.data.length === 18;
    const isAssureRegistration = frame.protocol === 'assure' && frame.functionCode === 0x0012 && frame.data.length === 14;
    if (!isWavveRegistration && !isAssureRegistration) return false;

    const firmwareVersion = isWavveRegistration ? Array.from(frame.data.subarray(1, 5)).join('.') : undefined;
    const externalId = frame.data.subarray(isWavveRegistration ? 5 : 1).toString('hex').toUpperCase();
    const device = await this.devices.resolveAeroSenseDevice(externalId);
    if (!device) return false;

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
}

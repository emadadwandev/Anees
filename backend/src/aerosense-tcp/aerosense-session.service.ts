import { Injectable } from '@nestjs/common';
import { DeviceStatus } from '@prisma/client';
import { Socket } from 'net';
import { DevicesService } from '../devices/devices.service';
import { PrismaService } from '../prisma/prisma.service';
import { AeroSenseFrame } from './protocol/aerosense-frame';

@Injectable()
export class AeroSenseSessionService {
  private readonly deviceIds = new Map<Socket, string>();

  constructor(
    private readonly devices: DevicesService,
    private readonly prisma: PrismaService,
  ) {}

  getDeviceId(socket: Socket): string | undefined {
    return this.deviceIds.get(socket);
  }

  unregister(socket: Socket): void {
    this.deviceIds.delete(socket);
  }

  async register(socket: Socket, frame: AeroSenseFrame): Promise<boolean> {
    if (frame.functionCode !== 0x0001 || frame.data.length !== 18) return false;

    const firmwareVersion = Array.from(frame.data.subarray(1, 5)).join('.');
    const externalId = frame.data.subarray(5).toString('hex').toUpperCase();
    const device = await this.devices.resolveAeroSenseDevice(externalId);
    if (!device) return false;

    await this.prisma.device.update({
      where: { id: device.id },
      data: {
        firmwareVersion,
        lastHeartbeat: new Date(),
        status: DeviceStatus.online,
      },
    });
    this.deviceIds.set(socket, device.id);
    return true;
  }
}

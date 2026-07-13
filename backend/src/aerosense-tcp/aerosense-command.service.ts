import { BadRequestException, Injectable } from '@nestjs/common';
import { AeroSenseSessionService } from './aerosense-session.service';

export type AssureFallMode = 'high_sensitivity' | 'low_false_alert';

@Injectable()
export class AeroSenseCommandService {
  private nextRequestId = 1;

  constructor(private readonly sessions: AeroSenseSessionService) {}

  async setWavveReportInterval(deviceId: string, ticks: number): Promise<void> {
    if (!Number.isInteger(ticks) || ticks < 1 || ticks > 60_000) {
      throw new BadRequestException('Wavve report interval must be within 1..60000 ticks');
    }

    const data = Buffer.alloc(4);
    data.writeUInt32BE(ticks, 0);
    const response = await this.sessions.sendCommand(deviceId, {
      protocol: 'wavve',
      requestId: this.nextRequestId++,
      timeoutOrStatus: 10_000,
      functionCode: 0x03e9,
      data,
    });
    if (response.data.length !== 4 || response.data.readUInt32BE(0) !== 1) {
      throw new BadRequestException('Wavve rejected the report interval command');
    }
  }

  async getWavveReportInterval(deviceId: string): Promise<number> {
    return this.readWavveUint32(deviceId, 0x03ea, 1, 60_000, 'report interval');
  }

  async setWavveBedExitTimer(deviceId: string, seconds: number): Promise<void> {
    if (!Number.isInteger(seconds) || (seconds !== 0 && (seconds < 30 || seconds > 86_400))) {
      throw new BadRequestException('Wavve bed-exit timer must be 0 or 30..86400 seconds');
    }

    const data = Buffer.alloc(4);
    data.writeUInt32BE(seconds, 0);
    const response = await this.sessions.sendCommand(deviceId, {
      protocol: 'wavve',
      requestId: this.nextRequestId++,
      timeoutOrStatus: 10_000,
      functionCode: 0x0404,
      data,
    });
    if (response.data.length !== 4 || response.data.readUInt32BE(0) !== 1) {
      throw new BadRequestException('Wavve rejected the bed-exit timer command');
    }
  }

  async getWavveBedExitTimer(deviceId: string): Promise<number> {
    const value = await this.readWavveUint32(deviceId, 0x0405, 0, 86_400, 'bed-exit timer');
    if (value !== 0 && value < 30) throw new BadRequestException('Wavve returned an invalid bed-exit timer');
    return value;
  }

  async setAssureInstallationHeight(deviceId: string, meters: number): Promise<void> {
    this.requireFiniteRange(meters, 1.4, 2.2, 'Assure installation height must be within 1.4..2.2 meters');
    await this.sendAssureSet(deviceId, 0x0002, this.floatData(meters), 'installation height');
  }

  async getAssureInstallationHeight(deviceId: string): Promise<number> {
    return this.readAssureFloat(deviceId, 0x0003, 1.4, 2.2, 'installation height');
  }

  async setAssureFallBufferTime(deviceId: string, seconds: number): Promise<void> {
    if (!Number.isInteger(seconds) || seconds < 30 || seconds > 300) {
      throw new BadRequestException('Assure fall buffer time must be within 30..300 seconds');
    }
    await this.sendAssureSet(deviceId, 0x0004, this.uint32Data(seconds), 'fall buffer time');
  }

  async getAssureFallBufferTime(deviceId: string): Promise<number> {
    return this.readAssureUint32(deviceId, 0x0005, 30, 300, 'fall buffer time');
  }

  async setAssureWorkingRange(deviceId: string, meters: number): Promise<void> {
    this.requireFiniteRange(meters, 1, 7, 'Assure working range must be within 1..7 meters');
    await this.sendAssureSet(deviceId, 0x0006, this.floatData(meters), 'working range');
  }

  async getAssureWorkingRange(deviceId: string): Promise<number> {
    return this.readAssureFloat(deviceId, 0x0007, 1, 7, 'working range');
  }

  async setAssureFallMode(deviceId: string, mode: AssureFallMode): Promise<void> {
    const value = mode === 'high_sensitivity' ? 0 : mode === 'low_false_alert' ? 1 : undefined;
    if (value === undefined) throw new BadRequestException('Assure fall mode must be high_sensitivity or low_false_alert');
    await this.sendAssureSet(deviceId, 0x001e, this.uint32Data(value), 'fall mode');
  }

  async getAssureFallMode(deviceId: string): Promise<AssureFallMode> {
    const value = await this.readAssureUint32(deviceId, 0x001f, 0, 1, 'fall mode');
    return value === 0 ? 'high_sensitivity' : 'low_false_alert';
  }

  private async sendAssureSet(deviceId: string, functionCode: number, data: Buffer, commandName: string): Promise<void> {
    const response = await this.sendAssureCommand(deviceId, functionCode, data);
    if (response.data.length !== 4 || response.data.readUInt32BE(0) !== 1) {
      throw new BadRequestException(`Assure rejected the ${commandName} command`);
    }
  }

  private async readWavveUint32(
    deviceId: string,
    functionCode: number,
    minimum: number,
    maximum: number,
    valueName: string,
  ): Promise<number> {
    const response = await this.sessions.sendCommand(deviceId, {
      protocol: 'wavve',
      requestId: this.nextRequestId++,
      timeoutOrStatus: 10_000,
      functionCode,
      data: Buffer.alloc(4),
    });
    if (response.data.length !== 4) throw new BadRequestException(`Wavve returned an invalid ${valueName} response`);
    const value = response.data.readUInt32BE(0);
    if (value < minimum || value > maximum) throw new BadRequestException(`Wavve returned an invalid ${valueName}`);
    return value;
  }

  private async readAssureFloat(
    deviceId: string,
    functionCode: number,
    minimum: number,
    maximum: number,
    valueName: string,
  ): Promise<number> {
    const response = await this.sendAssureCommand(deviceId, functionCode, Buffer.alloc(4));
    if (response.data.length !== 4) throw new BadRequestException(`Assure returned an invalid ${valueName} response`);
    const value = response.data.readFloatBE(0);
    this.requireFiniteRange(value, minimum, maximum, `Assure returned an invalid ${valueName}`);
    return value;
  }

  private async readAssureUint32(
    deviceId: string,
    functionCode: number,
    minimum: number,
    maximum: number,
    valueName: string,
  ): Promise<number> {
    const response = await this.sendAssureCommand(deviceId, functionCode, Buffer.alloc(4));
    if (response.data.length !== 4) throw new BadRequestException(`Assure returned an invalid ${valueName} response`);
    const value = response.data.readUInt32BE(0);
    if (value < minimum || value > maximum) throw new BadRequestException(`Assure returned an invalid ${valueName}`);
    return value;
  }

  private sendAssureCommand(deviceId: string, functionCode: number, data: Buffer) {
    return this.sessions.sendCommand(deviceId, {
      protocol: 'assure',
      requestId: this.nextRequestId++,
      timeoutOrStatus: 10_000,
      functionCode,
      data,
    });
  }

  private floatData(value: number): Buffer {
    const data = Buffer.alloc(4);
    data.writeFloatBE(value, 0);
    return data;
  }

  private uint32Data(value: number): Buffer {
    const data = Buffer.alloc(4);
    data.writeUInt32BE(value, 0);
    return data;
  }

  private requireFiniteRange(value: number, minimum: number, maximum: number, message: string): void {
    if (!Number.isFinite(value) || value < minimum || value > maximum) throw new BadRequestException(message);
  }
}

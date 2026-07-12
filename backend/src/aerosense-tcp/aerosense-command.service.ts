import { BadRequestException, Injectable } from '@nestjs/common';
import { AeroSenseSessionService } from './aerosense-session.service';

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
}

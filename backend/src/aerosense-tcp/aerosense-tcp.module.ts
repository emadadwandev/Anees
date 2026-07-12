import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { AeroSenseSessionService } from './aerosense-session.service';
import { AeroSenseTcpServerService } from './aerosense-tcp-server.service';

@Module({
  imports: [DevicesModule],
  providers: [AeroSenseTcpServerService, AeroSenseSessionService],
  exports: [AeroSenseTcpServerService],
})
export class AeroSenseTcpModule {}

import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { AeroSenseEventService } from './aerosense-event.service';
import { AeroSenseSessionService } from './aerosense-session.service';
import { AeroSenseTcpServerService } from './aerosense-tcp-server.service';

@Module({
  imports: [DevicesModule],
  providers: [AeroSenseTcpServerService, AeroSenseSessionService, AeroSenseEventService],
  exports: [AeroSenseTcpServerService],
})
export class AeroSenseTcpModule {}

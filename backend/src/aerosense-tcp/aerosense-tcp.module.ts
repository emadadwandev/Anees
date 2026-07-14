import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DevicesModule } from '../devices/devices.module';
import { AeroSenseCommandController } from './aerosense-command.controller';
import { AeroSenseCommandService } from './aerosense-command.service';
import { AeroSenseEventService } from './aerosense-event.service';
import { AeroSenseSessionService } from './aerosense-session.service';
import { AeroSenseTcpServerService } from './aerosense-tcp-server.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'fall-alert' }), DevicesModule],
  providers: [AeroSenseTcpServerService, AeroSenseSessionService, AeroSenseEventService, AeroSenseCommandService],
  controllers: [AeroSenseCommandController],
  exports: [AeroSenseTcpServerService, AeroSenseCommandService],
})
export class AeroSenseTcpModule {}

import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { DeviceHealthService } from './device-health.service';

@Module({
  providers: [DevicesService, DeviceHealthService],
  controllers: [DevicesController],
  exports: [DevicesService],
})
export class DevicesModule {}

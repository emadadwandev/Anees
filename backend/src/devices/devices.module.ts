import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { DeviceHealthService } from './device-health.service';
import { DeviceLifecycleService } from './device-lifecycle.service';

@Module({
  providers: [DevicesService, DeviceHealthService, DeviceLifecycleService],
  controllers: [DevicesController],
  exports: [DevicesService, DeviceLifecycleService],
})
export class DevicesModule {}

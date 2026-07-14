import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { DeviceHealthService } from './device-health.service';
import { DeviceLifecycleService } from './device-lifecycle.service';
import { DeviceIngressPolicyService } from './device-ingress-policy.service';

@Module({
  providers: [DevicesService, DeviceHealthService, DeviceLifecycleService, DeviceIngressPolicyService],
  controllers: [DevicesController],
  exports: [DevicesService, DeviceLifecycleService, DeviceIngressPolicyService],
})
export class DevicesModule {}

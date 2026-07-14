import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { MetricsModule } from '../metrics/metrics.module';
import { MqttConsumerModule } from '../mqtt/mqtt-consumer.module';
import { AeroSenseTcpModule } from '../aerosense-tcp/aerosense-tcp.module';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';

@Module({
  imports: [DevicesModule, MetricsModule, MqttConsumerModule, AeroSenseTcpModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
})
export class SuperAdminModule {}

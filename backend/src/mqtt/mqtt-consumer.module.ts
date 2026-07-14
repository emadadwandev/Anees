import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MqttConsumerService } from './mqtt-consumer.service';
import { HardwareDeviceService } from './hardware-device.service';
import { RadarCommandService } from './radar-command.service';
import { DevicesModule } from '../devices/devices.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'dlq' }),
    BullModule.registerQueue({ name: 'fall-alert' }),
    DevicesModule,
    MetricsModule,
  ],
  providers: [MqttConsumerService, HardwareDeviceService, RadarCommandService],
  exports: [RadarCommandService, MqttConsumerService, HardwareDeviceService],
})
export class MqttConsumerModule {}

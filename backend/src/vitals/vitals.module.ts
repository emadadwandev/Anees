import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { VitalsService } from './vitals.service';
import { VitalStorageWorker } from './vital-storage.worker';
import { AnomalyDetectionProcessor } from './anomaly-detection.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'anomaly-detection' },
      { name: 'push-notifications' },
    ),
  ],
  providers: [VitalsService, VitalStorageWorker, AnomalyDetectionProcessor],
  exports: [VitalsService],
})
export class VitalsModule {}

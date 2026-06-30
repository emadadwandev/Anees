import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { AlertsProcessor } from './alerts.processor';
import { AlertOrchestrationService } from './alert-orchestration.service';
import { IntercomModule } from '../intercom/intercom.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'fall-alert' },
      { name: 'push-notifications' },
    ),
    IntercomModule,
  ],
  providers: [AlertsService, AlertsProcessor, AlertOrchestrationService],
  controllers: [AlertsController],
  exports: [AlertsService],
})
export class AlertsModule {}

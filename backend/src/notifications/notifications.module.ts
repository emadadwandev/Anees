import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService, NotificationsProcessor } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [BullModule.registerQueue({ name: 'push-notifications' })],
  providers: [NotificationsService, NotificationsProcessor],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}

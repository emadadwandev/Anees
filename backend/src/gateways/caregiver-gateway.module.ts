import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { CaregiverGateway } from './caregiver.gateway';

@Module({
  imports: [
    JwtModule.register({}),
    BullModule.registerQueue({ name: 'fall-alert' }),
  ],
  providers: [CaregiverGateway],
})
export class CaregiverGatewayModule {}

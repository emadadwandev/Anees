import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { VitalsGateway } from './vitals.gateway';

@Module({
  imports: [JwtModule.register({})],
  providers: [VitalsGateway],
})
export class VitalsGatewayModule {}

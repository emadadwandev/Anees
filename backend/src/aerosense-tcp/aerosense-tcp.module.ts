import { Module } from '@nestjs/common';
import { AeroSenseTcpServerService } from './aerosense-tcp-server.service';

@Module({
  providers: [AeroSenseTcpServerService],
  exports: [AeroSenseTcpServerService],
})
export class AeroSenseTcpModule {}

import { Module } from '@nestjs/common';
import { IntercomService } from './intercom.service';
import { IntercomController } from './intercom.controller';

@Module({
  providers: [IntercomService],
  controllers: [IntercomController],
  exports: [IntercomService],
})
export class IntercomModule {}

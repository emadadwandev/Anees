import { Module } from '@nestjs/common';
import { SleepService } from './sleep.service';

@Module({
  providers: [SleepService],
  exports: [SleepService],
})
export class SleepModule {}

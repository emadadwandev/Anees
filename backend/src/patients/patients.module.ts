import { Module } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';
import { ReportsController } from './reports.controller';

@Module({
  providers: [PatientsService],
  controllers: [PatientsController, ReportsController],
  exports: [PatientsService],
})
export class PatientsModule {}

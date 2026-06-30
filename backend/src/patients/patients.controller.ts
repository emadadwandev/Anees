import { Controller, Get, Param, Query, UseGuards, ParseIntPipe, Optional } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  getRoster(@CurrentUser() user: { id: string }) {
    return this.patientsService.getRoster(user.id);
  }

  @Get(':id')
  getById(@Param('id') patientId: string, @CurrentUser() user: { id: string }) {
    return this.patientsService.getById(patientId, user.id);
  }

  @Get(':id/vitals/live')
  getLiveVitals(@Param('id') patientId: string) {
    return this.patientsService.getLiveVitals(patientId);
  }

  @Get(':id/vitals/history')
  getVitalHistory(
    @Param('id') patientId: string,
    @Query('range') range: string = '24h',
  ) {
    return this.patientsService.getVitalHistory(patientId, range);
  }

  @Get(':id/sleep/report')
  getSleepReport(
    @Param('id') patientId: string,
    @Query('date') date?: string,
    @Query('last') last?: string,
  ) {
    if (last) {
      return this.patientsService.getSleepReport(patientId, '', parseInt(last, 10));
    }
    const d = date ?? new Date().toISOString().split('T')[0];
    return this.patientsService.getSleepReport(patientId, d);
  }

  @Get(':id/alerts')
  getAlertHistory(
    @Param('id') patientId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.patientsService.getAlertHistory(patientId, +page, +limit);
  }

  @Get(':id/device')
  getDevice(@Param('id') patientId: string, @CurrentUser() user: { id: string }) {
    return this.patientsService.getById(patientId, user.id).then((p: any) => p?.devices?.[0]);
  }
}

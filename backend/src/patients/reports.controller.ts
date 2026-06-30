import { Controller, Get, NotFoundException, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('caregiver', 'admin')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly patientsService: PatientsService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Get('vitals/export')
  async exportVitals(
    @Query('patientId') patientId: string,
    @Query('range') range: string = '24h',
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ) {
    await this.patientsService.getById(patientId, user.id);

    const rows = await this.patientsService.getVitalHistory(patientId, range, '1 minute');

    const header = 'bucket,heart_rate_bpm,resp_rate_brpm,signal_quality\n';
    const body = (rows as any[])
      .map(
        (r) =>
          `${r.bucket},${r.heart_rate_bpm ?? ''},${r.resp_rate_brpm ?? ''},${r.signal_quality ?? ''}`,
      )
      .join('\n');

    const filename = `vitals_${patientId}_${range}_${new Date().toISOString().split('T')[0]}.csv`;

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(header + body);
  }

  // Hardware sleep report — generated nightly by ST-BD60S1-WT sensor
  @Get('patients/:id/sleep/hardware')
  async getHardwareSleepReport(
    @Param('id') patientId: string,
    @Query('date') date: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.patientsService.getById(patientId, user.id);

    const reportDate = date ?? new Date().toISOString().split('T')[0];
    const cached = await this.redis.get(`sleep:hw_report:${patientId}:${reportDate}`);
    if (!cached) throw new NotFoundException(`No hardware sleep report for ${reportDate}`);
    return JSON.parse(cached);
  }
}

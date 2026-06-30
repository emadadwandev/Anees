import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('caregiver', 'admin')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('history')
  findHistory(
    @CurrentUser() user: { id: string },
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.alertsService.findHistoryForCaregiver(user.id, +page, +limit);
  }

  @Get(':id')
  findById(@Param('id') alertId: string) {
    return this.alertsService.findById(alertId);
  }

  @Post(':id/acknowledge')
  acknowledge(@Param('id') alertId: string, @CurrentUser() user: { id: string }) {
    return this.alertsService.acknowledge(alertId, user.id);
  }

  @Post(':id/resolve')
  resolve(
    @Param('id') alertId: string,
    @CurrentUser() user: { id: string },
    @Body() body: { notes?: string },
  ) {
    return this.alertsService.resolve(alertId, user.id, body.notes);
  }

  @Post(':id/false-alarm')
  falseAlarm(
    @Param('id') alertId: string,
    @CurrentUser() user: { id: string },
    @Body() body: { notes?: string },
  ) {
    return this.alertsService.markFalseAlarm(alertId, user.id, body.notes);
  }
}

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AeroSenseCommandService } from './aerosense-command.service';

@Controller('aerosense/devices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AeroSenseCommandController {
  constructor(
    private readonly commands: AeroSenseCommandService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':deviceId/wavve/report-interval')
  setWavveReportInterval(
    @Param('deviceId') deviceId: string,
    @Body() body: { ticks: number },
    @CurrentUser() user: { id: string },
  ) {
    return this.runCommand(user.id, deviceId, 'wavve.report_interval.set', { ticks: body.ticks }, () =>
      this.commands.setWavveReportInterval(deviceId, body.ticks),
    ).then(() => ({ ok: true as const }));
  }

  @Get(':deviceId/wavve/report-interval')
  getWavveReportInterval(@Param('deviceId') deviceId: string, @CurrentUser() user: { id: string }) {
    return this.runCommand(user.id, deviceId, 'wavve.report_interval.get', {}, () =>
      this.commands.getWavveReportInterval(deviceId),
    ).then((value) => ({ value }));
  }

  @Post(':deviceId/wavve/bed-exit-timer')
  setWavveBedExitTimer(
    @Param('deviceId') deviceId: string,
    @Body() body: { seconds: number },
    @CurrentUser() user: { id: string },
  ) {
    return this.runCommand(user.id, deviceId, 'wavve.bed_exit_timer.set', { seconds: body.seconds }, () =>
      this.commands.setWavveBedExitTimer(deviceId, body.seconds),
    ).then(() => ({ ok: true as const }));
  }

  @Get(':deviceId/wavve/bed-exit-timer')
  getWavveBedExitTimer(@Param('deviceId') deviceId: string, @CurrentUser() user: { id: string }) {
    return this.runCommand(user.id, deviceId, 'wavve.bed_exit_timer.get', {}, () =>
      this.commands.getWavveBedExitTimer(deviceId),
    ).then((value) => ({ value }));
  }

  @Post(':deviceId/assure/fall-buffer-time')
  setAssureFallBufferTime(
    @Param('deviceId') deviceId: string,
    @Body() body: { seconds: number },
    @CurrentUser() user: { id: string },
  ) {
    return this.runCommand(user.id, deviceId, 'assure.fall_buffer_time.set', { seconds: body.seconds }, () =>
      this.commands.setAssureFallBufferTime(deviceId, body.seconds),
    ).then(() => ({ ok: true as const }));
  }

  @Get(':deviceId/assure/fall-buffer-time')
  getAssureFallBufferTime(@Param('deviceId') deviceId: string, @CurrentUser() user: { id: string }) {
    return this.runCommand(user.id, deviceId, 'assure.fall_buffer_time.get', {}, () =>
      this.commands.getAssureFallBufferTime(deviceId),
    ).then((value) => ({ value }));
  }

  @Post(':deviceId/assure/installation-height')
  setAssureInstallationHeight(
    @Param('deviceId') deviceId: string,
    @Body() body: { meters: number },
    @CurrentUser() user: { id: string },
  ) {
    return this.runCommand(user.id, deviceId, 'assure.installation_height.set', { meters: body.meters }, () =>
      this.commands.setAssureInstallationHeight(deviceId, body.meters),
    ).then(() => ({ ok: true as const }));
  }

  @Get(':deviceId/assure/installation-height')
  getAssureInstallationHeight(@Param('deviceId') deviceId: string, @CurrentUser() user: { id: string }) {
    return this.runCommand(user.id, deviceId, 'assure.installation_height.get', {}, () =>
      this.commands.getAssureInstallationHeight(deviceId),
    ).then((value) => ({ value }));
  }

  @Post(':deviceId/assure/working-range')
  setAssureWorkingRange(
    @Param('deviceId') deviceId: string,
    @Body() body: { meters: number },
    @CurrentUser() user: { id: string },
  ) {
    return this.runCommand(user.id, deviceId, 'assure.working_range.set', { meters: body.meters }, () =>
      this.commands.setAssureWorkingRange(deviceId, body.meters),
    ).then(() => ({ ok: true as const }));
  }

  @Get(':deviceId/assure/working-range')
  getAssureWorkingRange(@Param('deviceId') deviceId: string, @CurrentUser() user: { id: string }) {
    return this.runCommand(user.id, deviceId, 'assure.working_range.get', {}, () =>
      this.commands.getAssureWorkingRange(deviceId),
    ).then((value) => ({ value }));
  }

  @Post(':deviceId/assure/fall-mode')
  setAssureFallMode(
    @Param('deviceId') deviceId: string,
    @Body() body: { mode: 'high_sensitivity' | 'low_false_alert' },
    @CurrentUser() user: { id: string },
  ) {
    return this.runCommand(user.id, deviceId, 'assure.fall_mode.set', { mode: body.mode }, () =>
      this.commands.setAssureFallMode(deviceId, body.mode),
    ).then(() => ({ ok: true as const }));
  }

  @Get(':deviceId/assure/fall-mode')
  getAssureFallMode(@Param('deviceId') deviceId: string, @CurrentUser() user: { id: string }) {
    return this.runCommand(user.id, deviceId, 'assure.fall_mode.get', {}, () =>
      this.commands.getAssureFallMode(deviceId),
    ).then((value) => ({ value }));
  }

  private async runCommand<T>(
    actorId: string,
    deviceId: string,
    commandName: string,
    requestedValues: Record<string, number | string>,
    execute: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    let responseStatus: 'succeeded' | 'failed' = 'succeeded';
    let errorName: string | undefined;

    try {
      return await execute();
    } catch (error) {
      responseStatus = 'failed';
      errorName = error instanceof Error ? error.name : 'UnknownError';
      throw error;
    } finally {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: `aerosense.command.${commandName}`,
          resourceType: 'aerosense_device',
          resourceId: deviceId,
          details: {
            requestedValues,
            responseStatus,
            elapsedMs: Date.now() - startedAt,
            ...(errorName && { errorName }),
          },
        },
      });
    }
  }
}

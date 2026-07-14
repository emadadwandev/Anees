import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateDeviceDto } from './dto/create-device.dto';
import { DeviceCommandDto } from './dto/device-command.dto';
import { DeviceFilterDto } from './dto/device-filter.dto';
import { DeviceReasonDto, DeviceStateDto } from './dto/device-state.dto';
import { SuperAdminService } from './super-admin.service';

@Controller('super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuperAdminController {
  constructor(private readonly service: SuperAdminService) {}

  @Roles(Role.super_admin)
  @Get('devices')
  list(@Query() filter: DeviceFilterDto) {
    return this.service.listDevices(filter);
  }

  @Roles(Role.super_admin)
  @Get('devices/summary')
  summary() {
    return this.service.getFleetSummary();
  }

  @Roles(Role.super_admin)
  @Post('devices')
  create(@Body() dto: CreateDeviceDto, @CurrentUser() user: { id: string }) {
    return this.service.createDevice(dto, user.id);
  }

  @Roles(Role.super_admin)
  @Get('devices/:id')
  get(@Param('id') id: string) {
    return this.service.getDevice(id);
  }

  @Roles(Role.super_admin)
  @Post('devices/:id/state')
  transition(
    @Param('id') id: string,
    @Body() dto: DeviceStateDto,
    @CurrentUser() user: { id: string },
  ) {
    this.requireReason(dto.reason);
    return this.service.transition(id, dto.state, dto.reason, user.id);
  }

  @Roles(Role.super_admin)
  @Post('devices/:id/restore')
  restore(
    @Param('id') id: string,
    @Body() dto: DeviceReasonDto,
    @CurrentUser() user: { id: string },
  ) {
    this.requireReason(dto.reason);
    return this.service.restore(id, dto.reason, user.id);
  }

  @Roles(Role.super_admin)
  @Post('devices/:id/deprovision')
  deprovision(
    @Param('id') id: string,
    @Body() dto: DeviceReasonDto,
    @CurrentUser() user: { id: string },
  ) {
    this.requireReason(dto.reason);
    return this.service.deprovision(id, dto.reason, user.id);
  }

  @Roles(Role.super_admin)
  @Get('devices/:id/audit')
  deviceAudit(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.service.getDeviceAudit(id, limit ? Number(limit) : undefined);
  }

  @Roles(Role.super_admin)
  @Get('audit')
  globalAudit(@Query() filter: { cursor?: string; limit?: string; action?: string; deviceId?: string }) {
    return this.service.getGlobalAudit({
      cursor: filter.cursor,
      limit: filter.limit ? Number(filter.limit) : undefined,
      action: filter.action,
      deviceId: filter.deviceId,
    });
  }

  @Roles(Role.super_admin)
  @Get('system/health')
  systemHealth() {
    return this.service.getSystemHealth();
  }

  @Roles(Role.super_admin)
  @Post('devices/:id/aerosense/commands')
  command(
    @Param('id') id: string,
    @Body() dto: DeviceCommandDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.executeCommand(id, dto.command, dto.values, user.id);
  }

  private requireReason(reason: string) {
    if (!reason?.trim()) throw new BadRequestException('A lifecycle transition reason is required');
  }
}

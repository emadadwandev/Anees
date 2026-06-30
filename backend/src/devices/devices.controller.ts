import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Roles('caregiver', 'admin')
  @Get()
  getFleet() {
    return this.devicesService.getFleet();
  }

  @Roles('caregiver', 'admin')
  @Get(':id')
  getStatus(@Param('id') id: string) {
    return this.devicesService.getStatus(id);
  }

  @Roles('caregiver', 'admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { roomLabel?: string }) {
    if (body.roomLabel) return this.devicesService.updateRoomLabel(id, body.roomLabel);
  }

  @Roles('admin')
  @Post('/admin/devices')
  register(
    @Body() body: { serial: string; userId: string; roomLabel: string; firmwareVersion: string },
  ) {
    return this.devicesService.register(body.serial, body.userId, body.roomLabel, body.firmwareVersion);
  }
}

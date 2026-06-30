import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { CaregiverService } from './caregiver.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.caregiver)
@Controller('caregiver')
export class CaregiverController {
  constructor(private readonly caregiverService: CaregiverService) {}

  @Get('patient')
  getLinkedPatient(@CurrentUser() user: { id: string }) {
    return this.caregiverService.getLinkedPatient(user.id);
  }

  @Post('patients')
  createPatient(
    @CurrentUser() user: { id: string },
    @Body()
    dto: {
      firstName: string;
      lastName: string;
      phone?: string;
      language?: string;
    },
  ) {
    return this.caregiverService.createPatient(user.id, dto);
  }

  @Patch('patient')
  updatePatient(
    @CurrentUser() user: { id: string },
    @Body() dto: { firstName?: string; lastName?: string; phone?: string; language?: string },
  ) {
    return this.caregiverService.updatePatient(user.id, dto);
  }

  @Patch('patient/pin')
  updatePatientPin(
    @CurrentUser() user: { id: string },
    @Body() dto: { pin: string },
  ) {
    return this.caregiverService.updatePatientPin(user.id, dto.pin);
  }

  @Post('devices')
  registerDevice(
    @CurrentUser() user: { id: string },
    @Body()
    dto: {
      serial: string;
      firmwareVersion: string;
      roomLabel: string;
      deviceType: string;
      patientId: string;
    },
  ) {
    return this.caregiverService.registerDevice(user.id, dto);
  }
}

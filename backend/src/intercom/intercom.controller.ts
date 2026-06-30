import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IntercomService } from './intercom.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('caregiver', 'admin')
@Controller('intercom')
export class IntercomController {
  constructor(private readonly intercomService: IntercomService) {}

  @Post('token')
  requestToken(
    @CurrentUser() user: { id: string },
    @Body() body: { patientId: string },
  ) {
    return this.intercomService.requestToken(user.id, body.patientId);
  }

  @Post('sessions')
  endSession(
    @CurrentUser() user: { id: string },
    @Body() body: { livekitRoomToken: string; durationSeconds: number },
  ) {
    return this.intercomService.endSession(body.livekitRoomToken, body.durationSeconds, user.id);
  }
}

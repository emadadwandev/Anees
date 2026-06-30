import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Platform } from '@prisma/client';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('token')
  registerToken(@Body() body: { token: string; platform: Platform }, @Request() req: any) {
    return this.notificationsService.saveToken(req.user.sub, body.token, body.platform);
  }
}

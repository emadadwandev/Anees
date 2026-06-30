import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { LinksService } from './links.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RelationshipType } from '@prisma/client';

@Controller('links')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post('invite')
  @Roles('caregiver', 'admin')
  generateInvite(@Request() req: any) {
    return this.linksService.generateInvite(req.user.sub);
  }

  @Post('accept')
  @Roles('care_receiver', 'admin')
  acceptInvite(@Body() body: { code: string }, @Request() req: any) {
    return this.linksService.acceptInvite(body.code, req.user.sub);
  }

  @Get('patients')
  @Roles('caregiver', 'admin')
  getPatients(@Request() req: any) {
    return this.linksService.getPatients(req.user.sub);
  }

  @Patch(':id')
  @Roles('caregiver', 'admin')
  updateLink(
    @Param('id') id: string,
    @Body() body: { relationshipType: RelationshipType },
    @Request() req: any,
  ) {
    return this.linksService.updateLink(id, req.user.sub, body.relationshipType);
  }

  @Delete(':id')
  @Roles('caregiver', 'admin')
  removeLink(@Param('id') id: string, @Request() req: any) {
    return this.linksService.removeLink(id, req.user.sub);
  }

  @Post('admin/direct')
  @Roles('admin')
  createDirect(@Body() body: { caregiverId: string; patientId: string; isPrimary?: boolean }) {
    return this.linksService.createDirectLink(body.caregiverId, body.patientId, body.isPrimary ?? false);
  }
}

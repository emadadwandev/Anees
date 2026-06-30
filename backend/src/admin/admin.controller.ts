import {
  Controller,
  Get,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
  ) {}

  // P9-003: Immutable audit log — admin read-only, no delete/update endpoints
  @Get('audit-log')
  async getAuditLog(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('actorId') actorId?: string,
    @Query('resourceType') resourceType?: string,
    @Query('action') action?: string,
    @Query('since') since?: string,
    @Query('until') until?: string,
  ) {
    const skip = (page - 1) * Math.min(limit, 200);
    const take = Math.min(limit, 200);

    const where = {
      ...(actorId && { actorId }),
      ...(resourceType && { resourceType }),
      ...(action && { action }),
      ...(since || until
        ? {
            timestamp: {
              ...(since && { gte: new Date(since) }),
              ...(until && { lte: new Date(until) }),
            },
          }
        : {}),
    };

    const [total, entries] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take,
        include: { actor: { select: { id: true, email: true, role: true } } },
      }),
    ]);

    return {
      data: entries,
      meta: { total, page, limit: take, pages: Math.ceil(total / take) },
    };
  }

  @Get('users')
  async getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const skip = (page - 1) * Math.min(limit, 100);
    const take = Math.min(limit, 100);

    const [total, users] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          _count: { select: { devices: true, caregiverLinks: true } },
        },
      }),
    ]);

    return { data: users, meta: { total, page, limit: take } };
  }

  @Get('system-events')
  async getSystemEvents(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('type') type?: string,
    @Query('deviceId') deviceId?: string,
  ) {
    const skip = (page - 1) * Math.min(limit, 200);
    const take = Math.min(limit, 200);

    const where = {
      ...(type && { type }),
      ...(deviceId && { deviceId }),
    };

    const [total, events] = await Promise.all([
      this.prisma.systemEvent.count({ where }),
      this.prisma.systemEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { device: { select: { id: true, serial: true, roomLabel: true } } },
      }),
    ]);

    return { data: events, meta: { total, page, limit: take } };
  }

  // ── Dashboard endpoints ───────────────────────────────────────────────────

  @Get('stats')
  getFacilityStats() {
    return this.adminService.getFacilityStats();
  }

  @Get('patients')
  getAllPatients() {
    return this.adminService.getAllPatients();
  }

  @Get('alerts/active')
  getActiveAlerts() {
    return this.adminService.getActiveAlerts();
  }

  @Get('alerts/history')
  getAlertHistory(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getAlertHistory(limit);
  }

  @Get('analytics')
  getAnalytics() {
    return this.adminService.getAnalytics();
  }
}

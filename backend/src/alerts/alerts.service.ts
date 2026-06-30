import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertStatus } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('push-notifications') private pushQueue: Queue,
  ) {}

  async findById(alertId: string) {
    const alert = await this.prisma.alertEvent.findUnique({
      where: { id: alertId },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        device:  { select: { roomLabel: true, serial: true, firmwareVersion: true } },
      },
    });
    if (!alert) throw new NotFoundException('Alert not found');

    const timeline = [
      { time: alert.triggeredAt.toISOString(), event: 'Fall vector detected' },
      ...(alert.status !== 'pending_cancellation'
        ? [{ time: null as string | null, event: 'Grace period expired' }]
        : []),
      ...(
        ['dispatched', 'acknowledged', 'resolved', 'false_alarm'].includes(alert.status)
          ? [{ time: null as string | null, event: 'Alert dispatched' }]
          : []
      ),
      ...(
        alert.status === 'acknowledged'
          ? [{ time: null as string | null, event: 'You acknowledged' }]
          : []
      ),
      ...(
        alert.status === 'cancelled_by_user'
          ? [{ time: null as string | null, event: 'Cancelled by patient voice' }]
          : []
      ),
    ];

    return {
      id: alert.id,
      type: alert.type,
      status: alert.status,
      triggeredAt: alert.triggeredAt.toISOString(),
      resolvedAt: alert.resolvedAt?.toISOString() ?? null,
      patientId: alert.patientId,
      patientName: alert.patient
        ? `${alert.patient.firstName} ${alert.patient.lastName}`
        : 'Unknown',
      room: alert.device?.roomLabel ?? '',
      timeline,
    };
  }

  async acknowledge(alertId: string, caregiverId: string) {
    const alert = await this.prisma.alertEvent.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('Alert not found');
    const updated = await this.prisma.alertEvent.update({
      where: { id: alertId },
      data: { status: AlertStatus.acknowledged },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: caregiverId,
        action: 'alert.acknowledged',
        resourceType: 'alert_event',
        resourceId: alertId,
      },
    });
    return updated;
  }

  async resolve(alertId: string, caregiverId: string, notes?: string) {
    const alert = await this.prisma.alertEvent.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('Alert not found');
    const updated = await this.prisma.alertEvent.update({
      where: { id: alertId },
      data: { status: AlertStatus.resolved, resolvedAt: new Date(), notes },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: caregiverId,
        action: 'alert.resolved',
        resourceType: 'alert_event',
        resourceId: alertId,
      },
    });
    return updated;
  }

  async findHistoryForCaregiver(caregiverId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.alertEvent.findMany({
        where: {
          patient: {
            caregiverLinks: { some: { caregiverId } },
          },
          status: { in: ['resolved', 'false_alarm', 'cancelled_by_user'] },
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          device:  { select: { roomLabel: true } },
        },
        orderBy: { triggeredAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.alertEvent.count({
        where: {
          patient: {
            caregiverLinks: { some: { caregiverId } },
          },
          status: { in: ['resolved', 'false_alarm', 'cancelled_by_user'] },
        },
      }),
    ]);

    return {
      data: data.map((a) => ({
        id: a.id,
        type: a.type,
        status: a.status,
        triggeredAt: a.triggeredAt.toISOString(),
        resolvedAt: a.resolvedAt?.toISOString() ?? null,
        patientId: a.patientId,
        patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : 'Unknown',
        room: a.device?.roomLabel ?? '',
      })),
      total,
      page,
      limit,
    };
  }

  async markFalseAlarm(alertId: string, caregiverId: string, notes?: string) {
    const alert = await this.prisma.alertEvent.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('Alert not found');
    const updated = await this.prisma.alertEvent.update({
      where: { id: alertId },
      data: { status: AlertStatus.false_alarm, resolvedAt: new Date(), notes },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: caregiverId,
        action: 'alert.false_alarm',
        resourceType: 'alert_event',
        resourceId: alertId,
      },
    });
    return updated;
  }
}

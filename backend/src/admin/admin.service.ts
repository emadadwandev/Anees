import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getFacilityStats() {
    const [totalPatients, devices, activeAlerts, warnings] = await Promise.all([
      this.prisma.user.count({ where: { role: 'care_receiver' } }),
      this.prisma.device.findMany({
        where: { user: { role: 'care_receiver' } },
        select: { status: true, signalQuality: true },
      }),
      this.prisma.alertEvent.count({
        where: { status: { in: ['dispatched', 'acknowledged', 'pending_cancellation'] } },
      }),
      this.prisma.alertEvent.count({
        where: {
          status: { in: ['dispatched', 'acknowledged', 'pending_cancellation'] },
          type: 'vital_anomaly',
        },
      }),
    ]);

    const onlineDevices = devices.filter((d) => d.status === 'online').length;
    const offlineDevices = devices.filter((d) => d.status !== 'online').length;
    const onlineSignals = devices
      .filter((d) => d.status === 'online' && d.signalQuality !== null)
      .map((d) => d.signalQuality as number);
    const avgSignalQuality =
      onlineSignals.length > 0
        ? Math.round(
            (onlineSignals.reduce((a, b) => a + b, 0) / onlineSignals.length) * 100,
          )
        : 0;

    return {
      totalPatients,
      onlineDevices,
      offlineDevices,
      activeAlerts,
      warnings,
      avgSignalQuality,
    };
  }

  async getAllPatients() {
    const patients = await this.prisma.user.findMany({
      where: { role: 'care_receiver' },
      include: {
        devices: {
          select: {
            id: true,
            serial: true,
            firmwareVersion: true,
            roomLabel: true,
            status: true,
            signalQuality: true,
            lastHeartbeat: true,
            occlusionStatus: true,
          },
          take: 1,
        },
        alertEvents: {
          where: { status: { in: ['dispatched', 'acknowledged', 'pending_cancellation'] } },
          orderBy: { triggeredAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const liveVitals = await Promise.all(
      patients.map((p) =>
        this.redis.get(`vitals:live:${p.id}`).then((raw) => (raw ? JSON.parse(raw) : null)),
      ),
    );

    return patients.map((p, i) => {
      const live = liveVitals[i];
      const device = p.devices[0] ?? null;
      const activeAlert = p.alertEvents[0] ?? null;

      let alertStatus: 'fall_active' | 'vital_anomaly' | 'system_offline' | 'ok' = 'ok';
      if (device?.status === 'offline') alertStatus = 'system_offline';
      else if (activeAlert?.type === 'fall') alertStatus = 'fall_active';
      else if (activeAlert?.type === 'vital_anomaly') alertStatus = 'vital_anomaly';

      return {
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        age: (p as any).dateOfBirth
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Math.floor((Date.now() - new Date((p as any).dateOfBirth).getTime()) / 3.156e10)
          : null,
        roomLabel: device?.roomLabel ?? 'Unassigned',
        deviceStatus: device?.status ?? 'offline',
        alertStatus,
        occlusionStatus: device?.occlusionStatus ?? 'none',
        signalQuality: device?.signalQuality ?? null,
        lastHeartbeat: device?.lastHeartbeat?.toISOString() ?? null,
        latestHr: live?.heart_rate_bpm ?? null,
        latestRr: live?.resp_rate_brpm ?? null,
        device: device
          ? { id: device.id, serial: device.serial, firmwareVersion: device.firmwareVersion }
          : null,
      };
    });
  }

  async getActiveAlerts() {
    const alerts = await this.prisma.alertEvent.findMany({
      where: { status: { in: ['dispatched', 'acknowledged', 'pending_cancellation'] } },
      orderBy: { triggeredAt: 'desc' },
      include: {
        patient: {
          include: { devices: { select: { roomLabel: true }, take: 1 } },
        },
      },
    });

    return alerts.map((a) => ({
      id: a.id,
      patientId: a.patientId,
      patientName: `${a.patient.firstName} ${a.patient.lastName}`,
      patientRoom: a.patient.devices[0]?.roomLabel ?? 'Unknown',
      type: a.type,
      status: a.status,
      triggeredAt: a.triggeredAt.toISOString(),
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
      notes: a.notes ?? null,
    }));
  }

  async getAlertHistory(limit = 50) {
    const alerts = await this.prisma.alertEvent.findMany({
      where: {
        status: { in: ['resolved', 'cancelled_by_user', 'false_alarm', 'acknowledged'] },
        resolvedAt: { not: null },
      },
      orderBy: { triggeredAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        patient: {
          include: { devices: { select: { roomLabel: true }, take: 1 } },
        },
      },
    });

    return alerts.map((a) => ({
      id: a.id,
      patientId: a.patientId,
      patientName: `${a.patient.firstName} ${a.patient.lastName}`,
      patientRoom: a.patient.devices[0]?.roomLabel ?? 'Unknown',
      type: a.type,
      status: a.status,
      triggeredAt: a.triggeredAt.toISOString(),
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
      notes: a.notes ?? null,
      // response time in seconds
      responseTimeSec:
        a.resolvedAt
          ? Math.round((a.resolvedAt.getTime() - a.triggeredAt.getTime()) / 1000)
          : null,
    }));
  }

  async getAnalytics() {
    const [alertsByDay, alertsByType, resolvedAlerts] = await Promise.all([
      // Last 7 days alert counts grouped by day
      this.prisma.$queryRaw<{ day: string; count: bigint }[]>`
        SELECT DATE_TRUNC('day', "triggeredAt") AS day, COUNT(*)::bigint AS count
        FROM "AlertEvent"
        WHERE "triggeredAt" >= NOW() - INTERVAL '7 days'
        GROUP BY day
        ORDER BY day ASC
      `,
      // Count by type (active + recent)
      this.prisma.alertEvent.groupBy({
        by: ['type'],
        _count: { _all: true },
        where: { triggeredAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      // Average response time from resolved alerts
      this.prisma.alertEvent.findMany({
        where: { status: 'resolved', resolvedAt: { not: null } },
        select: { triggeredAt: true, resolvedAt: true },
        take: 100,
        orderBy: { triggeredAt: 'desc' },
      }),
    ]);

    const avgResponseSec =
      resolvedAlerts.length > 0
        ? Math.round(
            resolvedAlerts.reduce(
              (sum, a) =>
                sum + (a.resolvedAt!.getTime() - a.triggeredAt.getTime()) / 1000,
              0,
            ) / resolvedAlerts.length,
          )
        : null;

    return {
      alertsByDay: alertsByDay.map((r) => ({
        day: r.day,
        count: Number(r.count),
      })),
      alertsByType: alertsByType.map((r) => ({
        type: r.type,
        count: r._count._all,
      })),
      avgResponseSec,
    };
  }
}

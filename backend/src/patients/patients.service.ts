import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getRoster(caregiverId: string) {
    const links = await this.prisma.caregiverLink.findMany({
      where: { caregiverId },
      include: {
        patient: {
          include: {
            devices: true,
            alertEvents: {
              where: { status: { in: ['dispatched', 'acknowledged', 'pending_cancellation'] } },
              orderBy: { triggeredAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    return Promise.all(
      links.map(async (l) => {
        const p = l.patient;
        const liveRaw = await this.redis.get(`vitals:live:${p.id}`);
        const live = liveRaw ? JSON.parse(liveRaw) : null;
        const activeAlert = p.alertEvents[0];

        return {
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
          age: 0,
          room: p.devices[0]?.roomLabel ?? '',
          hr: live?.heart_rate_bpm ?? null,
          rr: live?.resp_rate_brpm ?? null,
          sleepQuality: 'Unknown',
          alertStatus: activeAlert
            ? activeAlert.type === 'fall'
              ? 'fall_active'
              : 'anomaly_warning'
            : 'ok',
          alertId: activeAlert?.id ?? null,
          alertTriggeredAt: activeAlert?.triggeredAt.toISOString() ?? null,
          alertAcknowledged: activeAlert?.status === 'acknowledged',
        };
      }),
    );
  }

  async getById(patientId: string, caregiverId: string) {
    const link = await this.prisma.caregiverLink.findFirst({
      where: { caregiverId, patientId },
    });
    if (!link) throw new ForbiddenException('Not linked to this patient');
    const patient = await this.prisma.user.findUnique({
      where: { id: patientId },
      include: { devices: true, threshold: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async getLiveVitals(patientId: string) {
    const cached = await this.redis.get(`vitals:live:${patientId}`);
    if (cached) return JSON.parse(cached);
    return null;
  }

  async getVitalHistory(patientId: string, range: string) {
    const interval   = this.rangeToInterval(range);
    const resolution = this.rangeToResolution(range);
    const rows: any[] = await this.prisma.$queryRaw`
      SELECT
        time_bucket(${resolution}::interval, time) AS bucket,
        ROUND(AVG(heart_rate_bpm))::int            AS heart_rate_bpm,
        ROUND(AVG(resp_rate_brpm))::int            AS resp_rate_brpm,
        AVG(signal_quality)                        AS signal_quality
      FROM vital_readings
      WHERE patient_id = ${patientId}::uuid
        AND time >= NOW() - ${interval}::interval
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
    return rows;
  }

  async getSleepReport(patientId: string, date: string, lastN?: number) {
    // Multi-night summary for 30-day trend
    if (lastN) {
      const nights: any[] = await this.prisma.$queryRaw`
        SELECT
          date_trunc('day', time)::date::text                                    AS date,
          ROUND(100.0 * SUM(duration_sec) FILTER (WHERE stage = 'deep')
                / NULLIF(SUM(duration_sec), 0))::float                          AS "deepPct",
          ROUND(100.0 * SUM(duration_sec) FILTER (WHERE stage = 'light')
                / NULLIF(SUM(duration_sec), 0))::float                          AS "lightPct",
          ROUND(100.0 * SUM(duration_sec) FILTER (WHERE stage = 'rem')
                / NULLIF(SUM(duration_sec), 0))::float                          AS "remPct",
          ROUND(100.0 * SUM(duration_sec) FILTER (WHERE stage = 'awake')
                / NULLIF(SUM(duration_sec), 0))::float                          AS "awakePct",
          ROUND(SUM(duration_sec) / 60.0)::int                                  AS "totalSleepMin",
          -- Fragmentation: ratio of awake epochs to total epochs
          ROUND(COUNT(*) FILTER (WHERE stage = 'awake')::numeric
                / NULLIF(COUNT(*), 0), 2)::float                                AS "fragmentationIndex"
        FROM sleep_epochs
        WHERE patient_id = ${patientId}::uuid
          AND time >= NOW() - (${lastN} || ' days')::interval
        GROUP BY 1
        ORDER BY 1 ASC
      `;
      return nights;
    }

    // Single-night structured report
    const start = new Date(`${date}T00:00:00Z`);
    const end   = new Date(`${date}T23:59:59Z`);
    const rawEpochs: any[] = await this.prisma.$queryRaw`
      SELECT time, stage, duration_sec
      FROM sleep_epochs
      WHERE patient_id = ${patientId}::uuid
        AND time BETWEEN ${start} AND ${end}
      ORDER BY time ASC
    `;

    const epochs = rawEpochs.map((e: any) => ({
      time:  new Date(e.time).toISOString().slice(11, 16), // "HH:mm"
      stage: e.stage,
    }));

    const totalSec = rawEpochs.reduce((s: number, e: any) => s + Number(e.duration_sec), 0);
    const stageSec = (stage: string) =>
      rawEpochs
        .filter((e: any) => e.stage === stage)
        .reduce((s: number, e: any) => s + Number(e.duration_sec), 0);

    const awakeSec = stageSec('awake');
    const fragmentationIndex = rawEpochs.length > 0
      ? Math.round((rawEpochs.filter((e: any) => e.stage === 'awake').length / rawEpochs.length) * 100) / 100
      : 0;

    return {
      date,
      epochs,
      totalSleepMin:  Math.round(totalSec / 60),
      deepPct:        totalSec > 0 ? Math.round((stageSec('deep')  / totalSec) * 100) : 0,
      lightPct:       totalSec > 0 ? Math.round((stageSec('light') / totalSec) * 100) : 0,
      remPct:         totalSec > 0 ? Math.round((stageSec('rem')   / totalSec) * 100) : 0,
      awakePct:       totalSec > 0 ? Math.round((awakeSec          / totalSec) * 100) : 0,
      fragmentationIndex,
    };
  }

  async getAlertHistory(patientId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.alertEvent.findMany({
        where: { patientId },
        orderBy: { triggeredAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.alertEvent.count({ where: { patientId } }),
    ]);
    return { data, total, page, limit };
  }

  private rangeToInterval(range: string): string {
    const map: Record<string, string> = {
      '6h':  '6 hours',
      '24h': '24 hours',
      '7d':  '7 days',
      '30d': '30 days',
    };
    return map[range.toLowerCase()] ?? '24 hours';
  }

  private rangeToResolution(range: string): string {
    const map: Record<string, string> = {
      '6h':  '5 minutes',
      '24h': '15 minutes',
      '7d':  '1 hour',
      '30d': '4 hours',
    };
    return map[range.toLowerCase()] ?? '15 minutes';
  }
}

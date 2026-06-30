import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

interface SleepEpoch {
  device_id: string;
  patient_id: string;
  timestamp: number;
  stage: 'deep' | 'light' | 'rem' | 'awake';
  duration_sec: number;
}

@Injectable()
export class SleepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SleepService.name);
  private subscriber: Redis;

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  onModuleInit() {
    this.subscriber = this.redis.duplicate();
    this.subscriber.psubscribe('sleep:*', (err) => {
      if (err) this.logger.error('Failed to subscribe to sleep channels', err);
      else this.logger.log('Subscribed to sleep:* channel');
    });
    this.subscriber.on('pmessage', async (_pattern, _channel, message) => {
      try {
        const epoch: SleepEpoch = JSON.parse(message);
        await this.storeEpoch(epoch);
      } catch (e) {
        this.logger.warn('Failed to process sleep epoch', e);
      }
    });
  }

  async onModuleDestroy() {
    await this.subscriber.quit();
  }

  private async storeEpoch(epoch: SleepEpoch) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO sleep_epochs (time, device_id, patient_id, stage, duration_sec)
       VALUES (to_timestamp($1 / 1000.0), $2::uuid, $3::uuid, $4, $5)`,
      epoch.timestamp,
      epoch.device_id,
      epoch.patient_id,
      epoch.stage,
      epoch.duration_sec,
    );
  }

  async getReport(patientId: string, date: string) {
    const cacheKey = `sleep:report:${patientId}:${date}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const start = new Date(`${date}T00:00:00Z`);
    const end = new Date(`${date}T23:59:59Z`);

    const epochs: any[] = await this.prisma.$queryRaw`
      SELECT time, stage, duration_sec
      FROM sleep_epochs
      WHERE patient_id = ${patientId}::uuid
        AND time BETWEEN ${start} AND ${end}
      ORDER BY time ASC
    `;

    if (epochs.length === 0) return null;

    const totalSec = epochs.reduce((sum: number, e: any) => sum + Number(e.duration_sec), 0);
    const stageTotals = epochs.reduce((acc: Record<string, number>, e: any) => {
      acc[e.stage] = (acc[e.stage] ?? 0) + Number(e.duration_sec);
      return acc;
    }, {});
    const fragmentationIndex = this.computeFragmentation(epochs.map((e: any) => e.stage));

    return {
      date,
      epochs,
      totalSleepMin: Math.round(totalSec / 60),
      deepPct: Math.round(((stageTotals['deep'] ?? 0) / totalSec) * 100),
      lightPct: Math.round(((stageTotals['light'] ?? 0) / totalSec) * 100),
      remPct: Math.round(((stageTotals['rem'] ?? 0) / totalSec) * 100),
      awakePct: Math.round(((stageTotals['awake'] ?? 0) / totalSec) * 100),
      fragmentationIndex,
      qualityLabel: this.qualityLabel(fragmentationIndex, stageTotals, totalSec),
    };
  }

  async getLast7(patientId: string) {
    const results = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().split('T')[0];
      results.push({ date, report: await this.getReport(patientId, date) });
    }
    return results;
  }

  @Cron('0 0 * * *')
  async nightlyAggregation() {
    this.logger.log('Running nightly sleep aggregation');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = yesterday.toISOString().split('T')[0];

    const patients = await this.prisma.user.findMany({ where: { role: 'care_receiver' } });
    for (const patient of patients) {
      try {
        // Bypass cache to recompute from raw epochs
        const start = new Date(`${date}T00:00:00Z`);
        const end = new Date(`${date}T23:59:59Z`);
        const epochs: any[] = await this.prisma.$queryRaw`
          SELECT time, stage, duration_sec FROM sleep_epochs
          WHERE patient_id = ${patient.id}::uuid AND time BETWEEN ${start} AND ${end}
          ORDER BY time ASC
        `;
        if (epochs.length === 0) continue;

        const totalSec = epochs.reduce((sum: number, e: any) => sum + Number(e.duration_sec), 0);
        const stageTotals = epochs.reduce((acc: Record<string, number>, e: any) => {
          acc[e.stage] = (acc[e.stage] ?? 0) + Number(e.duration_sec);
          return acc;
        }, {});
        const fragmentationIndex = this.computeFragmentation(epochs.map((e: any) => e.stage));
        const report = {
          date, epochs, totalSleepMin: Math.round(totalSec / 60),
          deepPct: Math.round(((stageTotals['deep'] ?? 0) / totalSec) * 100),
          lightPct: Math.round(((stageTotals['light'] ?? 0) / totalSec) * 100),
          remPct: Math.round(((stageTotals['rem'] ?? 0) / totalSec) * 100),
          awakePct: Math.round(((stageTotals['awake'] ?? 0) / totalSec) * 100),
          fragmentationIndex,
          qualityLabel: this.qualityLabel(fragmentationIndex, stageTotals, totalSec),
        };

        await this.redis.set(`sleep:report:${patient.id}:${date}`, JSON.stringify(report), 'EX', 7 * 24 * 3600);
        this.logger.log({ patientId: patient.id, date, qualityLabel: report.qualityLabel }, 'Sleep report cached');
      } catch (e) {
        this.logger.warn({ patientId: patient.id }, 'Failed to aggregate sleep for patient');
      }
    }
  }

  private computeFragmentation(stages: string[]): number {
    if (stages.length < 2) return 0;
    const transitions = stages.filter((s, i) => i > 0 && s !== stages[i - 1]).length;
    return Math.round((transitions / stages.length) * 100) / 100;
  }

  private qualityLabel(fragIndex: number, stageTotals: Record<string, number>, totalSec: number): 'good' | 'restless' | 'poor' {
    const deepPct = (stageTotals['deep'] ?? 0) / totalSec;
    if (fragIndex < 0.2 && deepPct > 0.15 && totalSec > 4 * 3600) return 'good';
    if (fragIndex > 0.4 || totalSec < 3 * 3600) return 'poor';
    return 'restless';
  }
}

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

// Wire-format matches what DSP publishes to Redis (snake_case)
export interface VitalReading {
  device_id: string;
  patient_id: string;
  timestamp: number;   // Unix ms
  heart_rate_bpm: number;
  resp_rate_brpm: number;
  signal_quality: number;
}

const BUFFER_INTERVAL_MS = 5_000;
const BUFFER_MAX_SIZE = 50;
const LIVE_VITAL_TTL_SEC = 300; // 5 min — expiry signals device offline

@Injectable()
export class VitalStorageWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VitalStorageWorker.name);
  private subscriber: Redis;
  private buffer: VitalReading[] = [];
  private flushTimer: NodeJS.Timeout;
  // Rolling window of last 10 readings per patient for anomaly detection
  private readonly anomalyBuffer = new Map<string, VitalReading[]>();

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('anomaly-detection') private readonly anomalyQueue: Queue,
  ) {}

  onModuleInit() {
    this.subscriber = this.redis.duplicate();
    this.subscriber.psubscribe('vitals:*', (err) => {
      if (err) this.logger.error('Failed to subscribe to vitals channels', err);
    });
    this.subscriber.on('pmessage', (_pattern, _channel, message) => {
      try {
        const reading: VitalReading = JSON.parse(message);
        if (!this.isValidReading(reading)) {
          this.logger.warn('Discarded invalid vital reading from Redis');
          return;
        }
        this.buffer.push(reading);
        if (this.buffer.length >= BUFFER_MAX_SIZE) void this.flush();
      } catch (e) {
        this.logger.warn('Failed to parse vital reading from Redis', e);
      }
    });
    this.flushTimer = setInterval(() => void this.flush(), BUFFER_INTERVAL_MS);
  }

  private isValidReading(reading: VitalReading): boolean {
    return (
      Number.isFinite(reading.timestamp) &&
      Number.isFinite(reading.heart_rate_bpm) &&
      Number.isFinite(reading.resp_rate_brpm) &&
      Number.isFinite(reading.signal_quality) &&
      reading.heart_rate_bpm >= 20 && reading.heart_rate_bpm <= 250 &&
      reading.resp_rate_brpm >= 3 && reading.resp_rate_brpm <= 60 &&
      reading.signal_quality >= 0 && reading.signal_quality <= 1
    );
  }

  async onModuleDestroy() {
    clearInterval(this.flushTimer);
    await this.flush();
    await this.subscriber.quit();
  }

  private async flush() {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);

    try {
      // 1. Batch insert into TimescaleDB via parameterised raw SQL
      await this.prisma.$executeRaw`
        INSERT INTO vital_readings (time, device_id, patient_id, heart_rate_bpm, resp_rate_brpm, signal_quality)
        SELECT
          to_timestamp(v.timestamp / 1000.0),
          v.device_id::uuid,
          v.patient_id::uuid,
          ROUND(v.heart_rate_bpm)::smallint,
          ROUND(v.resp_rate_brpm)::smallint,
          v.signal_quality::real
        FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb)
          AS v(device_id text, patient_id text, timestamp bigint,
               heart_rate_bpm numeric, resp_rate_brpm numeric, signal_quality float)
      `;

      // 2. Live cache (one key per patient, TTL 5 min) + device heartbeat
      const latestByPatient = new Map<string, VitalReading>();
      const latestByDevice = new Map<string, VitalReading>();
      for (const r of batch) {
        latestByPatient.set(r.patient_id, r);
        latestByDevice.set(r.device_id, r);
      }

      const pipe = this.redis.pipeline();
      for (const [patientId, r] of latestByPatient) {
        pipe.set(`vitals:live:${patientId}`, JSON.stringify(r), 'EX', LIVE_VITAL_TTL_SEC);
      }
      await pipe.exec();

      for (const [deviceId, r] of latestByDevice) {
        await this.prisma.device
          .update({
            where: { id: deviceId },
            data: {
              lastHeartbeat: new Date(r.timestamp),
              signalQuality: r.signal_quality,
              status: 'online',
            },
          })
          .catch(() => {}); // device may not exist in dev/test
      }

      // 3. Anomaly detection — P4-007
      await this.runAnomalyCheck(batch);

      this.logger.debug(`Flushed ${batch.length} vital readings to TimescaleDB`);
    } catch (e) {
      this.logger.error({ err: e }, 'Failed to flush vital readings — returning to buffer');
      this.buffer.unshift(...batch);
    }
  }

  private async runAnomalyCheck(batch: VitalReading[]) {
    const patientIds = [...new Set(batch.map((r) => r.patient_id))];

    for (const patientId of patientIds) {
      const incoming = batch.filter((r) => r.patient_id === patientId);
      const existing = this.anomalyBuffer.get(patientId) ?? [];
      const window = [...existing, ...incoming].slice(-10);
      this.anomalyBuffer.set(patientId, window);

      const threshold = await this.prisma.patientThreshold
        .findUnique({ where: { patientId } })
        .catch(() => null);
      if (!threshold) continue;

      const latestDeviceId = incoming[incoming.length - 1].device_id;

      const hrBreaches = window.filter(
        (r) => r.heart_rate_bpm < threshold.hrMin || r.heart_rate_bpm > threshold.hrMax,
      );
      const rrBreaches = window.filter(
        (r) => r.resp_rate_brpm < threshold.rrMin || r.resp_rate_brpm > threshold.rrMax,
      );

      if (hrBreaches.length >= 3) {
        await this.anomalyQueue
          .add(
            'vital-anomaly',
            { patientId, deviceId: latestDeviceId, violationType: 'hr', readings: hrBreaches.slice(-3) },
            { jobId: `anomaly:hr:${patientId}:${Date.now()}` },
          )
          .catch(() => {});
      }

      if (rrBreaches.length >= 3) {
        await this.anomalyQueue
          .add(
            'vital-anomaly',
            { patientId, deviceId: latestDeviceId, violationType: 'rr', readings: rrBreaches.slice(-3) },
            { jobId: `anomaly:rr:${patientId}:${Date.now()}` },
          )
          .catch(() => {});
      }
    }
  }
}

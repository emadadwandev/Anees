import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import * as mqtt from 'mqtt';
import { PrismaService } from '../prisma/prisma.service';
import { DevicesService } from '../devices/devices.service';
import { MetricsService } from '../metrics/metrics.service';
import { AlertStatus, AlertType, DeviceStatus } from '@prisma/client';
import { RadarUpstreamMessageSchema } from './schemas/radar-event.schema';
import { Config } from '../config/config.schema';

const FALL_GRACE_MS = 10_000;
const DWELL_DEBOUNCE_SEC = 600;

@Injectable()
export class HardwareDeviceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HardwareDeviceService.name);
  private client: mqtt.MqttClient;

  constructor(
    private readonly config: ConfigService<Config>,
    private readonly prisma: PrismaService,
    private readonly devicesService: DevicesService,
    private readonly metrics: MetricsService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('fall-alert') private readonly fallAlertQueue: Queue,
  ) {}

  onModuleInit() {
    const brokerUrl = this.config.get('MQTT_BROKER_URL');
    this.client = mqtt.connect(brokerUrl, {
      username: this.config.get('MQTT_USERNAME'),
      password: this.config.get('MQTT_PASSWORD'),
      clientId: `anees-hw-consumer-${Date.now()}`,
      reconnectPeriod: 3000,
    });

    this.client.on('connect', () => {
      this.logger.log('Hardware device MQTT consumer connected');
      this.client.subscribe('/Radar60FL/+/sys/property/post', { qos: 1 });
    });

    this.client.on('message', async (topic, payload) => {
      await this.handleMessage(topic, payload.toString());
    });

    this.client.on('error', (err) => this.logger.error('Hardware MQTT error', err));
  }

  async onModuleDestroy() {
    this.client?.end();
  }

  private extractSerial(topic: string): string | null {
    // /Radar60FL/{SERIAL}/sys/property/post
    const parts = topic.split('/');
    return parts.length >= 3 ? parts[2] : null;
  }

  private async handleMessage(topic: string, raw: string) {
    this.metrics.mqttMessagesReceived.inc();

    const serial = this.extractSerial(topic);
    if (!serial) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn(`Non-JSON payload from hardware device serial=${serial}`);
      return;
    }

    const result = RadarUpstreamMessageSchema.safeParse(parsed);
    if (!result.success) {
      this.logger.warn({ serial, errors: result.error.flatten() }, 'Invalid radar upstream message');
      return;
    }

    const msg = result.data;
    if (!('method' in msg) || msg.method !== 'post') return; // skip query responses

    const device = await this.devicesService.resolveDeviceBySerial(serial);
    if (!device) {
      this.logger.warn(`Unregistered hardware device serial=${serial} — ignoring`);
      return;
    }

    const params = msg.params;

    const results = await Promise.allSettled([
      this.handleOnlineStatus(device, params),
      this.handleHeartbeat(device, params),
      this.handleFirmwareVersion(device, params),
      this.handleFallStatus(device, params),
      this.handleDwellStatus(device, params),
      this.handlePresenceMotion(device, params),
      this.handleFallSensorMotion(device, params),
      this.handleSleepRadarVitals(device, params),
      this.handleSleepReport(device, params),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error({ err: result.reason }, 'Hardware handler error');
      }
    }
  }

  // ─── Online / Offline ────────────────────────────────────────────────────────

  private async handleOnlineStatus(device: any, params: Record<string, string>) {
    if (!('online' in params)) return;

    const isOnline = params.online === '1';
    await this.prisma.device.update({
      where: { id: device.id },
      data: {
        status: isOnline ? DeviceStatus.online : DeviceStatus.offline,
        ...(isOnline && { lastHeartbeat: new Date() }),
      },
    });

    if (!isOnline && device.userId) {
      await this.redis.publish('alerts:caregiver', JSON.stringify({
        type: 'system.device_offline',
        deviceId: device.id,
        patientId: device.userId,
        lastSeen: new Date().toISOString(),
      }));
      this.logger.warn({ serial: device.serial }, 'Hardware device went offline');
    }
  }

  // ─── Heartbeat ────────────────────────────────────────────────────────────────

  private async handleHeartbeat(device: any, params: Record<string, string>) {
    if (!('heartBeat' in params)) return;

    if (params.heartBeat === '1') {
      await this.prisma.device.update({
        where: { id: device.id },
        data: { lastHeartbeat: new Date(), status: DeviceStatus.online },
      });
    } else if (device.userId) {
      await this.redis.publish('alerts:caregiver', JSON.stringify({
        type: 'system.heartbeat_warning',
        deviceId: device.id,
        patientId: device.userId,
        timestamp: new Date().toISOString(),
      }));
      this.logger.warn({ serial: device.serial }, 'Abnormal heartbeat from hardware device');
    }
  }

  // ─── Firmware version ────────────────────────────────────────────────────────

  private async handleFirmwareVersion(device: any, params: Record<string, string>) {
    const version = params.firmwareVersionProduct ?? params.firmwareVersion ?? params.firmwareVersionWiFi;
    if (!version) return;
    await this.prisma.device.update({ where: { id: device.id }, data: { firmwareVersion: version } });
  }

  // ─── Fall Detection (ST-FDVT3-WT) ────────────────────────────────────────────

  private async handleFallStatus(device: any, params: Record<string, string>) {
    if (!('fallStatus' in params)) return;
    if (!device.userId) return;
    if (params.fallStatus === '1') {
      await this.onFallDetected(device);
    } else {
      await this.onFallClearedByVoice(device);
    }
  }

  private async onFallDetected(device: any) {
    const { id: deviceId, userId: patientId, roomLabel, serial } = device;

    // Dedup: only one pending fall per patient at a time
    const existing = await this.prisma.alertEvent.findFirst({
      where: { patientId, type: AlertType.fall, status: AlertStatus.pending_cancellation },
    });
    if (existing) {
      this.logger.debug({ patientId }, 'Duplicate fall event — already pending cancellation');
      return;
    }

    const alert = await this.prisma.alertEvent.create({
      data: { deviceId, patientId, type: AlertType.fall, status: AlertStatus.pending_cancellation },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: patientId,
        action: 'alert.fall_detected',
        resourceType: 'alert_event',
        resourceId: alert.id,
      },
    });

    // Delayed BullMQ job — fires after grace window if not cancelled by patient voice
    try {
      const job = await this.fallAlertQueue.add(
        'fall-alert-dispatch',
        { alertId: alert.id, patientId, deviceId },
        { delay: FALL_GRACE_MS, jobId: `fall-alert-${alert.id}` },
      );
      this.logger.log({ alertId: alert.id, jobId: job.id }, 'Fall grace timer enqueued');
    } catch (qErr) {
      this.logger.error({ err: qErr, alertId: alert.id }, 'Failed to enqueue fall-alert BullMQ job');
    }

    const fallPayload = JSON.stringify({
      type: 'fall.detected',
      alertId: alert.id,
      patientId,
      room: roomLabel ?? 'Unknown Room',
      detectedAt: new Date().toISOString(),
      confidence: 1.0,
      source: 'hardware',
    });

    await Promise.all([
      // → CaregiverGateway → caregivers' Socket.IO rooms
      this.redis.publish('alerts:caregiver', fallPayload),
      // → VitalsGateway → patient's own Socket.IO room (triggers FallGraceScreen)
      this.redis.publish(`alerts:patient:${patientId}`, fallPayload),
    ]);

    this.logger.log({ alertId: alert.id, serial }, 'Hardware fall detected — 10s grace timer started');
  }

  private async onFallClearedByVoice(device: any) {
    const { userId: patientId, serial } = device;

    const pendingAlert = await this.prisma.alertEvent.findFirst({
      where: { patientId, type: AlertType.fall, status: AlertStatus.pending_cancellation },
      orderBy: { triggeredAt: 'desc' },
    });
    if (!pendingAlert) return;

    // Cancel the BullMQ dispatch job
    const jobs = await this.fallAlertQueue.getJobs(['delayed']);
    const job = jobs.find((j) => j.data.alertId === pendingAlert.id);
    if (job) await job.remove();

    await this.prisma.alertEvent.update({
      where: { id: pendingAlert.id },
      data: { status: AlertStatus.cancelled_by_user, cancelledByUser: true },
    });

    const cancelPayload = JSON.stringify({
      type: 'alert.state_changed',
      alertId: pendingAlert.id,
      patientId,
      state: AlertStatus.cancelled_by_user,
      cancelledBy: 'voice',
      updatedAt: new Date().toISOString(),
    });

    await Promise.all([
      this.redis.publish('alerts:caregiver', cancelPayload),
      this.redis.publish(`alerts:patient:${patientId}`, cancelPayload),
    ]);

    this.logger.log({ alertId: pendingAlert.id, serial }, 'Fall cleared by patient voice — alert cancelled');
  }

  // ─── Static Dwell Alarm ──────────────────────────────────────────────────────

  private async handleDwellStatus(device: any, params: Record<string, string>) {
    if (params.residentStatus !== '1') return;
    if (!device.userId) return;

    const { id: deviceId, userId: patientId, roomLabel } = device;
    const debounceKey = `dwell:debounce:${patientId}`;
    if (await this.redis.get(debounceKey)) return;

    await this.redis.set(debounceKey, '1', 'EX', DWELL_DEBOUNCE_SEC);

    const alert = await this.prisma.alertEvent.create({
      data: { deviceId, patientId, type: AlertType.vital_anomaly, status: AlertStatus.dispatched },
    });

    await this.redis.publish('alerts:caregiver', JSON.stringify({
      type: 'vital.dwell_alarm',
      alertId: alert.id,
      patientId,
      room: roomLabel,
      timestamp: new Date().toISOString(),
    }));

    this.logger.warn({ alertId: alert.id, patientId }, 'Static dwell alarm triggered');
  }

  // ─── Presence & Motion state ─────────────────────────────────────────────────

  private async handlePresenceMotion(device: any, params: Record<string, string>) {
    const update: Record<string, unknown> = {};
    if ('someoneExists' in params) update.someoneExists = params.someoneExists === '1';
    if ('motionStatus' in params) update.motionStatus = Number(params.motionStatus); // 0=none,1=static,2=active
    if (Object.keys(update).length === 0) return;
    if (!device.userId) return;

    await this.redis.publish('vitals:presence', JSON.stringify({
      deviceId: device.id,
      patientId: device.userId,
      timestamp: Date.now(),
      ...update,
    }));

    await this.redis.set(
      `presence:${device.userId}`,
      JSON.stringify({ ...update, updatedAt: new Date().toISOString() }),
      'EX', 120,
    );
  }

  // ─── Motion energy from fall sensor (not clinical HR/RR) ─────────────────────

  private async handleFallSensorMotion(device: any, params: Record<string, string>) {
    if (!('movementSigns' in params) && !('humanPresenceEnergyValue' in params)) return;
    if (!device.userId) return;
    const motionLevel = Number(params.movementSigns ?? params.humanPresenceEnergyValue ?? 0);
    await this.redis.set(
      `motion:${device.userId}`,
      JSON.stringify({ motionLevel, updatedAt: new Date().toISOString() }),
      'EX', 60,
    );
  }

  // ─── Clinical vitals from sleep radar (ST-BD60S1-WT) ────────────────────────

  private async handleSleepRadarVitals(device: any, params: Record<string, string>) {
    const hasHr = 'heartRate' in params;
    const hasRr = 'breathRate' in params;
    if (!hasHr || !hasRr) return; // need both to publish a valid vital reading
    if (!device.userId) return;

    const hr = Number(params.heartRate);
    const rr = Number(params.breathRate);

    if (hr < 20 || hr > 250 || rr < 3 || rr > 60) return; // sanity gate

    const motionRaw = params.movingRange ? Number(params.movingRange) : 0;
    const signalQuality = parseFloat(Math.max(0, 1 - motionRaw / 100).toFixed(3));

    const vitalsPayload = JSON.stringify({
      device_id: device.id,
      patient_id: device.userId,
      timestamp: Date.now(),
      heart_rate_bpm: hr,
      resp_rate_brpm: rr,
      signal_quality: signalQuality,
      motion_magnitude: motionRaw / 100,
    });

    await Promise.all([
      // Pub/sub → VitalsGateway → Socket.IO vitals.update
      this.redis.publish(`vitals:${device.userId}`, vitalsPayload),
      // Point-in-time cache → getRoster() / getLiveVitals()
      this.redis.set(`vitals:live:${device.userId}`, vitalsPayload, 'EX', 120),
    ]);
  }

  // ─── Sleep stages & full sleep report (ST-BD60S1-WT) ────────────────────────

  private async handleSleepReport(device: any, params: Record<string, string>) {
    if (!device.userId) return;
    // Per-epoch stage update during sleep
    if ('sleepState' in params) {
      const stageMap: Record<string, string> = { '0': 'deep', '1': 'light', '2': 'rem', '3': 'awake' };
      const stage = stageMap[params.sleepState] ?? 'awake';
      await this.redis.publish(`sleep:${device.userId}`, JSON.stringify({
        device_id: device.id,
        patient_id: device.userId,
        timestamp: Date.now(),
        stage,
        duration_sec: 30,
      }));
    }

    // Full nightly report (only when sleepReport="1", after 4-12h in bed + 5min out)
    if (params.sleepReport !== '1') return;

    const reportDate = new Date().toISOString().split('T')[0];
    const hwReport = {
      source: 'hardware',
      date: reportDate,
      sleepScore: params.sleepScore ? Number(params.sleepScore) : null,
      totalSleepMin: params.sleepTime ? Number(params.sleepTime) : null,
      deepSleepMin: params.deepSleepTime ? Number(params.deepSleepTime) : null,
      lightSleepMin: params.lightSleepTime ? Number(params.lightSleepTime) : null,
      wakeMin: params.wakeTime ? Number(params.wakeTime) : null,
      outOfBedTimes: params.outOfBedTimes ? Number(params.outOfBedTimes) : null,
      generatedAt: new Date().toISOString(),
    };

    await this.redis.set(
      `sleep:hw_report:${device.userId}:${reportDate}`,
      JSON.stringify(hwReport),
      'EX', 8 * 24 * 3600,
    );

    await this.redis.publish('alerts:caregiver', JSON.stringify({
      type: 'sleep.report_ready',
      patientId: device.userId,
      date: reportDate,
      sleepScore: hwReport.sleepScore,
    }));

    this.logger.log(
      { patientId: device.userId, score: hwReport.sleepScore, totalMin: hwReport.totalSleepMin },
      'Hardware sleep report received and cached',
    );
  }
}

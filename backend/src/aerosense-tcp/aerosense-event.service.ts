import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { AlertStatus, AlertType } from '@prisma/client';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { WavveVitalData } from './protocol/wavve-codec';

export interface AeroSenseSession {
  deviceId: string;
  patientId: string;
}

const FALL_GRACE_MS = 10_000;
const WAVVE_ALERT_DEBOUNCE_SEC = 300;

export type WavveClinicalAlertKind =
  | 'vital.no_breath'
  | 'vital.low_breath'
  | 'vital.high_breath'
  | 'vital.no_heart'
  | 'vital.low_heart'
  | 'vital.high_heart';

@Injectable()
export class AeroSenseEventService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('fall-alert') private readonly fallAlertQueue: Queue,
  ) {}

  async handleWavveVital(session: AeroSenseSession, vital: WavveVitalData, timestamp: number): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO wavve_vital_details (
        time, device_id, patient_id, breath_curve, heart_curve, target_distance_m,
        bed_signal_strength, valid_bit, body_move_energy, body_move_range
      ) VALUES (
        to_timestamp(${timestamp} / 1000.0), ${session.deviceId}::uuid, ${session.patientId}::uuid,
        ${vital.breathCurve}, ${vital.heartCurve}, ${vital.targetDistanceM},
        ${vital.bedSignalStrength}, ${vital.validBit}, ${vital.bodyMoveEnergy}, ${vital.bodyMoveRange}
      )
    `;

    if (vital.validBit !== 2) return;

    await this.redis.publish(
      `vitals:${session.patientId}`,
      JSON.stringify({
        device_id: session.deviceId,
        patient_id: session.patientId,
        timestamp,
        heart_rate_bpm: vital.heartRateBpm,
        resp_rate_brpm: vital.respirationRateBrpm,
        signal_quality: 1,
      }),
    );
  }

  async handleWavveClinicalAlert(
    session: AeroSenseSession,
    subtype: WavveClinicalAlertKind,
    timestamp: number,
  ): Promise<void> {
    const debounceKey = `wavve:alert:${session.deviceId}:${subtype}`;
    const acquired = await this.redis.set(debounceKey, '1', 'EX', WAVVE_ALERT_DEBOUNCE_SEC, 'NX');
    if (acquired !== 'OK') return;

    const alert = await this.prisma.alertEvent.create({
      data: {
        deviceId: session.deviceId,
        patientId: session.patientId,
        type: AlertType.vital_anomaly,
        status: AlertStatus.dispatched,
        notes: `AeroSense Wavve alert: ${subtype}`,
        triggeredAt: new Date(timestamp),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: session.patientId,
        action: 'alert.wavve_vital_anomaly',
        resourceType: 'alert_event',
        resourceId: alert.id,
      },
    });
    await this.redis.publish(
      'alerts:caregiver',
      JSON.stringify({
        type: subtype,
        alertId: alert.id,
        patientId: session.patientId,
        timestamp: new Date(timestamp).toISOString(),
        source: 'wavve',
      }),
    );
  }

  async handleAssureFall(
    session: AeroSenseSession,
    position: { xM: number; yM: number },
    timestamp: number,
  ): Promise<void> {
    let alert = await this.prisma.alertEvent.findFirst({
      where: {
        deviceId: session.deviceId,
        type: AlertType.fall,
        status: AlertStatus.pending_cancellation,
      },
    });

    if (!alert) {
      alert = await this.prisma.alertEvent.create({
        data: {
          deviceId: session.deviceId,
          patientId: session.patientId,
          type: AlertType.fall,
          status: AlertStatus.pending_cancellation,
          notes: `AeroSense Assure fall coordinates: x=${position.xM}m, y=${position.yM}m`,
          triggeredAt: new Date(timestamp),
        },
      });
      await this.prisma.auditLog.create({
        data: {
          actorId: session.patientId,
          action: 'alert.fall_detected',
          resourceType: 'alert_event',
          resourceId: alert.id,
        },
      });
    }

    await this.fallAlertQueue.add(
      'fall-alert-dispatch',
      { alertId: alert.id, patientId: session.patientId, deviceId: session.deviceId },
      { delay: FALL_GRACE_MS, jobId: `fall-alert-${alert.id}` },
    );

    const fallPayload = JSON.stringify({
      type: 'fall.detected',
      alertId: alert.id,
      patientId: session.patientId,
      room: 'Unknown Room',
      detectedAt: new Date(timestamp).toISOString(),
      confidence: 1,
      source: 'aerosense_assure',
      coordinates: position,
    });
    await Promise.all([
      this.redis.publish('alerts:caregiver', fallPayload),
      this.redis.publish(`alerts:patient:${session.patientId}`, fallPayload),
    ]);
  }

  async handleAssureFallElimination(session: AeroSenseSession): Promise<void> {
    const pendingAlert = await this.prisma.alertEvent.findFirst({
      where: {
        deviceId: session.deviceId,
        type: AlertType.fall,
        status: AlertStatus.pending_cancellation,
      },
      orderBy: { triggeredAt: 'desc' },
    });
    if (!pendingAlert) return;

    const jobs = await this.fallAlertQueue.getJobs(['delayed']);
    const job = jobs.find((candidate) => candidate.data.alertId === pendingAlert.id);
    if (job) await job.remove();

    await this.prisma.alertEvent.update({
      where: { id: pendingAlert.id },
      data: { status: AlertStatus.cancelled_by_user, cancelledByUser: true },
    });

    const cancelPayload = JSON.stringify({
      type: 'alert.state_changed',
      alertId: pendingAlert.id,
      patientId: session.patientId,
      state: AlertStatus.cancelled_by_user,
      cancelledBy: 'sensor',
      updatedAt: new Date().toISOString(),
      source: 'aerosense_assure',
    });
    await Promise.all([
      this.redis.publish('alerts:caregiver', cancelPayload),
      this.redis.publish(`alerts:patient:${session.patientId}`, cancelPayload),
    ]);
  }

  async handleAssurePresence(
    session: AeroSenseSession,
    presence: { occupied: boolean; rangeM: number; energy: number },
    timestamp: number,
  ): Promise<void> {
    const payload = {
      deviceId: session.deviceId,
      patientId: session.patientId,
      timestamp,
      someoneExists: presence.occupied,
      rangeM: presence.rangeM,
      energy: presence.energy,
      source: 'aerosense_assure',
    };
    await Promise.all([
      this.redis.publish('vitals:presence', JSON.stringify(payload)),
      this.redis.set(
        `presence:${session.patientId}`,
        JSON.stringify({
          someoneExists: presence.occupied,
          rangeM: presence.rangeM,
          energy: presence.energy,
          source: 'aerosense_assure',
          updatedAt: new Date(timestamp).toISOString(),
        }),
        'EX',
        120,
      ),
    ]);
  }

  async handleAssurePosition(
    session: AeroSenseSession,
    position: {
      xM: number;
      yM: number;
      zM: number;
      motion?: { xM: number; yM: number; zM: number; snrDb: number };
      targetCount?: number;
    },
    timestamp: number,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO motion_events (time, device_id, patient_id, event_type, coordinates)
      VALUES (
        to_timestamp(${timestamp} / 1000.0), ${session.deviceId}::uuid, ${session.patientId}::uuid,
        ${'assure.position'}, ${JSON.stringify(position)}::jsonb
      )
    `;
  }
}

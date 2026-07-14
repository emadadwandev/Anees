import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { AlertType, AlertStatus, OcclusionStatus } from '@prisma/client';
import { IntercomService } from '../intercom/intercom.service';
import { DeviceIngressPolicyService } from '../devices/device-ingress-policy.service';

@Injectable()
export class AlertOrchestrationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertOrchestrationService.name);
  private subscriber: Redis;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('fall-alert') private readonly fallAlertQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly intercom: IntercomService,
    @Optional() private readonly policy?: DeviceIngressPolicyService,
  ) {}

  onModuleInit() {
    this.subscriber = this.redis.duplicate();
    this.subscriber.psubscribe('alerts:*', (err) => {
      if (err) this.logger.error('Failed to subscribe to alerts channel', err);
      else this.logger.log('Subscribed to alerts:* channel');
    });
    this.subscriber.on('pmessage', async (_pattern, channel, message) => {
      await this.handleAlertMessage(channel, message);
    });
  }

  async onModuleDestroy() {
    await this.subscriber.quit();
  }

  private async handleAlertMessage(channel: string, message: string) {
    try {
      const event = JSON.parse(message);
      const eventType = event.event_type ?? event.type;

      if (eventType === 'occlusion' || eventType === 'occlusion_cleared') {
        await this.handleOcclusionEvent(event, eventType);
        return;
      }

      if (eventType !== 'fall_candidate') return;

      const { device_id: deviceId, patient_id: patientId, timestamp, confidence } = event;

      const device = await this.prisma.device.findUnique({
        where: { id: deviceId },
        select: { roomLabel: true, managementState: true, userId: true, deprovisionedAt: true },
      });
      if (this.policy && (!device || !this.policy.allowClinicalProcessing(device))) return;

      const alert = await this.prisma.alertEvent.create({
        data: {
          deviceId,
          patientId,
          type: AlertType.fall,
          status: AlertStatus.pending_cancellation,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          actorId: patientId,
          action: 'alert.created',
          resourceType: 'alert_event',
          resourceId: alert.id,
        },
      });

      // Delayed job — fires after 10s grace window if not cancelled by patient
      await this.fallAlertQueue.add(
        'fall-alert-dispatch',
        { alertId: alert.id, patientId, deviceId },
        { delay: 10_000, jobId: `fall-alert-${alert.id}` },
      );

      // Pre-create LiveKit room + issue patient auto-answer token (P5-005)
      let patientLivekitToken: string | null = null;
      let livekitWsUrl: string | null = null;
      try {
        await this.intercom.createRoom(patientId);
        const tokenResult = await this.intercom.issueToken(
          patientId,
          `patient-${patientId}`,
          true,
          true,
        );
        patientLivekitToken = await tokenResult.token;
        livekitWsUrl = tokenResult.wsUrl;
      } catch (err) {
        this.logger.warn({ err, alertId: alert.id }, 'Failed to pre-create LiveKit room');
      }

      // Notify CaregiverGateway (subscribes to 'alerts:caregiver')
      await this.redis.publish(
        'alerts:caregiver',
        JSON.stringify({
          type: 'fall.detected',
          alertId: alert.id,
          patientId,
          room: device?.roomLabel ?? 'Unknown Room',
          detectedAt: new Date(timestamp).toISOString(),
          confidence,
        }),
      );

      // Notify patient directly (vitals gateway subscribes to 'alerts:patient:*')
      await this.redis.publish(
        `alerts:patient:${patientId}`,
        JSON.stringify({
          type: 'fall.detected',
          alertId: alert.id,
          patientId,
          room: device?.roomLabel ?? 'Unknown Room',
          detectedAt: new Date(timestamp).toISOString(),
          livekitToken: patientLivekitToken,
          livekitWsUrl,
        }),
      );

      this.logger.log(
        { alertId: alert.id, patientId, confidence, channel },
        'Fall candidate → AlertEvent created, grace timer enqueued',
      );
    } catch (err) {
      this.logger.error({ err, channel }, 'Failed to handle alert message');
    }
  }

  private async handleOcclusionEvent(event: Record<string, unknown>, eventType: string) {
    const { device_id: deviceId, patient_id: patientId, status } = event as {
      device_id: string;
      patient_id: string;
      status: string;
    };

    const occlusionStatus =
      status === 'none'
        ? OcclusionStatus.none
        : status === 'partial'
          ? OcclusionStatus.partial
          : OcclusionStatus.full;

    await this.prisma.device.update({
      where: { id: deviceId },
      data: { occlusionStatus },
    });

    await this.redis.publish(
      'alerts:caregiver',
      JSON.stringify({
        type: eventType === 'occlusion' ? 'system.occlusion' : 'system.occlusion_cleared',
        deviceId,
        patientId,
        occlusionStatus,
        timestamp: new Date().toISOString(),
      }),
    );

    this.logger.log({ deviceId, occlusionStatus }, `Occlusion state updated`);
  }
}

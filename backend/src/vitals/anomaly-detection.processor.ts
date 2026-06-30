import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AlertType, AlertStatus } from '@prisma/client';

@Processor('anomaly-detection')
export class AnomalyDetectionProcessor extends WorkerHost {
  private readonly logger = new Logger(AnomalyDetectionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('push-notifications') private readonly pushQueue: Queue,
  ) {
    super();
  }

  async process(job: Job) {
    const { patientId, deviceId, violationType } = job.data;

    // Deduplicate: skip if there's already an active anomaly alert for this patient
    const existing = await this.prisma.alertEvent.findFirst({
      where: {
        patientId,
        type: AlertType.vital_anomaly,
        status: { in: [AlertStatus.pending_cancellation, AlertStatus.dispatched, AlertStatus.acknowledged] },
      },
    });
    if (existing) {
      this.logger.debug({ patientId }, 'Anomaly alert already active — skipping duplicate');
      return;
    }

    const alert = await this.prisma.alertEvent.create({
      data: {
        patientId,
        deviceId,
        type: AlertType.vital_anomaly,
        status: AlertStatus.dispatched,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: patientId,
        action: 'alert.vital_anomaly.created',
        resourceType: 'alert_event',
        resourceId: alert.id,
      },
    });

    const links = await this.prisma.caregiverLink.findMany({ where: { patientId } });
    const tokens = await this.prisma.userPushToken.findMany({
      where: { userId: { in: links.map((l) => l.caregiverId) } },
    });

    for (const t of tokens) {
      await this.pushQueue.add('send-standard-alert', {
        token: t.token,
        platform: t.platform,
        alertId: alert.id,
        patientId,
      });
    }

    this.logger.log(
      { alertId: alert.id, patientId, violationType, pushCount: tokens.length },
      'Vital anomaly alert dispatched',
    );
  }
}

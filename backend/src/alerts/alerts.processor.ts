import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AlertStatus } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IntercomService } from '../intercom/intercom.service';

@Processor('fall-alert')
export class AlertsProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly intercom: IntercomService,
    @InjectQueue('push-notifications') private pushQueue: Queue,
  ) {
    super();
  }

  async process(job: Job) {
    const { alertId } = job.data;
    this.logger.log(`Processing fall alert job alertId=${alertId}`);

    const alert = await this.prisma.alertEvent.findUnique({
      where: { id: alertId },
      include: {
        patient: {
          include: {
            caregiverLinks: true,
            pushTokens: true,
          },
        },
        device: { select: { roomLabel: true } },
      },
    });

    if (!alert || alert.status === AlertStatus.cancelled_by_user) {
      this.logger.log(`Alert ${alertId} was cancelled — skipping dispatch`);
      return;
    }

    await this.prisma.alertEvent.update({
      where: { id: alertId },
      data: { status: AlertStatus.dispatched },
    });

    // Auto-create LiveKit room so caregiver can join voice call immediately from push notification
    let livekitRoomId: string | null = null;
    let livekitWsUrl: string | null = null;
    try {
      await this.intercom.createRoom(alert.patientId);
      livekitRoomId = `patient-${alert.patientId}`;
      const tokenResult = await this.intercom.issueToken(
        alert.patientId,
        `system-alert-${alertId}`,
        false,
        false,
      );
      livekitWsUrl = tokenResult.wsUrl;
      await this.intercom.logSession(alertId, livekitRoomId, alert.patientId);
      this.logger.log({ alertId, livekitRoomId }, 'LiveKit room auto-created for fall alert');
    } catch (err) {
      this.logger.warn({ err, alertId }, 'Failed to auto-create LiveKit room — push still sent');
    }

    const caregiverIds = alert.patient.caregiverLinks.map((l) => l.caregiverId);
    const pushTokens = await this.prisma.userPushToken.findMany({
      where: { userId: { in: caregiverIds } },
    });

    for (const token of pushTokens) {
      await this.pushQueue.add('send-critical-alert', {
        token: token.token,
        platform: token.platform,
        alertId,
        patientId: alert.patientId,
        roomLabel: alert.device?.roomLabel ?? '',
        livekitRoomId,
        livekitWsUrl,
      });
    }

    this.logger.log(
      { alertId, pushCount: pushTokens.length, livekitRoomId },
      'Fall alert dispatched with auto-intercom room',
    );
  }
}

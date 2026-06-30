import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';
import { Platform } from '@prisma/client';
import { Config } from '../config/config.schema';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly config: ConfigService<Config>,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const projectId = this.config.get('FCM_PROJECT_ID');
    if (projectId && !admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail: this.config.get('FCM_CLIENT_EMAIL'),
          privateKey: this.config.get('FCM_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  async saveToken(userId: string, token: string, platform: Platform) {
    return this.prisma.userPushToken.upsert({
      where: { token },
      update: { userId, platform },
      create: { userId, token, platform },
    });
  }

  async sendCriticalAlert(
    pushToken: string,
    platform: Platform,
    alertId: string,
    patientId: string,
    roomLabel: string,
  ) {
    if (!admin.apps.length) {
      this.logger.warn('FCM not initialized — skipping push');
      return;
    }
    const data = { alertId, patientId, roomLabel, type: 'fall' };
    await admin.messaging().send({
      token: pushToken,
      data,
      android: { priority: 'high', notification: { sound: 'alarm', channelId: 'critical-alerts' } },
      apns: {
        headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
        payload: { aps: { sound: { critical: true, name: 'alarm.caf', volume: 1.0 }, contentAvailable: true } },
      },
    });
  }

  async sendStandardAlert(pushToken: string, _platform: Platform, alertId: string, patientId: string) {
    if (!admin.apps.length) return;
    await admin.messaging().send({
      token: pushToken,
      data: { alertId, patientId, type: 'vital_anomaly' },
    });
  }
}

@Processor('push-notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job) {
    const { token, platform, alertId, patientId, roomLabel } = job.data;
    await this.notificationsService.sendCriticalAlert(token, platform, alertId, patientId, roomLabel);
    this.logger.log(`Push sent to ${platform} token for alert ${alertId}`);
  }
}

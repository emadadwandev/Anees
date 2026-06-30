import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AlertStatus } from '@prisma/client';
import { Config } from '../config/config.schema';

@WebSocketGateway({ namespace: '/caregiver', cors: { origin: '*' } })
export class CaregiverGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CaregiverGateway.name);
  private subscriber: Redis;
  private presenceSubscriber: Redis;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Config>,
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('fall-alert') private readonly fallAlertQueue: Queue,
  ) {}

  onModuleInit() {
    // ── Alert & system events channel ───────────────────────────────────────
    this.subscriber = this.redis.duplicate();
    this.subscriber.subscribe('alerts:caregiver', (err) => {
      if (err) this.logger.error('caregiver subscribe error', err);
    });

    this.subscriber.on('message', (_channel, message) => {
      const event = JSON.parse(message);
      const room = `patient:${event.patientId}`;

      switch (event.type) {
        case 'fall.detected':
          this.server.to(room).emit('fall.detected', event);
          break;

        case 'alert.state_changed':
          this.server.to(room).emit('alert.state_changed', event);
          break;

        case 'vital.dwell_alarm':
          this.server.to(room).emit('alert.vital', event);
          break;

        case 'sleep.report_ready':
          this.server.to(room).emit('sleep.report_ready', event);
          break;

        case 'system.device_offline':
        case 'device.offline_15min':
          this.server.to(room).emit('system.device_offline', {
            deviceId: event.deviceId,
            patientId: event.patientId,
            lastSeen: event.lastSeen,
            offlineDuration: event.offlineDuration,
          });
          break;

        case 'system.heartbeat_warning':
          this.server.to(room).emit('system.heartbeat_warning', {
            deviceId: event.deviceId,
            patientId: event.patientId,
            timestamp: event.timestamp,
          });
          break;

        case 'system.occlusion':
        case 'system.occlusion_cleared':
          this.server.to(room).emit('system.occlusion', {
            deviceId: event.deviceId,
            patientId: event.patientId,
            occlusionStatus: event.occlusionStatus,
            cleared: event.type === 'system.occlusion_cleared',
            timestamp: event.timestamp,
          });
          break;
      }
    });

    // ── Presence / motion events channel (high-frequency, separate subscriber) ─
    this.presenceSubscriber = this.redis.duplicate();
    this.presenceSubscriber.subscribe('vitals:presence', (err) => {
      if (err) this.logger.error('presence subscribe error', err);
    });
    this.presenceSubscriber.on('message', (_channel, message) => {
      const event = JSON.parse(message);
      this.server.to(`patient:${event.patientId}`).emit('device.presence', event);
    });
  }

  async onModuleDestroy() {
    await this.subscriber.quit();
    await this.presenceSubscriber.quit();
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      const payload = this.jwtService.verify(token, { secret: this.config.get('JWT_ACCESS_SECRET') });
      if (payload.role !== 'caregiver' && payload.role !== 'admin') {
        client.disconnect(true);
        return;
      }
      client.data.userId = payload.sub;
      client.data.role = payload.role;

      if (payload.role === 'admin') {
        const allPatients = await this.prisma.user.findMany({
          where: { role: 'care_receiver' },
          select: { id: true },
        });
        for (const p of allPatients) {
          await client.join(`patient:${p.id}`);
        }
        await client.join('admin');
      } else {
        const links = await this.prisma.caregiverLink.findMany({ where: { caregiverId: payload.sub } });
        for (const link of links) {
          await client.join(`patient:${link.patientId}`);
        }
      }
      this.logger.log(`${payload.role} connected: ${client.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Caregiver disconnected: ${client.id}`);
  }

  @SubscribeMessage('alert.cancel')
  async handleAlertCancel(
    @MessageBody() data: { alertId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const jobs = await this.fallAlertQueue.getJobs(['delayed']);
    const job = jobs.find((j) => j.data.alertId === data.alertId);
    if (job) await job.remove();

    await this.prisma.alertEvent.update({
      where: { id: data.alertId },
      data: { status: AlertStatus.cancelled_by_user, cancelledByUser: true },
    });

    this.logger.log(`Alert ${data.alertId} cancelled via WebSocket`);
    return { success: true };
  }
}

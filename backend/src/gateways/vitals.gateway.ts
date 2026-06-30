import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { Config } from '../config/config.schema';

@WebSocketGateway({ namespace: '/vitals', cors: { origin: '*' } })
export class VitalsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VitalsGateway.name);
  private subscriber: Redis;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Config>,
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  onModuleInit() {
    this.subscriber = this.redis.duplicate();
    this.subscriber.psubscribe('vitals:*', 'sleep:*', 'alerts:patient:*', (err) => {
      if (err) this.logger.error('subscribe error', err);
    });
    this.subscriber.on('pmessage', (_pattern, channel, message) => {
      try {
        const data = JSON.parse(message) as {
          patient_id?: string;
          patientId?: string;
          type?: string;
        };
        const patientId = data.patient_id ?? data.patientId;
        if (!patientId) return;

        if (channel.startsWith('vitals:')) {
          this.server.to(`patient:${patientId}`).emit('vitals.update', data);
        } else if (channel.startsWith('sleep:')) {
          this.server.to(`patient:${patientId}`).emit('sleep.epoch', data);
        } else if (channel.startsWith('alerts:patient:')) {
          // Forward fall.detected (with livekitToken) to the patient's own Socket.IO room
          const eventType = data.type ?? 'fall.detected';
          this.server.to(`patient:${patientId}`).emit(eventType, data);
        }
      } catch {
        this.logger.warn(`Failed to parse Redis message on ${channel}`);
      }
    });
  }

  async onModuleDestroy() {
    await this.subscriber.quit();
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      const payload = this.jwtService.verify(token, { secret: this.config.get('JWT_ACCESS_SECRET') });
      client.data.userId = payload.sub;
      client.data.role = payload.role;

      if (payload.role === 'care_receiver') {
        const device = await this.prisma.device.findFirst({ where: { userId: payload.sub } });
        if (device) await client.join(`patient:${payload.sub}`);
      } else if (payload.role === 'caregiver') {
        const links = await this.prisma.caregiverLink.findMany({ where: { caregiverId: payload.sub } });
        for (const link of links) {
          await client.join(`patient:${link.patientId}`);
        }
      } else if (payload.role === 'admin') {
        const allPatients = await this.prisma.user.findMany({
          where: { role: 'care_receiver' },
          select: { id: true },
        });
        for (const p of allPatients) {
          await client.join(`patient:${p.id}`);
        }
        await client.join('admin');
      }
      this.logger.log(`Client connected: ${client.id} (${payload.role})`);
    } catch {
      this.logger.warn(`Unauthorized WS connection: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }
}

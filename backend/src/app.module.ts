import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { RedisModule } from '@nestjs-modules/ioredis';
import { BullModule } from '@nestjs/bullmq';

import { configSchema } from './config/config.schema';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { LinksModule } from './links/links.module';
import { DevicesModule } from './devices/devices.module';
import { VitalsModule } from './vitals/vitals.module';
import { AlertsModule } from './alerts/alerts.module';
import { SleepModule } from './sleep/sleep.module';
import { IntercomModule } from './intercom/intercom.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MqttConsumerModule } from './mqtt/mqtt-consumer.module';
import { VitalsGatewayModule } from './gateways/vitals-gateway.module';
import { CaregiverGatewayModule } from './gateways/caregiver-gateway.module';
import { MetricsModule } from './metrics/metrics.module';
import { AdminModule } from './admin/admin.module';
import { CaregiverModule } from './caregiver/caregiver.module';
import { AeroSenseTcpModule } from './aerosense-tcp/aerosense-tcp.module';
import { SuperAdminModule } from './super-admin/super-admin.module';

@Module({
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  imports: [
    // ─── Config ──────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => configSchema.parse(config),
    }),

    // ─── Logging ─────────────────────────────────────────────────────────────
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
      },
    }),

    // ─── Scheduling ──────────────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ─── Rate limiting (P9-002): 5 requests/min per IP globally; auth/login uses @Throttle(5, 60)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // ─── Redis ───────────────────────────────────────────────────────────────
    RedisModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'single',
        url: config.get<string>('REDIS_URL'),
      }),
      inject: [ConfigService],
    }),

    // ─── BullMQ (all queues registered globally) ─────────────────────────────
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL') },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'fall-alert' },
      { name: 'push-notifications' },
      { name: 'sleep-aggregation' },
      { name: 'anomaly-detection' },
      { name: 'dlq' },
    ),

    // ─── Observability ────────────────────────────────────────────────────────
    MetricsModule,

    // ─── Feature Modules ──────────────────────────────────────────────────────
    PrismaModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    LinksModule,
    DevicesModule,
    VitalsModule,
    AlertsModule,
    SleepModule,
    IntercomModule,
    NotificationsModule,
    MqttConsumerModule,
    VitalsGatewayModule,
    CaregiverGatewayModule,
    AdminModule,
    CaregiverModule,
    AeroSenseTcpModule,
    SuperAdminModule,
  ],
})
export class AppModule {}

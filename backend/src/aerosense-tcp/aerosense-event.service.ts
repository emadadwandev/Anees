import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { WavveVitalData } from './protocol/wavve-codec';

export interface AeroSenseSession {
  deviceId: string;
  patientId: string;
}

@Injectable()
export class AeroSenseEventService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
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
}

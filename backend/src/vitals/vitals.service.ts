import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class VitalsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getLive(patientId: string) {
    const cached = await this.redis.get(`vitals:live:${patientId}`);
    return cached ? JSON.parse(cached) : null;
  }

  async getHistory(patientId: string, range: string, resolution: string) {
    const interval = this.rangeToInterval(range);
    return this.prisma.$queryRaw`
      SELECT
        time_bucket(${resolution}::interval, time) AS bucket,
        ROUND(AVG(heart_rate_bpm))::int            AS heart_rate_bpm,
        ROUND(AVG(resp_rate_brpm))::int            AS resp_rate_brpm,
        AVG(signal_quality)                        AS signal_quality
      FROM vital_readings
      WHERE patient_id = ${patientId}::uuid
        AND time >= NOW() - ${interval}::interval
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
  }

  private rangeToInterval(range: string): string {
    const map: Record<string, string> = {
      '6h': '6 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
    };
    return map[range.toLowerCase()] ?? '24 hours';
  }
}

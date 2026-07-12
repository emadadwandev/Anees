import { describe, expect, it, jest } from '@jest/globals';
import { AeroSenseEventService } from './aerosense-event.service';

const session = {
  deviceId: '7b1c8f21-bd66-4a81-8b9f-620e5fed2c76',
  patientId: 'ce54a4f9-50ad-4527-8652-1edc5daec281',
};

describe('AeroSenseEventService Assure observations', () => {
  it('publishes and caches safe presence data without raw ADC bytes', async () => {
    const redis = {
      publish: jest.fn<(channel: string, payload: string) => Promise<number>>().mockResolvedValue(1),
      set: jest.fn<(key: string, value: string, mode: string, seconds: number) => Promise<string>>().mockResolvedValue('OK'),
    };
    const service = new AeroSenseEventService({} as never, redis as never, {} as never);

    await service.handleAssurePresence(session, { occupied: true, rangeM: 4.5, energy: 100 }, 1_720_672_000_000);

    expect(redis.publish).toHaveBeenCalledWith(
      'vitals:presence',
      JSON.stringify({
        deviceId: session.deviceId,
        patientId: session.patientId,
        timestamp: 1_720_672_000_000,
        someoneExists: true,
        rangeM: 4.5,
        energy: 100,
        source: 'aerosense_assure',
      }),
    );
    expect(redis.set).toHaveBeenCalledWith(
      `presence:${session.patientId}`,
      JSON.stringify({ someoneExists: true, rangeM: 4.5, energy: 100, source: 'aerosense_assure', updatedAt: '2024-07-11T04:26:40.000Z' }),
      'EX',
      120,
    );
  });

  it('stores Assure position and motion details in the motion time series', async () => {
    const prisma = { $executeRaw: jest.fn<(...args: unknown[]) => Promise<number>>().mockResolvedValue(1) };
    const service = new AeroSenseEventService(prisma as never, {} as never, {} as never);

    await service.handleAssurePosition(
      session,
      {
        xM: 1.5,
        yM: 2,
        zM: 0.8,
        motion: { xM: 1.5, yM: 2, zM: 1.8, snrDb: 60 },
        targetCount: 3,
      },
      1_720_672_000_000,
    );

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(String(prisma.$executeRaw.mock.calls[0][0])).toContain('motion_events');
    expect(prisma.$executeRaw.mock.calls[0]).toEqual(
      expect.arrayContaining([
        session.deviceId,
        session.patientId,
        'assure.position',
        expect.stringContaining('"targetCount":3'),
      ]),
    );
  });
});

import { describe, expect, it, jest } from '@jest/globals';
import { AeroSenseEventService } from './aerosense-event.service';

const session = { deviceId: '7b1c8f21-bd66-4a81-8b9f-620e5fed2c76', patientId: 'ce54a4f9-50ad-4527-8652-1edc5daec281' };

describe('AeroSenseEventService Wavve observations', () => {
  it('records bed exit as a system event and informs caregivers', async () => {
    const prisma = { systemEvent: { create: jest.fn<(args: unknown) => Promise<Record<string, never>>>().mockResolvedValue({}) } };
    const redis = { publish: jest.fn<(channel: string, payload: string) => Promise<number>>().mockResolvedValue(1) };
    const service = new AeroSenseEventService(prisma as never, redis as never, {} as never);

    await service.handleWavveObservation(session, { kind: 'bed.exit' }, 1_720_672_000_000);

    expect(prisma.systemEvent.create).toHaveBeenCalledWith({
      data: { deviceId: session.deviceId, type: 'wavve.bed_exit', payload: { patientId: session.patientId, source: 'wavve' } },
    });
    expect(JSON.parse(redis.publish.mock.calls[0][1])).toMatchObject({ type: 'bed.exit', patientId: session.patientId, source: 'wavve' });
  });

  it('persists body-movement energy without creating a clinical alert', async () => {
    const prisma = { $executeRaw: jest.fn<(...args: unknown[]) => Promise<number>>().mockResolvedValue(1) };
    const service = new AeroSenseEventService(prisma as never, {} as never, {} as never);

    await service.handleWavveObservation(session, { kind: 'bed.movement', energy: 95 }, 1_720_672_000_000);

    expect(String(prisma.$executeRaw.mock.calls[0][0])).toContain('motion_events');
    expect(prisma.$executeRaw.mock.calls[0]).toEqual(expect.arrayContaining([session.deviceId, session.patientId, 'wavve.body_movement', 95]));
  });

  it('records Wi-Fi dBm as a device system event', async () => {
    const prisma = { systemEvent: { create: jest.fn<(args: unknown) => Promise<Record<string, never>>>().mockResolvedValue({}) } };
    const service = new AeroSenseEventService(prisma as never, {} as never, {} as never);

    await service.handleWavveObservation(session, { kind: 'system.wifi_signal', dbm: -58 }, 1_720_672_000_000);

    expect(prisma.systemEvent.create).toHaveBeenCalledWith({
      data: { deviceId: session.deviceId, type: 'wavve.wifi_signal', payload: { dbm: -58, source: 'wavve' } },
    });
  });
});

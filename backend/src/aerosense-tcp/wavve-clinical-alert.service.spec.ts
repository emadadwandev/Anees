import { describe, expect, it, jest } from '@jest/globals';
import { AlertStatus, AlertType } from '@prisma/client';
import { AeroSenseEventService } from './aerosense-event.service';

const session = { deviceId: '7b1c8f21-bd66-4a81-8b9f-620e5fed2c76', patientId: 'ce54a4f9-50ad-4527-8652-1edc5daec281' };

describe('AeroSenseEventService Wavve clinical alerts', () => {
  it('deduplicates a device high-heart alert and notifies caregivers once', async () => {
    const alert = { id: '4d8d38a4-a8d9-4dad-93f8-a401c32df3b8' };
    const prisma = {
      alertEvent: { create: jest.fn<(args: unknown) => Promise<typeof alert>>().mockResolvedValue(alert) },
      auditLog: { create: jest.fn<(args: unknown) => Promise<Record<string, never>>>().mockResolvedValue({}) },
    };
    const redis = {
      set: jest.fn<(key: string, value: string, mode: string, seconds: number, condition: string) => Promise<string | null>>()
        .mockResolvedValueOnce('OK').mockResolvedValueOnce(null),
      publish: jest.fn<(channel: string, payload: string) => Promise<number>>().mockResolvedValue(1),
    };
    const service = new AeroSenseEventService(prisma as never, redis as never, {} as never);

    await service.handleWavveClinicalAlert(session, 'vital.high_heart', 1_720_672_000_000);
    await service.handleWavveClinicalAlert(session, 'vital.high_heart', 1_720_672_000_001);

    expect(redis.set).toHaveBeenCalledWith(`wavve:alert:${session.deviceId}:vital.high_heart`, '1', 'EX', 300, 'NX');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ deviceId: session.deviceId, patientId: session.patientId, type: AlertType.vital_anomaly, status: AlertStatus.dispatched }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(redis.publish).toHaveBeenCalledTimes(1);
    expect(JSON.parse(redis.publish.mock.calls[0][1])).toMatchObject({
      type: 'vital.high_heart', alertId: alert.id, patientId: session.patientId, source: 'wavve',
    });
  });
});

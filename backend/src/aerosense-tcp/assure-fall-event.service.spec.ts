import { describe, expect, it, jest } from '@jest/globals';
import { AlertStatus, AlertType } from '@prisma/client';
import { AeroSenseEventService } from './aerosense-event.service';

const session = {
  deviceId: '7b1c8f21-bd66-4a81-8b9f-620e5fed2c76',
  patientId: 'ce54a4f9-50ad-4527-8652-1edc5daec281',
};

describe('AeroSenseEventService Assure falls', () => {
  it('creates and queues a device-scoped pending fall with coordinates', async () => {
    const alert = { id: '4d8d38a4-a8d9-4dad-93f8-a401c32df3b8' };
    const prisma = {
      alertEvent: {
        findFirst: jest.fn<(args: unknown) => Promise<null>>().mockResolvedValue(null),
        create: jest.fn<(args: unknown) => Promise<typeof alert>>().mockResolvedValue(alert),
      },
      auditLog: { create: jest.fn<() => Promise<Record<string, never>>>().mockResolvedValue({}) },
    };
    const redis = { publish: jest.fn<(channel: string, payload: string) => Promise<number>>().mockResolvedValue(1) };
    const queue = {
      add: jest
        .fn<(name: string, data: unknown, options: unknown) => Promise<{ id: string }>>()
        .mockResolvedValue({ id: 'fall-alert-1' }),
    };
    const service = new AeroSenseEventService(prisma as never, redis as never, queue as never);

    await service.handleAssureFall(session, { xM: 3, yM: 5 }, 1_720_672_000_000);

    expect(prisma.alertEvent.findFirst).toHaveBeenCalledWith({
      where: { deviceId: session.deviceId, type: AlertType.fall, status: AlertStatus.pending_cancellation },
    });
    expect(prisma.alertEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deviceId: session.deviceId,
        patientId: session.patientId,
        type: AlertType.fall,
        status: AlertStatus.pending_cancellation,
        notes: 'AeroSense Assure fall coordinates: x=3m, y=5m',
      }),
    });
    expect(queue.add).toHaveBeenCalledWith(
      'fall-alert-dispatch',
      { alertId: alert.id, patientId: session.patientId, deviceId: session.deviceId },
      { delay: 10_000, jobId: `fall-alert-${alert.id}` },
    );
    expect(redis.publish).toHaveBeenCalledTimes(2);
    expect(JSON.parse(redis.publish.mock.calls[0][1])).toMatchObject({
      type: 'fall.detected',
      alertId: alert.id,
      patientId: session.patientId,
      source: 'aerosense_assure',
      coordinates: { xM: 3, yM: 5 },
    });
  });

  it('cancels only the newest pending fall for the reporting device', async () => {
    const pendingAlert = { id: '4d8d38a4-a8d9-4dad-93f8-a401c32df3b8' };
    const job = { data: { alertId: pendingAlert.id }, remove: jest.fn<() => Promise<void>>().mockResolvedValue() };
    const prisma = {
      alertEvent: {
        findFirst: jest.fn<(args: unknown) => Promise<typeof pendingAlert>>().mockResolvedValue(pendingAlert),
        update: jest.fn<(args: unknown) => Promise<typeof pendingAlert>>().mockResolvedValue(pendingAlert),
      },
    };
    const redis = { publish: jest.fn<(channel: string, payload: string) => Promise<number>>().mockResolvedValue(1) };
    const queue = { getJobs: jest.fn<() => Promise<typeof job[]>>().mockResolvedValue([job]) };
    const service = new AeroSenseEventService(prisma as never, redis as never, queue as never);

    await service.handleAssureFallElimination(session);

    expect(prisma.alertEvent.findFirst).toHaveBeenCalledWith({
      where: { deviceId: session.deviceId, type: AlertType.fall, status: AlertStatus.pending_cancellation },
      orderBy: { triggeredAt: 'desc' },
    });
    expect(job.remove).toHaveBeenCalledTimes(1);
    expect(prisma.alertEvent.update).toHaveBeenCalledWith({
      where: { id: pendingAlert.id },
      data: { status: AlertStatus.cancelled_by_user, cancelledByUser: true },
    });
  });
});

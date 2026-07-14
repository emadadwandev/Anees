import { describe, expect, it, jest } from '@jest/globals';
import { AlertOrchestrationService } from './alert-orchestration.service';

describe('AlertOrchestrationService management-state gating', () => {
  it('suppresses fall escalation for a maintenance device', async () => {
    const prisma = {
      device: {
        findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>()
          .mockResolvedValue({ roomLabel: 'Bedroom', managementState: 'maintenance', userId: 'patient-1', deprovisionedAt: null }),
      },
      alertEvent: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const redis = { duplicate: jest.fn(), publish: jest.fn() };
    const service = new AlertOrchestrationService(
      redis as never,
      { add: jest.fn() } as never,
      prisma as never,
      {} as never,
      { allowClinicalProcessing: jest.fn().mockReturnValue(false) } as never,
    );

    await (service as any).handleAlertMessage('alerts:caregiver', JSON.stringify({
      type: 'fall_candidate',
      device_id: 'device-1',
      patient_id: 'patient-1',
      timestamp: Date.now(),
      confidence: 0.9,
    }));

    expect(prisma.alertEvent.create).not.toHaveBeenCalled();
    expect(redis.publish).not.toHaveBeenCalled();
  });
});

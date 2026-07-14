import { describe, expect, it, jest } from '@jest/globals';
import { HardwareDeviceService } from './hardware-device.service';

describe('HardwareDeviceService assignment handling', () => {
  it('updates connectivity without publishing a patient alert for unassigned devices', async () => {
    const prisma = { device: { update: jest.fn<(...args: unknown[]) => Promise<unknown>>() } };
    const redis = { publish: jest.fn<(...args: unknown[]) => Promise<number>>() };
    const service = new HardwareDeviceService(
      { get: jest.fn() } as never,
      prisma as never,
      {} as never,
      { mqttMessagesReceived: { inc: jest.fn() } } as never,
      redis as never,
      {} as never,
    );

    await (service as any).handleOnlineStatus(
      { id: 'device-1', serial: 'SERIAL-1', userId: null },
      { online: '0' },
    );

    expect(prisma.device.update).toHaveBeenCalled();
    expect(redis.publish).not.toHaveBeenCalled();
  });

  it('suppresses disabled hardware telemetry before clinical handlers', async () => {
    const prisma = {
      device: {
        update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
      systemEvent: { create: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
    };
    const service = new HardwareDeviceService(
      { get: jest.fn() } as never,
      prisma as never,
      {
        resolveDeviceBySerial: jest.fn<(...args: unknown[]) => Promise<unknown>>()
          .mockResolvedValue({ id: 'device-1', serial: 'SERIAL-1', userId: 'patient-1', managementState: 'disabled', deprovisionedAt: null }),
      } as never,
      { mqttMessagesReceived: { inc: jest.fn() } } as never,
      { publish: jest.fn(), set: jest.fn(), get: jest.fn() } as never,
      {} as never,
      { acceptTelemetry: jest.fn().mockReturnValue(false), allowClinicalProcessing: jest.fn() } as never,
    );

    await (service as any).handleMessage(
      '/Radar60FL/SERIAL-1/sys/property/post',
      JSON.stringify({ version: '1.0', method: 'post', params: { online: '1' } }),
    );

    expect(prisma.device.update).not.toHaveBeenCalled();
    expect(prisma.systemEvent.create).toHaveBeenCalledWith({
      data: {
        deviceId: 'device-1',
        type: 'device.ingress_suppressed',
        payload: { transport: 'mqtt_hardware', reason: 'disabled' },
      },
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createAdminApi, normalizeDevice } from './api';

describe('admin API contract', () => {
  it('normalizes device responses without secrets or raw payloads', () => {
    const device = normalizeDevice({
      id: 'device-uuid',
      serial: 'AS-001',
      firmwareVersion: '1.2.3',
      roomLabel: 'Bedroom',
      transport: 'aerosense_tcp',
      deviceType: 'wavve',
      managementState: 'enabled',
      managementStateReason: null,
      status: 'online',
      userId: null,
      deprovisionedAt: null,
      password: 'must-not-leak',
      rawPayload: { heartRate: 80 },
    });

    expect(device).toEqual({
      id: 'device-uuid',
      serial: 'AS-001',
      firmwareVersion: '1.2.3',
      roomLabel: 'Bedroom',
      transport: 'aerosense_tcp',
      deviceType: 'wavve',
      managementState: 'enabled',
      managementStateReason: null,
      status: 'online',
      userId: null,
      deprovisionedAt: null,
    });
    expect(device).not.toHaveProperty('password');
    expect(device).not.toHaveProperty('rawPayload');
  });

  it('attaches the bearer token to device requests', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    const api = createAdminApi('admin-token', fetcher);

    await api.listDevices();

    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/v1/super-admin/devices'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      }),
    );
  });
});

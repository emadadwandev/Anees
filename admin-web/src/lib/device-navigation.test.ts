import { describe, expect, it } from 'vitest';
import { getCreatedDeviceRedirectPath, resolveDeviceRouteParams } from './device-navigation';

describe('device navigation', () => {
  it('awaits Next route params before reading the device id', async () => {
    await expect(resolveDeviceRouteParams(Promise.resolve({ id: 'device-uuid' }))).resolves.toEqual({ id: 'device-uuid' });
  });

  it('redirects a newly created device to its detail page with an acknowledgement flag', () => {
    expect(getCreatedDeviceRedirectPath('device/uuid')).toBe('/devices/device%2Fuuid?created=1');
  });
});

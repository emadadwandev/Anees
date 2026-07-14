import { describe, expect, it } from 'vitest';
import { getDeviceLabelText } from './device-uuid-card';

describe('device UUID card', () => {
  it('builds a physical-box label containing the immutable UUID', () => {
    expect(getDeviceLabelText('device-uuid', 'AS-001')).toContain('UUID: device-uuid');
    expect(getDeviceLabelText('device-uuid', 'AS-001')).toContain('SERIAL: AS-001');
  });
});

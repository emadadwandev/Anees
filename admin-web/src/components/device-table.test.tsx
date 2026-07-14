import { describe, expect, it } from 'vitest';
import { formatDeviceType } from './device-table';

describe('device table sensor labels', () => {
  it('labels the two supported sensor types for fleet operators', () => {
    expect(formatDeviceType('fall_sensor')).toBe('Fall detection');
    expect(formatDeviceType('sleep_sensor')).toBe('Sleep / vitals');
  });
});

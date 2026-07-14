import { describe, expect, it } from 'vitest';
import { validateLifecycleReason } from './device-state-control';

describe('device lifecycle control', () => {
  it('requires a non-empty reason', () => {
    expect(validateLifecycleReason('   ')).toBe(false);
    expect(validateLifecycleReason('scheduled maintenance')).toBe(true);
  });
});

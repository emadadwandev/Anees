import { describe, expect, it } from '@jest/globals';
import { DeviceIngressPolicyService } from './device-ingress-policy.service';

describe('DeviceIngressPolicyService', () => {
  const policy = new DeviceIngressPolicyService();

  it('accepts enabled and maintenance telemetry but rejects disabled/deprovisioned devices', () => {
    expect(policy.acceptTelemetry({ managementState: 'enabled', deprovisionedAt: null })).toBe(true);
    expect(policy.acceptTelemetry({ managementState: 'maintenance', deprovisionedAt: null })).toBe(true);
    expect(policy.acceptTelemetry({ managementState: 'disabled', deprovisionedAt: null })).toBe(false);
    expect(policy.acceptTelemetry({ managementState: 'enabled', deprovisionedAt: new Date() })).toBe(false);
  });

  it('allows clinical processing only for enabled assigned devices', () => {
    expect(policy.allowClinicalProcessing({ managementState: 'enabled', userId: 'patient-1', deprovisionedAt: null })).toBe(true);
    expect(policy.allowClinicalProcessing({ managementState: 'maintenance', userId: 'patient-1', deprovisionedAt: null })).toBe(false);
    expect(policy.allowClinicalProcessing({ managementState: 'enabled', userId: null, deprovisionedAt: null })).toBe(false);
    expect(policy.allowClinicalProcessing({ managementState: 'disabled', userId: 'patient-1', deprovisionedAt: null })).toBe(false);
  });
});

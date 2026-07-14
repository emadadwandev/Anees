import { Injectable } from '@nestjs/common';
import { DeviceManagementState } from '@prisma/client';

interface ManagedDeviceState {
  managementState: DeviceManagementState;
  userId?: string | null;
  deprovisionedAt?: Date | null;
}

@Injectable()
export class DeviceIngressPolicyService {
  acceptTelemetry(device: ManagedDeviceState): boolean {
    const state = device.managementState ?? DeviceManagementState.enabled;
    return !device.deprovisionedAt && state !== DeviceManagementState.disabled;
  }

  allowClinicalProcessing(device: ManagedDeviceState): boolean {
    const state = device.managementState ?? DeviceManagementState.enabled;
    return this.acceptTelemetry(device)
      && state === DeviceManagementState.enabled
      && Boolean(device.userId);
  }
}

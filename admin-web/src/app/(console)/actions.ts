'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdminApi } from '@/lib/api';
import { getCreatedDeviceRedirectPath } from '@/lib/device-navigation';

export async function createDeviceAction(formData: FormData) {
  const api = await getAdminApi();
  const device = await api.createDevice({
    serial: String(formData.get('serial') ?? ''),
    firmwareVersion: String(formData.get('firmwareVersion') ?? ''),
    roomLabel: String(formData.get('roomLabel') ?? ''),
    deviceType: String(formData.get('deviceType') ?? 'fall_sensor') as 'fall_sensor' | 'sleep_sensor',
    transport: String(formData.get('transport') ?? 'mqtt') as 'mqtt' | 'aerosense_tcp',
    vendor: String(formData.get('vendor') ?? '') || undefined,
    externalId: String(formData.get('externalId') ?? '') || undefined,
  });
  revalidatePath('/');
  revalidatePath('/devices');
  redirect(getCreatedDeviceRedirectPath(device.id));
}

export async function transitionDeviceAction(deviceId: string, formData: FormData) {
  const api = await getAdminApi();
  const state = String(formData.get('state') ?? 'enabled') as 'enabled' | 'maintenance' | 'disabled';
  const reason = String(formData.get('reason') ?? '');
  await api.transitionDevice(deviceId, state, reason);
  revalidatePath('/');
  revalidatePath('/devices');
  revalidatePath(`/devices/${deviceId}`);
}

export async function deprovisionDeviceAction(deviceId: string, formData: FormData) {
  const api = await getAdminApi();
  await api.deprovisionDevice(deviceId, String(formData.get('reason') ?? ''));
  revalidatePath('/');
  revalidatePath('/devices');
  revalidatePath(`/devices/${deviceId}`);
}

export async function executeCommandAction(deviceId: string, formData: FormData) {
  const api = await getAdminApi();
  const command = String(formData.get('command') ?? '');
  const rawValue = String(formData.get('value') ?? '');
  const key = command.startsWith('wavve.report_interval') ? 'ticks' : command.startsWith('wavve.bed_exit_timer') ? 'seconds' : command.startsWith('assure.installation_height') || command.startsWith('assure.working_range') ? 'meters' : 'seconds';
  const values = command.endsWith('.get') ? {} : command.endsWith('fall_mode.set') ? { mode: rawValue } : { [key]: Number(rawValue) };
  await api.executeCommand(deviceId, command, values);
}

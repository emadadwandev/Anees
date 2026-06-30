import axios, { AxiosError } from 'axios';
import { getSession, signOut } from 'next-auth/react';
import type {
  Patient,
  PatientDetail,
  VitalReading,
  SleepReport,
  AlertEvent,
  Device,
  AdminPatient,
  FacilityStats,
  AdminAlertEvent,
  FacilityAnalytics,
} from './types';
import { mockVitalHistory, mockSleepReport, MOCK_PATIENT_DETAILS, MOCK_ALERT_HISTORY as MOCK_ALERT_HIST } from './mock-data';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const session = await getSession();
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await signOut({ callbackUrl: '/login' });
    }
    const message =
      (error.response?.data as { message?: string })?.message ??
      error.message ??
      'Network error';
    throw new AppError(message, error.response?.status);
  },
);

export async function getPatients(): Promise<Patient[]> {
  try {
    const { data } = await apiClient.get<Patient[]>('/v1/patients');
    const list = Array.isArray(data) ? data : [];
    // deduplicate by id in case the backend returns duplicates
    return [...new Map(list.map((p) => [p.id, p])).values()];
  } catch {
    return MOCK_PATIENT_DETAILS;
  }
}

export async function getPatient(id: string): Promise<PatientDetail> {
  try {
    const { data } = await apiClient.get<PatientDetail>(`/v1/patients/${id}`);
    return data;
  } catch {
    const mock = MOCK_PATIENT_DETAILS.find((p) => p.id === id);
    if (!mock) throw new AppError('Patient not found', 404);
    return mock;
  }
}

export async function getVitalHistory(
  patientId: string,
  range: string,
  resolution: string,
): Promise<VitalReading[]> {
  try {
    const { data } = await apiClient.get<VitalReading[]>(
      `/v1/patients/${patientId}/vitals/history`,
      { params: { range, resolution } },
    );
    return data;
  } catch {
    return mockVitalHistory(patientId, range);
  }
}

export async function getSleepReport(
  patientId: string,
  date: string,
): Promise<SleepReport> {
  try {
    const { data } = await apiClient.get<SleepReport>(
      `/v1/patients/${patientId}/sleep/report`,
      { params: { date } },
    );
    return data;
  } catch {
    return mockSleepReport(patientId);
  }
}

export async function getAlerts(patientId?: string): Promise<AlertEvent[]> {
  try {
    const { data } = await apiClient.get<AlertEvent[]>('/v1/patients/alerts', {
      params: patientId ? { patientId } : undefined,
    });
    return Array.isArray(data) ? data : [];
  } catch {
    const { MOCK_ALERT_HISTORY } = await import('./mock-data');
    return patientId
      ? MOCK_ALERT_HISTORY.filter((a) => a.patientId === patientId)
      : MOCK_ALERT_HISTORY;
  }
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  await apiClient.post(`/v1/alerts/${alertId}/acknowledge`);
}

export async function resolveAlert(alertId: string, notes?: string): Promise<void> {
  await apiClient.post(`/v1/alerts/${alertId}/resolve`, { notes });
}

export async function markFalseAlarm(alertId: string, notes?: string): Promise<void> {
  await apiClient.post(`/v1/alerts/${alertId}/false-alarm`, { notes });
}

export async function getIntercomToken(
  patientId: string,
): Promise<{ token: string; url: string }> {
  const { data } = await apiClient.post<{ token: string; url: string }>(
    '/v1/intercom/token',
    { patientId },
  );
  return data;
}

export async function exportVitalsCSV(
  patientId: string,
  start: string,
  end: string,
): Promise<Blob> {
  try {
    const { data } = await apiClient.get<Blob>('/v1/reports/vitals/export', {
      params: { patient_id: patientId, start, end },
      responseType: 'blob',
    });
    return data;
  } catch {
    const readings = mockVitalHistory(patientId, '30d').filter((r) => {
      const t = r.time;
      return t >= start && t <= end + 'T23:59:59Z';
    });
    const header = 'time,heartRateBpm,respRateBrpm,signalQuality\n';
    const rows = readings
      .map((r) => `${r.time},${r.heartRateBpm},${r.respRateBrpm},${r.signalQuality.toFixed(3)}`)
      .join('\n');
    return new Blob([header + rows], { type: 'text/csv' });
  }
}

export async function getDevices(): Promise<Device[]> {
  const { data } = await apiClient.get<Device[]>('/v1/devices');
  return data;
}

export async function updateDeviceRoom(deviceId: string, roomLabel: string): Promise<void> {
  await apiClient.patch(`/v1/devices/${deviceId}`, { roomLabel });
}

export async function getPatientAlerts(patientId: string): Promise<AlertEvent[]> {
  try {
    const { data } = await apiClient.get<AlertEvent[]>(`/v1/patients/${patientId}/alerts`);
    return Array.isArray(data) ? data : [];
  } catch {
    return MOCK_ALERT_HIST.filter((a) => a.patientId === patientId);
  }
}

// ── Admin dashboard ───────────────────────────────────────────────────────

export async function getAdminStats(): Promise<FacilityStats> {
  const { data } = await apiClient.get<FacilityStats>('/v1/admin/stats');
  return data;
}

export async function getAdminPatients(): Promise<AdminPatient[]> {
  const { data } = await apiClient.get<AdminPatient[]>('/v1/admin/patients');
  return data;
}

export async function getAdminActiveAlerts(): Promise<AdminAlertEvent[]> {
  const { data } = await apiClient.get<AdminAlertEvent[]>('/v1/admin/alerts/active');
  return data;
}

export async function getAdminAlertHistory(limit = 50): Promise<AdminAlertEvent[]> {
  const { data } = await apiClient.get<AdminAlertEvent[]>('/v1/admin/alerts/history', {
    params: { limit },
  });
  return data;
}

export async function getAdminAnalytics(): Promise<FacilityAnalytics> {
  const { data } = await apiClient.get<FacilityAnalytics>('/v1/admin/analytics');
  return data;
}

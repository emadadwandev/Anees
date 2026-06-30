import type { AdminPatient, FacilityStats, AdminAlertEvent, FacilityAnalytics, PatientDetail, VitalReading, SleepReport } from './types';

const now = new Date();
const ago = (mins: number) => new Date(now.getTime() - mins * 60_000).toISOString();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString().split('T')[0];

export const MOCK_PATIENTS: AdminPatient[] = [
  {
    id: 'p1', name: 'Margaret Hassan', age: 82, roomLabel: '101-A',
    deviceStatus: 'online', alertStatus: 'ok', occlusionStatus: 'none',
    signalQuality: 0.91, lastHeartbeat: ago(1), latestHr: 68, latestRr: 15,
    device: { id: 'd1', serial: 'ANS-0041', firmwareVersion: '2.4.1' },
  },
  {
    id: 'p2', name: 'Karim Al-Rashid', age: 75, roomLabel: '102-B',
    deviceStatus: 'online', alertStatus: 'vital_anomaly', occlusionStatus: 'none',
    signalQuality: 0.78, lastHeartbeat: ago(2), latestHr: 112, latestRr: 22,
    device: { id: 'd2', serial: 'ANS-0038', firmwareVersion: '2.4.1' },
  },
  {
    id: 'p3', name: 'Fatima Al-Sayed', age: 88, roomLabel: '103-A',
    deviceStatus: 'online', alertStatus: 'fall_active', occlusionStatus: 'none',
    signalQuality: 0.85, lastHeartbeat: ago(0), latestHr: 94, latestRr: 20,
    device: { id: 'd3', serial: 'ANS-0052', firmwareVersion: '2.4.1' },
  },
  {
    id: 'p4', name: 'Ibrahim Nour', age: 71, roomLabel: '104-C',
    deviceStatus: 'offline', alertStatus: 'system_offline', occlusionStatus: 'none',
    signalQuality: null, lastHeartbeat: ago(47), latestHr: null, latestRr: null,
    device: { id: 'd4', serial: 'ANS-0029', firmwareVersion: '2.3.8' },
  },
  {
    id: 'p5', name: 'Laila Mansour', age: 79, roomLabel: '105-B',
    deviceStatus: 'online', alertStatus: 'ok', occlusionStatus: 'none',
    signalQuality: 0.67, lastHeartbeat: ago(3), latestHr: 72, latestRr: 16,
    device: { id: 'd5', serial: 'ANS-0044', firmwareVersion: '2.4.1' },
  },
  {
    id: 'p6', name: 'Ahmed Khalil', age: 84, roomLabel: '106-A',
    deviceStatus: 'online', alertStatus: 'ok', occlusionStatus: 'none',
    signalQuality: 0.94, lastHeartbeat: ago(1), latestHr: 61, latestRr: 14,
    device: { id: 'd6', serial: 'ANS-0033', firmwareVersion: '2.4.1' },
  },
  {
    id: 'p7', name: 'Nadia Fouad', age: 77, roomLabel: '107-C',
    deviceStatus: 'online', alertStatus: 'vital_anomaly', occlusionStatus: 'partial',
    signalQuality: 0.53, lastHeartbeat: ago(4), latestHr: 48, latestRr: 11,
    device: { id: 'd7', serial: 'ANS-0057', firmwareVersion: '2.4.1' },
  },
  {
    id: 'p8', name: 'Youssef Barakat', age: 90, roomLabel: '108-B',
    deviceStatus: 'online', alertStatus: 'ok', occlusionStatus: 'none',
    signalQuality: 0.88, lastHeartbeat: ago(2), latestHr: 74, latestRr: 17,
    device: { id: 'd8', serial: 'ANS-0061', firmwareVersion: '2.4.1' },
  },
  {
    id: 'p9', name: 'Samira Eid', age: 73, roomLabel: '109-A',
    deviceStatus: 'offline', alertStatus: 'system_offline', occlusionStatus: 'none',
    signalQuality: null, lastHeartbeat: ago(130), latestHr: null, latestRr: null,
    device: { id: 'd9', serial: 'ANS-0048', firmwareVersion: '2.3.8' },
  },
  {
    id: 'p10', name: 'Omar Tawfik', age: 80, roomLabel: '110-C',
    deviceStatus: 'online', alertStatus: 'ok', occlusionStatus: 'none',
    signalQuality: 0.82, lastHeartbeat: ago(1), latestHr: 66, latestRr: 15,
    device: { id: 'd10', serial: 'ANS-0036', firmwareVersion: '2.4.1' },
  },
  {
    id: 'p11', name: 'Hana Al-Masri', age: 85, roomLabel: '111-B',
    deviceStatus: 'online', alertStatus: 'ok', occlusionStatus: 'none',
    signalQuality: 0.76, lastHeartbeat: ago(5), latestHr: 70, latestRr: 16,
    device: { id: 'd11', serial: 'ANS-0071', firmwareVersion: '2.4.1' },
  },
  {
    id: 'p12', name: 'Tarek Salama', age: 68, roomLabel: '112-A',
    deviceStatus: 'online', alertStatus: 'ok', occlusionStatus: 'none',
    signalQuality: 0.96, lastHeartbeat: ago(1), latestHr: 58, latestRr: 13,
    device: { id: 'd12', serial: 'ANS-0042', firmwareVersion: '2.4.1' },
  },
];

export const MOCK_STATS: FacilityStats = {
  totalPatients: 12,
  onlineDevices: 10,
  offlineDevices: 2,
  activeAlerts: 1,
  warnings: 2,
  avgSignalQuality: 82,
};

export const MOCK_ACTIVE_ALERTS: AdminAlertEvent[] = [
  {
    id: 'a1',
    patientId: 'p3',
    patientName: 'Fatima Al-Sayed',
    patientRoom: '103-A',
    type: 'fall',
    status: 'dispatched',
    triggeredAt: ago(8),
    responseTimeSec: null,
  },
  {
    id: 'a2',
    patientId: 'p2',
    patientName: 'Karim Al-Rashid',
    patientRoom: '102-B',
    type: 'vital_anomaly',
    status: 'acknowledged',
    triggeredAt: ago(22),
    responseTimeSec: 240,
  },
];

export const MOCK_ALERT_HISTORY: AdminAlertEvent[] = [
  ...MOCK_ACTIVE_ALERTS,
  {
    id: 'a3', patientId: 'p7', patientName: 'Nadia Fouad', patientRoom: '107-C',
    type: 'vital_anomaly', status: 'resolved', triggeredAt: ago(180), responseTimeSec: 195,
  },
  {
    id: 'a4', patientId: 'p4', patientName: 'Ibrahim Nour', patientRoom: '104-C',
    type: 'vital_anomaly', status: 'false_alarm', triggeredAt: ago(300), responseTimeSec: 85,
  },
  {
    id: 'a5', patientId: 'p1', patientName: 'Margaret Hassan', patientRoom: '101-A',
    type: 'fall', status: 'resolved', triggeredAt: ago(420), responseTimeSec: 167,
  },
  {
    id: 'a6', patientId: 'p10', patientName: 'Omar Tawfik', patientRoom: '110-C',
    type: 'vital_anomaly', status: 'resolved', triggeredAt: ago(600), responseTimeSec: 312,
  },
];

export const MOCK_ANALYTICS: FacilityAnalytics = {
  alertsByDay: [
    { day: daysAgo(6), count: 3 },
    { day: daysAgo(5), count: 5 },
    { day: daysAgo(4), count: 2 },
    { day: daysAgo(3), count: 7 },
    { day: daysAgo(2), count: 4 },
    { day: daysAgo(1), count: 6 },
    { day: daysAgo(0), count: 2 },
  ],
  alertsByType: [
    { type: 'fall', count: 8 },
    { type: 'vital_anomaly', count: 21 },
  ],
  avgResponseSec: 186,
};

export const MOCK_PATIENT_DETAILS: PatientDetail[] = MOCK_PATIENTS.map((p) => ({
  id: p.id,
  name: p.name,
  age: p.age ?? 0,
  roomLabel: p.roomLabel,
  role: 'care_receiver' as const,
  deviceStatus: p.deviceStatus,
  alertStatus: p.alertStatus,
  lastSeen: p.lastHeartbeat ?? ago(5),
  latestHr: p.latestHr ?? undefined,
  latestRr: p.latestRr ?? undefined,
  device: {
    id: p.device?.id ?? `d-${p.id}`,
    serial: p.device?.serial ?? 'ANS-0000',
    firmwareVersion: p.device?.firmwareVersion ?? '2.4.1',
    roomLabel: p.roomLabel,
    status: p.deviceStatus,
    lastHeartbeat: p.lastHeartbeat,
    signalQuality: p.signalQuality,
    occlusionStatus: p.occlusionStatus,
  },
  thresholds: { hrMin: 50, hrMax: 100, rrMin: 12, rrMax: 20 },
}));

function seed(patientId: string): number {
  let h = 0;
  for (let i = 0; i < patientId.length; i++) h = (Math.imul(31, h) + patientId.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pseudoRand(n: number): number {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

export function mockVitalHistory(patientId: string, range: string): VitalReading[] {
  const RANGE_MINS: Record<string, number> = { '6h': 360, '24h': 1440, '7d': 10080, '30d': 43200 };
  const totalMins = RANGE_MINS[range] ?? 1440;
  const stepMins = totalMins <= 360 ? 1 : totalMins <= 1440 ? 5 : totalMins <= 10080 ? 30 : 120;
  const baseHr = 60 + (seed(patientId) % 20);
  const baseRr = 13 + (seed(patientId + 'rr') % 6);
  const points: VitalReading[] = [];
  const endMs = Date.now();
  const steps = Math.round(totalMins / stepMins);
  for (let i = 0; i < steps; i++) {
    const r = pseudoRand(seed(patientId) + i);
    const r2 = pseudoRand(seed(patientId + 'rr') + i);
    points.push({
      time: new Date(endMs - (steps - i) * stepMins * 60_000).toISOString(),
      heartRateBpm: Math.round(baseHr + (r - 0.5) * 20),
      respRateBrpm: Math.round(baseRr + (r2 - 0.5) * 6),
      signalQuality: 0.8 + pseudoRand(seed(patientId + 'sq') + i) * 0.2,
    });
  }
  return points;
}

export function mockSleepReport(patientId: string): SleepReport {
  const r = pseudoRand(seed(patientId));
  const deepPct = 15 + r * 10;
  const remPct = 20 + pseudoRand(seed(patientId + 'rem')) * 10;
  const awakePct = 5 + pseudoRand(seed(patientId + 'aw')) * 8;
  const lightPct = 100 - deepPct - remPct - awakePct;
  return {
    date: new Date().toISOString().split('T')[0],
    totalSleepMin: Math.round(360 + r * 120),
    deepPct: +deepPct.toFixed(1),
    lightPct: +lightPct.toFixed(1),
    remPct: +remPct.toFixed(1),
    awakePct: +awakePct.toFixed(1),
    fragmentationIndex: +(0.1 + pseudoRand(seed(patientId + 'fi')) * 0.4).toFixed(2),
    qualityLabel: r > 0.6 ? 'good' : r > 0.3 ? 'restless' : 'poor',
  };
}

export type Role = 'care_receiver' | 'caregiver' | 'admin';
export type AlertType = 'fall' | 'vital_anomaly';
export type AlertStatus =
  | 'pending_cancellation'
  | 'cancelled_by_user'
  | 'dispatched'
  | 'acknowledged'
  | 'resolved'
  | 'false_alarm';
export type AlertPriority = 'fall_active' | 'vital_anomaly' | 'system_offline' | 'ok';
export type SleepStage = 'deep' | 'light' | 'rem' | 'awake';
export type DeviceStatus = 'online' | 'offline' | 'maintenance';
export type OcclusionStatus = 'none' | 'partial' | 'full';
export type SleepQuality = 'good' | 'restless' | 'poor';
export type TimeRange = '6h' | '24h' | '7d' | '30d';
export type VitalMetric = 'hr' | 'rr' | 'both';

export interface Device {
  id: string;
  serial: string;
  firmwareVersion: string;
  roomLabel: string;
  status: DeviceStatus;
  lastHeartbeat: string | null;
  signalQuality: number | null;
  occlusionStatus: OcclusionStatus;
  patientName?: string;
}

export interface PatientThreshold {
  hrMin: number;
  hrMax: number;
  rrMin: number;
  rrMax: number;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  roomLabel: string;
  role: Role;
  deviceStatus: DeviceStatus;
  alertStatus: AlertPriority;
  lastSeen: string;
  latestHr?: number;
  latestRr?: number;
  lastSleepQuality?: SleepQuality;
}

export interface PatientDetail extends Patient {
  device: Device;
  thresholds: PatientThreshold;
}

export interface VitalReading {
  time: string;
  heartRateBpm: number;
  respRateBrpm: number;
  signalQuality: number;
}

export interface AlertEvent {
  id: string;
  patientId: string;
  patientName?: string;
  patientRoom?: string;
  type: AlertType;
  status: AlertStatus;
  triggeredAt: string;
  resolvedAt?: string;
  notes?: string;
}

export interface SleepReport {
  date: string;
  totalSleepMin: number;
  deepPct: number;
  lightPct: number;
  remPct: number;
  awakePct: number;
  fragmentationIndex: number;
  qualityLabel: SleepQuality;
  epochs?: { time: string; stage: SleepStage; durationSec: number }[];
}

// Admin dashboard types
export interface AdminPatient {
  id: string;
  name: string;
  age: number | null;
  roomLabel: string;
  deviceStatus: DeviceStatus;
  alertStatus: AlertPriority;
  occlusionStatus: OcclusionStatus;
  signalQuality: number | null;
  lastHeartbeat: string | null;
  latestHr: number | null;
  latestRr: number | null;
  device: { id: string; serial: string; firmwareVersion: string } | null;
}

export interface FacilityStats {
  totalPatients: number;
  onlineDevices: number;
  offlineDevices: number;
  activeAlerts: number;
  warnings: number;
  avgSignalQuality: number;
}

export interface AdminAlertEvent extends AlertEvent {
  patientRoom: string;
  responseTimeSec?: number | null;
}

export interface FacilityAnalytics {
  alertsByDay: { day: string; count: number }[];
  alertsByType: { type: string; count: number }[];
  avgResponseSec: number | null;
}

// Socket event payloads
export interface VitalsUpdate {
  patientId: string;
  hr: number;
  rr: number;
  timestamp: string;
  quality: number;
}

export interface FallDetected {
  patientId: string;
  alertId: string;
  room: string;
  detectedAt: string;
}

export interface AlertStateChange {
  alertId: string;
  patientId: string;
  state: AlertStatus;
  updatedAt: string;
}

export interface DeviceOffline {
  deviceId: string;
  patientId: string;
  lastSeen: string;
}

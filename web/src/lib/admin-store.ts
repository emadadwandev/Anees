'use client';

import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import type {
  AdminPatient,
  FacilityStats,
  AdminAlertEvent,
  AlertStatus,
  VitalsUpdate,
  DeviceOffline,
} from './types';

interface LiveVital {
  hr: number;
  rr: number;
  quality: number;
  ts: string;
}

interface AdminStore {
  // Data
  patients: AdminPatient[];
  stats: FacilityStats | null;
  activeAlerts: AdminAlertEvent[];
  liveVitals: Record<string, LiveVital>;
  unreadAlerts: number;

  // Sockets
  caregiverSocket: Socket | null;
  vitalsSocket: Socket | null;

  // Actions
  setPatients: (patients: AdminPatient[]) => void;
  setStats: (stats: FacilityStats) => void;
  setActiveAlerts: (alerts: AdminAlertEvent[]) => void;
  setCaregiverSocket: (s: Socket | null) => void;
  setVitalsSocket: (s: Socket | null) => void;

  // Real-time mutations
  upsertVital: (patientId: string, vital: LiveVital) => void;
  addAlert: (alert: AdminAlertEvent) => void;
  updateAlertStatus: (alertId: string, status: AlertStatus) => void;
  removeAlert: (alertId: string) => void;
  setDeviceOffline: (patientId: string) => void;
  clearUnread: () => void;
}

export const useAdminStore = create<AdminStore>((set) => ({
  patients: [],
  stats: null,
  activeAlerts: [],
  liveVitals: {},
  unreadAlerts: 0,
  caregiverSocket: null,
  vitalsSocket: null,

  setPatients: (patients) => set({ patients }),
  setStats: (stats) => set({ stats }),
  setActiveAlerts: (activeAlerts) => set({ activeAlerts }),
  setCaregiverSocket: (caregiverSocket) => set({ caregiverSocket }),
  setVitalsSocket: (vitalsSocket) => set({ vitalsSocket }),

  upsertVital: (patientId, vital) =>
    set((s) => ({
      liveVitals: { ...s.liveVitals, [patientId]: vital },
      // Also update latestHr/latestRr on the patient row for roster re-render
      patients: s.patients.map((p) =>
        p.id === patientId
          ? { ...p, latestHr: vital.hr, latestRr: vital.rr, signalQuality: vital.quality }
          : p,
      ),
    })),

  addAlert: (alert) =>
    set((s) => {
      const exists = s.activeAlerts.some((a) => a.id === alert.id);
      if (exists) return s;
      const sorted = [alert, ...s.activeAlerts].sort((a, b) => {
        const pri: Record<string, number> = { fall: 0, vital_anomaly: 1 };
        return (pri[a.type] ?? 2) - (pri[b.type] ?? 2);
      });
      return {
        activeAlerts: sorted,
        unreadAlerts: s.unreadAlerts + 1,
        // Update patient alertStatus
        patients: s.patients.map((p) =>
          p.id === alert.patientId
            ? { ...p, alertStatus: alert.type === 'fall' ? 'fall_active' : 'vital_anomaly' }
            : p,
        ),
      };
    }),

  updateAlertStatus: (alertId, status) =>
    set((s) => ({
      activeAlerts: s.activeAlerts.map((a) =>
        a.id === alertId ? { ...a, status } : a,
      ),
    })),

  removeAlert: (alertId) =>
    set((s) => ({
      activeAlerts: s.activeAlerts.filter((a) => a.id !== alertId),
    })),

  setDeviceOffline: (patientId) =>
    set((s) => ({
      patients: s.patients.map((p) =>
        p.id === patientId
          ? { ...p, deviceStatus: 'offline', alertStatus: 'system_offline' }
          : p,
      ),
      stats: s.stats
        ? {
            ...s.stats,
            offlineDevices: s.stats.offlineDevices + 1,
            onlineDevices: Math.max(0, s.stats.onlineDevices - 1),
          }
        : null,
    })),

  clearUnread: () => set({ unreadAlerts: 0 }),
}));

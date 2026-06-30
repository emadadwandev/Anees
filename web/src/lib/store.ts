'use client';

import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import type { AlertEvent, AlertStatus, VitalsUpdate } from './types';

interface DeviceOfflineRecord {
  deviceId: string;
  patientId: string;
  lastSeen: string;
  offlineSince: string;
}

interface AlertStore {
  // ── Alerts ──────────────────────────────────────────────────────────────────
  activeAlerts: AlertEvent[];
  unreadCount: number;

  // ── Live vitals keyed by patientId ──────────────────────────────────────────
  vitalsMap: Record<string, VitalsUpdate>;

  // ── Offline devices ─────────────────────────────────────────────────────────
  offlineDevices: DeviceOfflineRecord[];

  // ── Socket ──────────────────────────────────────────────────────────────────
  socket: Socket | null;

  // ── Actions ─────────────────────────────────────────────────────────────────
  setSocket: (s: Socket) => void;
  addAlert: (alert: AlertEvent) => void;
  updateAlertState: (alertId: string, status: AlertStatus) => void;
  acknowledgeAlert: (alertId: string) => void;
  clearUnread: () => void;
  updateVitals: (update: VitalsUpdate) => void;
  markDeviceOffline: (record: DeviceOfflineRecord) => void;
  markDeviceOnline: (deviceId: string) => void;
}

export const useAlertStore = create<AlertStore>((set) => ({
  activeAlerts: [],
  unreadCount: 0,
  vitalsMap: {},
  offlineDevices: [],
  socket: null,

  setSocket: (socket) => set({ socket }),

  addAlert: (alert) =>
    set((state) => ({
      activeAlerts: [alert, ...state.activeAlerts].sort((a, b) => {
        const priority = { fall: 0, vital_anomaly: 1 } as Record<string, number>;
        return (priority[a.type] ?? 2) - (priority[b.type] ?? 2);
      }),
      unreadCount: state.unreadCount + 1,
    })),

  updateAlertState: (alertId, status) =>
    set((state) => ({
      // Drop from active list once resolved — it moves to history
      activeAlerts: ['resolved', 'false_alarm', 'cancelled_by_user'].includes(status)
        ? state.activeAlerts.filter((a) => a.id !== alertId)
        : state.activeAlerts.map((a) =>
            a.id === alertId ? { ...a, status } : a
          ),
    })),

  acknowledgeAlert: (alertId) =>
    set((state) => ({
      activeAlerts: state.activeAlerts.map((a) =>
        a.id === alertId ? { ...a, status: 'acknowledged' as AlertStatus } : a
      ),
    })),

  clearUnread: () => set({ unreadCount: 0 }),

  updateVitals: (update) =>
    set((state) => ({
      vitalsMap: { ...state.vitalsMap, [update.patientId]: update },
    })),

  markDeviceOffline: (record) =>
    set((state) => ({
      offlineDevices: [
        record,
        ...state.offlineDevices.filter((d) => d.deviceId !== record.deviceId),
      ],
    })),

  markDeviceOnline: (deviceId) =>
    set((state) => ({
      offlineDevices: state.offlineDevices.filter((d) => d.deviceId !== deviceId),
    })),
}));

'use client';

import { useEffect, useState } from 'react';
import { X, Phone, FileText } from 'lucide-react';
import type { AdminPatient, AdminAlertEvent } from '@/lib/types';
import { useAdminStore } from '@/lib/admin-store';
import { getAdminAlertHistory } from '@/lib/api';
import { MOCK_ALERT_HISTORY } from '@/lib/mock-data';

interface Props {
  patient: AdminPatient | null;
  onClose: () => void;
  onCall: (p: AdminPatient) => void;
}

function VitalBox({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string | number;
  unit: string;
  color?: string;
}) {
  return (
    <div className="adm-card px-3.5 py-3 flex flex-col gap-1">
      <span
        className="text-[10px] font-semibold uppercase tracking-[1px]"
        style={{ color: 'var(--adm-t3)' }}
      >
        {label}
      </span>
      <span
        className="text-[28px] font-semibold leading-none font-mono"
        style={{ color: color ?? 'var(--adm-t1)', fontFamily: "'JetBrains Mono', monospace" }}
      >
        {value}
      </span>
      <span className="text-[10px]" style={{ color: 'var(--adm-t3)' }}>
        {unit}
      </span>
    </div>
  );
}

function DeviceField({ label, value }: { label: string; value: string }) {
  return (
    <div className="adm-card px-3 py-2.5">
      <div
        className="text-[9px] font-semibold uppercase tracking-[1px] mb-0.5"
        style={{ color: 'var(--adm-t3)' }}
      >
        {label}
      </div>
      <div className="text-[12px] font-medium" style={{ color: 'var(--adm-t1)' }}>
        {value}
      </div>
    </div>
  );
}

function alertStatusLabel(status: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    resolved:          { label: 'Resolved',    cls: 'adm-badge-green' },
    false_alarm:       { label: 'False Alarm', cls: 'adm-badge-blue'  },
    cancelled_by_user: { label: 'Cancelled',   cls: 'adm-badge-slate' },
    acknowledged:      { label: 'Acknowledged',cls: 'adm-badge-amber' },
    dispatched:        { label: 'Active',      cls: 'adm-badge-red'   },
  };
  return map[status] ?? { label: status, cls: 'adm-badge-slate' };
}

export function PatientDetailPanel({ patient, onClose, onCall }: Props) {
  const liveVitals = useAdminStore((s) => (patient ? s.liveVitals[patient.id] : null));
  const [history, setHistory] = useState<AdminAlertEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!patient) return;
    const mockFiltered = MOCK_ALERT_HISTORY.filter((a) => a.patientId === patient.id).slice(0, 5);
    setHistory(mockFiltered);
    getAdminAlertHistory(100)
      .then((alerts) => setHistory(alerts.filter((a) => a.patientId === patient.id).slice(0, 5)))
      .catch(() => {}); // keep mock data on failure
  }, [patient?.id]);

  const hr = liveVitals?.hr ?? patient?.latestHr ?? null;
  const rr = liveVitals?.rr ?? patient?.latestRr ?? null;
  const quality = liveVitals?.quality ?? patient?.signalQuality ?? null;

  const hrColor =
    hr === null ? 'var(--adm-slate)' : hr < 45 || hr > 110 ? 'var(--adm-red)' : 'var(--adm-green)';
  const rrColor =
    rr === null ? 'var(--adm-slate)' : rr < 8 || rr > 25 ? 'var(--adm-red)' : 'var(--adm-green)';

  const occlusionColor =
    patient?.occlusionStatus === 'none'
      ? 'var(--adm-green)'
      : patient?.occlusionStatus === 'partial'
        ? 'var(--adm-amber)'
        : 'var(--adm-red)';

  const isOpen = patient !== null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(3px)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: 520,
          background: '#0d1425',
          borderLeft: '1px solid var(--adm-border)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '-24px 0 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-start gap-3.5 px-6 pt-5 pb-4 shrink-0"
          style={{ borderBottom: '1px solid var(--adm-border)' }}
        >
          <div
            className="w-[52px] h-[52px] rounded-full shrink-0 flex items-center justify-center text-[20px] font-bold text-white"
            style={{ background: patient ? avatarColor(patient.name) : '#1565c0' }}
          >
            {patient ? initials(patient.name) : ''}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[18px] font-bold leading-tight" style={{ color: 'var(--adm-t1)' }}>
              {patient?.name ?? ''}
            </div>
            <div className="text-[12px] mt-1" style={{ color: 'var(--adm-t3)' }}>
              {patient?.age ? `${patient.age} years · ` : ''}
              {patient?.roomLabel}
              {patient?.device ? ` · ${patient.device.serial}` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-[30px] h-[30px] rounded-lg transition-all shrink-0"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--adm-border)',
              color: 'var(--adm-t3)',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Live vitals */}
          <section>
            <h3
              className="text-[10px] font-semibold uppercase tracking-[1.5px] mb-3"
              style={{ color: 'var(--adm-t3)' }}
            >
              Live Vitals
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <VitalBox label="Heart Rate"   value={hr ?? '—'} unit="BPM"      color={hrColor} />
              <VitalBox label="Respiration"  value={rr ?? '—'} unit="BRPM"     color={rrColor} />
              <VitalBox
                label="Signal Quality"
                value={quality !== null ? `${Math.round(quality * 100)}%` : '—'}
                unit="SNR"
                color="#60a5fa"
              />
              <VitalBox label="Occlusion" value={occlusionLabel(patient?.occlusionStatus)} unit="Sensor" color={occlusionColor} />
            </div>
          </section>

          {/* Device info */}
          {patient?.device && (
            <section>
              <h3
                className="text-[10px] font-semibold uppercase tracking-[1.5px] mb-3"
                style={{ color: 'var(--adm-t3)' }}
              >
                Device
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <DeviceField label="Serial"    value={patient.device.serial} />
                <DeviceField label="Firmware"  value={patient.device.firmwareVersion} />
                <DeviceField
                  label="Status"
                  value={patient.deviceStatus === 'online' ? 'Online' : 'Offline'}
                />
                <DeviceField
                  label="Last Heartbeat"
                  value={patient.lastHeartbeat ? relativeTime(patient.lastHeartbeat) : '—'}
                />
              </div>
            </section>
          )}

          {/* Recent alerts */}
          <section>
            <h3
              className="text-[10px] font-semibold uppercase tracking-[1.5px] mb-3"
              style={{ color: 'var(--adm-t3)' }}
            >
              Recent Alerts
            </h3>
            {loadingHistory ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="adm-card h-14 animate-pulse" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--adm-t3)' }}>
                No recent alerts
              </p>
            ) : (
              <div className="space-y-1.5">
                {history.map((a) => {
                  const { label, cls } = alertStatusLabel(a.status);
                  return (
                    <div
                      key={a.id}
                      className="adm-card px-3 py-2.5 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-[12px] font-semibold" style={{ color: 'var(--adm-t1)' }}>
                          {a.type === 'fall' ? 'Fall Detection' : 'Vital Anomaly'}
                        </div>
                        <div className="text-[11px]" style={{ color: 'var(--adm-t3)' }}>
                          {new Date(a.triggeredAt).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <span className={`adm-badge ${cls}`}>{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Footer actions */}
        <div
          className="flex gap-2 px-6 py-4 shrink-0"
          style={{ borderTop: '1px solid var(--adm-border)' }}
        >
          <button
            onClick={() => patient && onCall(patient)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--adm-border)',
              color: 'var(--adm-t2)',
            }}
          >
            <Phone size={15} />
            Intercom
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--adm-border)',
              color: 'var(--adm-t2)',
            }}
          >
            <FileText size={15} />
            Full Report
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold transition-all"
            style={{
              background: 'var(--adm-blue)',
              border: '1px solid var(--adm-blue)',
              color: '#fff',
            }}
          >
            View Alerts
          </button>
        </div>
      </div>
    </>
  );
}

function occlusionLabel(s?: string): string {
  if (!s || s === 'none') return 'Clear';
  if (s === 'partial') return 'Partial';
  return 'Full';
}

function avatarColor(name: string): string {
  const palette = ['#1565c0', '#4a148c', '#006064', '#33691e', '#880e4f', '#01579b', '#e65100', '#37474f'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return palette[h % palette.length];
}

function initials(name: string): string {
  const parts = name.trim().split(' ');
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

'use client';

import { useState, useEffect } from 'react';
import { Phone, CheckCircle, XCircle, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { useAdminStore } from '@/lib/admin-store';
import { acknowledgeAlert, resolveAlert, markFalseAlarm } from '@/lib/api';
import type { AdminAlertEvent } from '@/lib/types';

interface Props {
  onCall: (patientId: string, room: string) => void;
}

function elapsed(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function AlertCard({ alert, onCall }: { alert: AdminAlertEvent; onCall: (id: string, room: string) => void }) {
  const { updateAlertStatus, removeAlert } = useAdminStore();
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  // Re-render every 10s to keep elapsed time fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const isFall = alert.type === 'fall';

  async function handle(action: 'ack' | 'resolve' | 'false_alarm') {
    setBusy(true);
    try {
      if (action === 'ack') {
        await acknowledgeAlert(alert.id);
        updateAlertStatus(alert.id, 'acknowledged');
      } else if (action === 'resolve') {
        await resolveAlert(alert.id);
        setTimeout(() => removeAlert(alert.id), 800);
      } else {
        await markFalseAlarm(alert.id);
        setTimeout(() => removeAlert(alert.id), 800);
      }
    } catch {
      // silent — toast system can be added
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={clsx('adm-card flex flex-col gap-0', isFall && 'adm-alert-critical')}
    >
      {/* Card header */}
      <div className="flex items-start justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-[38px] h-[38px] rounded-xl flex items-center justify-center text-[18px] shrink-0"
            style={{ background: isFall ? 'var(--adm-red-dim)' : 'var(--adm-amber-dim)' }}
          >
            {isFall ? '🚨' : '⚠️'}
          </div>
          <div>
            <div className="text-[14px] font-bold" style={{ color: 'var(--adm-t1)' }}>
              {alert.patientName}
            </div>
            <div className="text-[12px]" style={{ color: 'var(--adm-t2)' }}>
              {isFall ? 'Fall detected' : 'Vital anomaly'}
              {alert.status === 'acknowledged' ? ' · Acknowledged' : ''}
            </div>
          </div>
        </div>
        <span
          className="text-[11px] font-mono shrink-0"
          style={{ color: 'var(--adm-t3)', fontFamily: "'JetBrains Mono', monospace" }}
        >
          {elapsed(alert.triggeredAt)}
        </span>
      </div>

      {/* Status row */}
      <div className="flex gap-2 px-5 pb-3">
        <span className={clsx('adm-badge', isFall ? 'adm-badge-red' : 'adm-badge-amber')}>
          <span className="w-[5px] h-[5px] rounded-full bg-current" />
          {isFall ? (alert.status === 'acknowledged' ? 'ACKNOWLEDGED' : 'FALL DISPATCH') : 'VITAL ANOMALY'}
        </span>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderTop: '1px solid var(--adm-border)' }}
      >
        <span className="text-[11px]" style={{ color: 'var(--adm-t3)' }}>
          {alert.patientRoom}
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={() => onCall(alert.patientId, alert.patientRoom)}
            disabled={busy}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--adm-border)',
              color: 'var(--adm-t2)',
            }}
          >
            <Phone size={11} />
            Intercom
          </button>
          {alert.status !== 'acknowledged' && (
            <button
              onClick={() => handle('ack')}
              disabled={busy}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--adm-border)',
                color: 'var(--adm-t2)',
              }}
            >
              <Clock size={11} />
              Acknowledge
            </button>
          )}
          <button
            onClick={() => handle('resolve')}
            disabled={busy}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all"
            style={{
              background: 'var(--adm-blue)',
              border: '1px solid var(--adm-blue)',
              color: '#fff',
            }}
          >
            <CheckCircle size={11} />
            Resolve
          </button>
          <button
            onClick={() => handle('false_alarm')}
            disabled={busy}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--adm-border)',
              color: 'var(--adm-t3)',
            }}
            title="Mark as false alarm"
          >
            <XCircle size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AlertsGrid({ onCall }: Props) {
  const activeAlerts = useAdminStore((s) => s.activeAlerts);

  if (activeAlerts.length === 0) {
    return (
      <div
        className="adm-card mx-7 flex flex-col items-center justify-center py-16 text-center"
        style={{ borderColor: 'var(--adm-green-dim)' }}
      >
        <CheckCircle size={36} style={{ color: 'var(--adm-green)', opacity: 0.5, marginBottom: 12 }} />
        <p className="text-[14px] font-semibold" style={{ color: 'var(--adm-t2)' }}>
          No active alerts
        </p>
        <p className="text-[12px] mt-1" style={{ color: 'var(--adm-t3)' }}>
          All patients are stable
        </p>
      </div>
    );
  }

  return (
    <div className="px-7 grid grid-cols-2 gap-3">
      {activeAlerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} onCall={onCall} />
      ))}
    </div>
  );
}

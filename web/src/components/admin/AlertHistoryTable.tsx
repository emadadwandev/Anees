'use client';

import type { AdminAlertEvent } from '@/lib/types';

interface Props {
  alerts: AdminAlertEvent[];
  loading?: boolean;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    resolved:          { label: 'Resolved',    cls: 'adm-badge-green' },
    false_alarm:       { label: 'False Alarm', cls: 'adm-badge-blue'  },
    cancelled_by_user: { label: 'Cancelled',   cls: 'adm-badge-slate' },
    acknowledged:      { label: 'Acknowledged',cls: 'adm-badge-amber' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'adm-badge-slate' };
  return <span className={`adm-badge ${cls}`}>{label}</span>;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtResponse(secs: number | null | undefined): string {
  if (secs == null) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function AlertHistoryTable({ alerts, loading }: Props) {
  if (loading) {
    return (
      <div className="adm-card mx-7 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse"
            style={{ borderBottom: '1px solid var(--adm-border)', animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="adm-card mx-7 px-4 py-10 text-center">
        <p className="text-[13px]" style={{ color: 'var(--adm-t3)' }}>No history in this period</p>
      </div>
    );
  }

  return (
    <div className="adm-card mx-7 overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--adm-border)' }}>
            {['Time', 'Patient', 'Room', 'Type', 'Status', 'Response'].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[1.2px]"
                style={{ color: 'var(--adm-t3)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr
              key={a.id}
              className="transition-colors"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            >
              <td
                className="px-4 py-3 text-[11px] font-mono whitespace-nowrap"
                style={{ color: 'var(--adm-t3)', fontFamily: "'JetBrains Mono', monospace" }}
              >
                {fmtTime(a.triggeredAt)}
              </td>
              <td className="px-4 py-3 text-[13px] font-medium" style={{ color: 'var(--adm-t1)' }}>
                {a.patientName}
              </td>
              <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--adm-t2)' }}>
                {a.patientRoom}
              </td>
              <td className="px-4 py-3">
                <span className={`adm-badge ${a.type === 'fall' ? 'adm-badge-red' : 'adm-badge-amber'}`}>
                  {a.type === 'fall' ? 'Fall' : 'Vital'}
                </span>
              </td>
              <td className="px-4 py-3">{statusBadge(a.status)}</td>
              <td
                className="px-4 py-3 text-[12px] font-mono"
                style={{
                  color: a.responseTimeSec && a.responseTimeSec < 180 ? 'var(--adm-green)' : 'var(--adm-amber)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {fmtResponse(a.responseTimeSec)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

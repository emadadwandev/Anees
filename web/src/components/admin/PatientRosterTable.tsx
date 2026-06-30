'use client';

import { useState, useMemo } from 'react';
import { Phone, Eye } from 'lucide-react';
import { useAdminStore } from '@/lib/admin-store';
import { Sparkline } from './Sparkline';
import type { AdminPatient, AlertPriority } from '@/lib/types';

type Filter = 'all' | 'fall_active' | 'vital_anomaly' | 'system_offline' | 'ok';

function statusBadge(status: AlertPriority, deviceStatus: string) {
  if (deviceStatus === 'offline')
    return <span className="adm-badge adm-badge-slate"><span className="w-[5px] h-[5px] rounded-full bg-current" />OFFLINE</span>;
  if (status === 'fall_active')
    return <span className="adm-badge adm-badge-red"><span className="w-[5px] h-[5px] rounded-full bg-current" />FALL ALERT</span>;
  if (status === 'vital_anomaly')
    return <span className="adm-badge adm-badge-amber"><span className="w-[5px] h-[5px] rounded-full bg-current" />WARNING</span>;
  return <span className="adm-badge adm-badge-green"><span className="w-[5px] h-[5px] rounded-full bg-current" />STABLE</span>;
}

function vitalColor(v: number | null, lo: number, hi: number): string {
  if (v === null) return 'var(--adm-slate)';
  if (v < lo || v > hi) return 'var(--adm-red)';
  return 'var(--adm-green)';
}

function SignalBar({ quality }: { quality: number | null }) {
  const pct = quality !== null ? Math.round(quality * 100) : 0;
  const color = pct >= 70 ? 'var(--adm-green)' : pct >= 40 ? 'var(--adm-amber)' : 'var(--adm-red)';
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-mono" style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>
        {pct}%
      </span>
    </div>
  );
}

function rowBg(p: AdminPatient): string {
  if (p.alertStatus === 'fall_active') return 'rgba(255,68,68,0.04)';
  if (p.alertStatus === 'vital_anomaly') return 'rgba(255,152,0,0.03)';
  return 'transparent';
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',          label: 'All Patients' },
  { key: 'fall_active',  label: 'Fall Alerts' },
  { key: 'vital_anomaly',label: 'Warnings' },
  { key: 'system_offline', label: 'Offline' },
  { key: 'ok',           label: 'Stable' },
];

interface Props {
  onSelectPatient: (p: AdminPatient) => void;
  onCallPatient: (p: AdminPatient) => void;
  search: string;
}

export function PatientRosterTable({ onSelectPatient, onCallPatient, search }: Props) {
  const patients = useAdminStore((s) => s.patients);
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(() => {
    let list = patients;
    if (filter !== 'all') list = list.filter((p) => p.alertStatus === filter || (filter === 'system_offline' && p.deviceStatus === 'offline'));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.roomLabel.toLowerCase().includes(q));
    }
    return list;
  }, [patients, filter, search]);

  const counts = useMemo(() => ({
    fall_active:   patients.filter((p) => p.alertStatus === 'fall_active').length,
    vital_anomaly: patients.filter((p) => p.alertStatus === 'vital_anomaly').length,
    system_offline:patients.filter((p) => p.deviceStatus === 'offline').length,
    ok:            patients.filter((p) => p.alertStatus === 'ok' && p.deviceStatus !== 'offline').length,
  }), [patients]);

  return (
    <div className="px-7 pb-7">
      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {FILTERS.map(({ key, label }) => {
          const count = key === 'all' ? patients.length : counts[key as keyof typeof counts];
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="px-3 py-1.5 rounded-md text-[12px] font-semibold border transition-all"
              style={{
                color:       filter === key ? '#60a5fa' : 'var(--adm-t3)',
                background:  filter === key ? 'var(--adm-blue-dim)' : 'transparent',
                borderColor: filter === key ? 'rgba(96,165,250,0.2)' : 'transparent',
              }}
            >
              {label}
              {count !== undefined && (
                <span className="ml-1.5 opacity-60">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="adm-card overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--adm-border)' }}>
              {['Patient', 'Room', 'Status', 'Heart Rate', 'Resp. Rate', 'Signal', 'Last Seen', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[1.2px] whitespace-nowrap"
                  style={{ color: 'var(--adm-t3)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-[13px]" style={{ color: 'var(--adm-t3)' }}>
                  No patients match this filter
                </td>
              </tr>
            )}
            {visible.map((p) => {
              const hrColor = vitalColor(p.latestHr, 45, 110);
              const rrColor = vitalColor(p.latestRr, 8, 25);
              // Build a pseudo-history from a single reading (real history comes via vitals hook)
              const hrData = p.latestHr !== null ? [p.latestHr] : [];
              const sparkColor = p.alertStatus === 'fall_active' ? 'var(--adm-red)' : 'var(--adm-blue)';

              return (
                <tr
                  key={p.id}
                  onClick={() => onSelectPatient(p)}
                  className="cursor-pointer transition-colors"
                  style={{
                    background: rowBg(p),
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = rowBg(p))}
                >
                  {/* Patient */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-[34px] h-[34px] rounded-full shrink-0 flex items-center justify-center text-[13px] font-semibold text-white"
                        style={{ background: avatarColor(p.name) }}
                      >
                        {initials(p.name)}
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold" style={{ color: 'var(--adm-t1)' }}>{p.name}</div>
                        {p.age && <div className="text-[11px]" style={{ color: 'var(--adm-t3)' }}>{p.age} yrs</div>}
                      </div>
                    </div>
                  </td>

                  {/* Room */}
                  <td className="px-4 py-3">
                    <div className="text-[12px]" style={{ color: 'var(--adm-t2)' }}>{p.roomLabel}</div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">{statusBadge(p.alertStatus, p.deviceStatus)}</td>

                  {/* HR */}
                  <td className="px-4 py-3">
                    <span className="text-[14px] font-medium font-mono" style={{ color: hrColor, fontFamily: "'JetBrains Mono', monospace" }}>
                      {p.latestHr ?? '—'}
                    </span>
                    <span className="text-[10px] ml-0.5" style={{ color: 'var(--adm-t3)' }}>BPM</span>
                    <div className="mt-0.5">
                      <Sparkline data={hrData.length >= 2 ? hrData : []} color={sparkColor} />
                    </div>
                  </td>

                  {/* RR */}
                  <td className="px-4 py-3">
                    <span className="text-[14px] font-medium font-mono" style={{ color: rrColor, fontFamily: "'JetBrains Mono', monospace" }}>
                      {p.latestRr ?? '—'}
                    </span>
                    <span className="text-[10px] ml-0.5" style={{ color: 'var(--adm-t3)' }}>BRPM</span>
                  </td>

                  {/* Signal */}
                  <td className="px-4 py-3"><SignalBar quality={p.signalQuality} /></td>

                  {/* Last seen */}
                  <td className="px-4 py-3">
                    <span className="text-[11px]" style={{ color: 'var(--adm-t3)' }}>
                      {p.lastHeartbeat ? relativeTime(p.lastHeartbeat) : '—'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onCallPatient(p)}
                        className="flex items-center justify-center w-[28px] h-[28px] rounded-md transition-all"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--adm-border)', color: 'var(--adm-t3)' }}
                        title="Intercom"
                      >
                        <Phone size={13} />
                      </button>
                      <button
                        onClick={() => onSelectPatient(p)}
                        className="flex items-center justify-center w-[28px] h-[28px] rounded-md transition-all"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--adm-border)', color: 'var(--adm-t3)' }}
                        title="View details"
                      >
                        <Eye size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Deterministic avatar colour from name hash
function avatarColor(name: string): string {
  const palette = ['#1565c0','#4a148c','#006064','#33691e','#880e4f','#01579b','#e65100','#37474f'];
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

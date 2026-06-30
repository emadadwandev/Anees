'use client';

import { useState } from 'react';
import { Wifi, WifiOff, Wrench, Search, RefreshCw } from 'lucide-react';
import { useAdminStore } from '@/lib/admin-store';
import type { AdminPatient } from '@/lib/types';

function statusIcon(status: string) {
  if (status === 'online')  return <Wifi size={13} style={{ color: 'var(--adm-green)' }} />;
  if (status === 'offline') return <WifiOff size={13} style={{ color: 'var(--adm-red)' }} />;
  return <Wrench size={13} style={{ color: 'var(--adm-amber)' }} />;
}

function statusBadge(status: string) {
  if (status === 'online')
    return <span className="adm-badge adm-badge-green"><span className="w-[5px] h-[5px] rounded-full bg-current" />ONLINE</span>;
  if (status === 'offline')
    return <span className="adm-badge adm-badge-red"><span className="w-[5px] h-[5px] rounded-full bg-current" />OFFLINE</span>;
  return <span className="adm-badge adm-badge-amber"><span className="w-[5px] h-[5px] rounded-full bg-current" />MAINTENANCE</span>;
}

function SignalBar({ quality }: { quality: number | null }) {
  if (quality === null) return <span className="text-[11px]" style={{ color: 'var(--adm-t3)' }}>—</span>;
  const pct = Math.round(quality * 100);
  const color = pct >= 70 ? 'var(--adm-green)' : pct >= 40 ? 'var(--adm-amber)' : 'var(--adm-red)';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-mono" style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>
        {pct}%
      </span>
    </div>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type Filter = 'all' | 'online' | 'offline' | 'maintenance';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',         label: 'All Devices'  },
  { key: 'online',      label: 'Online'       },
  { key: 'offline',     label: 'Offline'      },
  { key: 'maintenance', label: 'Maintenance'  },
];

export default function AdminDevicesPage() {
  const patients = useAdminStore((s) => s.patients);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const devices = patients.filter((p) => p.device !== null);

  const visible = devices.filter((p) => {
    if (filter !== 'all' && p.deviceStatus !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.roomLabel.toLowerCase().includes(q) ||
        (p.device?.serial ?? '').toLowerCase().includes(q) ||
        (p.device?.firmwareVersion ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    online:      devices.filter((p) => p.deviceStatus === 'online').length,
    offline:     devices.filter((p) => p.deviceStatus === 'offline').length,
    maintenance: devices.filter((p) => p.deviceStatus === 'maintenance').length,
  };

  const avgSignal = (() => {
    const online = devices.filter((p) => p.signalQuality !== null);
    if (!online.length) return null;
    return Math.round(online.reduce((a, p) => a + (p.signalQuality ?? 0), 0) / online.length * 100);
  })();

  return (
    <div className="py-5">
      {/* Fleet KPIs */}
      <div className="grid grid-cols-4 gap-3 px-7 mb-5">
        {[
          { label: 'Total Devices', value: devices.length, color: 'var(--adm-t1)', border: 'var(--adm-border)' },
          { label: 'Online',        value: counts.online,  color: 'var(--adm-green)', border: 'rgba(63,207,92,0.18)' },
          { label: 'Offline',       value: counts.offline, color: '#ff6b6b',          border: counts.offline > 0 ? 'rgba(255,68,68,0.22)' : 'var(--adm-border)' },
          { label: 'Avg Signal',    value: avgSignal !== null ? `${avgSignal}%` : '—', color: '#60a5fa', border: 'rgba(96,165,250,0.2)' },
        ].map(({ label, value, color, border }) => (
          <div key={label} className="adm-card px-4 py-3.5" style={{ borderColor: border }}>
            <p className="text-[10px] font-semibold uppercase tracking-[1.2px] mb-1.5" style={{ color: 'var(--adm-t3)' }}>
              {label}
            </p>
            <p className="text-[26px] font-bold leading-none tracking-tight" style={{ color }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex items-center justify-between px-7 mb-4">
        <div className="flex gap-1">
          {FILTERS.map(({ key, label }) => {
            const count = key === 'all' ? devices.length : counts[key as keyof typeof counts];
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
                <span className="ml-1.5 opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--adm-border)', width: 220 }}
        >
          <Search size={13} style={{ color: 'var(--adm-t3)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search serial, room, patient…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-[12px] w-full"
            style={{ color: 'var(--adm-t1)' }}
          />
        </div>
      </div>

      {/* Device table */}
      <div className="px-7">
        <div className="adm-card overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--adm-border)' }}>
                {['Device', 'Serial', 'Firmware', 'Patient', 'Room', 'Signal', 'Last Heartbeat', 'Status', ''].map((h) => (
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
                  <td colSpan={9} className="px-4 py-12 text-center text-[13px]" style={{ color: 'var(--adm-t3)' }}>
                    No devices match this filter
                  </td>
                </tr>
              )}
              {visible.map((p) => (
                <tr
                  key={p.id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {statusIcon(p.deviceStatus)}
                      <span className="text-[12px] font-medium" style={{ color: 'var(--adm-t1)' }}>
                        ANS mmWave
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-mono" style={{ color: 'var(--adm-t2)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {p.device?.serial ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-mono" style={{ color: 'var(--adm-t3)', fontFamily: "'JetBrains Mono', monospace" }}>
                      v{p.device?.firmwareVersion ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px]" style={{ color: 'var(--adm-t1)' }}>{p.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px]" style={{ color: 'var(--adm-t2)' }}>{p.roomLabel}</span>
                  </td>
                  <td className="px-4 py-3">
                    <SignalBar quality={p.signalQuality} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px]" style={{ color: 'var(--adm-t3)' }}>
                      {relativeTime(p.lastHeartbeat)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{statusBadge(p.deviceStatus)}</td>
                  <td className="px-4 py-3">
                    <button
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--adm-border)',
                        color: 'var(--adm-t3)',
                      }}
                      title="Restart device"
                    >
                      <RefreshCw size={11} />
                      Restart
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Firmware note */}
        {devices.some((p) => p.device?.firmwareVersion !== '2.4.1') && (
          <div
            className="mt-4 flex items-center gap-3 px-4 py-3 rounded-lg"
            style={{ background: 'var(--adm-amber-dim)', border: '1px solid rgba(255,152,0,0.2)' }}
          >
            <Wrench size={14} style={{ color: 'var(--adm-amber)' }} />
            <span className="text-[12px]" style={{ color: 'var(--adm-amber)' }}>
              {devices.filter((p) => p.device?.firmwareVersion !== '2.4.1').length} device(s) running older firmware — update to v2.4.1 recommended.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useAdminStore } from '@/lib/admin-store';

interface KpiProps {
  label: string;
  value: string | number;
  sub: string;
  variant?: 'default' | 'green' | 'red' | 'amber' | 'blue';
}

function KpiCard({ label, value, sub, variant = 'default' }: KpiProps) {
  const valueColor: Record<string, string> = {
    default: 'var(--adm-t1)',
    green:   'var(--adm-green)',
    red:     '#ff6b6b',
    amber:   'var(--adm-amber)',
    blue:    '#60a5fa',
  };
  const borderColor: Record<string, string> = {
    default: 'var(--adm-border)',
    green:   'rgba(63,207,92,0.18)',
    red:     'rgba(255,68,68,0.22)',
    amber:   'rgba(255,152,0,0.22)',
    blue:    'rgba(96,165,250,0.2)',
  };
  const bgColor: Record<string, string> = {
    default: 'var(--adm-card)',
    green:   'var(--adm-card)',
    red:     'rgba(255,68,68,0.05)',
    amber:   'rgba(255,152,0,0.04)',
    blue:    'var(--adm-card)',
  };

  return (
    <div
      className="adm-card px-4 py-3.5 cursor-default"
      style={{ borderColor: borderColor[variant], background: bgColor[variant] }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-[1.2px] mb-1.5"
        style={{ color: 'var(--adm-t3)' }}
      >
        {label}
      </p>
      <p
        className="text-[26px] font-bold leading-none tracking-tight"
        style={{ color: valueColor[variant] }}
      >
        {value}
      </p>
      <p className="text-[10px] mt-1" style={{ color: 'var(--adm-t3)' }}>
        {sub}
      </p>
    </div>
  );
}

export function KpiBar() {
  const stats = useAdminStore((s) => s.stats);

  if (!stats) {
    return (
      <div className="grid grid-cols-5 gap-3 px-7 py-4 shrink-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="adm-card h-[84px] animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-3 px-7 py-4 shrink-0">
      <KpiCard
        label="Online"
        value={stats.onlineDevices}
        sub={`of ${stats.totalPatients} patients`}
        variant="green"
      />
      <KpiCard
        label="Active Alerts"
        value={stats.activeAlerts}
        sub="Require response"
        variant={stats.activeAlerts > 0 ? 'red' : 'default'}
      />
      <KpiCard
        label="Warnings"
        value={stats.warnings}
        sub="Vital anomaly"
        variant={stats.warnings > 0 ? 'amber' : 'default'}
      />
      <KpiCard
        label="Offline"
        value={stats.offlineDevices}
        sub="No heartbeat"
        variant="default"
      />
      <KpiCard
        label="Avg Signal"
        value={`${stats.avgSignalQuality}%`}
        sub="Fleet signal quality"
        variant="blue"
      />
    </div>
  );
}

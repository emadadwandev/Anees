'use client';

import type { FacilityAnalytics, FacilityStats } from '@/lib/types';

interface Props {
  analytics: FacilityAnalytics | null;
  stats: FacilityStats | null;
  loading?: boolean;
}

function fmtResponse(secs: number | null): string {
  if (secs == null) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function AnalyticsPanel({ analytics, stats, loading }: Props) {
  if (loading || !analytics) {
    return (
      <div className="px-7 pb-7 grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="adm-card h-48 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    );
  }

  const maxDay = Math.max(...analytics.alertsByDay.map((d) => d.count), 1);

  const fallCount  = analytics.alertsByType.find((t) => t.type === 'fall')?.count ?? 0;
  const vitalCount = analytics.alertsByType.find((t) => t.type === 'vital_anomaly')?.count ?? 0;
  const totalByType = fallCount + vitalCount || 1;

  return (
    <div className="px-7 pb-7 space-y-4">
      {/* Alert frequency chart */}
      <div className="adm-card px-6 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] mb-4" style={{ color: 'var(--adm-t3)' }}>
          Alert Frequency: Last 7 Days
        </p>
        {analytics.alertsByDay.length === 0 ? (
          <p className="text-[12px] py-6 text-center" style={{ color: 'var(--adm-t3)' }}>No data</p>
        ) : (
          <>
            <div className="flex items-end gap-2 h-20">
              {analytics.alertsByDay.map((d, i) => {
                const pct = (d.count / maxDay) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                    <div
                      className="w-full rounded-t transition-all"
                      style={{
                        height: `${Math.max(pct, 4)}%`,
                        background: d.count > 5 ? 'var(--adm-red)' : 'var(--adm-blue)',
                        opacity: 0.8,
                      }}
                    />
                    <span
                      className="text-[9px] font-mono absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--adm-t1)' }}
                    >
                      {d.count}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2">
              {analytics.alertsByDay.map((d, i) => (
                <div key={i} className="flex-1 text-center">
                  <span className="text-[9px]" style={{ color: 'var(--adm-t3)' }}>
                    {new Date(d.day).toLocaleDateString('en-GB', { weekday: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Alert type breakdown */}
        <div className="adm-card px-6 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] mb-4" style={{ color: 'var(--adm-t3)' }}>
            Alert Types: Last 7 Days
          </p>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-[12px]" style={{ color: 'var(--adm-t2)' }}>Fall Detection</span>
                <span className="text-[12px] font-semibold" style={{ color: 'var(--adm-red)' }}>{fallCount}</span>
              </div>
              <div className="h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(fallCount / totalByType) * 100}%`, background: 'var(--adm-red)' }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-[12px]" style={{ color: 'var(--adm-t2)' }}>Vital Anomaly</span>
                <span className="text-[12px] font-semibold" style={{ color: 'var(--adm-amber)' }}>{vitalCount}</span>
              </div>
              <div className="h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(vitalCount / totalByType) * 100}%`, background: 'var(--adm-amber)' }}
                />
              </div>
            </div>
            {stats && (
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[12px]" style={{ color: 'var(--adm-t2)' }}>Device Offline</span>
                  <span className="text-[12px] font-semibold" style={{ color: 'var(--adm-slate)' }}>
                    {stats.offlineDevices}
                  </span>
                </div>
                <div className="h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min((stats.offlineDevices / (totalByType + stats.offlineDevices)) * 100, 100)}%`,
                      background: 'var(--adm-slate)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Response time */}
        <div className="adm-card px-6 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] mb-3" style={{ color: 'var(--adm-t3)' }}>
            Avg Response Time
          </p>
          <p
            className="text-[40px] font-bold tracking-[-2px] leading-none font-mono"
            style={{
              color: analytics.avgResponseSec && analytics.avgResponseSec < 180
                ? 'var(--adm-green)'
                : 'var(--adm-amber)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {fmtResponse(analytics.avgResponseSec)}
          </p>
          <p className="text-[11px] mt-2" style={{ color: 'var(--adm-t3)' }}>
            min:sec · based on last 100 resolved alerts
          </p>

          {stats && (
            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-[11px]">
                <span style={{ color: 'var(--adm-t3)' }}>Online patients</span>
                <span style={{ color: 'var(--adm-green)' }}>{stats.onlineDevices}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span style={{ color: 'var(--adm-t3)' }}>Avg signal quality</span>
                <span style={{ color: '#60a5fa' }}>{stats.avgSignalQuality}%</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span style={{ color: 'var(--adm-t3)' }}>Total monitored</span>
                <span style={{ color: 'var(--adm-t1)' }}>{stats.totalPatients}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

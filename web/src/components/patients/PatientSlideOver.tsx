'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { AdminPatient, VitalReading, SleepReport, AlertStatus, AlertPriority } from '@/lib/types';
import { getVitalHistory, getSleepReport } from '@/lib/api';
import { MOCK_ALERT_HISTORY } from '@/lib/mock-data';

// ── Helpers ──────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function avatarBg(name: string) {
  const colors = ['#1A73E8', '#3FCF5C', '#FF9800', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function vitalColor(v: number | null, min: number, max: number) {
  if (v === null) return 'var(--adm-t3)';
  if (v < min || v > max) return 'var(--adm-red)';
  return 'var(--adm-green)';
}

function buildSparkPath(readings: VitalReading[]) {
  const pts = readings.slice(-60).map((r) => r.heartRateBpm);
  if (pts.length < 2) return { line: '', area: '' };
  const W = 440, H = 72;
  const lo = Math.min(...pts) - 3;
  const hi = Math.max(...pts) + 3;
  const range = hi - lo || 1;
  const coords = pts.map((v, i) => [
    (i / (pts.length - 1)) * W,
    H - ((v - lo) / range) * (H - 10) - 5,
  ] as [number, number]);
  const d = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return { line: d, area: `${d} L${W},${H} L0,${H} Z` };
}

const ALERT_STATUS: Record<AlertStatus, { label: string; bg: string; color: string }> = {
  dispatched:           { label: 'Dispatched',  bg: 'rgba(255,68,68,0.14)',   color: '#ff6b6b' },
  acknowledged:         { label: 'Acknowledged',bg: 'rgba(255,152,0,0.14)',   color: '#FF9800' },
  resolved:             { label: 'Resolved',    bg: 'rgba(63,207,92,0.14)',   color: '#3FCF5C' },
  false_alarm:          { label: 'False Alarm', bg: 'rgba(26,115,232,0.14)',  color: '#60a5fa' },
  pending_cancellation: { label: 'Pending',     bg: 'rgba(107,127,163,0.14)', color: '#6B7FA3' },
  cancelled_by_user:    { label: 'Cancelled',   bg: 'rgba(107,127,163,0.14)', color: '#6B7FA3' },
};

const PRIORITY_BADGE: Record<AlertPriority, { label: string; bg: string; color: string }> = {
  fall_active:    { label: 'Fall Active',    bg: 'rgba(255,68,68,0.14)',   color: '#ff6b6b' },
  vital_anomaly:  { label: 'Vital Anomaly',  bg: 'rgba(255,152,0,0.14)',   color: '#FF9800' },
  system_offline: { label: 'Offline',        bg: 'rgba(107,127,163,0.14)', color: '#6B7FA3' },
  ok:             { label: 'Stable',         bg: 'rgba(63,207,92,0.14)',   color: '#3FCF5C' },
};

// ── Sub-components ────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--adm-t3)',
        letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function VitalBox({ label, value, unit, valueColor = 'var(--adm-t1)' }: {
  label: string; value: string; unit: string; valueColor?: string;
}) {
  return (
    <div style={{
      background: 'var(--adm-card)', border: '1px solid var(--adm-border)',
      borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--adm-t3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 600,
        lineHeight: 1, color: valueColor,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--adm-t3)' }}>{unit}</div>
    </div>
  );
}

function DeviceField({ label, value, color, mono }: {
  label: string; value: string; color?: string; mono?: boolean;
}) {
  return (
    <div style={{
      background: 'var(--adm-card)', border: '1px solid var(--adm-border)',
      borderRadius: 8, padding: '10px 12px',
    }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--adm-t3)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{
        fontSize: mono ? 11 : 12, fontWeight: 500,
        color: color ?? 'var(--adm-t1)',
        fontFamily: mono ? "'JetBrains Mono', monospace" : undefined,
      }}>
        {value}
      </div>
    </div>
  );
}

function FooterBtn({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: 10, borderRadius: 9, fontSize: 13, fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: primary ? 'var(--adm-blue)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${primary ? 'var(--adm-blue)' : 'var(--adm-border)'}`,
        color: primary ? '#fff' : 'var(--adm-t2)',
      }}
    >
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────

interface Props {
  patient: AdminPatient | null;
  onClose: () => void;
}

export function PatientSlideOver({ patient, onClose }: Props) {
  const router = useRouter();
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [sleep, setSleep] = useState<SleepReport | null>(null);
  const open = patient !== null;

  useEffect(() => {
    if (!patient) { setVitals([]); setSleep(null); return; }
    const today = new Date().toISOString().split('T')[0];
    getVitalHistory(patient.id, '6h', '1m').then(setVitals).catch(() => setVitals([]));
    getSleepReport(patient.id, today).then(setSleep).catch(() => setSleep(null));
  }, [patient?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const recentAlerts = MOCK_ALERT_HISTORY.filter((a) => a.patientId === patient?.id).slice(0, 3);
  const spark = buildSparkPath(vitals);
  const latest = vitals[vitals.length - 1];
  const hr = latest?.heartRateBpm ?? patient?.latestHr ?? null;
  const rr = latest?.respRateBrpm ?? patient?.latestRr ?? null;
  const sig = latest?.signalQuality ?? patient?.signalQuality;
  const totalH = sleep ? Math.floor(sleep.totalSleepMin / 60) : 0;
  const totalM = sleep ? sleep.totalSleepMin % 60 : 0;

  const badge = patient ? PRIORITY_BADGE[patient.alertStatus] : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(3px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 520, zIndex: 101,
          background: '#0d1425',
          borderLeft: '1px solid var(--adm-border)',
          display: 'flex', flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '-24px 0 64px rgba(0,0,0,0.6)',
        }}
      >
        {patient && (
          <>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px', borderBottom: '1px solid var(--adm-border)',
              display: 'flex', alignItems: 'flex-start', gap: 14, flexShrink: 0,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                background: avatarBg(patient.name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: '#fff',
              }}>
                {initials(patient.name)}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--adm-t1)', lineHeight: 1.2 }}>
                  {patient.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--adm-t3)', marginTop: 4 }}>
                  {patient.age !== null ? `${patient.age} years` : ''} · Room {patient.roomLabel}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                {badge && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                    background: badge.bg, color: badge.color,
                    whiteSpace: 'nowrap',
                  }}>
                    {badge.label}
                  </span>
                )}
                <button
                  onClick={onClose}
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--adm-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--adm-t3)', flexShrink: 0,
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

              {/* Live Vitals */}
              <Section title="Live Vitals">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <VitalBox label="Heart Rate" value={hr !== null ? String(hr) : '—'} unit="BPM"
                    valueColor={vitalColor(hr, 50, 100)} />
                  <VitalBox label="Respiration" value={rr !== null ? String(rr) : '—'} unit="BRPM"
                    valueColor={vitalColor(rr, 12, 20)} />
                  <VitalBox
                    label="Signal Quality"
                    value={sig !== null && sig !== undefined ? `${Math.round(sig * 100)}%` : '—'}
                    unit="SNR"
                    valueColor="#60a5fa"
                  />
                  <VitalBox
                    label="Motion"
                    value={patient.deviceStatus === 'online' ? 'Active' : 'Still'}
                    unit="Activity"
                    valueColor="var(--adm-t2)"
                  />
                </div>
              </Section>

              {/* HR Trend */}
              <Section title="HR Trend — Last 60 min">
                <div style={{
                  background: 'var(--adm-card)', border: '1px solid var(--adm-border)',
                  borderRadius: 10, padding: 14,
                }}>
                  <svg width="100%" height="72" viewBox="0 0 440 72" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id={`sg-${patient.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1A73E8" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#1A73E8" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {spark.line ? (
                      <>
                        <path d={spark.area} fill={`url(#sg-${patient.id})`} />
                        <path d={spark.line} fill="none" stroke="#1A73E8" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </>
                    ) : (
                      <text x="220" y="40" textAnchor="middle" fill="rgba(200,210,240,0.3)" fontSize="12">
                        Loading…
                      </text>
                    )}
                  </svg>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 10, color: 'var(--adm-t3)', marginTop: 6,
                  }}>
                    <span>60 min ago</span><span>30 min ago</span><span>Now</span>
                  </div>
                </div>
              </Section>

              {/* Sleep */}
              <Section title="Sleep — Last Night">
                <div style={{
                  background: 'var(--adm-card)', border: '1px solid var(--adm-border)',
                  borderRadius: 10, padding: 14,
                }}>
                  {sleep ? (
                    <>
                      <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
                        <div style={{ background: '#3730a3', flex: `0 0 ${sleep.deepPct}%` }} />
                        <div style={{ background: '#7c3aed', flex: `0 0 ${sleep.remPct}%` }} />
                        <div style={{ background: '#3b82f6', flex: `0 0 ${sleep.lightPct}%` }} />
                        <div style={{ background: '#f59e0b', flex: `0 0 ${sleep.awakePct}%` }} />
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11 }}>
                        <span style={{ color: '#6366f1' }}>■ Deep {sleep.deepPct}%</span>
                        <span style={{ color: '#7c3aed' }}>■ REM {sleep.remPct}%</span>
                        <span style={{ color: '#60a5fa' }}>■ Light {sleep.lightPct}%</span>
                        <span style={{ color: '#f59e0b' }}>■ Awake {sleep.awakePct}%</span>
                      </div>
                      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--adm-t2)' }}>
                        Total sleep:{' '}
                        <strong style={{ color: 'var(--adm-t1)' }}>{totalH}h {totalM}m</strong>
                        {' · '}Quality:{' '}
                        <strong style={{
                          color: sleep.qualityLabel === 'good' ? 'var(--adm-green)'
                            : sleep.qualityLabel === 'restless' ? 'var(--adm-amber)'
                            : 'var(--adm-red)',
                        }}>
                          {sleep.qualityLabel.charAt(0).toUpperCase() + sleep.qualityLabel.slice(1)}
                        </strong>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--adm-t3)', textAlign: 'center', padding: '16px 0' }}>
                      No sleep data
                    </div>
                  )}
                </div>
              </Section>

              {/* Device */}
              <Section title="Device">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <DeviceField label="Serial" value={patient.device?.serial ?? '—'} mono />
                  <DeviceField label="Firmware" value={patient.device?.firmwareVersion ?? '—'} />
                  <DeviceField
                    label="Occlusion"
                    value={patient.occlusionStatus === 'none' ? 'Clear' : patient.occlusionStatus}
                    color={patient.occlusionStatus === 'none' ? 'var(--adm-green)' : 'var(--adm-amber)'}
                  />
                  <DeviceField
                    label="Last Heartbeat"
                    value={patient.lastHeartbeat
                      ? formatDistanceToNow(new Date(patient.lastHeartbeat), { addSuffix: true })
                      : '—'}
                    color={patient.deviceStatus === 'online' ? 'var(--adm-green)' : 'var(--adm-t3)'}
                  />
                </div>
              </Section>

              {/* Recent Alerts */}
              <Section title="Recent Alerts">
                {recentAlerts.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--adm-t3)', padding: '12px 0' }}>
                    No recent alerts
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {recentAlerts.map((alert) => {
                      const s = ALERT_STATUS[alert.status];
                      return (
                        <div key={alert.id} style={{
                          background: 'var(--adm-card)', border: '1px solid var(--adm-border)',
                          borderRadius: 8, padding: '10px 12px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--adm-t1)' }}>
                              {alert.type === 'fall' ? 'Fall Detection' : 'Vital Anomaly'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--adm-t3)', marginTop: 2 }}>
                              {format(new Date(alert.triggeredAt), 'MMM d · HH:mm')}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                            background: s.bg, color: s.color,
                          }}>
                            {s.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid var(--adm-border)',
              display: 'flex', gap: 8, flexShrink: 0,
            }}>
              <FooterBtn label="🎙 Intercom" onClick={() => {}} />
              <FooterBtn label="📊 Full Report" onClick={() => router.push(`/patients/${patient.id}`)} />
              <FooterBtn label="View All Alerts" onClick={() => { onClose(); router.push('/alerts'); }} primary />
            </div>
          </>
        )}
      </div>
    </>
  );
}

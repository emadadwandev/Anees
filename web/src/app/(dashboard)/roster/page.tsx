import { MOCK_PATIENTS, MOCK_STATS } from '@/lib/mock-data';
import { RosterWithPanel } from '@/components/patients/RosterWithPanel';

export default function RosterPage() {
  const stats = MOCK_STATS;

  const kpiCards = [
    { label: 'Total Patients', value: stats.totalPatients, accent: 'var(--adm-blue)' },
    { label: 'Online Devices', value: stats.onlineDevices, accent: 'var(--adm-green)' },
    { label: 'Offline Devices', value: stats.offlineDevices, accent: stats.offlineDevices > 0 ? 'var(--adm-amber)' : 'var(--adm-slate)' },
    { label: 'Active Alerts', value: stats.activeAlerts, accent: stats.activeAlerts > 0 ? 'var(--adm-red)' : 'var(--adm-green)' },
    { label: 'Avg Signal', value: `${stats.avgSignalQuality}%`, accent: 'var(--adm-blue)' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="adm-live-dot" />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--adm-t1)' }}>
            Patient Roster
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--adm-t3)' }}>
            All linked patients with live status
          </p>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpiCards.map(({ label, value, accent }) => (
          <div
            key={label}
            className="adm-card rounded-xl p-4 flex flex-col gap-1"
          >
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--adm-t3)' }}>
              {label}
            </p>
            <p className="text-2xl font-bold font-mono" style={{ color: accent }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <RosterWithPanel initialPatients={MOCK_PATIENTS} />
    </div>
  );
}

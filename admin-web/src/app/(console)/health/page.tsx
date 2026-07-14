import { getAdminApi } from '@/lib/api';
import SystemHealthGrid from '@/components/system-health-grid';

export default async function HealthPage() {
  const health = await (await getAdminApi()).getHealth();
  return <><header className="page-header"><div><div className="eyebrow">RUNTIME DIAGNOSTICS</div><h1>System health</h1><p>Dependency probes and bounded rejected-frame metrics from the backend.</p></div><span className={`state state-${health.status === 'healthy' ? 'enabled' : 'disabled'}`}>{health.status}</span></header><section className="panel"><SystemHealthGrid health={health} /><p className="last-checked">Last checked {new Date(health.checkedAt).toLocaleString()}</p></section></>;
}

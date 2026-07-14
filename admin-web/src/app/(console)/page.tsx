import Link from 'next/link';
import { getAdminApi } from '@/lib/api';
import DeviceTable from '@/components/device-table';
import SystemHealthGrid from '@/components/system-health-grid';

export default async function OverviewPage() {
  const api = await getAdminApi();
  const [summary, health, devices] = await Promise.all([api.getSummary(), api.getHealth(), api.listDevices({ limit: '8' })]);
  return <><header className="page-header"><div><div className="eyebrow">FLEET OVERVIEW</div><h1>Sensor operations</h1><p>Provisioning and lifecycle control for MQTT and AeroSense TCP hardware.</p></div><Link className="primary-link" href={'/devices/new' as any}>Add device</Link></header><section className="metric-grid"><Metric label="Active devices" value={summary.total} /><Metric label="Online" value={summary.connectivity.online} /><Metric label="Maintenance" value={summary.managementStates.maintenance} /><Metric label="Unassigned" value={Math.max(0, summary.total - summary.managementStates.disabled)} /></section><section className="panel"><div className="section-heading"><div><div className="eyebrow">RECENT FLEET</div><h2>Device inventory</h2></div><Link href={'/devices' as any}>View all</Link></div><DeviceTable devices={devices} /></section><section className="panel"><div className="section-heading"><div><div className="eyebrow">DEPENDENCIES</div><h2>System health</h2></div><Link href={'/health' as any}>Details</Link></div><SystemHealthGrid health={health} /></section></>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }

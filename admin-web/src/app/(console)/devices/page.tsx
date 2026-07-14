import Link from 'next/link';
import { getAdminApi } from '@/lib/api';
import DeviceTable from '@/components/device-table';

export default async function DevicesPage({ searchParams }: { searchParams: Promise<{ transport?: string; managementState?: string; status?: string }> }) {
  const filters = await searchParams;
  const api = await getAdminApi();
  const devices = await api.listDevices(Object.fromEntries(Object.entries(filters).filter(([, value]) => Boolean(value)) as [string, string][]));
  return <><header className="page-header"><div><div className="eyebrow">DEVICE INVENTORY</div><h1>All sensors</h1><p>UUIDs are shown for physical-box provisioning; patient assignment remains in the caregiver app.</p></div><Link className="primary-link" href={'/devices/new' as any}>Add device</Link></header><form className="filters"><select name="transport" defaultValue={filters.transport ?? ''}><option value="">All transports</option><option value="mqtt">MQTT</option><option value="aerosense_tcp">AeroSense TCP</option></select><select name="managementState" defaultValue={filters.managementState ?? ''}><option value="">All states</option><option value="enabled">Enabled</option><option value="maintenance">Maintenance</option><option value="disabled">Disabled</option></select><select name="status" defaultValue={filters.status ?? ''}><option value="">All connectivity</option><option value="online">Online</option><option value="offline">Offline</option></select><button type="submit">Filter fleet</button></form><section className="panel"><DeviceTable devices={devices} /></section></>;
}

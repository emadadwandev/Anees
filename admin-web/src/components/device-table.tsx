import Link from 'next/link';
import type { AdminDevice } from '@/lib/api';

export default function DeviceTable({ devices }: { devices: AdminDevice[] }) {
  return (
    <div className="table-wrap"><table><thead><tr><th>Device / UUID</th><th>Transport</th><th>State</th><th>Connectivity</th><th>Assignment</th></tr></thead><tbody>
      {devices.map((device) => <tr key={device.id}><td><Link href={`/devices/${device.id}` as any}><strong>{device.serial}</strong><code>{device.id}</code></Link></td><td>{device.transport}</td><td><span className={`state state-${device.managementState}`}>{device.managementState}</span></td><td>{device.status}</td><td>{device.userId ? device.userId : 'Unassigned'}</td></tr>)}
      {devices.length === 0 && <tr><td colSpan={5} className="empty">No devices match the current filters.</td></tr>}
    </tbody></table></div>
  );
}

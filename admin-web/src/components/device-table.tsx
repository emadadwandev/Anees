import Link from 'next/link';
import type { AdminDevice } from '@/lib/api';

export function formatDeviceType(deviceType: string) {
  if (deviceType === 'fall_sensor') return 'Fall detection';
  if (deviceType === 'sleep_sensor') return 'Sleep / vitals';
  return deviceType.replace(/_/g, ' ') || 'Unknown';
}

export default function DeviceTable({ devices }: { devices: AdminDevice[] }) {
  return (
    <div className="table-wrap"><table><thead><tr><th>Device / UUID</th><th>Sensor type</th><th>Transport</th><th>State</th><th>Connectivity</th><th>Assignment</th></tr></thead><tbody>
      {devices.map((device) => <tr key={device.id}><td><Link href={`/devices/${device.id}` as any}><strong>{device.serial}</strong><code>{device.id}</code></Link></td><td><span className={`device-type device-type-${device.deviceType}`}>{formatDeviceType(device.deviceType)}</span></td><td>{device.transport}</td><td><span className={`state state-${device.managementState}`}>{device.managementState}</span></td><td>{device.status}</td><td>{device.userId ? device.userId : 'Unassigned'}</td></tr>)}
      {devices.length === 0 && <tr><td colSpan={6} className="empty">No devices match the current filters.</td></tr>}
    </tbody></table></div>
  );
}

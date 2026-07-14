import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminApi } from '@/lib/api';
import DeviceUuidCard from '@/components/device-uuid-card';
import DeviceStateControl from '@/components/device-state-control';
import DeprovisionDeviceControl from '@/components/deprovision-device-control';
import AeroSenseCommandPanel from '@/components/aerosense-command-panel';
import { resolveDeviceRouteParams } from '@/lib/device-navigation';
import { deprovisionDeviceAction, executeCommandAction, transitionDeviceAction } from '../../actions';

export default async function DeviceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await resolveDeviceRouteParams(params);
  const query = await searchParams;
  const api = await getAdminApi();
  const device = await api.getDevice(id).catch(() => null);
  if (!device) notFound();
  const stateAction = transitionDeviceAction.bind(null, device.id);
  const deprovisionAction = deprovisionDeviceAction.bind(null, device.id);
  const commandAction = executeCommandAction.bind(null, device.id);
  return <>{query.created === '1' && <p className="form-success" role="status">Device created successfully. UUID: <code>{device.id}</code></p>}<header className="page-header"><div><div className="eyebrow">DEVICE DETAIL</div><h1>{device.serial}</h1><p>{device.roomLabel} · {device.transport} · {device.deviceType}</p></div><Link href={`/devices/${device.id}/label/print` as any}>Print QR label</Link></header><DeviceUuidCard id={device.id} serial={device.serial} printHref={`/devices/${device.id}/label/print`} /><div className="detail-grid"><section className="panel"><h2>Lifecycle controls</h2><DeviceStateControl currentState={device.managementState} action={stateAction} /><DeprovisionDeviceControl action={deprovisionAction} /></section><section className="panel"><h2>Assignment boundary</h2><p className="assignment-readonly">{device.userId ? `Assigned patient: ${device.userId}` : 'Unassigned — caregiver assignment is handled by the mobile app.'}</p><dl className="facts"><dt>Management state</dt><dd>{device.managementState}</dd><dt>Connectivity</dt><dd>{device.status}</dd><dt>Firmware</dt><dd>{device.firmwareVersion}</dd></dl></section></div>{device.transport === 'aerosense_tcp' && <section className="panel"><AeroSenseCommandPanel action={commandAction} /></section>}</>;
}

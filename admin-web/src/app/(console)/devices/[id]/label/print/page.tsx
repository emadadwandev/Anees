import { getAdminApi } from '@/lib/api';

export default async function PrintDeviceLabelPage({ params }: { params: { id: string } }) {
  const device = await (await getAdminApi()).getDevice(params.id);
  return <main className="print-label"><div className="eyebrow">ANEES SENSOR</div><h1>{device.serial}</h1><p>{device.roomLabel}</p><code>{device.id}</code><small>Scan or enter this UUID in the caregiver mobile app.</small><script dangerouslySetInnerHTML={{ __html: 'window.addEventListener("load", () => window.print())' }} /></main>;
}

import { getAdminApi } from '@/lib/api';
import QRCode from 'qrcode';

export default async function PrintDeviceLabelPage({ params }: { params: { id: string } }) {
  const device = await (await getAdminApi()).getDevice(params.id);
  const qrDataUrl = await QRCode.toDataURL(device.id, { errorCorrectionLevel: 'M', margin: 2, width: 360 });
  return <main className="print-label"><div className="eyebrow">ANEES SENSOR</div><h1>{device.serial}</h1><p>{device.roomLabel}</p><img src={qrDataUrl} alt={`QR code for device ${device.id}`} /><code>{device.id}</code><small>Scan this QR code in the caregiver mobile app.</small><script dangerouslySetInnerHTML={{ __html: 'window.addEventListener("load", () => window.print())' }} /></main>;
}

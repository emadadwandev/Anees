'use client';

import { useState } from 'react';

export function getDeviceLabelText(id: string, serial: string) {
  return `ANEES SENSOR\nUUID: ${id}\nSERIAL: ${serial}`;
}

export function getDeviceQrValue(id: string) {
  return id;
}

export default function DeviceUuidCard({ id, serial, printHref }: { id: string; serial: string; printHref: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }
  return (
    <section className="uuid-card" aria-label="Device UUID">
      <div><span className="eyebrow">IMMUTABLE DEVICE UUID</span><code>{id}</code><small>Print a QR label for the caregiver mobile app.</small></div>
      <div className="button-row"><button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy UUID'}</button><button type="button" onClick={() => { window.location.href = printHref; }}>Print QR label</button></div>
    </section>
  );
}

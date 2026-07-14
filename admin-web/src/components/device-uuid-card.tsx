'use client';

import { useState } from 'react';

export function getDeviceLabelText(id: string, serial: string) {
  return `ANEES SENSOR\nUUID: ${id}\nSERIAL: ${serial}`;
}

export default function DeviceUuidCard({ id, serial }: { id: string; serial: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }
  return (
    <section className="uuid-card" aria-label="Device UUID">
      <div><span className="eyebrow">IMMUTABLE DEVICE UUID</span><code>{id}</code><small>Attach this UUID label to the physical sensor box.</small></div>
      <div className="button-row"><button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy UUID'}</button><button type="button" onClick={() => window.print()}>Print label</button></div>
    </section>
  );
}

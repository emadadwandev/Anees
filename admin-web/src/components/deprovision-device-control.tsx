'use client';

import { useState } from 'react';

export default function DeprovisionDeviceControl({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [reason, setReason] = useState('');
  function submit(event: React.FormEvent<HTMLFormElement>) {
    if (!reason.trim() || !window.confirm('Deprovision this device? This cannot be undone.')) event.preventDefault();
  }
  return <form action={action} onSubmit={submit} className="stack-form danger-form"><label htmlFor="deprovision-reason">Deprovision reason (irreversible)</label><input id="deprovision-reason" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} required /><button type="submit">Deprovision device</button></form>;
}

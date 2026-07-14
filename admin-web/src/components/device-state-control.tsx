'use client';

import { useState } from 'react';
import type { DeviceManagementState } from '@/lib/api';

export function validateLifecycleReason(reason: string) {
  return reason.trim().length > 0;
}

export default function DeviceStateControl({
  currentState,
  action,
}: {
  currentState: DeviceManagementState;
  action: (formData: FormData) => Promise<void>;
}) {
  const [state, setState] = useState<DeviceManagementState>(currentState);
  const [reason, setReason] = useState('');
  const needsConfirmation = state === 'disabled';

  function submit(event: React.FormEvent<HTMLFormElement>) {
    if (!validateLifecycleReason(reason)) {
      event.preventDefault();
      return;
    }
    if (needsConfirmation && !window.confirm('Disable clinical processing for this device?')) event.preventDefault();
  }

  return (
    <form action={action} onSubmit={submit} className="stack-form">
      <label htmlFor="state">Management state</label>
      <select id="state" name="state" value={state} onChange={(event) => setState(event.target.value as DeviceManagementState)}>
        <option value="enabled">Enabled</option>
        <option value="maintenance">Maintenance</option>
        <option value="disabled">Disabled</option>
      </select>
      <label htmlFor="reason">Reason (required)</label>
      <input id="reason" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} required placeholder="Why is this state changing?" />
      <button type="submit">Save lifecycle state</button>
    </form>
  );
}

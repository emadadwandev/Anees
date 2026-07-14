'use client';

import { useState } from 'react';

export const AEROSENSE_COMMANDS = [
  'wavve.report_interval.set', 'wavve.report_interval.get', 'wavve.bed_exit_timer.set', 'wavve.bed_exit_timer.get',
  'assure.installation_height.set', 'assure.installation_height.get', 'assure.fall_buffer_time.set', 'assure.fall_buffer_time.get',
  'assure.working_range.set', 'assure.working_range.get', 'assure.fall_mode.set', 'assure.fall_mode.get',
] as const;

export default function AeroSenseCommandPanel({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [command, setCommand] = useState<string>(AEROSENSE_COMMANDS[0]);
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const isGet = command.endsWith('.get');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('pending');
    setMessage('');
    try {
      await action(new FormData(event.currentTarget));
      setStatus('success');
      setMessage('Command completed and was recorded in the audit log.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Command failed.');
    }
  }
  return <form onSubmit={submit} className="command-panel"><h2>AeroSense test command</h2><p>Only the documented command allowlist is exposed here.</p><label htmlFor="command">Command</label><select id="command" name="command" value={command} onChange={(event) => setCommand(event.target.value)}>{AEROSENSE_COMMANDS.map((name) => <option key={name}>{name}</option>)}</select>{!isGet && <><label htmlFor="value">Value</label><input id="value" name="value" placeholder="Enter command value" required /></>}<button type="submit" disabled={status === 'pending'}>{status === 'pending' ? 'Waiting for sensor…' : isGet ? 'Read setting' : 'Send setting'}</button>{message && <p className={status === 'error' ? 'form-error' : 'form-success'} role="status">{message}</p>}</form>;
}

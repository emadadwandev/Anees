import { getAdminApi } from '@/lib/api';

export default async function AuditPage() {
  const entries = await (await getAdminApi()).getAudit({ limit: '100' });
  return <><header className="page-header"><div><div className="eyebrow">IMMUTABLE FEED</div><h1>Audit log</h1><p>Administrative actions only. Medical payloads and command responses are never rendered here.</p></div></header><section className="panel"><div className="table-wrap"><table><thead><tr><th>Time</th><th>Action</th><th>Resource</th><th>Actor</th><th>Details</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{new Date(entry.timestamp).toLocaleString()}</td><td>{entry.action}</td><td><code>{entry.resourceId ?? '—'}</code></td><td><code>{entry.actorId}</code></td><td>{Object.entries(entry.details).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}</td></tr>)}</tbody></table></div></section></>;
}

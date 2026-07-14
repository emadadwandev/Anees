import type { SystemHealth } from '@/lib/api';

export default function SystemHealthGrid({ health }: { health: SystemHealth }) {
  return <div className="health-grid">{Object.entries(health.dependencies).map(([name, status]) => <div className="health-item" key={name}><span>{name}</span><strong className={status === 'healthy' ? 'healthy' : 'unhealthy'}>{status}</strong></div>)}<div className="health-item"><span>Rejected frames</span><strong>{health.metrics.rejectedFrames ?? '—'}</strong></div></div>;
}

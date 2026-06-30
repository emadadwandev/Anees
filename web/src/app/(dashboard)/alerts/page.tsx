'use client';

import { useState, useEffect } from 'react';
import { getAlerts } from '@/lib/api';
import { AlertCard } from '@/components/alerts/AlertCard';
import { useAlerts } from '@/hooks/useAlerts';
import type { AlertEvent } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

export default function AlertsPage() {
  const { activeAlerts } = useAlerts();
  const [history, setHistory] = useState<AlertEvent[]>([]);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === 'history') {
      setLoading(true);
      getAlerts()
        .then((alerts) =>
          setHistory(alerts.filter((a) => a.status === 'resolved' || a.status === 'false_alarm')),
        )
        .finally(() => setLoading(false));
    }
  }, [tab]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Alerts Center</h1>

      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {(['active', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
            {t === 'active' && activeAlerts.length > 0 && (
              <span className="ml-2 bg-danger text-white text-xs rounded-full px-1.5 py-0.5">
                {activeAlerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'active' && (
        <div className="space-y-3">
          {activeAlerts.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">No active alerts</p>
          ) : (
            activeAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          {loading && <p className="text-gray-400 text-sm">Loading…</p>}
          {!loading && history.length === 0 && (
            <p className="text-gray-500 text-sm py-8 text-center">No resolved alerts</p>
          )}
          {history.map((alert) => (
            <div
              key={alert.id}
              className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-sm flex items-center justify-between"
            >
              <div>
                <span className="font-medium text-gray-800">
                  {alert.patientName ?? alert.patientId}
                </span>
                <span className="text-gray-400 ml-2">{alert.patientRoom}</span>
              </div>
              <div className="flex items-center gap-4 text-gray-500">
                <span className="capitalize">{alert.type.replace('_', ' ')}</span>
                <span>{formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    alert.status === 'resolved'
                      ? 'bg-green-100 text-success'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {alert.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

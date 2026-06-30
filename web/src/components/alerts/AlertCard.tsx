'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Activity, Wifi } from 'lucide-react';
import { clsx } from 'clsx';
import { acknowledgeAlert } from '@/lib/api';
import { useAlertStore } from '@/lib/store';
import { IntercomModal } from './IntercomModal';
import type { AlertEvent } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

const TYPE_ICON = {
  fall: AlertTriangle,
  vital_anomaly: Activity,
  system_offline: Wifi,
} as const;

const CARD_STYLES: Record<string, string> = {
  fall_active: 'border-danger bg-red-50 animate-pulse-border',
  vital_anomaly: 'border-warning bg-orange-50',
  system_offline: 'border-gray-300 bg-gray-50',
  default: 'border-gray-200 bg-white',
};

interface Props {
  alert: AlertEvent;
}

export function AlertCard({ alert }: Props) {
  const [elapsed, setElapsed] = useState('');
  const [ackLoading, setAckLoading] = useState(false);
  const [intercomOpen, setIntercomOpen] = useState(false);
  const acknowledgeInStore = useAlertStore((s) => s.acknowledgeAlert);

  useEffect(() => {
    function update() {
      setElapsed(formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true }));
    }
    update();
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, [alert.triggeredAt]);

  async function handleAcknowledge() {
    setAckLoading(true);
    try {
      await acknowledgeAlert(alert.id);
      acknowledgeInStore(alert.id);
    } finally {
      setAckLoading(false);
    }
  }

  const Icon = TYPE_ICON[alert.type] ?? AlertTriangle;
  const cardStyle =
    alert.type === 'fall' && alert.status === 'dispatched'
      ? CARD_STYLES.fall_active
      : alert.type === 'vital_anomaly'
      ? CARD_STYLES.vital_anomaly
      : CARD_STYLES.default;

  return (
    <>
      <div className={clsx('rounded-xl border-2 p-4 transition-all', cardStyle)}>
        <div className="flex items-start gap-3">
          <div
            className={clsx(
              'p-2 rounded-lg shrink-0',
              alert.type === 'fall' ? 'bg-red-100' : alert.type === 'vital_anomaly' ? 'bg-orange-100' : 'bg-gray-100',
            )}
          >
            <Icon
              size={18}
              className={
                alert.type === 'fall' ? 'text-danger' : alert.type === 'vital_anomaly' ? 'text-warning' : 'text-gray-500'
              }
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-gray-900 truncate">
                {alert.patientName ?? alert.patientId}
              </p>
              <span className="text-xs text-gray-400 shrink-0">{elapsed}</span>
            </div>
            {alert.patientRoom && (
              <p className="text-xs text-gray-500 mt-0.5">Room {alert.patientRoom}</p>
            )}
            <p className="text-xs font-medium capitalize mt-1 text-gray-700">
              {alert.type.replace('_', ' ')}
            </p>
          </div>
        </div>

        {alert.status !== 'acknowledged' && alert.status !== 'resolved' && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAcknowledge}
              disabled={ackLoading}
              className="flex-1 text-xs font-medium py-1.5 px-3 border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
            >
              {ackLoading ? 'Acknowledging…' : 'Acknowledge'}
            </button>
            {alert.type === 'fall' && (
              <button
                onClick={() => setIntercomOpen(true)}
                className="flex-1 text-xs font-semibold py-1.5 px-3 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Open Intercom
              </button>
            )}
          </div>
        )}
      </div>

      {intercomOpen && (
        <IntercomModal
          patientId={alert.patientId}
          onClose={() => setIntercomOpen(false)}
        />
      )}
    </>
  );
}

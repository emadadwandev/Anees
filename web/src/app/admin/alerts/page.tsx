'use client';

import { useEffect, useState } from 'react';
import { useAdminStore } from '@/lib/admin-store';
import { AlertsGrid } from '@/components/admin/AlertsGrid';
import { AlertHistoryTable } from '@/components/admin/AlertHistoryTable';
import { getAdminAlertHistory, getIntercomToken } from '@/lib/api';
import { MOCK_ALERT_HISTORY } from '@/lib/mock-data';
import type { AdminAlertEvent } from '@/lib/types';

export default function AdminAlertsPage() {
  const { caregiverSocket, clearUnread } = useAdminStore();
  const [history, setHistory] = useState<AdminAlertEvent[]>(MOCK_ALERT_HISTORY);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    clearUnread();
    getAdminAlertHistory(50)
      .then(setHistory)
      .catch(() => {}); // keep mock data on failure
  }, [clearUnread]);

  async function handleCall(patientId: string, room: string) {
    try {
      const { token, url } = await getIntercomToken(patientId);
      caregiverSocket?.emit('intercom.request', { patientId, token, url });
    } catch {
      // silent
    }
  }

  return (
    <div className="px-0 py-5 space-y-6">
      {/* Active incidents */}
      <section>
        <div className="flex items-center justify-between px-7 mb-3">
          <h2 className="text-[13px] font-semibold" style={{ color: 'var(--adm-t1)' }}>
            Active Incidents
          </h2>
        </div>
        <AlertsGrid onCall={handleCall} />
      </section>

      {/* History */}
      <section>
        <div className="flex items-center justify-between px-7 mb-3">
          <h2 className="text-[13px] font-semibold" style={{ color: 'var(--adm-t1)' }}>
            Alert History: Last 50
          </h2>
        </div>
        <AlertHistoryTable alerts={history} loading={loadingHistory} />
      </section>
    </div>
  );
}

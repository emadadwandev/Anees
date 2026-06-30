'use client';

import { useEffect, useState } from 'react';
import { useAdminStore } from '@/lib/admin-store';
import { AnalyticsPanel } from '@/components/admin/AnalyticsPanel';
import { getAdminAnalytics } from '@/lib/api';
import { MOCK_ANALYTICS } from '@/lib/mock-data';
import type { FacilityAnalytics } from '@/lib/types';

export default function AdminAnalyticsPage() {
  const stats = useAdminStore((s) => s.stats);
  const [analytics, setAnalytics] = useState<FacilityAnalytics>(MOCK_ANALYTICS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAdminAnalytics()
      .then(setAnalytics)
      .catch(() => {}); // keep mock data on failure
  }, []);

  return (
    <div className="py-5">
      <div className="px-7 mb-5">
        <h2 className="text-[13px] font-semibold" style={{ color: 'var(--adm-t1)' }}>
          Facility Analytics
        </h2>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--adm-t3)' }}>
          Alert frequency, type breakdown, and response time metrics
        </p>
      </div>
      <AnalyticsPanel analytics={analytics} stats={stats} loading={loading} />
    </div>
  );
}

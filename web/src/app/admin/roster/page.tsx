'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { KpiBar } from '@/components/admin/KpiBar';
import { PatientRosterTable } from '@/components/admin/PatientRosterTable';
import { PatientDetailPanel } from '@/components/admin/PatientDetailPanel';
import { useAdminStore } from '@/lib/admin-store';
import { getIntercomToken } from '@/lib/api';
import type { AdminPatient } from '@/lib/types';

export default function AdminRosterPage() {
  const [selected, setSelected] = useState<AdminPatient | null>(null);
  const [search, setSearch] = useState('');
  const caregiverSocket = useAdminStore((s) => s.caregiverSocket);

  async function handleCall(patient: AdminPatient) {
    try {
      const { token, url } = await getIntercomToken(patient.id);
      // LiveKit intercom: socket join + open IntercomModal
      // For now, emit via caregiver socket so the edge gateway hears it
      caregiverSocket?.emit('intercom.request', {
        patientId: patient.id,
        token,
        url,
      });
    } catch {
      // fallback: show toast
    }
  }

  return (
    <>
      <KpiBar />

      {/* Search + section label */}
      <div className="flex items-center justify-between px-7 pb-3">
        <p className="text-[11px]" style={{ color: 'var(--adm-t3)' }}>
          Showing all patients · sorted by alert priority
        </p>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--adm-border)', width: 220 }}
        >
          <Search size={13} style={{ color: 'var(--adm-t3)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search patients or rooms…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-[12px] w-full"
            style={{ color: 'var(--adm-t1)' }}
          />
        </div>
      </div>

      <PatientRosterTable
        onSelectPatient={setSelected}
        onCallPatient={handleCall}
        search={search}
      />

      <PatientDetailPanel
        patient={selected}
        onClose={() => setSelected(null)}
        onCall={handleCall}
      />
    </>
  );
}

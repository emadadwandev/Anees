'use client';

import { useState, useCallback } from 'react';
import type { AdminPatient } from '@/lib/types';
import { PatientRosterTable } from './PatientRosterTable';
import { PatientSlideOver } from './PatientSlideOver';

interface Props {
  initialPatients: AdminPatient[];
}

export function RosterWithPanel({ initialPatients }: Props) {
  const [selected, setSelected] = useState<AdminPatient | null>(null);
  const close = useCallback(() => setSelected(null), []);

  return (
    <>
      <PatientRosterTable initialPatients={initialPatients} onSelect={setSelected} />
      <PatientSlideOver patient={selected} onClose={close} />
    </>
  );
}

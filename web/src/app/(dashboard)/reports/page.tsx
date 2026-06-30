'use client';

import { useState, useEffect, useCallback } from 'react';
import { pdf } from '@react-pdf/renderer';
import { getPatients, getPatient, getSleepReport, getPatientAlerts, getVitalHistory, exportVitalsCSV } from '@/lib/api';
import { ClinicalReportPdf } from '@/components/reports/ClinicalReportPdf';
import type { Patient, PatientDetail, SleepReport, AlertEvent, VitalReading } from '@/lib/types';
import { format, subDays } from 'date-fns';
import { FileText, Download, Loader2 } from 'lucide-react';

export default function ReportsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [csvLoading, setCsvLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    getPatients().then((p) => {
      setPatients(p);
      if (p.length > 0) setSelectedPatient(p[0].id);
    }).catch(() => {});
  }, []);

  async function handleExportCSV() {
    if (!selectedPatient) return;
    setCsvLoading(true);
    try {
      const blob = await exportVitalsCSV(selectedPatient, startDate, endDate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vitals_${selectedPatient}_${startDate}_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setCsvLoading(false);
    }
  }

  const handleGeneratePdf = useCallback(async () => {
    if (!selectedPatient) return;
    setPdfLoading(true);
    setPdfError(null);

    try {
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      const [patient, alerts, vitalsRaw] = await Promise.all([
        getPatient(selectedPatient),
        getPatientAlerts(selectedPatient),
        getVitalHistory(selectedPatient, '30d', '1h'),
      ]);

      // Merge patient info from the dropdown list to fill any missing fields the backend omits
      const fromList = patients.find((p) => p.id === selectedPatient);
      const mergedPatient: PatientDetail = {
        ...patient,
        name:      patient.name      ?? fromList?.name      ?? 'Unknown',
        age:       patient.age       ?? fromList?.age        ?? 0,
        roomLabel: patient.roomLabel ?? fromList?.roomLabel  ?? '—',
      };

      let sleep: SleepReport | null = null;
      try {
        sleep = await getSleepReport(selectedPatient, yesterday);
      } catch {
        // non-fatal
      }

      // Filter to selected date range
      const start = new Date(startDate);
      const end   = new Date(endDate);
      end.setHours(23, 59, 59);

      const rangeAlerts = alerts.filter((a) => {
        const t = new Date(a.triggeredAt);
        return t >= start && t <= end;
      });

      const rangeVitals = vitalsRaw.filter((r) => {
        const t = new Date(r.time);
        return t >= start && t <= end;
      });

      const doc = (
        <ClinicalReportPdf
          patient={mergedPatient}
          sleep={sleep}
          alerts={rangeAlerts}
          vitals={rangeVitals}
          startDate={startDate}
          endDate={endDate}
        />
      );

      const blob = await pdf(doc).toBlob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `anees_report_${mergedPatient.name.replace(/\s+/g, '_')}_${startDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setPdfLoading(false);
    }
  }, [selectedPatient, startDate, endDate]);

  const selectedName = patients.find((p) => p.id === selectedPatient)?.name ?? '';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports & Export</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm max-w-xl space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
          <select
            value={selectedPatient}
            onChange={(e) => { setSelectedPatient(e.target.value); setPdfError(null); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.roomLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleExportCSV}
            disabled={!selectedPatient || csvLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {csvLoading
              ? <><Loader2 size={15} className="animate-spin" /> Exporting…</>
              : <><Download size={15} /> Export CSV</>}
          </button>
          <button
            onClick={handleGeneratePdf}
            disabled={!selectedPatient || pdfLoading}
            className="flex-1 flex items-center justify-center gap-2 border border-primary text-primary rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-50 transition-colors disabled:opacity-60"
          >
            {pdfLoading
              ? <><Loader2 size={15} className="animate-spin" /> Building PDF…</>
              : <><FileText size={15} /> Generate PDF</>}
          </button>
        </div>

        {pdfError && (
          <p className="text-xs text-danger">{pdfError}</p>
        )}
      </div>

      <div className="max-w-xl space-y-2 text-xs text-gray-400">
        <p>
          <span className="font-medium text-gray-500">CSV</span> — all vital readings (HR, RR, signal quality) at raw 5-minute resolution.
        </p>
        <p>
          <span className="font-medium text-gray-500">PDF</span> — clinical summary including patient info, sleep report (last night), and alert history for the selected date range. Generated client-side.
        </p>
      </div>
    </div>
  );
}

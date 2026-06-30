'use client';

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { getSleepReport } from '@/lib/api';
import type { SleepReport, SleepStage } from '@/lib/types';

const STAGE_COLORS: Record<SleepStage, string> = {
  deep:  '#3730a3',
  light: '#3b82f6',
  rem:   '#7c3aed',
  awake: '#f59e0b',
};

const STAGE_ORDER: SleepStage[] = ['deep', 'light', 'rem', 'awake'];

const FRAGMENTATION_LABEL: Record<string, { label: string; color: string }> = {
  low:      { label: 'Low',      color: 'text-success' },
  moderate: { label: 'Moderate', color: 'text-warning' },
  high:     { label: 'High',     color: 'text-danger' },
};

function fragRisk(index: number) {
  if (index < 0.2) return 'low';
  if (index < 0.4) return 'moderate';
  return 'high';
}

interface Props {
  patientId: string;
  date: string;
}

export function SleepHypnogram({ patientId, date }: Props) {
  const [report, setReport] = useState<SleepReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSleepReport(patientId, date)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [patientId, date]);

  if (loading) {
    return <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Loading…</div>;
  }

  if (!report) {
    return (
      <div className="h-40 flex items-center justify-center text-gray-300 text-sm">
        No sleep data for this date
      </div>
    );
  }

  // Build hypnogram bars from epoch data if available
  const epochBars =
    report.epochs?.map((e) => ({
      time: e.time,
      stage: e.stage,
      value: 1,
    })) ?? [];

  const pctData = STAGE_ORDER.map((stage) => ({
    stage,
    pct: report[`${stage}Pct` as keyof SleepReport] as number,
  }));

  const totalHours = Math.floor(report.totalSleepMin / 60);
  const totalMins = report.totalSleepMin % 60;
  const risk = fragRisk(report.fragmentationIndex);
  const riskStyle = FRAGMENTATION_LABEL[risk];

  return (
    <div className="space-y-4">
      {/* Stage % bar chart */}
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={pctData} layout="vertical" barSize={20}>
          <XAxis type="number" unit="%" tick={{ fontSize: 11 }} domain={[0, 100]} />
          <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} width={44} />
          <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
            {pctData.map((entry) => (
              <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-gray-400 text-xs">Total Sleep</p>
          <p className="font-semibold text-gray-800 mt-0.5">
            {totalHours}h {totalMins}m
          </p>
        </div>
        <div className="bg-indigo-50 rounded-lg p-3">
          <p className="text-gray-400 text-xs">Deep</p>
          <p className="font-semibold text-indigo-700 mt-0.5">{report.deepPct.toFixed(1)}%</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-3">
          <p className="text-gray-400 text-xs">REM</p>
          <p className="font-semibold text-purple-700 mt-0.5">{report.remPct.toFixed(1)}%</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-gray-400 text-xs">Fragmentation</p>
          <p className={`font-semibold mt-0.5 ${riskStyle.color}`}>
            {riskStyle.label} ({report.fragmentationIndex.toFixed(2)})
          </p>
        </div>
      </div>
    </div>
  );
}

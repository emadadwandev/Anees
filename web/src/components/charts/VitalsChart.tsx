'use client';

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
  ReferenceArea,
} from 'recharts';
import { getVitalHistory } from '@/lib/api';
import type { VitalReading, TimeRange, VitalMetric } from '@/lib/types';
import { format, parseISO } from 'date-fns';

const RANGES: TimeRange[] = ['6h', '24h', '7d', '30d'];
const RESOLUTION: Record<TimeRange, string> = {
  '6h': '1m', '24h': '5m', '7d': '30m', '30d': '2h',
};

interface Props {
  patientId: string;
  timeRange?: TimeRange;
  metric?: VitalMetric;
}

export function VitalsChart({ patientId, timeRange: defaultRange = '24h', metric = 'both' }: Props) {
  const [range, setRange] = useState<TimeRange>(defaultRange);
  const [activeMetric, setActiveMetric] = useState<VitalMetric>(metric);
  const [data, setData] = useState<VitalReading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getVitalHistory(patientId, range, RESOLUTION[range])
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [patientId, range]);

  function formatXAxis(time: string) {
    try {
      const d = parseISO(time);
      return range === '7d' || range === '30d' ? format(d, 'MMM d') : format(d, 'HH:mm');
    } catch {
      return time;
    }
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                range === r ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['hr', 'rr', 'both'] as VitalMetric[]).map((m) => (
            <button
              key={m}
              onClick={() => setActiveMetric(m)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                activeMetric === m ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-56 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
      ) : data.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-gray-300 text-sm">No data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="time"
              tickFormatter={formatXAxis}
              tick={{ fontSize: 11 }}
              minTickGap={40}
            />
            <YAxis tick={{ fontSize: 11 }} width={36} />
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value} ${name === 'heartRateBpm' ? 'bpm' : 'brpm'}`,
                name === 'heartRateBpm' ? 'Heart Rate' : 'Resp Rate',
              ]}
              labelFormatter={(label) => formatXAxis(label as string)}
            />
            <Legend
              formatter={(v) => (v === 'heartRateBpm' ? 'Heart Rate' : 'Resp Rate')}
            />

            {/* Anomaly reference bands (example static thresholds — real data from API) */}
            <ReferenceArea y1={110} y2={200} fill="#fee2e2" fillOpacity={0.4} label="" />
            <ReferenceArea y1={0} y2={45} fill="#fee2e2" fillOpacity={0.4} label="" />

            {(activeMetric === 'hr' || activeMetric === 'both') && (
              <Line
                type="monotone"
                dataKey="heartRateBpm"
                stroke="#1A73E8"
                dot={false}
                strokeWidth={1.5}
                name="heartRateBpm"
              />
            )}
            {(activeMetric === 'rr' || activeMetric === 'both') && (
              <Line
                type="monotone"
                dataKey="respRateBrpm"
                stroke="#0d9488"
                dot={false}
                strokeWidth={1.5}
                name="respRateBrpm"
              />
            )}

            {range === '30d' && <Brush dataKey="time" height={20} tickFormatter={formatXAxis} />}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

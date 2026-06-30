'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ScatterChart,
  Scatter,
} from 'recharts';
import { getPatients } from '@/lib/api';
import type { Patient } from '@/lib/types';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Mock heatmap data until real analytics endpoint is wired
function generateHeatmapData() {
  return DAYS.flatMap((day, di) =>
    HOURS.map((hour) => ({
      day: di,
      hour,
      count: Math.floor(Math.random() * 5),
    })),
  );
}

export default function AnalyticsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const heatmapData = generateHeatmapData();

  useEffect(() => {
    getPatients().then(setPatients).catch(() => {});
  }, []);

  const scatterData = patients.map((p) => ({
    hr: p.latestHr ?? 72,
    rr: p.latestRr ?? 14,
    name: p.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* HR/RR population scatter */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Population HR vs RR Distribution
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hr" name="HR" unit=" bpm" label={{ value: 'Heart Rate', position: 'insideBottom', offset: -4 }} />
              <YAxis dataKey="rr" name="RR" unit=" brpm" label={{ value: 'Resp Rate', angle: -90, position: 'insideLeft' }} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={scatterData} fill="#1A73E8" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Alert frequency heatmap */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Alert Frequency (Hour × Day)
          </h2>
          <div className="overflow-x-auto">
            <svg width={480} height={200}>
              {heatmapData.map(({ day, hour, count }) => {
                const cellSize = 16;
                const opacity = count === 0 ? 0.05 : count / 5;
                return (
                  <rect
                    key={`${day}-${hour}`}
                    x={hour * (cellSize + 2) + 32}
                    y={day * (cellSize + 2) + 16}
                    width={cellSize}
                    height={cellSize}
                    rx={3}
                    fill={`rgba(211, 47, 47, ${opacity})`}
                    stroke="#f3f4f6"
                    strokeWidth={1}
                  >
                    <title>{`${DAYS[day]} ${hour}:00 — ${count} alerts`}</title>
                  </rect>
                );
              })}
              {DAYS.map((d, i) => (
                <text
                  key={d}
                  x={8}
                  y={i * 18 + 26}
                  fontSize={10}
                  fill="#6b7280"
                  dominantBaseline="middle"
                >
                  {d}
                </text>
              ))}
              {[0, 6, 12, 18, 23].map((h) => (
                <text
                  key={h}
                  x={h * 18 + 34}
                  y={8}
                  fontSize={9}
                  fill="#6b7280"
                  textAnchor="middle"
                >
                  {h}
                </text>
              ))}
            </svg>
          </div>
          <p className="text-xs text-gray-400 mt-2">Darker = more alerts in that hour</p>
        </div>

        {/* Sleep quality trends (placeholder multi-line) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Sleep Quality Trends (30-day facility average)
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={Array.from({ length: 30 }, (_, i) => ({
                day: i + 1,
                deepPct: 15 + Math.random() * 10,
                remPct: 20 + Math.random() * 8,
                awakePct: 5 + Math.random() * 10,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" label={{ value: 'Day', position: 'insideBottom', offset: -4 }} />
              <YAxis unit="%" />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
              <Legend />
              <Line type="monotone" dataKey="deepPct" name="Deep" stroke="#3730a3" dot={false} />
              <Line type="monotone" dataKey="remPct" name="REM" stroke="#7c3aed" dot={false} />
              <Line type="monotone" dataKey="awakePct" name="Awake" stroke="#f59e0b" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

'use client';

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Svg,
  Rect,
  Polyline,
  Line,
  G,
} from '@react-pdf/renderer';
import { format } from 'date-fns';
import type { PatientDetail, SleepReport, AlertEvent, VitalReading } from '@/lib/types';

Font.registerHyphenationCallback((w) => [w]);

const C = {
  blue:    '#1A73E8',
  indigo:  '#3730A3',
  violet:  '#7C3AED',
  sky:     '#3B82F6',
  amber:   '#F59E0B',
  red:     '#DC2626',
  green:   '#166534',
  t1:      '#111827',
  t2:      '#374151',
  t3:      '#6B7280',
  t4:      '#9CA3AF',
  border:  '#E5E7EB',
  bg:      '#F9FAFB',
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 52,
    paddingHorizontal: 44,
    color: C.t1,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.blue, letterSpacing: 0.3 },
  headerSub:   { fontSize: 9, color: C.t3, marginTop: 3 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: C.t2,
    marginTop: 18,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  row:   { flexDirection: 'row', marginBottom: 4 },
  label: { width: 130, color: C.t3, fontSize: 9 },
  value: { flex: 1, color: C.t1 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  statBox: {
    width: '22%',
    backgroundColor: C.bg,
    borderRadius: 4,
    padding: 8,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  statLabel: { fontSize: 8, color: C.t4, marginBottom: 2 },
  statValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.t1 },
  alertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 44,
    right: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: C.t4,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 6,
  },
  chartLabel: { fontSize: 8, color: C.t3, marginBottom: 3 },
  chartRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  vitalsStatRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  vitalsStatCell: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 4,
    padding: 8,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  vsCellLabel: { fontSize: 8, color: C.t4, marginBottom: 4 },
  vsCellMetric: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  vsCellKey: { fontSize: 8, color: C.t3 },
  vsCellVal: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.t1 },
});

const STAGE_COLORS: Record<string, string> = {
  deep: C.indigo, rem: C.violet, light: C.sky, awake: C.amber,
};

// ── Chart helpers ────────────────────────────────────────────────────────────

function downsample(readings: VitalReading[], maxPoints: number): VitalReading[] {
  if (readings.length <= maxPoints) return readings;
  const step = readings.length / maxPoints;
  return Array.from({ length: maxPoints }, (_, i) => readings[Math.floor(i * step)]);
}

function buildPolylinePoints(
  readings: VitalReading[],
  getValue: (r: VitalReading) => number,
  yMin: number,
  yMax: number,
  chartW: number,
  chartH: number,
  padLeft: number,
  padTop: number,
): string {
  if (readings.length < 2) return '';
  const range = yMax - yMin || 1;
  return readings
    .map((r, i) => {
      const x = padLeft + (i / (readings.length - 1)) * chartW;
      const y = padTop + chartH - ((getValue(r) - yMin) / range) * chartH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

interface ChartProps {
  readings: VitalReading[];
  getValue: (r: VitalReading) => number;
  color: string;
  yMin: number;
  yMax: number;
  yTicks: number[];
  width: number;
  height: number;
}

function VitalsChart({ readings, getValue, color, yMin, yMax, yTicks, width, height }: ChartProps) {
  const pad = { top: 6, right: 6, bottom: 6, left: 28 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const sampled = downsample(readings, 120);
  const points  = buildPolylinePoints(sampled, getValue, yMin, yMax, chartW, chartH, pad.left, pad.top);
  const range   = yMax - yMin || 1;

  return (
    <Svg width={width} height={height}>
      {/* chart bg */}
      <Rect
        x={pad.left} y={pad.top}
        width={chartW} height={chartH}
        fill={C.bg} stroke={C.border} strokeWidth={0.5}
        rx={2}
      />
      {/* grid lines + y-axis labels */}
      {yTicks.map((tick) => {
        const y = pad.top + chartH - ((tick - yMin) / range) * chartH;
        return (
          <G key={tick}>
            <Line
              x1={pad.left} y1={y} x2={pad.left + chartW} y2={y}
              stroke={C.border} strokeWidth={0.4}
            />
          </G>
        );
      })}
      {/* data line */}
      {points ? (
        <Polyline points={points} fill="none" stroke={color} strokeWidth={1.2} />
      ) : null}
    </Svg>
  );
}

// ── Stat helpers ─────────────────────────────────────────────────────────────

function vitalStats(readings: VitalReading[], get: (r: VitalReading) => number) {
  if (!readings.length) return { min: 0, max: 0, avg: 0 };
  const vals = readings.map(get);
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  const avg  = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  return { min, max, avg };
}

// ── PDF Document ─────────────────────────────────────────────────────────────

interface Props {
  patient: PatientDetail;
  sleep: SleepReport | null;
  alerts: AlertEvent[];
  vitals: VitalReading[];
  startDate: string;
  endDate: string;
}

export function ClinicalReportPdf({ patient, sleep, alerts, vitals, startDate, endDate }: Props) {
  const generatedAt   = format(new Date(), 'PPP p');
  const totalSleepH   = sleep ? Math.floor(sleep.totalSleepMin / 60) : 0;
  const totalSleepM   = sleep ? sleep.totalSleepMin % 60 : 0;

  const hrStats  = vitalStats(vitals, (r) => r.heartRateBpm);
  const rrStats  = vitalStats(vitals, (r) => r.respRateBrpm);
  const sqAvg    = vitals.length
    ? Math.round((vitals.reduce((s, r) => s + r.signalQuality, 0) / vitals.length) * 100)
    : 0;

  const hrYMin   = Math.max(30,  Math.floor((hrStats.min - 5) / 10) * 10);
  const hrYMax   = Math.min(180, Math.ceil((hrStats.max  + 5) / 10) * 10);
  const rrYMin   = Math.max(4,   Math.floor((rrStats.min - 2) / 2)  * 2);
  const rrYMax   = Math.min(40,  Math.ceil((rrStats.max  + 2) / 2)  * 2);

  const hrTicks  = [hrYMin, Math.round((hrYMin + hrYMax) / 2), hrYMax];
  const rrTicks  = [rrYMin, Math.round((rrYMin + rrYMax) / 2), rrYMax];

  const CHART_W  = 235;
  const CHART_H  = 70;

  const alertStatus = (status: string) => ({
    fontSize: 8,
    color:
      status === 'resolved'    ? C.green
      : status === 'false_alarm' ? C.t3
      : C.red,
    fontFamily: 'Helvetica-Bold' as const,
    textTransform: 'capitalize' as const,
  });

  return (
    <Document title={`Anees Clinical Report — ${patient.name}`} author="Anees Healthcare">
      <Page size="A4" style={styles.page}>

        {/* ── Header ───────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Anees Health — Clinical Report</Text>
            <Text style={styles.headerSub}>{startDate} → {endDate}</Text>
          </View>
          <Text style={styles.headerSub}>Generated {generatedAt}</Text>
        </View>

        {/* ── Patient Information ───────────────────────────── */}
        <Text style={styles.sectionTitle}>Patient Information</Text>
        <View style={styles.row}><Text style={styles.label}>Name</Text><Text style={styles.value}>{patient.name}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Age</Text><Text style={styles.value}>{patient.age}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Room</Text><Text style={styles.value}>{patient.roomLabel}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Device Serial</Text><Text style={styles.value}>{patient.device?.serial ?? '—'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Firmware</Text><Text style={styles.value}>{patient.device?.firmwareVersion ?? '—'}</Text></View>
        <View style={styles.row}>
          <Text style={styles.label}>Device Status</Text>
          <Text style={[styles.value, { color: patient.device?.status === 'online' ? C.green : C.red }]}>
            {patient.device?.status ?? '—'}
          </Text>
        </View>

        {/* ── Vital Signs ───────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Vital Signs — {startDate} to {endDate}</Text>

        {vitals.length === 0 ? (
          <Text style={{ color: C.t4, fontSize: 9 }}>No vital data available for this period</Text>
        ) : (
          <>
            {/* Stats row */}
            <View style={styles.vitalsStatRow}>
              <View style={styles.vitalsStatCell}>
                <Text style={styles.vsCellLabel}>Heart Rate (bpm)</Text>
                <View style={styles.vsCellMetric}><Text style={styles.vsCellKey}>Min</Text><Text style={[styles.vsCellVal, { color: C.sky }]}>{hrStats.min}</Text></View>
                <View style={styles.vsCellMetric}><Text style={styles.vsCellKey}>Avg</Text><Text style={[styles.vsCellVal, { color: C.blue }]}>{hrStats.avg}</Text></View>
                <View style={styles.vsCellMetric}><Text style={styles.vsCellKey}>Max</Text><Text style={[styles.vsCellVal, { color: hrStats.max > 100 ? C.red : C.t1 }]}>{hrStats.max}</Text></View>
              </View>
              <View style={styles.vitalsStatCell}>
                <Text style={styles.vsCellLabel}>Resp. Rate (brpm)</Text>
                <View style={styles.vsCellMetric}><Text style={styles.vsCellKey}>Min</Text><Text style={[styles.vsCellVal, { color: C.sky }]}>{rrStats.min}</Text></View>
                <View style={styles.vsCellMetric}><Text style={styles.vsCellKey}>Avg</Text><Text style={[styles.vsCellVal, { color: C.blue }]}>{rrStats.avg}</Text></View>
                <View style={styles.vsCellMetric}><Text style={styles.vsCellKey}>Max</Text><Text style={[styles.vsCellVal, { color: rrStats.max > 20 ? C.amber : C.t1 }]}>{rrStats.max}</Text></View>
              </View>
              <View style={styles.vitalsStatCell}>
                <Text style={styles.vsCellLabel}>Signal Quality</Text>
                <View style={styles.vsCellMetric}><Text style={styles.vsCellKey}>Avg</Text>
                  <Text style={[styles.vsCellVal, { color: sqAvg >= 80 ? C.green : sqAvg >= 50 ? C.amber : C.red }]}>{sqAvg}%</Text>
                </View>
                <View style={styles.vsCellMetric}><Text style={styles.vsCellKey}>Readings</Text><Text style={styles.vsCellVal}>{vitals.length}</Text></View>
              </View>
              <View style={styles.vitalsStatCell}>
                <Text style={styles.vsCellLabel}>Normal Ranges</Text>
                <View style={styles.vsCellMetric}><Text style={styles.vsCellKey}>HR</Text><Text style={styles.vsCellVal}>50–100</Text></View>
                <View style={styles.vsCellMetric}><Text style={styles.vsCellKey}>RR</Text><Text style={styles.vsCellVal}>12–20</Text></View>
                <View style={styles.vsCellMetric}><Text style={styles.vsCellKey}>SpO2</Text><Text style={styles.vsCellVal}>≥95%</Text></View>
              </View>
            </View>

            {/* Charts side by side */}
            <View style={styles.chartRow}>
              <View>
                <Text style={styles.chartLabel}>Heart Rate Trend (bpm) — range {hrYMin}–{hrYMax}</Text>
                <VitalsChart
                  readings={vitals}
                  getValue={(r) => r.heartRateBpm}
                  color={C.blue}
                  yMin={hrYMin} yMax={hrYMax} yTicks={hrTicks}
                  width={CHART_W} height={CHART_H}
                />
              </View>
              <View>
                <Text style={styles.chartLabel}>Respiratory Rate Trend (brpm) — range {rrYMin}–{rrYMax}</Text>
                <VitalsChart
                  readings={vitals}
                  getValue={(r) => r.respRateBrpm}
                  color="#059669"
                  yMin={rrYMin} yMax={rrYMax} yTicks={rrTicks}
                  width={CHART_W} height={CHART_H}
                />
              </View>
            </View>

            {/* Anomaly summary */}
            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 4 }}>
              {(() => {
                const hrHigh  = vitals.filter((r) => r.heartRateBpm > 100).length;
                const hrLow   = vitals.filter((r) => r.heartRateBpm < 50).length;
                const rrHigh  = vitals.filter((r) => r.respRateBrpm > 20).length;
                const rrLow   = vitals.filter((r) => r.respRateBrpm < 12).length;
                const pct     = (n: number) => vitals.length ? `${((n / vitals.length) * 100).toFixed(1)}%` : '0%';
                return (
                  <>
                    <Text style={{ fontSize: 8, color: C.t3 }}>HR &gt;100: <Text style={{ color: hrHigh > 0 ? C.red : C.t3 }}>{hrHigh} readings ({pct(hrHigh)})</Text></Text>
                    <Text style={{ fontSize: 8, color: C.t3 }}>HR &lt;50: <Text style={{ color: hrLow  > 0 ? C.amber : C.t3 }}>{hrLow} readings ({pct(hrLow)})</Text></Text>
                    <Text style={{ fontSize: 8, color: C.t3 }}>RR &gt;20: <Text style={{ color: rrHigh > 0 ? C.amber : C.t3 }}>{rrHigh} readings ({pct(rrHigh)})</Text></Text>
                    <Text style={{ fontSize: 8, color: C.t3 }}>RR &lt;12: <Text style={{ color: rrLow  > 0 ? C.amber : C.t3 }}>{rrLow} readings ({pct(rrLow)})</Text></Text>
                  </>
                );
              })()}
            </View>
          </>
        )}

        {/* ── Sleep Summary ─────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Sleep Summary — Last Night</Text>
        {sleep ? (
          <>
            <View style={styles.statGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Total Sleep</Text>
                <Text style={styles.statValue}>{totalSleepH}h {totalSleepM}m</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Deep %</Text>
                <Text style={[styles.statValue, { color: STAGE_COLORS.deep }]}>{sleep.deepPct.toFixed(1)}%</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>REM %</Text>
                <Text style={[styles.statValue, { color: STAGE_COLORS.rem }]}>{sleep.remPct.toFixed(1)}%</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Fragmentation</Text>
                <Text style={styles.statValue}>{sleep.fragmentationIndex.toFixed(2)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', height: 14, borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
              {(['deep', 'rem', 'light', 'awake'] as const).map((s) => {
                const pct = sleep[`${s}Pct` as keyof SleepReport] as number;
                return pct > 0 ? (
                  <View key={s} style={{ height: 14, width: `${pct}%`, backgroundColor: STAGE_COLORS[s] }} />
                ) : null;
              })}
            </View>
            <Text style={{ fontSize: 8, color: C.t4 }}>
              Deep  |  REM  |  Light  |  Awake  — proportional to sleep time
            </Text>
          </>
        ) : (
          <Text style={{ color: C.t4, fontSize: 9 }}>No sleep data available</Text>
        )}

        {/* ── Alert History ─────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Alert History ({startDate} → {endDate})</Text>
        {alerts.length === 0 ? (
          <Text style={{ color: C.t4, fontSize: 9 }}>No alerts in this period</Text>
        ) : (
          <>
            <View style={[styles.alertRow, { borderBottomWidth: 1 }]}>
              <Text style={[styles.label, { fontFamily: 'Helvetica-Bold', fontSize: 8 }]}>Date / Time</Text>
              <Text style={[styles.label, { fontFamily: 'Helvetica-Bold', fontSize: 8 }]}>Type</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, width: 80 }}>Status</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, flex: 1 }}>Notes</Text>
            </View>
            {alerts.slice(0, 30).map((a) => (
              <View key={a.id} style={styles.alertRow}>
                <Text style={[styles.label, { fontSize: 9 }]}>
                  {format(new Date(a.triggeredAt), 'MMM d, HH:mm')}
                </Text>
                <Text style={[styles.label, { fontSize: 9 }]}>
                  {a.type === 'fall' ? 'Fall Detection' : 'Vital Anomaly'}
                </Text>
                <Text style={[alertStatus(a.status), { width: 80 }]}>
                  {a.status.replace(/_/g, ' ')}
                </Text>
                <Text style={{ flex: 1, fontSize: 9, color: C.t2 }}>{a.notes ?? '—'}</Text>
              </View>
            ))}
            {alerts.length > 30 && (
              <Text style={{ fontSize: 8, color: C.t4, marginTop: 4 }}>
                + {alerts.length - 30} more alerts not shown
              </Text>
            )}
          </>
        )}

        {/* ── Footer ───────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text>Anees Healthcare Platform — Confidential Clinical Document</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

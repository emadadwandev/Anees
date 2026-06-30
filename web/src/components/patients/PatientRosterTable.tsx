'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import type { AdminPatient, AlertPriority } from '@/lib/types';
import { ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ALERT_PRIORITY: Record<AlertPriority, number> = {
  fall_active: 0,
  vital_anomaly: 1,
  system_offline: 2,
  ok: 3,
};

type FilterTab = 'all' | 'fall' | 'warning' | 'offline' | 'stable';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',     label: 'All' },
  { id: 'fall',    label: 'Fall Alerts' },
  { id: 'warning', label: 'Warnings' },
  { id: 'offline', label: 'Offline' },
  { id: 'stable',  label: 'Stable' },
];

function avatarColor(name: string): string {
  const colors = [
    'var(--adm-blue)', 'var(--adm-green)', 'var(--adm-amber)',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); }
  catch { return '—'; }
}

function SignalBars({ quality }: { quality: number | null }) {
  if (quality === null) return <span style={{ color: 'var(--adm-t3)' }}>—</span>;
  const bars = 5;
  const filled = Math.round(quality * bars);
  const color = quality >= 0.8 ? 'var(--adm-green)' : quality >= 0.5 ? 'var(--adm-amber)' : 'var(--adm-red)';
  return (
    <span className="flex items-end gap-0.5">
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className="inline-block rounded-sm"
          style={{
            width: 3,
            height: 6 + i * 3,
            background: i < filled ? color : 'var(--adm-border-hi)',
          }}
        />
      ))}
    </span>
  );
}

function VitalValue({ value, unit, min, max }: { value: number | null; unit: string; min: number; max: number }) {
  if (value === null) return <span style={{ color: 'var(--adm-t3)' }}>—</span>;
  const color = value < min || value > max ? 'var(--adm-red)'
    : value < min * 1.1 || value > max * 0.9 ? 'var(--adm-amber)'
    : 'var(--adm-green)';
  return (
    <span className="font-mono font-semibold" style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>
      {value} <span className="text-xs font-normal" style={{ color: 'var(--adm-t3)' }}>{unit}</span>
    </span>
  );
}

function StatusBadge({ status }: { status: AlertPriority }) {
  const map: Record<AlertPriority, { cls: string; label: string }> = {
    fall_active:    { cls: 'adm-badge-red',   label: 'Fall Active' },
    vital_anomaly:  { cls: 'adm-badge-amber', label: 'Vital Anomaly' },
    system_offline: { cls: 'adm-badge-slate', label: 'Offline' },
    ok:             { cls: 'adm-badge-green', label: 'Stable' },
  };
  const { cls, label } = map[status];
  return <span className={`adm-badge ${cls} text-xs px-2 py-0.5 rounded-full font-semibold`}>{label}</span>;
}

const col = createColumnHelper<AdminPatient>();

interface Props {
  initialPatients: AdminPatient[];
  onSelect?: (patient: AdminPatient) => void;
}

export function PatientRosterTable({ initialPatients, onSelect }: Props) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const tabFiltered = useMemo(() => {
    const base = [...initialPatients].sort(
      (a, b) => ALERT_PRIORITY[a.alertStatus] - ALERT_PRIORITY[b.alertStatus],
    );
    if (activeTab === 'all')     return base;
    if (activeTab === 'fall')    return base.filter((p) => p.alertStatus === 'fall_active');
    if (activeTab === 'warning') return base.filter((p) => p.alertStatus === 'vital_anomaly');
    if (activeTab === 'offline') return base.filter((p) => p.deviceStatus === 'offline');
    if (activeTab === 'stable')  return base.filter((p) => p.alertStatus === 'ok');
    return base;
  }, [initialPatients, activeTab]);

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: 'Patient',
        cell: (info) => {
          const name = info.getValue();
          const p = info.row.original;
          return (
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: avatarColor(name) }}
              >
                {initials(name)}
              </div>
              <div>
                <p className="font-medium text-sm" style={{ color: 'var(--adm-t1)' }}>{name}</p>
                {p.age !== null && (
                  <p className="text-xs" style={{ color: 'var(--adm-t3)' }}>Age {p.age}</p>
                )}
              </div>
            </div>
          );
        },
      }),
      col.accessor('roomLabel', {
        header: 'Room',
        cell: (info) => (
          <span className="font-mono text-sm" style={{ color: 'var(--adm-t2)' }}>
            {info.getValue()}
          </span>
        ),
      }),
      col.accessor('latestHr', {
        header: 'HR',
        cell: (info) => <VitalValue value={info.getValue()} unit="bpm" min={50} max={100} />,
      }),
      col.accessor('latestRr', {
        header: 'RR',
        cell: (info) => <VitalValue value={info.getValue()} unit="brpm" min={12} max={20} />,
      }),
      col.accessor('signalQuality', {
        header: 'Signal',
        cell: (info) => <SignalBars quality={info.getValue()} />,
      }),
      col.accessor('alertStatus', {
        header: 'Status',
        cell: (info) => <StatusBadge status={info.getValue()} />,
        sortingFn: (a, b) =>
          ALERT_PRIORITY[a.original.alertStatus] - ALERT_PRIORITY[b.original.alertStatus],
      }),
      col.accessor('lastHeartbeat', {
        header: 'Last Seen',
        cell: (info) => (
          <span className="text-xs" style={{ color: 'var(--adm-t3)' }}>
            {relativeTime(info.getValue())}
          </span>
        ),
      }),
      col.display({
        id: 'actions',
        header: '',
        cell: (info) => (
          <button
            onClick={(e) => { e.stopPropagation(); onSelect ? onSelect(info.row.original) : router.push(`/patients/${info.row.original.id}`); }}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--adm-t3)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--adm-t1)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--adm-t3)'; }}
          >
            <ChevronRight size={16} />
          </button>
        ),
      }),
    ],
    [router],
  );

  const table = useReactTable({
    data: tabFiltered,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  return (
    <div className="adm-card rounded-xl overflow-hidden">
      {/* Tabs + filter */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid var(--adm-border)' }}
      >
        <div className="flex gap-1 flex-wrap">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                style={
                  active
                    ? { background: 'var(--adm-blue-dim)', color: 'var(--adm-blue)' }
                    : { color: 'var(--adm-t3)' }
                }
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--adm-card-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = '';
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          placeholder="Filter patients…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="text-xs rounded-lg px-3 py-1.5 focus:outline-none w-48"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--adm-border)',
            color: 'var(--adm-t1)',
          }}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} style={{ borderBottom: '1px solid var(--adm-border)' }}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{
                      color: 'var(--adm-t3)',
                      cursor: header.column.getCanSort() ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && <ChevronUp size={12} style={{ color: 'var(--adm-blue)' }} />}
                      {header.column.getIsSorted() === 'desc' && <ChevronDown size={12} style={{ color: 'var(--adm-blue)' }} />}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isCritical = row.original.alertStatus === 'fall_active';
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelect ? onSelect(row.original) : router.push(`/patients/${row.original.id}`)}
                  className={isCritical ? 'adm-alert-critical' : ''}
                  style={{ borderBottom: '1px solid var(--adm-border)', cursor: 'pointer' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--adm-card-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div
        className="flex items-center justify-between px-4 py-3 text-xs"
        style={{ borderTop: '1px solid var(--adm-border)', color: 'var(--adm-t3)' }}
      >
        <span>
          {table.getFilteredRowModel().rows.length} patient
          {table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1 rounded disabled:opacity-30 transition-colors"
            style={{ border: '1px solid var(--adm-border)', color: 'var(--adm-t2)' }}
            onMouseEnter={(e) => { if (table.getCanPreviousPage()) (e.currentTarget as HTMLButtonElement).style.background = 'var(--adm-card-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
          >
            Prev
          </button>
          <span className="px-3 py-1" style={{ color: 'var(--adm-t2)' }}>
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1 rounded disabled:opacity-30 transition-colors"
            style={{ border: '1px solid var(--adm-border)', color: 'var(--adm-t2)' }}
            onMouseEnter={(e) => { if (table.getCanNextPage()) (e.currentTarget as HTMLButtonElement).style.background = 'var(--adm-card-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

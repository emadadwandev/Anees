'use client';

import { useState, useEffect } from 'react';
import { getDevices, updateDeviceRoom } from '@/lib/api';
import type { Device } from '@/lib/types';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Check,
  X,
} from 'lucide-react';

type OcclusionStatus = 'none' | 'partial' | 'full';

const OCCLUSION_BADGE: Record<OcclusionStatus, { label: string; className: string }> = {
  none:    { label: 'Clear',   className: 'bg-green-100 text-success' },
  partial: { label: 'Partial', className: 'bg-amber-100 text-warning' },
  full:    { label: 'Full',    className: 'bg-red-100 text-danger' },
};

function SignalBar({ quality }: { quality: number }) {
  const pct = Math.round(quality * 100);
  const color = pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums">{pct}%</span>
    </div>
  );
}

function RoomLabelEditor({
  deviceId,
  current,
  onSaved,
}: {
  deviceId: string;
  current: string;
  onSaved: (label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (value === current) { setEditing(false); return; }
    setSaving(true);
    try {
      await updateDeviceRoom(deviceId, value);
      onSaved(value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          className="border border-gray-300 rounded px-2 py-0.5 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button onClick={save} disabled={saving} className="p-0.5 hover:text-success">
          <Check size={14} />
        </button>
        <button onClick={() => { setValue(current); setEditing(false); }} className="p-0.5 hover:text-danger">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-1 group text-gray-800 hover:text-primary"
    >
      <span className="text-sm">{current}</span>
      <Edit2 size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');

  useEffect(() => {
    setLoading(true);
    getDevices()
      .then(setDevices)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleRoomSaved(deviceId: string, label: string) {
    setDevices((prev) =>
      prev.map((d) => (d.id === deviceId ? { ...d, roomLabel: label } : d)),
    );
  }

  const filtered =
    filter === 'all' ? devices : devices.filter((d) => d.status === filter);

  const online = devices.filter((d) => d.status === 'online').length;
  const offline = devices.filter((d) => d.status === 'offline').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Device Fleet</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-success">
            <CheckCircle2 size={15} />
            {online} online
          </span>
          <span className="flex items-center gap-1.5 text-danger">
            <WifiOff size={15} />
            {offline} offline
          </span>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {(['all', 'online', 'offline'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">No devices found</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Serial
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Room
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Patient
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Firmware
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Signal
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Occlusion
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Last Heartbeat
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((device) => {
                const occlusion = (device.occlusionStatus ?? 'none') as OcclusionStatus;
                const badge = OCCLUSION_BADGE[occlusion];
                const isOffline = device.status === 'offline';
                return (
                  <tr key={device.id} className={`hover:bg-gray-50 transition-colors ${isOffline ? 'opacity-70' : ''}`}>
                    <td className="px-4 py-3">
                      {isOffline ? (
                        <span className="flex items-center gap-1.5 text-danger text-xs font-medium">
                          <WifiOff size={14} />
                          Offline
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-success text-xs font-medium">
                          <Wifi size={14} />
                          Online
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{device.serial}</td>
                    <td className="px-4 py-3">
                      <RoomLabelEditor
                        deviceId={device.id}
                        current={device.roomLabel}
                        onSaved={(label) => handleRoomSaved(device.id, label)}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {device.patientName ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {device.firmwareVersion}
                    </td>
                    <td className="px-4 py-3">
                      <SignalBar quality={device.signalQuality ?? 0} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                      {occlusion !== 'none' && (
                        <AlertCircle size={13} className="inline ml-1 text-warning" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {device.lastHeartbeat ? (
                        <span title={format(new Date(device.lastHeartbeat), 'PPpp')}>
                          {formatDistanceToNow(new Date(device.lastHeartbeat), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-gray-300">Never</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Room labels are editable inline. OTA firmware updates are available in the next release.
      </p>
    </div>
  );
}

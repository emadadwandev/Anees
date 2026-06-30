import { getPatient } from '@/lib/api';
import { MOCK_PATIENT_DETAILS } from '@/lib/mock-data';
import { VitalsChart } from '@/components/charts/VitalsChart';
import { SleepHypnogram } from '@/components/charts/SleepHypnogram';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';

interface Props {
  params: { id: string };
}

export default async function PatientDetailPage({ params }: Props) {
  let patient;
  try {
    patient = await getPatient(params.id);
  } catch {
    patient = MOCK_PATIENT_DETAILS.find((p) => p.id === params.id);
    if (!patient) notFound();
  }

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
          <p className="text-gray-500 text-sm">
            Age {patient.age} · Room {patient.roomLabel}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            patient.deviceStatus === 'online'
              ? 'bg-green-100 text-success'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {patient.deviceStatus === 'online' ? '● Online' : '○ Offline'}
        </span>
      </div>

      {/* Vitals chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Vital History</h2>
        <VitalsChart patientId={params.id} timeRange="24h" metric="both" />
      </div>

      {/* Sleep */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Sleep — Last Night</h2>
        <SleepHypnogram patientId={params.id} date={today} />
      </div>

      {/* Device status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Device</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <DeviceField label="Serial" value={patient.device.serial} />
          <DeviceField label="Firmware" value={patient.device.firmwareVersion} />
          <DeviceField label="Room" value={patient.device.roomLabel} />
          <DeviceField
            label="Signal Quality"
            value={`${Math.round(patient.device.signalQuality * 100)}%`}
          />
          <DeviceField
            label="Last Heartbeat"
            value={format(new Date(patient.device.lastHeartbeat), 'HH:mm:ss')}
          />
          <DeviceField
            label="Occlusion"
            value={patient.device.occlusionStatus}
          />
        </dl>
      </div>
    </div>
  );
}

function DeviceField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-400 text-xs uppercase tracking-wide">{label}</dt>
      <dd className="font-medium text-gray-800 mt-0.5">{value}</dd>
    </div>
  );
}

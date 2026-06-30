'use client';

import { useState } from 'react';
import {
  Building2,
  Bell,
  Activity,
  Users,
  Shield,
  Save,
  Check,
  type LucideIcon,
} from 'lucide-react';

type SaveState = 'idle' | 'saving' | 'saved';

function Section({ title, icon: Icon, children }: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="adm-card px-6 py-5">
      <div className="flex items-center gap-2.5 mb-5" style={{ borderBottom: '1px solid var(--adm-border)', paddingBottom: '14px' }}>
        <Icon size={15} style={{ color: 'var(--adm-blue)' }} />
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--adm-t1)' }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="shrink-0 w-52">
        <p className="text-[12px] font-medium" style={{ color: 'var(--adm-t1)' }}>{label}</p>
        {hint && <p className="text-[10px] mt-0.5" style={{ color: 'var(--adm-t3)' }}>{hint}</p>}
      </div>
      <div className="flex-1 max-w-sm">{children}</div>
    </div>
  );
}

function Input({ value, onChange, type = 'text', placeholder }: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg text-[12px] outline-none transition-all"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid var(--adm-border)',
        color: 'var(--adm-t1)',
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(26,115,232,0.5)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--adm-border)')}
    />
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        className="relative w-9 h-5 rounded-full transition-colors"
        style={{ background: checked ? 'var(--adm-blue)' : 'rgba(255,255,255,0.1)' }}
        onClick={() => onChange(!checked)}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </div>
      <span className="text-[12px]" style={{ color: 'var(--adm-t2)' }}>{label}</span>
    </label>
  );
}

function NumField({ value, onChange, min, max, unit }: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 px-3 py-2 rounded-lg text-[12px] outline-none text-center font-mono transition-all"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--adm-border)',
          color: 'var(--adm-t1)',
          fontFamily: "'JetBrains Mono', monospace",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(26,115,232,0.5)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--adm-border)')}
      />
      <span className="text-[11px]" style={{ color: 'var(--adm-t3)' }}>{unit}</span>
    </div>
  );
}

const STAFF = [
  { name: 'Dr. Sara Hamdan', role: 'Medical Director', email: 'sara.hamdan@alsalam.care', status: 'active' },
  { name: 'Nurse Ahmed Zaki', role: 'Head Nurse', email: 'ahmed.zaki@alsalam.care', status: 'active' },
  { name: 'Nurse Mona Kamel', role: 'Night Shift RN', email: 'mona.kamel@alsalam.care', status: 'active' },
  { name: 'Dr. Hisham Nassar', role: 'Attending Physician', email: 'hisham.nassar@alsalam.care', status: 'inactive' },
];

export default function AdminSettingsPage() {
  // Facility
  const [facilityName, setFacilityName] = useState('Al-Salam Care Center');
  const [facilityAddress, setFacilityAddress] = useState('14 Nile Corniche, Cairo, Egypt');
  const [facilityContact, setFacilityContact] = useState('+20 2 2345 6789');
  const [facilityLicense, setFacilityLicense] = useState('MoH-2024-00413');

  // Alert thresholds
  const [hrMin, setHrMin] = useState(45);
  const [hrMax, setHrMax] = useState(110);
  const [rrMin, setRrMin] = useState(8);
  const [rrMax, setRrMax] = useState(25);
  const [fallConfidence, setFallConfidence] = useState(85);

  // Notifications
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [escalationMins, setEscalationMins] = useState(5);
  const [quietHoursStart, setQuietHoursStart] = useState('23:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('06:00');

  // Security
  const [mfaRequired, setMfaRequired] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(480);

  const [saveState, setSaveState] = useState<SaveState>('idle');

  function handleSave() {
    setSaveState('saving');
    setTimeout(() => {
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    }, 800);
  }

  return (
    <div className="py-5 px-7 space-y-4 pb-12">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-[13px] font-semibold" style={{ color: 'var(--adm-t1)' }}>
            Facility Settings
          </h2>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--adm-t3)' }}>
            B2B configuration · Al-Salam Care Center
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saveState === 'saving'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all"
          style={{
            background: saveState === 'saved' ? 'rgba(63,207,92,0.15)' : 'var(--adm-blue)',
            color: saveState === 'saved' ? 'var(--adm-green)' : '#fff',
            border: saveState === 'saved' ? '1px solid rgba(63,207,92,0.3)' : 'none',
            opacity: saveState === 'saving' ? 0.7 : 1,
          }}
        >
          {saveState === 'saved' ? <Check size={13} /> : <Save size={13} />}
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Facility information */}
      <Section title="Facility Information" icon={Building2}>
        <Field label="Facility Name" hint="Displayed in all reports and exports">
          <Input value={facilityName} onChange={setFacilityName} placeholder="Care facility name" />
        </Field>
        <Field label="Address" hint="Physical location of the facility">
          <Input value={facilityAddress} onChange={setFacilityAddress} placeholder="Street, City, Country" />
        </Field>
        <Field label="Contact Number" hint="Primary contact for system alerts">
          <Input value={facilityContact} onChange={setFacilityContact} type="tel" placeholder="+20 2 XXXX XXXX" />
        </Field>
        <Field label="License Number" hint="Ministry of Health license identifier">
          <Input value={facilityLicense} onChange={setFacilityLicense} placeholder="MoH-YYYY-XXXXX" />
        </Field>
      </Section>

      {/* Alert thresholds */}
      <Section title="Clinical Alert Thresholds" icon={Activity}>
        <p className="text-[11px] mb-4" style={{ color: 'var(--adm-t3)' }}>
          Vitals outside these ranges trigger a warning alert. Applied globally across all patients unless overridden per patient.
        </p>
        <Field label="Heart Rate Range" hint="Alert when HR falls outside this range">
          <div className="flex items-center gap-3">
            <NumField value={hrMin} onChange={setHrMin} min={20} max={60} unit="BPM min" />
            <span className="text-[11px]" style={{ color: 'var(--adm-t3)' }}>to</span>
            <NumField value={hrMax} onChange={setHrMax} min={80} max={200} unit="BPM max" />
          </div>
        </Field>
        <Field label="Respiration Rate Range" hint="Alert when RR falls outside this range">
          <div className="flex items-center gap-3">
            <NumField value={rrMin} onChange={setRrMin} min={4} max={12} unit="BRPM min" />
            <span className="text-[11px]" style={{ color: 'var(--adm-t3)' }}>to</span>
            <NumField value={rrMax} onChange={setRrMax} min={18} max={40} unit="BRPM max" />
          </div>
        </Field>
        <Field label="Fall Confidence Threshold" hint="Minimum AI confidence to trigger a fall alert">
          <div className="flex items-center gap-3">
            <NumField value={fallConfidence} onChange={setFallConfidence} min={50} max={99} unit="%" />
            <span
              className="text-[10px] px-2 py-0.5 rounded"
              style={{
                background: fallConfidence >= 85 ? 'var(--adm-green-dim)' : 'var(--adm-amber-dim)',
                color: fallConfidence >= 85 ? 'var(--adm-green)' : 'var(--adm-amber)',
              }}
            >
              {fallConfidence >= 85 ? 'Recommended' : 'More sensitive'}
            </span>
          </div>
        </Field>
      </Section>

      {/* Notifications */}
      <Section title="Notifications" icon={Bell}>
        <Field label="Alert Channels" hint="How staff are notified of critical events">
          <div className="space-y-3">
            <Toggle checked={emailAlerts} onChange={setEmailAlerts} label="Email notifications" />
            <Toggle checked={smsAlerts} onChange={setSmsAlerts} label="SMS alerts for critical events" />
            <Toggle checked={pushAlerts} onChange={setPushAlerts} label="Push notifications (mobile app)" />
          </div>
        </Field>
        <Field label="Escalation Delay" hint="Escalate to next responder if unacknowledged">
          <div className="flex items-center gap-2">
            <NumField value={escalationMins} onChange={setEscalationMins} min={1} max={30} unit="minutes" />
          </div>
        </Field>
        <Field label="Quiet Hours" hint="Suppress non-critical notifications during this window">
          <div className="flex items-center gap-3">
            <input
              type="time"
              value={quietHoursStart}
              onChange={(e) => setQuietHoursStart(e.target.value)}
              className="px-3 py-2 rounded-lg text-[12px] outline-none font-mono"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--adm-border)',
                color: 'var(--adm-t1)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
            <span className="text-[11px]" style={{ color: 'var(--adm-t3)' }}>to</span>
            <input
              type="time"
              value={quietHoursEnd}
              onChange={(e) => setQuietHoursEnd(e.target.value)}
              className="px-3 py-2 rounded-lg text-[12px] outline-none font-mono"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--adm-border)',
                color: 'var(--adm-t1)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          </div>
        </Field>
      </Section>

      {/* Staff management */}
      <Section title="Staff Accounts" icon={Users}>
        <div className="space-y-0">
          {STAFF.map((s) => (
            <div
              key={s.email}
              className="flex items-center justify-between py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-[12px] font-semibold text-white shrink-0"
                  style={{ background: '#1565c0' }}
                >
                  {s.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <p className="text-[12px] font-medium" style={{ color: 'var(--adm-t1)' }}>{s.name}</p>
                  <p className="text-[10px]" style={{ color: 'var(--adm-t3)' }}>{s.role} · {s.email}</p>
                </div>
              </div>
              <span
                className="adm-badge"
                style={{
                  background: s.status === 'active' ? 'var(--adm-green-dim)' : 'var(--adm-slate-dim)',
                  color: s.status === 'active' ? 'var(--adm-green)' : 'var(--adm-slate)',
                }}
              >
                {s.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <button
            className="px-4 py-2 rounded-lg text-[12px] font-medium transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--adm-border)',
              color: 'var(--adm-t2)',
            }}
          >
            + Invite staff member
          </button>
        </div>
      </Section>

      {/* Security */}
      <Section title="Security" icon={Shield}>
        <Field label="Multi-Factor Authentication" hint="Require MFA for all admin logins">
          <Toggle checked={mfaRequired} onChange={setMfaRequired} label="Require MFA" />
        </Field>
        <Field label="Session Timeout" hint="Automatically sign out inactive sessions">
          <div className="flex items-center gap-2">
            <NumField value={sessionTimeout} onChange={setSessionTimeout} min={30} max={1440} unit="minutes" />
          </div>
        </Field>
        <Field label="Audit Log" hint="IEC 62304 compliance — all actions are logged">
          <div className="flex items-center gap-2">
            <span
              className="adm-badge"
              style={{ background: 'var(--adm-green-dim)', color: 'var(--adm-green)' }}
            >
              <span className="w-[5px] h-[5px] rounded-full bg-current" />
              Enabled
            </span>
            <span className="text-[10px]" style={{ color: 'var(--adm-t3)' }}>Cannot be disabled (regulatory requirement)</span>
          </div>
        </Field>
      </Section>
    </div>
  );
}

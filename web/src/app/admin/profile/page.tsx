'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  User,
  Lock,
  Shield,
  Clock,
  LogOut,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`adm-card px-6 py-5 ${className ?? ''}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: {
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div
      className="flex items-center gap-2.5 mb-5 pb-3.5"
      style={{ borderBottom: '1px solid var(--adm-border)' }}
    >
      <Icon size={14} style={{ color: 'var(--adm-blue)' }} />
      <h3 className="text-[13px] font-semibold" style={{ color: 'var(--adm-t1)' }}>{title}</h3>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-start justify-between gap-6 py-3.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      <p className="text-[12px] font-medium shrink-0 w-40 pt-2" style={{ color: 'var(--adm-t2)' }}>
        {label}
      </p>
      <div className="flex-1 max-w-sm">{children}</div>
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, disabled, type = 'text',
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-3 py-2 rounded-lg text-[12px] outline-none transition-all"
      style={{
        background: disabled ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
        border: '1px solid var(--adm-border)',
        color: disabled ? 'var(--adm-t3)' : 'var(--adm-t1)',
        cursor: disabled ? 'default' : 'text',
      }}
      onFocus={(e) => { if (!disabled) e.currentTarget.style.borderColor = 'rgba(26,115,232,0.5)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--adm-border)'; }}
    />
  );
}

function SaveButton({ state, onClick, label = 'Save changes' }: {
  state: SaveState;
  onClick: () => void;
  label?: string;
}) {
  const busy = state === 'saving';
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all"
      style={{
        background: state === 'saved' ? 'rgba(63,207,92,0.15)' : state === 'error' ? 'rgba(255,68,68,0.12)' : 'var(--adm-blue)',
        color: state === 'saved' ? 'var(--adm-green)' : state === 'error' ? '#ff6b6b' : '#fff',
        opacity: busy ? 0.7 : 1,
      }}
    >
      {state === 'saved' && <Check size={12} />}
      {state === 'error' && <AlertTriangle size={12} />}
      {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? 'Failed' : label}
    </button>
  );
}

function fakeSubmit(set: (s: SaveState) => void) {
  set('saving');
  setTimeout(() => {
    set('saved');
    setTimeout(() => set('idle'), 2500);
  }, 700);
}

const ACTIVITY = [
  { action: 'Signed in',              time: '2 minutes ago',  ip: '197.48.12.55'  },
  { action: 'Resolved alert #a1',     time: '14 minutes ago', ip: '197.48.12.55'  },
  { action: 'Viewed analytics',       time: '1 hour ago',     ip: '197.48.12.55'  },
  { action: 'Updated alert threshold',time: 'Yesterday 18:42',ip: '197.48.12.55'  },
  { action: 'Signed in',              time: 'Yesterday 08:11',ip: '41.66.204.19'   },
];

export default function AdminProfilePage() {
  const { data: session } = useSession();

  const [displayName, setDisplayName]   = useState(session?.user?.name ?? '');
  const [profileState, setProfileState] = useState<SaveState>('idle');

  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [pwState, setPwState]       = useState<SaveState>('idle');
  const [pwError, setPwError]       = useState('');

  function handleSaveProfile() {
    fakeSubmit(setProfileState);
  }

  function handleChangePassword() {
    setPwError('');
    if (!currentPw) { setPwError('Current password is required'); return; }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    fakeSubmit(setPwState);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
  }

  const initials = (session?.user?.name ?? 'A')
    .split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="py-5 px-7 space-y-4 pb-12 max-w-3xl">
      {/* Avatar header */}
      <div className="flex items-center gap-5 mb-2">
        <div
          className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-[26px] font-bold text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #1a73e8, #0d4fa3)' }}
        >
          {initials}
        </div>
        <div>
          <h2 className="text-[18px] font-bold" style={{ color: 'var(--adm-t1)' }}>
            {session?.user?.name ?? 'Admin'}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="adm-badge adm-badge-blue"
              style={{ fontSize: 10 }}
            >
              Clinical Admin
            </span>
            <span className="text-[11px]" style={{ color: 'var(--adm-t3)' }}>
              {session?.user?.email}
            </span>
          </div>
        </div>
      </div>

      {/* Account info */}
      <Card>
        <SectionTitle icon={User} title="Account Information" />
        <Field label="Display name">
          <TextInput value={displayName} onChange={setDisplayName} placeholder="Full name" />
        </Field>
        <Field label="Email address">
          <TextInput value={session?.user?.email ?? ''} disabled />
        </Field>
        <Field label="Role">
          <div className="pt-1.5">
            <span className="adm-badge adm-badge-blue">admin</span>
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--adm-t3)' }}>
              Role is managed by your system administrator
            </p>
          </div>
        </Field>
        <div className="pt-4">
          <SaveButton state={profileState} onClick={handleSaveProfile} />
        </div>
      </Card>

      {/* Change password */}
      <Card>
        <SectionTitle icon={Lock} title="Change Password" />
        <Field label="Current password">
          <div className="relative">
            <TextInput
              type={showPw ? 'text' : 'password'}
              value={currentPw}
              onChange={setCurrentPw}
              placeholder="••••••••"
            />
            <button
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--adm-t3)' }}
            >
              {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </Field>
        <Field label="New password">
          <TextInput
            type={showPw ? 'text' : 'password'}
            value={newPw}
            onChange={setNewPw}
            placeholder="Min 8 characters"
          />
        </Field>
        <Field label="Confirm password">
          <TextInput
            type={showPw ? 'text' : 'password'}
            value={confirmPw}
            onChange={setConfirmPw}
            placeholder="Repeat new password"
          />
        </Field>
        {pwError && (
          <p className="text-[11px] mt-2 mb-1" style={{ color: 'var(--adm-red)' }}>
            {pwError}
          </p>
        )}
        <div className="pt-4">
          <SaveButton state={pwState} onClick={handleChangePassword} label="Update password" />
        </div>
      </Card>

      {/* Security */}
      <Card>
        <SectionTitle icon={Shield} title="Security" />
        <Field label="Multi-factor auth">
          <div className="flex items-center gap-2 pt-1">
            <span className="adm-badge adm-badge-green">
              <span className="w-[5px] h-[5px] rounded-full bg-current" />
              Enabled
            </span>
          </div>
        </Field>
        <Field label="Current session">
          <div className="pt-1 space-y-0.5">
            <p className="text-[12px]" style={{ color: 'var(--adm-t1)' }}>
              Browser · {typeof window !== 'undefined' ? navigator.platform : 'macOS'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--adm-t3)' }}>
              Active now · 197.48.12.55
            </p>
          </div>
        </Field>
        <div className="pt-4">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all"
            style={{
              background: 'rgba(255,68,68,0.1)',
              border: '1px solid rgba(255,68,68,0.2)',
              color: '#ff6b6b',
            }}
          >
            <LogOut size={13} />
            Sign out all sessions
          </button>
        </div>
      </Card>

      {/* Recent activity */}
      <Card>
        <SectionTitle icon={Clock} title="Recent Activity" />
        <div className="space-y-0">
          {ACTIVITY.map((entry, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2.5"
              style={{ borderBottom: i < ACTIVITY.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
            >
              <div>
                <p className="text-[12px]" style={{ color: 'var(--adm-t1)' }}>{entry.action}</p>
                <p className="text-[10px]" style={{ color: 'var(--adm-t3)' }}>{entry.ip}</p>
              </div>
              <span className="text-[11px] shrink-0" style={{ color: 'var(--adm-t3)' }}>
                {entry.time}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Danger zone */}
      <div
        className="rounded-xl px-6 py-5"
        style={{ border: '1px solid rgba(255,68,68,0.18)', background: 'rgba(255,68,68,0.03)' }}
      >
        <h3 className="text-[13px] font-semibold mb-1" style={{ color: '#ff6b6b' }}>
          Sign Out
        </h3>
        <p className="text-[11px] mb-4" style={{ color: 'var(--adm-t3)' }}>
          End your current session and return to the login screen.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all"
          style={{
            background: 'rgba(255,68,68,0.12)',
            border: '1px solid rgba(255,68,68,0.25)',
            color: '#ff6b6b',
          }}
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </div>
  );
}

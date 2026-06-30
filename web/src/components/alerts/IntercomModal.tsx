'use client';

import { useState, useEffect } from 'react';
import { LiveKitRoom, AudioConference, useRoomContext } from '@livekit/components-react';
import { X, MicOff, Mic } from 'lucide-react';
import { getIntercomToken } from '@/lib/api';

interface Props {
  patientId: string;
  onClose: () => void;
}

interface TokenState {
  token: string;
  url: string;
}

export function IntercomModal({ patientId, onClose }: Props) {
  const [tokenState, setTokenState] = useState<TokenState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? 'ws://localhost:7880';

  useEffect(() => {
    getIntercomToken(patientId)
      .then(setTokenState)
      .catch((e) => setError(e.message ?? 'Failed to connect'))
      .finally(() => setLoading(false));
  }, [patientId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Live Audio Channel</h2>
            <p className="text-xs text-gray-400 mt-0.5">Patient room intercom</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 min-h-[200px] flex flex-col items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Connecting to room…</p>
            </div>
          )}

          {error && (
            <div className="text-center space-y-2">
              <p className="text-danger text-sm font-medium">{error}</p>
              {error.toLowerCase().includes('permission') && (
                <p className="text-xs text-gray-400">
                  Please allow microphone access in your browser settings and try again.
                </p>
              )}
              <button
                onClick={onClose}
                className="text-xs text-primary underline"
              >
                Close
              </button>
            </div>
          )}

          {!loading && !error && tokenState && (
            <LiveKitRoom
              serverUrl={tokenState.url || livekitUrl}
              token={tokenState.token}
              connect={true}
              audio={true}
              video={false}
              onDisconnected={onClose}
              onError={(e) => setError(e.message)}
              className="w-full"
            >
              <IntercomControls onClose={onClose} />
            </LiveKitRoom>
          )}
        </div>
      </div>
    </div>
  );
}

function IntercomControls({ onClose }: { onClose: () => void }) {
  const room = useRoomContext();
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  async function toggleMute() {
    if (room.localParticipant) {
      await room.localParticipant.setMicrophoneEnabled(muted);
      setMuted(!muted);
    }
  }

  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="flex flex-col items-center gap-5 py-2 w-full">
      {/* Waveform visualizer (CSS animation placeholder) */}
      <div className="flex items-end gap-1 h-10">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="w-1.5 bg-primary rounded-full"
            style={{
              height: `${20 + Math.sin(Date.now() / 200 + i) * 12}px`,
              animation: `pulse ${0.8 + i * 0.1}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.08}s`,
            }}
          />
        ))}
      </div>

      <p className="text-2xl font-mono font-semibold text-gray-800 tabular-nums">
        {mins}:{secs}
      </p>

      <AudioConference />

      <div className="flex gap-3 w-full">
        <button
          onClick={toggleMute}
          className="flex-1 flex items-center justify-center gap-2 border border-gray-300 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          {muted ? <MicOff size={16} className="text-danger" /> : <Mic size={16} />}
          {muted ? 'Unmute' : 'Mute'}
        </button>
        <button
          onClick={() => { room.disconnect(); onClose(); }}
          className="flex-1 bg-danger text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-700 transition-colors"
        >
          End Call
        </button>
      </div>
    </div>
  );
}

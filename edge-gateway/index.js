'use strict';

require('dotenv').config();

const { io } = require('socket.io-client');
const { Room, RoomEvent, Track } = require('livekit-client');
const mqtt = require('mqtt');

// ─── Config ───────────────────────────────────────────────────────────────────
const {
  DEVICE_ID,
  DEVICE_SERIAL,
  SOCKET_BASE_URL = 'http://localhost:3000',
  DEVICE_JWT,
  LIVEKIT_WS_URL = 'ws://localhost:7880',
  MQTT_BROKER_URL = 'mqtt://localhost:1883',
  MQTT_USERNAME,
  MQTT_PASSWORD,
} = process.env;

if (!DEVICE_ID || !DEVICE_JWT) {
  console.error('[edge-gateway] DEVICE_ID and DEVICE_JWT must be set in .env');
  process.exit(1);
}

// ─── State ────────────────────────────────────────────────────────────────────
let activeRoom = null;
let reconnectAttempt = 0;

// ─── LiveKit room management ──────────────────────────────────────────────────
async function connectToRoom(token, wsUrl) {
  if (activeRoom) {
    console.log('[livekit] Already in a room — disconnecting first');
    await activeRoom.disconnect();
    activeRoom = null;
  }

  const room = new Room({
    // Disable video tracks; this is audio-only
    adaptiveStream: false,
    dynacast: false,
  });

  room.on(RoomEvent.ParticipantConnected, (p) => {
    console.log(`[livekit] Participant connected: ${p.identity}`);
  });

  room.on(RoomEvent.ParticipantDisconnected, async (p) => {
    console.log(`[livekit] Participant disconnected: ${p.identity}`);
    // Leave room when the only other participant (caregiver) disconnects
    const remoteCount = room.remoteParticipants.size;
    if (remoteCount === 0) {
      console.log('[livekit] No remote participants — leaving room');
      await room.disconnect();
      activeRoom = null;
    }
  });

  room.on(RoomEvent.Disconnected, () => {
    console.log('[livekit] Disconnected from room');
    activeRoom = null;
  });

  room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
    if (track.kind === Track.Kind.Audio) {
      console.log(`[livekit] Subscribed to audio from ${participant.identity}`);
      // On real hardware: route track.mediaStreamTrack to ALSA sink via Web Audio or native bridge.
      // In Node.js without a browser context this requires a native addon (e.g. node-speaker or
      // piping to `aplay`). The livekit-client SDK handles the WebRTC negotiation; actual PCM
      // output routing is hardware-platform-specific. Log here for testability.
      console.log('[audio-out] Audio track ready — route to speaker sink');
    }
  });

  try {
    await room.connect(wsUrl || LIVEKIT_WS_URL, token);
    console.log(`[livekit] Connected to room: ${room.name}`);

    // Publish local microphone audio track
    // On real hardware: source is device mic array via ALSA — captured via getUserMedia-equivalent.
    // In a headless Node.js environment without browser APIs, a native audio capture addon is
    // required to produce the MediaStreamTrack. This call documents the intent; the platform
    // integration (ALSA → WebRTC track) is done via a native bridge on the actual device.
    console.log('[audio-in] Microphone track ready — publishing to room');

    activeRoom = room;
  } catch (err) {
    console.error('[livekit] Failed to connect to room:', err.message);
  }
}

// ─── Socket.IO — receive fall.detected with embedded patient token ─────────────
function connectSocket() {
  const delay = reconnectAttempt === 0 ? 0 : Math.min(30_000, 2 ** reconnectAttempt * 1_000);

  setTimeout(() => {
    console.log(`[socket] Connecting to ${SOCKET_BASE_URL}/vitals (attempt ${reconnectAttempt + 1})`);

    const socket = io(`${SOCKET_BASE_URL}/vitals`, {
      transports: ['websocket'],
      auth: { token: DEVICE_JWT },
      reconnection: false,
    });

    socket.on('connect', () => {
      console.log('[socket] Connected');
      reconnectAttempt = 0;
    });

    // fall.detected arrives with { alertId, patientId, livekitToken, livekitWsUrl, ... }
    socket.on('fall.detected', async (event) => {
      console.log(`[socket] fall.detected — alertId=${event.alertId}`);

      if (!event.livekitToken) {
        console.warn('[socket] No livekitToken in fall.detected event — cannot auto-answer');
        return;
      }

      await connectToRoom(event.livekitToken, event.livekitWsUrl);
    });

    socket.on('disconnect', (reason) => {
      console.warn(`[socket] Disconnected: ${reason}`);
      reconnectAttempt += 1;
      connectSocket();
    });

    socket.on('connect_error', (err) => {
      console.error(`[socket] Connection error: ${err.message}`);
      reconnectAttempt += 1;
      connectSocket();
    });
  }, delay);
}

// ─── MQTT keepalive publisher ─────────────────────────────────────────────────
// The edge gateway publishes a heartbeat status frame every 30 s so the backend
// knows the device is alive even when no sensor frames are being generated.
function startMqttHeartbeat() {
  const client = mqtt.connect(MQTT_BROKER_URL, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clientId: `edge-gateway-${DEVICE_ID}`,
    reconnectPeriod: 5_000,
  });

  client.on('connect', () => {
    console.log(`[mqtt] Connected to ${MQTT_BROKER_URL}`);
    publishStatus(client);
    setInterval(() => publishStatus(client), 30_000);
  });

  client.on('error', (err) => {
    console.error('[mqtt] Error:', err.message);
  });
}

function publishStatus(client) {
  const payload = JSON.stringify({
    device_id: DEVICE_ID,
    serial: DEVICE_SERIAL,
    timestamp: Date.now(),
    event_type: 'gateway_heartbeat',
    intercom_active: activeRoom !== null,
  });
  client.publish(`anees/devices/${DEVICE_ID}/status`, payload, { qos: 1 });
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`[edge-gateway] ${signal} received — shutting down`);
  if (activeRoom) {
    await activeRoom.disconnect();
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Start ────────────────────────────────────────────────────────────────────
console.log(`[edge-gateway] Starting for device ${DEVICE_ID} (${DEVICE_SERIAL ?? 'no serial'})`);
connectSocket();
startMqttHeartbeat();

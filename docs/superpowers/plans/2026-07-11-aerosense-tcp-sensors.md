# AeroSense TCP Sensors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate AeroSense Assure fall sensors and AeroSense Wavve sleep/vital sensors through direct TCP while preserving the existing Anees PostgreSQL, TimescaleDB, Redis, BullMQ, Socket.IO, and dashboard contracts.

**Architecture:** Add one NestJS TCP ingress module with two isolated binary protocol codecs: Assure frames start with `0x12`; Wavve frames start with `0x13`. The ingress maps a registered vendor radar ID to an Anees device, acknowledges required frames, validates data, and publishes canonical events into the same Redis channels and BullMQ alert workflows already used by MQTT hardware. Wavve supplies real-time heart rate and respiration; Assure supplies fall, presence, position, and device-health events.

**Tech Stack:** NestJS + TypeScript, Node `net`, Zod, Prisma/PostgreSQL 16, TimescaleDB, Redis/ioredis, BullMQ, Socket.IO, Prometheus, Docker Compose, Jest.

## Review status and scope

This is a review document, not authorization to implement or deploy. It deliberately excludes two vendor features until separately approved: firmware OTA and raw heatmap/ADC ingestion.

### Included in the first release

- Incoming TCP connection/session management and packet framing.
- Device registration, online/offline status, last-seen and firmware tracking.
- Wavve real-time heart rate, respiration rate, validity, bed occupancy, movement, and device-originated clinical alerts.
- Assure fall, fall cancellation, presence, position/motion, Wi-Fi signal, and device health.
- Existing dashboard and mobile real-time events, plus device-source and connection-status display.
- Tests, observability, local simulator, Docker/OCI ingress configuration, and operational runbook.

### Explicitly excluded from the first release

- AeroSense firmware upgrade commands (`0x0021`-`0x0023`).
- Assure heatmap and raw ADC payload persistence.
- Wavve sleep-stage or nightly sleep-report ingestion: the Wavve TCP protocol defines no sleep-stage event. The vendor must provide a separate server API or protocol before this feature is scoped.
- Routing any vendor binary payload to the Python DSP service; that service expects mmWave point-cloud data, not AeroSense TCP frames.

## Global constraints

- The TCP service must accept both documented protocols without treating their frames as interchangeable: Assure magic byte `0x12`; Wavve magic byte `0x13`.
- TCP is a byte stream. The decoder must support partial frames and multiple frames in a single `data` event; it must never assume one socket chunk equals one protocol frame.
- All integers and floats are big-endian. A declared content length includes the two-byte function code.
- Require a known `Device.externalId` and matching `Device.transport` before accepting telemetry; never create a device from an unknown inbound connection.
- Reject unknown function codes, bad magic/version, invalid content lengths, and invalid field ranges. Record a metric and structured audit/system event without logging raw medical payloads.
- Use the existing Redis contracts: `vitals:{patientId}`, `vitals:presence`, `alerts:caregiver`, `alerts:patient:{patientId}`, and `sleep:{patientId}` only when the vendor actually provides a supported sleep epoch.
- Wavve `signal strength` means bed-occupancy signal, not measurement quality. Do not store it in `vital_readings.signal_quality`.
- Publish a normal vital reading only when Wavve `valid_bit === 2`; retain partial/invalid readings as vendor telemetry for diagnostics, not clinical threshold evaluation.
- Keep all user-facing vital and alert thresholds in Anees; optional sensor-side thresholds are a mirrored safety layer, never the sole source of a clinical decision.
- Do not expose unauthenticated plain TCP to the public internet. Production deployment requires either documented device TLS support or a private/VPN/edge-tunnel network path with source allowlisting.

## Phase 0: Contract confirmation and deployment gate

### What to confirm with AeroSense before production

1. The production firmware versions and the configured server IP/port for one Assure and one Wavve device.
2. Whether the device supports TLS, client certificates, VPN, or a secure outbound tunnel. The supplied documents describe TCP but do not document transport encryption or device authentication.
3. Whether the Wavve product exposes sleep stages/nightly reports through another protocol or cloud API. Its TCP protocol only defines vitals, occupancy, movement, and alerts.
4. Golden packet captures for each enabled function, including registration/heartbeat, Wavve `0x03E8`, Assure fall `0x0009`, Assure fall-elimination `0x0017`, and all enabled alert messages.

### Documentation references

- `docs/Areosense/AeroSense Assure-BLE/AeroSense Assure-BLE/05 Home Care Assistant_TCP_Communication_Protocol_v3.9-2.pdf`, sections 2, 3.1, 3.8, 3.17, 3.22, 3.23, 3.27, and 3.28.
- `docs/Areosense/AeroSense Wavve/AeroSense Wavve/AeroSense Wavve developer package01312023/05 Contactless Sleep Sensor_TCP_Communication Protocol_v1.17-4.pdf`, sections 2, 3.1, 3.2, and 3.8-3.38.
- `docs/Areosense/AeroSense Wavve/AeroSense Wavve/AeroSense Wavve developer package01312023/AeroSense Wavve _Development guidebook_v2.1-08252025-3.pdf`, pages covering server configuration and vital-sign operation.

### Verification checklist

- [ ] Record the exact configured port, firmware version, and static vendor device ID for each pilot device in the deployment runbook.
- [ ] Obtain a real packet capture and verify it decodes exactly like the protocol fixture.
- [ ] Select the approved protected network path before opening an OCI security-list rule.

### Anti-pattern guards

- Do not rely on the Assure SDK README port alone: its documentation conflicts with its Java source default.
- Do not infer Wavve sleep stages from movement or vital readings.
- Do not permit raw internet access just because the device initiates the connection.

---

## Planned file structure

| Path | Responsibility |
|---|---|
| `backend/src/aerosense-tcp/aerosense-tcp.module.ts` | Isolated Nest module and provider wiring. |
| `backend/src/aerosense-tcp/aerosense-tcp-server.service.ts` | TCP listener lifecycle, socket admission, buffering, timeout, and disconnect behavior. |
| `backend/src/aerosense-tcp/protocol/frame-codec.ts` | Shared 14-byte header parser/encoder, bounded buffer handling, and response writer. |
| `backend/src/aerosense-tcp/protocol/aerosense-frame.ts` | TypeScript frame, connection, and parsed-event types. |
| `backend/src/aerosense-tcp/protocol/assure-codec.ts` | Assure (`0x12`) function decoding and required acknowledgements. |
| `backend/src/aerosense-tcp/protocol/wavve-codec.ts` | Wavve (`0x13`) vital and alert decoding. |
| `backend/src/aerosense-tcp/aerosense-session.service.ts` | Registered radar-ID-to-device session mapping and status lifecycle. |
| `backend/src/aerosense-tcp/aerosense-event.service.ts` | Vendor-neutral event routing to existing Redis/BullMQ/database contracts. |
| `backend/src/aerosense-tcp/aerosense-command.service.ts` | Safe, approved server-to-device configuration commands after registration. |
| `backend/src/aerosense-tcp/schemas/aerosense-event.schema.ts` | Zod schemas for parsed event boundaries. |
| `backend/src/aerosense-tcp/*.spec.ts` | Unit and integration tests for framing, codecs, sessions, events, and commands. |
| `backend/prisma/schema.prisma` | Device transport/external identity and vendor capability metadata. |
| `backend/prisma/migrations/20260711120000_aerosense_tcp_devices/migration.sql` | Prisma database changes for device identity and transport. |
| `backend/prisma/migrations/20260711121000_wavve_telemetry/migration.sql` | Timescale Wavve diagnostic telemetry table and policy. |
| `backend/src/devices/devices.service.ts` | Cached device resolution by transport and external radar ID. |
| `backend/src/config/config.schema.ts` | Validated TCP bind, port, frame limit, idle timeout, and network allowlist configuration. |
| `backend/src/metrics/metrics.service.ts` | TCP connection/frame/rejection/handler/command metrics. |
| `backend/src/app.module.ts` | Import the new `AeroSenseTcpModule`. |
| `backend/test/aerosense-tcp.e2e-spec.ts` | Real-stack test using a TCP radar simulator and Timescale/Redis assertions. |
| `docker-compose.yml` | Local TCP port exposure and optional test simulator profile. |
| `infra/observability/grafana/provisioning/dashboards/json/iot-pipeline.json` | TCP listener and vendor-event panels. |
| `docs/operations/aerosense-tcp-runbook.md` | Provisioning, connectivity checks, security controls, and incident response. |

---

## Phase 1: Device identity, data model, and canonical contracts

### Task 1: Add vendor-safe device identity and Wavve telemetry storage

**Files:**

- Modify: `backend/prisma/schema.prisma:53-106`
- Create: `backend/prisma/migrations/20260711120000_aerosense_tcp_devices/migration.sql`
- Create: `backend/prisma/migrations/20260711121000_wavve_telemetry/migration.sql`
- Modify: `backend/prisma/migrations/00_timescale_hypertables.sql:1-44` only if the repository's migration policy requires all raw hypertables there; otherwise use the new timestamped migration.
- Test: `backend/src/aerosense-tcp/aerosense-event.service.spec.ts`

**Interfaces:**

- Produces `DeviceTransport` values `mqtt` and `aerosense_tcp`.
- Produces unique `Device.externalId`, populated with the uppercase hexadecimal vendor radar ID.
- Produces `wavve_vital_details(time, device_id, patient_id, breath_curve, heart_curve, target_distance_m, bed_signal_strength, valid_bit, body_move_energy, body_move_range)` as a Timescale hypertable.

- [ ] **Step 1: Write the failing device-identity test.**

```ts
it('resolves only a registered Wavve device by TCP transport and vendor ID', async () => {
  await prisma.device.create({ data: wavveDevice });
  await expect(devices.resolveAeroSenseDevice('13CECDA0000040C11D13155507'))
    .resolves.toMatchObject({ id: wavveDevice.id, transport: 'aerosense_tcp' });
});
```

- [ ] **Step 2: Add the schema and migration.**

```prisma
enum DeviceTransport {
  mqtt
  aerosense_tcp
}

model Device {
  // existing fields
  transport    DeviceTransport @default(mqtt)
  vendor       String?         
  externalId   String?         @unique @map("external_id")
  capabilities Json?           
}
```

The SQL migration must add `transport`, `vendor`, `external_id`, and `capabilities` without changing existing MQTT device records. Create `wavve_vital_details` with the columns in the interface above, promote it with `create_hypertable`, and apply the same two-year retention policy as other medical time-series tables.

- [ ] **Step 3: Add a cache-aware resolver to `DevicesService`.**

```ts
async resolveAeroSenseDevice(externalId: string) {
  const normalized = externalId.toUpperCase();
  const cacheKey = `device:aerosense:${normalized}`;
  // read cache, then findUnique({ where: { externalId: normalized } })
  // require transport === 'aerosense_tcp' before caching and returning
}
```

- [ ] **Step 4: Run checks.**

Run: `cd backend && npx prisma format && npx prisma validate && npm test -- devices`

Expected: Prisma validates; the resolver returns the registered TCP device and rejects an MQTT device with the same attempted ID.

- [ ] **Step 5: Commit.**

```bash
git add backend/prisma backend/src/devices
git commit -m "feat: add AeroSense TCP device identity"
```

### Task 2: Define the canonical inbound event contract

**Files:**

- Create: `backend/src/aerosense-tcp/protocol/aerosense-frame.ts`
- Create: `backend/src/aerosense-tcp/schemas/aerosense-event.schema.ts`
- Test: `backend/src/aerosense-tcp/schemas/aerosense-event.schema.spec.ts`

**Interfaces:**

```ts
export type AeroSenseProtocol = 'assure' | 'wavve';
export interface AeroSenseFrame {
  protocol: AeroSenseProtocol;
  type: 0 | 1 | 2;
  command: 0 | 1 | 2;
  requestId: number;
  timeoutOrStatus: number;
  functionCode: number;
  data: Buffer;
}

export type AeroSenseEvent =
  | { kind: 'registered'; protocol: AeroSenseProtocol; externalId: string; firmwareVersion: string; radarType: number }
  | { kind: 'wavve.vitals'; deviceId: string; patientId: string; timestamp: number; heartRateBpm: number; respirationRateBrpm: number; validBit: 0 | 1 | 2; targetDistanceM: number; bedSignalStrength: number; breathCurve: number; heartCurve: number; bodyMoveEnergy: number; bodyMoveRange: number }
  | { kind: 'assure.fall' | 'assure.fall_eliminated' | 'assure.presence' | 'assure.position' | 'assure.wifi_signal' | 'wavve.alert' | 'wavve.movement'; deviceId: string; patientId: string; timestamp: number; payload: Record<string, unknown> };
```

- [ ] **Step 1: Write schema tests for a complete Wavve vital reading and an invalid `validBit`.**
- [ ] **Step 2: Implement the Zod discriminated union.** It must accept only `validBit` values `0`, `1`, and `2`, finite numeric metrics, and a UUID device/patient pair.
- [ ] **Step 3: Run `cd backend && npm test -- aerosense-event.schema`.**
- [ ] **Step 4: Commit.**

### Phase 1 verification

- [ ] Existing MQTT devices retain `transport = mqtt` and continue resolving by UUID/serial.
- [ ] A Wavve radar ID can map to exactly one registered TCP device.
- [ ] Wavve diagnostic values are stored separately from the canonical vital-reading quality field.

### Phase 1 anti-pattern guards

- Do not repurpose the existing device UUID as a wire-level radar ID.
- Do not silently create or reassign a device when a sensor connects.
- Do not store clinical data in `SystemEvent.payload` when a typed time-series table is defined.

---

## Phase 2: Safe TCP framing and connection lifecycle

### Task 3: Implement the shared TCP frame codec

**Files:**

- Create: `backend/src/aerosense-tcp/protocol/frame-codec.ts`
- Test: `backend/src/aerosense-tcp/protocol/frame-codec.spec.ts`

**Documentation references:** Both vendor TCP PDFs, section 2.1 and 2.2.

**Interfaces:**

```ts
export const AEROSENSE_HEADER_BYTES = 14;
export const AEROSENSE_MAX_CONTENT_BYTES = 4096;

export function extractFrames(buffer: Buffer): { frames: Buffer[]; remainder: Buffer };
export function decodeFrame(wire: Buffer): AeroSenseFrame;
export function encodeStatusResponse(frame: AeroSenseFrame, status: 0 | 1): Buffer;
```

- [ ] **Step 1: Write failing tests using the vendor Wavve `0x03E8` example and Assure registration/fall examples.** Include a split header/body case, two concatenated frames, bad magic, content length under two bytes, and content length above `4096`.
- [ ] **Step 2: Implement `extractFrames`.** Read the magic byte, wait until the 14-byte header is complete, use big-endian `readUInt32BE(10)` for the content length, require `2 <= contentLength <= 4096`, then emit exactly `14 + contentLength` bytes.
- [ ] **Step 3: Implement `decodeFrame` and `encodeStatusResponse`.** The response must preserve incoming protocol magic, request ID, timeout field, and function code; use status `1` only after the event has passed registration and validation.
- [ ] **Step 4: Run `cd backend && npm test -- frame-codec`.**
- [ ] **Step 5: Commit.**

### Task 4: Add the listener and session lifecycle

**Files:**

- Create: `backend/src/aerosense-tcp/aerosense-tcp.module.ts`
- Create: `backend/src/aerosense-tcp/aerosense-tcp-server.service.ts`
- Create: `backend/src/aerosense-tcp/aerosense-session.service.ts`
- Modify: `backend/src/config/config.schema.ts:3-38`
- Modify: `backend/src/app.module.ts:10-103`
- Test: `backend/src/aerosense-tcp/aerosense-tcp-server.service.spec.ts`

**Interfaces:**

```ts
TCP_BIND_HOST: z.string().default('0.0.0.0')
TCP_PORT: z.coerce.number().int().min(1024).max(65535).default(8899)
TCP_IDLE_TIMEOUT_MS: z.coerce.number().int().min(30_000).default(120_000)
TCP_ALLOWED_CIDRS: z.string().default('')
```

- [ ] **Step 1: Write a server test with a local `net.createConnection`.** Verify an unregistered connection receives a failed registration response and closes; verify a registered connection receives success and creates a session.
- [ ] **Step 2: Implement listener startup/shutdown in Nest lifecycle hooks.** Configure socket idle timeout, bounded receive buffer, socket error handling, and a connection counter. Only bind when `TCP_PORT` is configured.
- [ ] **Step 3: Implement registration handling.** Decode Assure and Wavve `0x0001` independently, normalize the 13-byte ID to uppercase hex, resolve the matching `aerosense_tcp` device, update `firmwareVersion`, `lastHeartbeat`, and `status`, then retain an in-memory `socket -> deviceId` session.
- [ ] **Step 4: Implement disconnect handling.** Remove only the matching socket session, mark the device offline after the configured grace period if no newer session exists, and publish `system.device_offline` to `alerts:caregiver`.
- [ ] **Step 5: Run `cd backend && npm test -- aerosense-tcp-server`.**
- [ ] **Step 6: Commit.**

### Phase 2 verification

- [ ] The same registered Wavve vital example works whether it arrives in one write, three writes, or together with another frame.
- [ ] An unknown radar ID never reaches Redis or TimescaleDB.
- [ ] A reconnect replaces the old session without marking the device offline.

### Phase 2 anti-pattern guards

- Do not open more than one TCP listener in the backend process.
- Do not mark the device online from any frame before successful registration.
- Do not write a successful acknowledgement before validating the frame, device mapping, and event payload.

---

## Phase 3: Wavve vitals and clinical alerts

### Task 5: Decode and persist Wavve vital data

**Files:**

- Create: `backend/src/aerosense-tcp/protocol/wavve-codec.ts`
- Create: `backend/src/aerosense-tcp/aerosense-event.service.ts`
- Modify: `backend/src/vitals/vital-storage.worker.ts:8-160`
- Test: `backend/src/aerosense-tcp/protocol/wavve-codec.spec.ts`
- Test: `backend/src/aerosense-tcp/aerosense-event.service.spec.ts`

**Documentation references:** Wavve TCP protocol section 3.2 (`0x03E8`) and section 3.3 (report interval).

**Interfaces:**

```ts
export function decodeWavveFrame(frame: AeroSenseFrame, session: AeroSenseSession): AeroSenseEvent | null;
export async function publishWavveVital(event: Extract<AeroSenseEvent, { kind: 'wavve.vitals' }>): Promise<void>;
```

- [ ] **Step 1: Write a failing fixture test using the PDF’s full `0x03E8` example.** Assert exact big-endian values: breath `11.718`, heart `75`, target distance `1.5`, validity `2`, movement energy `22.472`, and movement range `3.3`.
- [ ] **Step 2: Decode the Wavve payload.** Read seven IEEE-754 floats, one unsigned validity byte, and two final IEEE-754 floats in the exact order documented by the vendor.
- [ ] **Step 3: Persist every parsed Wavve frame to `wavve_vital_details`.** Use the source timestamp assigned by Anees at receipt; do not manufacture a device timestamp absent from the payload.
- [ ] **Step 4: Publish a canonical vital reading only when `validBit === 2`.** Use `{ device_id, patient_id, timestamp, heart_rate_bpm, resp_rate_brpm, signal_quality: 1.0 }`. Wavve provides no clinical quality score; its occupancy signal is stored separately in `wavve_vital_details`. Publish through `vitals:{patientId}` so `VitalStorageWorker` persists it, updates the live cache, performs threshold checks, and reaches `VitalsGateway`.
- [ ] **Step 5: Change `VitalStorageWorker` so it validates parsed vital messages before buffering.** Reject non-finite values, heart rate outside `20..250`, respiration outside `3..60`, and signal quality outside `0..1`; increment a TCP rejected-frame metric when called from this source.
- [ ] **Step 6: Run `cd backend && npm test -- wavve-codec aerosense-event vital-storage`.**
- [ ] **Step 7: Commit.**

### Task 6: Map Wavve alerts and movement events

**Files:**

- Modify: `backend/src/aerosense-tcp/protocol/wavve-codec.ts`
- Modify: `backend/src/aerosense-tcp/aerosense-event.service.ts`
- Modify: `backend/prisma/schema.prisma:123-139` and a timestamped migration only if additional alert types are needed.
- Test: `backend/src/aerosense-tcp/aerosense-event.service.spec.ts`

**Required mappings:**

| Wavve function | Anees event | Handling |
|---|---|---|
| `0x03F0` | `vital.no_breath` | Create a dispatched `vital_anomaly`; publish caregiver alert. |
| `0x03F3` / `0x03F6` | `vital.low_breath` / `vital.high_breath` | Create a deduplicated `vital_anomaly`; include configured bounds in notes. |
| `0x03FB` | `vital.no_heart` | Create a dispatched high-priority `vital_anomaly`; publish caregiver alert. |
| `0x03FE` / `0x0401` | `vital.low_heart` / `vital.high_heart` | Create a deduplicated `vital_anomaly`; publish caregiver alert. |
| `0x0406` | `bed.exit` | Publish caregiver alert and store system event; do not label it a fall. |
| `0x040C` | `bed.turn_over` | Store movement event and publish an informational caregiver event. |
| `0x040F` | `bed.movement` | Store body-movement energy in `motion_events`. |
| `0xFFFF` | `system.wifi_signal` | Update a device system event; do not make it a clinical vital. |

- [ ] **Step 1: Write tests that send each alert twice within its debounce interval.** Assert one `AlertEvent` and one caregiver notification only.
- [ ] **Step 2: Create a shared `createVendorVitalAlert` method.** It must use `AlertType.vital_anomaly`, `AlertStatus.dispatched`, a Redis debounce key scoped by `deviceId + subtype`, an immutable audit record, and a caregiver payload with `source: 'wavve'`.
- [ ] **Step 3: Persist `0x040F` body-movement energy to `motion_events` with `event_type = 'wavve.body_movement'`.**
- [ ] **Step 4: Run `cd backend && npm test -- aerosense-event`.**
- [ ] **Step 5: Commit.**

### Phase 3 verification

- [ ] A valid Wavve vital frame appears in the existing live-vitals API, TimescaleDB, and `vitals.update` Socket.IO event.
- [ ] Invalid or breath-only readings do not affect patient threshold alarms.
- [ ] Every device-originated Wavve alert is deduplicated, auditable, and visible to caregivers.

### Phase 3 anti-pattern guards

- Do not call Wavve `signal_strength` “signal quality” in the dashboard or anomaly logic.
- Do not infer the patient is in bed from non-zero heart rate alone; use the vendor’s occupancy signal semantics and `valid_bit`.
- Do not route Wavve alerts through the fall grace timer.

---

## Phase 4: Assure fall, presence, and motion events

### Task 7: Decode Assure events and reuse the existing fall flow

**Files:**

- Create: `backend/src/aerosense-tcp/protocol/assure-codec.ts`
- Modify: `backend/src/aerosense-tcp/aerosense-event.service.ts`
- Test: `backend/src/aerosense-tcp/protocol/assure-codec.spec.ts`
- Test: `backend/src/aerosense-tcp/aerosense-event.service.spec.ts`

**Documentation references:** Assure TCP protocol sections 3.8 (`0x0009`), 3.16 (`0x0011`), 3.17 (`0x0012`), 3.22 (`0x0017`), 3.23 (`0x0018`), 3.27 (`0x001C`), and 3.28 (`0x001D`).

- [ ] **Step 1: Write frame tests for `0x0009` fall X/Y coordinates, `0x0017` fall elimination, `0x0018` presence, and all three documented `0x001C` payload lengths.**
- [ ] **Step 2: On `0x0009`, create the same pending fall alert and 10-second BullMQ grace timer used by `HardwareDeviceService.onFallDetected` at `backend/src/mqtt/hardware-device.service.ts:178-233`.** Include coordinate metres in `AlertEvent.notes` and the caregiver payload; acknowledge success only after durable alert creation succeeds.
- [ ] **Step 3: On `0x0017`, cancel only the newest pending fall for the same device, remove its delayed BullMQ job, and publish `alert.state_changed`.** Do not cancel another sensor’s fall for the same patient.
- [ ] **Step 4: On `0x0018`, publish presence state to `vitals:presence` and cache it in `presence:{patientId}`.** Keep raw ADC bytes out of Redis and application logs.
- [ ] **Step 5: On `0x001C`, store coordinates in `motion_events` as JSON, include target count/SNR only when present, and do not require an acknowledgement for one-way frames.**
- [ ] **Step 6: On `0xFFFF`, store Wi-Fi dBm as a `SystemEvent`.**
- [ ] **Step 7: Run `cd backend && npm test -- assure-codec aerosense-event`.**
- [ ] **Step 8: Commit.**

### Phase 4 verification

- [ ] One Assure fall reaches the current caregiver alert card and patient grace screen within the established alert SLA.
- [ ] Repeated vendor fall retries do not create multiple active alerts.
- [ ] A fall-elimination message cancels only the associated sensor’s pending alert.

### Phase 4 anti-pattern guards

- Do not treat `0x0011` negative fall as a second fall or a cancellation unless the vendor confirms that behavior in a recorded device test.
- Do not acknowledge documented one-way payloads merely because other Assure messages need ACKs.
- Do not persist heatmap/ADC payloads in this phase.

---

## Phase 5: Safe device configuration commands

### Task 8: Implement read and configuration commands after live ingress is stable

**Files:**

- Create: `backend/src/aerosense-tcp/aerosense-command.service.ts`
- Create: `backend/src/aerosense-tcp/aerosense-command.controller.ts`
- Modify: `backend/src/aerosense-tcp/aerosense-tcp.module.ts`
- Test: `backend/src/aerosense-tcp/aerosense-command.service.spec.ts`

**Interfaces:**

```ts
type WavveConfiguration = { reportIntervalTicks?: number; workingDistanceM?: number; bedExitTimerSec?: number };
type AssureConfiguration = { installationHeightM?: number; workingRangeM?: number; fallBufferTimeSec?: number; fallMode?: 'high_sensitivity' | 'low_false_alert' };
```

- [ ] **Step 1: Write tests for each command’s byte encoding, matching response request ID, timeout, and non-success status.**
- [ ] **Step 2: Implement Wavve commands `0x03E9`, `0x03EA`, `0x03EB`, `0x03EC`, `0x0404`, and `0x0405`.** Validate report interval `1..60000` ticks, working distance against the vendor-tested range, and bed-exit timer `0` or `30..86400` seconds.
- [ ] **Step 3: Implement Assure commands `0x0002` through `0x0007`, `0x001E`, and `0x001F`.** Enforce the protocol’s documented installation height, working range, buffer-time, and mode limits before encoding.
- [ ] **Step 4: Add protected admin-only endpoints.** Every request must be written to `AuditLog` with actor, device, command name, requested values, response status, and elapsed time.
- [ ] **Step 5: Run `cd backend && npm test -- aerosense-command`.**
- [ ] **Step 6: Commit.**

### Phase 5 anti-pattern guards

- Do not expose a “send arbitrary function code” endpoint.
- Do not add firmware upgrade, factory reset, or room-learning commands in this release.
- Do not apply default threshold values to a patient without explicit clinical configuration.

---

## Phase 6: Dashboard, observability, and deployment

### Task 9: Make device source and health visible without changing clinical screens

**Files:**

- Modify: `web/src/lib/types.ts`
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/app/(dashboard)/devices/page.tsx`
- Modify: `web/src/app/admin/devices/page.tsx`
- Modify: `backend/src/devices/devices.service.ts`
- Modify: `backend/src/devices/devices.controller.ts`
- Test: `web/src/app/(dashboard)/devices/page.test.tsx` if the project test setup supports React tests; otherwise cover the API response in backend tests.

- [ ] **Step 1: Extend the device API response with `transport`, `vendor`, `externalId`, `lastHeartbeat`, and connection state.**
- [ ] **Step 2: Show “AeroSense Wavve — TCP” or “AeroSense Assure — TCP” beside the device, plus firmware, last seen, and online/offline status.**
- [ ] **Step 3: Preserve the existing vital and alert screens.** They already consume protocol-neutral Socket.IO and REST data; only add source labels to alerts where the event supplies one.
- [ ] **Step 4: Correct any patient detail/roster query that assumes `devices[0]` is the sole device.** Display the selected source or an explicit aggregation rule rather than whichever device happens to be first.
- [ ] **Step 5: Run `cd web && npm run lint` and the applicable test command.**
- [ ] **Step 6: Commit.**

### Task 10: Add TCP observability and environment wiring

**Files:**

- Modify: `backend/src/metrics/metrics.service.ts:1-56`
- Modify: `docker-compose.yml:82-109`
- Modify: `infra/observability/grafana/provisioning/dashboards/json/iot-pipeline.json`
- Create: `docs/operations/aerosense-tcp-runbook.md`

**Metrics to add:**

```text
anees_tcp_connections_active{protocol}
anees_tcp_connections_total{protocol,result}
anees_tcp_frames_received_total{protocol,function_code}
anees_tcp_frames_rejected_total{protocol,reason}
anees_tcp_handler_duration_seconds{protocol,function_code}
anees_tcp_command_duration_seconds{protocol,function_code,result}
```

- [ ] **Step 1: Write metric tests that prove labels are bounded to protocol, known function code, and fixed rejection reason.**
- [ ] **Step 2: Expose local port `8899:8899` in Docker Compose and pass the validated TCP environment variables to the backend.**
- [ ] **Step 3: Add Grafana panels for active connections, rejected-frame rate, message rate by function, vital-data latency, and offline-device events.**
- [ ] **Step 4: Write the runbook.** Cover device provisioning, network allowlisting, radar-ID registration, TCP health probes, packet-capture procedure, disconnect investigation, and emergency rollback by disabling the listener while retaining MQTT.
- [ ] **Step 5: Run `docker compose config` and `cd backend && npm test -- metrics`.**
- [ ] **Step 6: Commit.**

---

## Phase 7: End-to-end verification and release gate

### Task 11: Add a TCP radar simulator and real-stack test

**Files:**

- Create: `backend/test/fixtures/aerosense-frames.ts`
- Create: `backend/test/aerosense-tcp.e2e-spec.ts`
- Modify: `backend/package.json`
- Modify: `docker-compose.yml` if a test profile is needed.

- [ ] **Step 1: Build reusable Buffer fixtures from the vendor’s published hexadecimal examples.** Include Wavve registration and valid vital data, Assure registration/fall/fall elimination, fragmented frames, concatenated frames, bad length, unknown device ID, and duplicate fall sequence.
- [ ] **Step 2: Write an E2E test that starts `AppModule`, creates one known TCP device/patient, connects a real local TCP client, sends registration and a Wavve vital frame, then asserts a `vital_readings` row and `vitals:live:{patientId}` cache entry.**
- [ ] **Step 3: Write an E2E test that sends Assure fall then fall elimination and asserts one cancelled alert and no delayed fall dispatch job.**
- [ ] **Step 4: Write an E2E test that sends an unknown device registration and asserts no Timescale data, no Redis clinical event, and one rejected-frame metric.**
- [ ] **Step 5: Add `test:e2e:tcp` to `backend/package.json`.**
- [ ] **Step 6: Run `cd backend && npm run test:e2e:tcp`, then `npm run lint` and `npm test`.**
- [ ] **Step 7: Commit.**

### Release acceptance criteria

- [ ] Assure and Wavve connect, register, reconnect, and transition offline correctly on the protected pilot network.
- [ ] Wavve valid heart/respiration values reach TimescaleDB and existing real-time dashboard events; invalid readings do not trigger clinical anomaly checks.
- [ ] Wavve clinical alerts and Assure falls are deduplicated, audited, and reach the existing caregiver notification path.
- [ ] Assure fall-elimination cancels only its own pending fall.
- [ ] Every malformed, oversized, unknown, or unauthenticated device frame is rejected without crashing the listener or exposing health data.
- [ ] Prometheus/Grafana make connection, rejection, and event-delivery failures visible.
- [ ] Production security review approves the protected TCP network before enabling the OCI listener.

## Evidence and reusable existing patterns

- `backend/src/mqtt/hardware-device.service.ts:167-268` is the exact reusable fall creation/cancellation pattern.
- `backend/src/mqtt/hardware-device.service.ts:297-362` is the current presence and canonical-vitals Redis publishing pattern.
- `backend/src/vitals/vital-storage.worker.ts:8-160` owns `vitals:*` persistence, live cache, and anomaly scheduling; TCP vital data must enter this path, not duplicate it.
- `backend/src/gateways/vitals.gateway.ts:31-58` bridges Redis vitals to Socket.IO `vitals.update` without knowing the hardware protocol.
- `backend/src/config/config.schema.ts:3-38`, `backend/src/metrics/metrics.service.ts:1-56`, and `docker-compose.yml:82-109` are the project patterns for configuration, metrics, and local service exposure.

## Final plan self-review

- **Coverage:** Includes device identity, secure ingress, Assure events, Wavve vitals/alerts, canonical storage/real-time output, dashboard health, commands, observability, tests, and production release gates.
- **Known limitation:** Sleep-stage data is intentionally excluded because the supplied Wavve TCP document does not define it.
- **Consistency:** Both vendor protocols share framing structure but retain separate magic-byte/function decoders; only one TCP listener/session lifecycle exists.
- **Scope:** Firmware OTA, raw heatmaps, and unsupported sleep analytics remain out of scope until a separate approved design.

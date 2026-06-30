# Anees Healthcare Platform — Engineering Task Breakdown
**Version:** 1.0.0  
**Date:** June 2026  
**Methodology:** Phase-gated delivery. Each phase produces a deployable, testable increment.

---

## Phase Overview

| Phase | Name | Duration | Output |
|---|---|---|---|
| **P0** | Infrastructure & Foundations | 1.5 weeks | All services running locally + OCI staging |
| **P1** | Auth & User Management | 1 week | Login, roles, patient-caregiver linking |
| **P2** | IoT Ingestion Pipeline | 2 weeks | MQTT → DSP → TimescaleDB pipeline live |
| **P3** | Real-Time Vitals (Interface A + B Mobile) | 2 weeks | Flutter live vitals dashboards |
| **P4** | Fall Detection & Alert Pipeline | 2 weeks | Full fall event flow with push notifications |
| **P5** | Voice Intercom (LiveKit) | 1.5 weeks | End-to-end WebRTC voice intercom |
| **P6** | Sleep Analytics | 1.5 weeks | Sleep stage reports on both interfaces |
| **P7** | Caregiver Web Dashboard (Next.js) | 2 weeks | Full web dashboard for clinical use |
| **P8** | System Health & Device Management | 1 week | Device fleet monitoring |
| **P9** | Security Hardening & Compliance | 1 week | TLS, audit logs, IEC 62304 controls |
| **P10** | Monitoring, Observability & CI/CD | 1 week | Grafana, Prometheus, Loki, OTEL, pipelines |

**Estimated Total:** ~18 weeks (engineering lead may parallelize P3–P6)

---

## PHASE 0 — Infrastructure & Foundations
**Goal:** All services bootstrapped, communicating, and deployable to OCI staging.

### [P0-001] Docker Compose Local Environment
- Define `docker-compose.yml` with services: `postgres` (TimescaleDB image), `redis`, `hivemq`, `nestjs`, `fastapi`, `livekit`, `coturn`, `grafana`, `prometheus`, `loki`, `promtail`, `jaeger`
- Mount persistent volumes for PostgreSQL, Redis, Loki, and Jaeger
- Define internal bridge network; expose only NestJS + FastAPI + LiveKit + Grafana ports externally
- Add `Makefile` shortcuts: `make dev`, `make stop`, `make reset`, `make logs`
- Promtail config: tail all container log files under `/var/lib/docker/containers`, label by service name

### [P0-002] PostgreSQL + TimescaleDB Schema Init (Prisma)
- Install TimescaleDB extension on PostgreSQL 16
- Define **Prisma schema** (`schema.prisma`): models `User`, `Device`, `CaregiverLink`, `AlertEvent`, `IntercomSession`, `UserPushToken`, `PatientThreshold`, `SystemEvent`, `AuditLog`
- Run `prisma migrate dev` to generate initial migration SQL
- Add raw SQL in migration file to promote time-series tables to TimescaleDB hypertables:
  ```sql
  SELECT create_hypertable('vital_readings', 'time');
  SELECT create_hypertable('sleep_epochs', 'time');
  SELECT create_hypertable('motion_events', 'time');
  ```
- Define TimescaleDB compression policy (compress `vital_readings` chunks > 30 days old)
- Define retention policy (drop raw chunks > 2 years old)
- Generate `PrismaService` NestJS module (singleton, `onModuleInit` connects, `onModuleDestroy` disconnects)
- Seed script: 2 test patients, 2 caregivers, 1 linked device per patient, sample vital readings for chart testing

### [P0-003] NestJS Project Scaffold
- Init NestJS project with `@nestjs/cli`
- Install core: `@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/websockets`, `@nestjs/platform-socket.io`, `@nestjs/microservices`
- Install enhancements: `prisma`, `@prisma/client`, `zod`, `ioredis`, `bullmq`, `pino`, `pino-pretty`, `nestjs-pino`
- Install observability: `prom-client`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-jaeger`
- Configure `ConfigModule` with `.env` validation via **Zod** schema (all env vars typed and required)
- Configure `nestjs-pino` as global logger (structured JSON in production, pretty-print in dev)
- Initialize OpenTelemetry SDK in `main.ts` **before** NestJS bootstrap (required for auto-instrumentation)
- Set up module structure: `auth`, `users`, `patients`, `devices`, `vitals`, `alerts`, `sleep`, `intercom`, `notifications`, `prisma`
- Configure global exception filter (logs to pino + Loki), request logger middleware, and Helmet security headers
- Wire `BullMQ` queues: `fall-alert`, `push-notifications`, `sleep-aggregation`, `anomaly-detection` — each with a dedicated processor module

### [P0-004] FastAPI DSP Service Scaffold
- Init FastAPI project with `uvicorn`, `pydantic`, `numpy`, `scipy`, `redis`, `structlog`
- Install observability: `opentelemetry-instrumentation-fastapi`, `prometheus-fastapi-instrumentator`, `opentelemetry-exporter-jaeger`
- Configure `structlog` for structured JSON logging (compatible with Promtail/Loki ingestion)
- Initialize OpenTelemetry with Jaeger exporter on service startup; propagate trace context via HTTP headers from NestJS caller
- Define `/health` and `/metrics` endpoints
- Configure Redis pub/sub publisher for processed vital metrics
- Define Pydantic + **Zod-equivalent Pydantic validators** for incoming payload and outgoing vitals event (strict mode, no extra fields)
- Containerize with multi-stage Dockerfile (`python:3.11-slim` base)

### [P0-005] HiveMQ Configuration
- Configure HiveMQ with MQTT 5.0 listener on port 8883 (TLS)
- Define topic structure: `anees/devices/{device_id}/raw`, `anees/devices/{device_id}/status`
- Create NestJS MQTT microservice consumer subscribing to `anees/devices/+/raw`
- Test end-to-end: mock MQTT publisher → HiveMQ → NestJS consumer logs payload

### [P0-006] OCI Staging Environment (Terraform)
- Write Terraform modules: `oci_compute` (ARM Ampere A1, 4 OCPU / 24 GB), `oci_vcn`, `oci_object_storage`, `oci_vault`
- Store Terraform state in OCI Object Storage backend (versioned bucket)
- `terraform plan` validates against staging; `terraform apply` on merge to `infra/staging` branch
- Provision OCI VCN, security lists (ports: 443, 8883 MQTT/TLS, 7880 LiveKit, 3478/5349 Coturn TURN)
- Store all secrets in OCI Vault: DB URL, MQTT credentials, LiveKit API key/secret, FCM service account, APNs cert, JWT secrets, OTEL endpoint
- Inject secrets at runtime via OCI instance metadata / environment — never in Docker images
- Deploy Docker Compose stack to staging via **GitHub Actions** SSH deploy job on merge to `main`
- Configure NGINX reverse proxy with TLS 1.3 (Let's Encrypt via Certbot)

### [P0-007] GitHub Actions CI/CD Pipeline
- **PR pipeline** (`.github/workflows/pr.yml`):
  - Lint: ESLint + Prettier (NestJS), Ruff + Black (FastAPI), `flutter analyze`
  - Unit tests: Jest (NestJS), pytest (FastAPI), Flutter test
  - Integration tests: spin up Docker Compose test stack, run Jest e2e suite
  - Build Docker images (no push on PR)
- **Merge to main** (`.github/workflows/deploy-staging.yml`):
  - Build + push to OCI Container Registry
  - SSH deploy to staging: `docker compose pull && docker compose up -d`
  - Slack notification on success/failure
- **Tag release** (`.github/workflows/deploy-prod.yml`):
  - Identical build/push step
  - Manual approval gate (GitHub Environments `production`)
  - SSH deploy to production instance
  - Post-deploy smoke test: hit `/health` on NestJS + FastAPI

---

## PHASE 1 — Auth & User Management
**Goal:** Secure login, role-based JWT issuance, and patient-caregiver relationship management.

### [P1-001] Auth Module — NestJS
- Implement `POST /auth/register` — create user with hashed password (bcrypt), assign role
- Implement `POST /auth/login` — validate credentials, issue access JWT (15 min) + refresh token (7 days)
- Implement `POST /auth/refresh` — validate refresh token, rotate and issue new pair
- Implement `POST /auth/logout` — blacklist refresh token in Redis
- JWT payload: `{ sub: userId, role: 'care_receiver' | 'caregiver' | 'admin', iat, exp }`
- NestJS `JwtAuthGuard` and `RolesGuard` applied globally; whitelist public routes

### [P1-002] User Profiles
- `GET /users/me` — return authenticated user profile
- `PATCH /users/me` — update name, phone, language preference (en/ar)
- `POST /users/me/avatar` — upload avatar to OCI Object Storage, store URL in DB

### [P1-003] Patient-Caregiver Linking
- `POST /links/invite` — caregiver generates invite code (stored in Redis, 24h TTL)
- `POST /links/accept` — patient (or admin) accepts invite, creates `caregiver_links` record
- `GET /links/patients` — caregiver retrieves their linked patient list
- `PATCH /links/:id` — update relationship_type (primary/secondary)
- `DELETE /links/:id` — remove link; triggers cascade alert re-routing to next primary
- Admin endpoint: `POST /admin/links` — direct link creation without invite flow

### [P1-004] Flutter Auth Flows
- Login screen: email + password fields, validation, error handling
- JWT storage: `flutter_secure_storage` (Keychain/Keystore backed)
- Auto-login: on app launch, attempt token refresh; on failure, redirect to login
- Role-based routing: `care_receiver` → Interface A root; `caregiver` → Interface B root
- Logout clears secure storage and calls `/auth/logout`

---

## PHASE 2 — IoT Ingestion Pipeline
**Goal:** Raw mmWave MQTT payloads processed into derived vitals stored in TimescaleDB.

### [P2-001] MQTT Payload Schema (Zod + Pydantic)
Define and validate the hardware JSON contract at **two layers**:

**NestJS boundary (Zod):**
```typescript
const MmWaveRawPayload = z.object({
  device_id: z.string().uuid(),
  timestamp: z.number().int().positive(),
  frame_seq: z.number().int().nonnegative(),
  point_cloud: z.array(z.object({
    x: z.number(), y: z.number(), z: z.number(),
    v: z.number(), snr: z.number().min(0).max(1)
  })).min(1),
  firmware_version: z.string().regex(/^\d+\.\d+\.\d+$/)
});
```
**FastAPI boundary (Pydantic strict mode):**
```python
class MmWavePayload(BaseModel):
    model_config = ConfigDict(strict=True, extra='forbid')
    device_id: UUID
    timestamp: int
    frame_seq: int
    point_cloud: list[PointCloudEntry]
    firmware_version: str
```
- Zod parse failure in NestJS → log to Loki with `device_id` tag + route to BullMQ `dlq` queue
- Pydantic validation failure in FastAPI → return 422, log structured error to Loki, increment Prometheus counter `dsp_validation_errors_total`

### [P2-002] NestJS MQTT Consumer → FastAPI Bridge
- NestJS MQTT consumer receives Zod-validated payload
- Extract OTEL trace context and inject as `traceparent` HTTP header on forwarded request
- Forward to FastAPI DSP via internal HTTP `POST /dsp/process` (VPC-internal, no external auth overhead)
- Include `device_id` and `patient_id` (resolved via **Prisma-cached device registry**, Redis L1 cache TTL 1h) in forwarded payload
- Handle FastAPI unavailability: **BullMQ job** with 3 retries × 500ms exponential backoff; on exhaustion → DLQ + Prometheus counter `mqtt_forward_failures_total`
- Log each forwarded message with trace ID to pino/Loki

### [P2-003] FastAPI DSP — Vital Extraction
- Implement phase extraction pipeline using NumPy/SciPy:
  - Extract range-velocity map from point cloud
  - Apply micro-Doppler phase shift: `ΔΦ(t) = (4π/λ) · d(t)` with λ = 3.9mm at 77 GHz
  - Band-pass filter: 0.8–2.5 Hz for HR, 0.1–0.5 Hz for RR
  - Peak detection for BPM/BRPM extraction
- Publish derived vitals to Redis channel `vitals:{device_id}`:
  ```json
  { "device_id": "...", "patient_id": "...", "timestamp": 0, "heart_rate_bpm": 72, "resp_rate_brpm": 14, "signal_quality": 0.92 }
  ```
- Unit test DSP functions with synthetic waveform fixtures

### [P2-004] Vital Storage Worker (NestJS)
- NestJS Redis subscriber on `vitals:*` pattern
- Batch-insert to TimescaleDB `vital_readings` hypertable (every 5 seconds, buffer up to 50 rows)
- Update device `last_heartbeat` timestamp in PostgreSQL
- Trigger anomaly detection check (see P4)

### [P2-005] Device Registry & Resolution
- `devices` table: serial → patient_id mapping
- Redis cache: `device:{serial}` → `{ device_id, patient_id }` (TTL 1 hour)
- `POST /admin/devices` — register new device and assign to patient
- `GET /devices/:id/status` — latest heartbeat, firmware, signal quality

### [P2-006] Pipeline Integration Test
- Write Jest integration test: publish mock MQTT payload → assert vital appears in TimescaleDB within 2 seconds
- Run in CI against Docker Compose test environment

---

## PHASE 3 — Real-Time Vitals (Flutter Interface A + B)
**Goal:** Live vitals streaming to both Flutter interfaces via WebSocket.

### [P3-001] NestJS WebSocket Gateway
- NestJS Socket.IO gateway on namespace `/vitals`
- On client connect: validate JWT, extract role and linked patient IDs
- `care_receiver` → auto-join room `patient:{own_patient_id}`
- `caregiver` → join rooms for all linked `patient:{id}` IDs
- Broadcast `vitals.update` event to patient rooms as Redis `vitals:*` messages arrive
- Broadcast `system.device_offline` if no vital received for a patient in > 5 minutes

### [P3-002] Flutter WebSocket Service
- Implement `VitalsSocketService` using `socket_io_client`
- Handle: connect, reconnect (exponential backoff, max 30s), disconnect, auth error
- Expose reactive streams: `Stream<VitalReading>` per patient ID
- Persist last known vital in local SQLite via `drift` for offline display

### [P3-003] Interface A — Care Receiver Vitals Screen
- Large HR card (48pt number, green background if in range)
- Large RR card (same paradigm)
- "System Active & Safeguarding" persistent connectivity strip (green / grey for offline)
- Text descriptions: "Your heart is beating normally" / "Your breathing looks good"
- All font sizes ≥ 18pt; no nested navigation from this screen
- Offline state: show last known values with "Last updated X minutes ago" notice

### [P3-004] Interface B — Patient Detail Live Vitals Panel
- HR and RR cards with real-time update animation (subtle pulse on value change)
- 60-second sparkline waveform (rolling window from WebSocket stream buffer)
- Signal quality progress bar (0–100%)
- "Last updated" timestamp auto-updating every second

### [P3-005] Interface B — Patient Roster Live Status
- Patient cards update HR/RR values in real-time from WebSocket stream
- Animate card border to amber/red on threshold breach
- Sort order re-evaluates on each alert state change event

---

## PHASE 4 — Fall Detection & Alert Pipeline
**Goal:** Full end-to-end fall event flow: sensor → cloud → push → caregiver UI.

### [P4-001] Fall Detection Logic (FastAPI DSP)
- Implement macro-Doppler fall classifier:
  - Detect sudden vertical velocity vector exceeding configurable threshold (default: -2.5 m/s²)
  - Validate horizontal floor-profile orientation from point cloud z-distribution
  - Debounce: require signal sustained > 100ms to filter micromovement noise
- Publish to Redis channel `alerts:{device_id}` with event type `fall_candidate`

### [P4-002] Fall Alert Orchestration (NestJS + BullMQ)
- Subscribe to Redis `alerts:*` channel
- On `fall_candidate`:
  - Create `alert_events` record via **Prisma** (status: `pending_cancellation`)
  - Emit `fall.detected` Socket.IO event to `patient:{id}` room
  - Enqueue **BullMQ delayed job** `fall-alert:{alert_id}` with 10-second delay in `fall-alert` queue
  - Log job enqueue with trace ID to pino/Loki
- On `CANCEL` received from Interface A via Socket.IO (with event ack):
  - Remove BullMQ delayed job by job ID
  - Update alert status to `cancelled_by_user` via Prisma
  - Append to **audit_log** table: `{ actor: patient_id, action: 'alert.cancelled', resource: alert_id }`
- On BullMQ job execution (10s elapsed, no cancel):
  - Update alert status to `dispatched` via Prisma
  - Enqueue jobs in `push-notifications` BullMQ queue (one per linked caregiver push token)
  - Log full fall event span to Jaeger (OTEL trace: fall detected → dispatched)

### [P4-003] Push Notification Service (NestJS)
- Integrate Firebase Admin SDK for FCM
- Integrate `apn` library for APNs direct provider API
- FCM critical alert: `priority: "high"`, `notification.sound: "alarm"`, data payload includes `alert_id`, `patient_id`, `room_label`
- APNs critical alert: `apns-priority: 10`, `apns-push-type: alert`, `aps.sound.critical: 1`, `aps.sound.volume: 1.0`
- Store device push tokens per user in `user_push_tokens` table
- Retry failed pushes via BullMQ (3 attempts, exponential backoff)

### [P4-004] Interface A — Fall Grace Period Screen
- On `fall.detected` WebSocket event: render fullscreen modal overlay
- Large countdown timer (10s, animated progress ring)
- Dominant "I'm OK — Cancel Alert" button (minimum 80pt height tap target)
- Voice prompt (TTS): "A fall was detected. Tap the button if you are okay."
- On cancel tap: emit `alert.cancel` WebSocket event to server

### [P4-005] Interface B — Alert Receipt & Triage UI
- Push notification arrives with deep-link to Alert Detail Screen
- Alert Detail Screen (per spec in Dashboard PRD Section 4.3)
- Patient Roster re-sorts: patient with active alert moves to top, card pulses red
- Alert tab badge count increments
- Looping alarm tone (AudioSession category: `playback` with `mixWithOthers: false` to override silent mode on iOS, `USAGE_ALARM` on Android)

### [P4-006] Alert Resolution Flows
- `POST /alerts/:id/acknowledge` — stops alarm tone, logs caregiver identity + timestamp
- `POST /alerts/:id/resolve` — marks incident closed; prompts optional free-text note
- `POST /alerts/:id/false-alarm` — flags DSP for calibration feedback; optional note
- Alert history visible in both patient detail and alerts center tab

### [P4-007] Vital Anomaly Detection
- Configurable per-patient thresholds stored in `patient_thresholds` table (HR min/max, RR min/max)
- NestJS vital storage worker checks each reading against thresholds
- On breach > 3 consecutive readings: create `alert_events` record (type: `vital_anomaly`)
- Push notification at lower priority (standard FCM/APNs priority, no alarm sound)
- Display amber warning chip on patient card in Interface B

---

## PHASE 5 — Voice Intercom (LiveKit)
**Goal:** One-tap full-duplex voice channel between caregiver and patient room hardware.

### [P5-001] LiveKit Server Setup
- Deploy LiveKit server on OCI (Docker, dedicated instance)
- Configure Coturn TURN server with OCI static IP (relay fallback for NAT traversal)
- LiveKit config: enable `room.auto_create: false`, define rooms via API only
- Store `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` in OCI Vault

### [P5-002] NestJS — LiveKit Room & Token Service
- `IntercomService` using LiveKit Server SDK (`livekit-server-sdk`)
- On alert dispatch (P4-002): pre-create LiveKit room `patient-{patient_uuid}` with 4-hour TTL
- `POST /intercom/token` (caregiver role):
  - Validate caregiver is linked to requested patient
  - Issue `RoomServiceClient` participant token with permissions: `canPublish: true`, `canSubscribe: true`
  - Return token + LiveKit WS URL
- Interface A participant token: issued automatically when alert fires; stored as room metadata for auto-connect

### [P5-003] Flutter — Caregiver Intercom Screen
- Integrate `livekit_client` Flutter package
- On "Open Live Audio Channel" tap: call `POST /intercom/token`, connect to LiveKit room
- Render: animated waveform visualizer (amplitude from local audio track), mute toggle, elapsed duration, end call button
- Handle: room not found (alert expired), permission denied, network drop (auto-reconnect once)
- On call end: `POST /intercom/sessions` to log session duration

### [P5-004] mmWave Hardware Gateway — Auto-Answer
- Lightweight process running on mmWave device edge (Node.js or Python)
- Connects to LiveKit room as participant on alert dispatch using pre-issued token
- Routes audio output to device speaker hardware via ALSA/PulseAudio sink
- Routes microphone input from device mic array to LiveKit track
- On caregiver disconnect: leave room, log session end

### [P5-005] Flutter — Interface A Auto-Answer
- If Interface A app is foreground when alert fires: auto-connect to LiveKit room using embedded token from `fall.detected` WebSocket payload
- No UI interaction required; show fullscreen "Caregiver Connected — Speaking…" overlay
- Elderly user can tap "End Call" at any time

---

## PHASE 6 — Sleep Analytics
**Goal:** Sleep stage classification stored, queryable, and displayed on both interfaces.

### [P6-001] FastAPI Sleep Stage Classifier
- Implement sleep stage classifier from vital sign waveforms:
  - HR variability + RR + motion amplitude → stage classification (rule-based baseline; ML upgrade in roadmap)
  - 30-second epoch classification: `deep | light | rem | awake`
- Publish to Redis `sleep:{device_id}` channel per epoch
- Nightly aggregation job (midnight cron): compute fragmentation index, total sleep time per stage

### [P6-002] Sleep Storage (NestJS + TimescaleDB)
- Subscribe to Redis `sleep:*`, write epochs to `sleep_epochs` hypertable
- Nightly BullMQ cron job: generate `sleep_reports` summary record per patient (total, stage %, fragmentation index, quality label)

### [P6-003] Interface A — Sleep Summary Widget
- Qualitative label: "You slept well last night" / "Your sleep was restless" / "You had a rough night"
- Simple 7-day bar chart: one bar per night, color-coded by quality label
- Data source: `GET /patients/:id/sleep/report?last=7`

### [P6-004] Interface B — Sleep Analytics Panel
- Full hypnogram (time axis × stage) for selected night
- 30-day trend chart: stacked bars per night, segmented by stage
- Fragmentation index with trend arrow (improving / worsening)
- `GET /patients/:id/sleep/report?date=YYYY-MM-DD`

---

## PHASE 7 — Caregiver Web Dashboard (Next.js 14)
**Goal:** Full web dashboard for clinical caregivers per Section 4.4 of Dashboard PRD.

### [P7-001] Next.js 14 Project Setup
- Init with App Router, TypeScript, Tailwind CSS, shadcn/ui
- Auth: NextAuth.js v5 with JWT strategy (validates Anees JWTs)
- Axios instance with auth interceptor + refresh token rotation
- Socket.IO client connecting to NestJS `/caregiver` namespace

### [P7-002] Dashboard Layout & Navigation
- Sidebar navigation: Roster, Alerts, Analytics, Reports, Devices, Settings
- Responsive: sidebar collapses to top nav on tablet breakpoint
- Active alerts count badge in sidebar and browser tab title
- Global alert toast system for real-time WebSocket events

### [P7-003] Patient Roster Table
- Sortable, filterable table (TanStack Table v8)
- Columns: name, age, room, live HR, live RR, sleep last night, alert status, actions
- Live HR/RR cells update via WebSocket without full table re-render (cell-level reactivity)
- Row click → patient detail page

### [P7-004] Patient Detail Page (Web)
- Same data sections as mobile (Sections 4.1–4.2 of PRD) with expanded chart area
- Recharts library for vitals line charts and sleep hypnogram
- Chart zoom: brush component on 30D view
- Export button: triggers `GET /reports/vitals/export` → downloads CSV

### [P7-005] Analytics Pages
- Population Overview: aggregate HR/RR box plots using Recharts
- Alert Heatmap: custom SVG heatmap (hour of day × day of week)
- Sleep Quality Trends: multi-line chart, all patients averaged per day
- Device Health Table: fleet status, uptime %, last calibration

### [P7-006] Reports & Export Center
- Date range picker + patient selector
- Generate PDF clinical report: client-side via `react-pdf` (vitals summary, sleep charts, alert history)
- Download generated PDF; no server-side PDF generation required

### [P7-007] Intercom from Web
- Web-based LiveKit intercom using `@livekit/components-react`
- Same flow as mobile: request token → connect → full-duplex audio
- Browser permission prompt for microphone handled gracefully

---

## PHASE 8 — System Health & Device Management

### [P8-001] Device Health Tracking (NestJS)
- Scheduled job (every 60s): scan all registered devices; flag any with `last_heartbeat > 5 min ago` as `offline`
- Emit `system.device_offline` WebSocket event to linked caregiver rooms
- Create `system_events` record for audit log

### [P8-002] Occlusion Detection (FastAPI)
- Detect sustained `signal_quality < 0.3` over 60-second window
- Classify as `partial_occlusion` (0.3 > quality > 0.1) or `full_occlusion` (< 0.1)
- Publish to Redis `system:{device_id}` channel → NestJS → WebSocket + push (standard priority)

### [P8-003] Device Management UI (Interface B + Web)
- Device detail card: serial, firmware, room label, last heartbeat, signal strength, occlusion status
- Admin: edit room label, trigger firmware update check (OTA roadmap item)
- Offline device alert banner on patient card

---

## PHASE 9 — Security Hardening & Compliance

### [P9-001] Transport Security Audit
- Verify TLS 1.3 on all external endpoints (NGINX, HiveMQ, LiveKit)
- Configure mTLS between NestJS ↔ FastAPI on OCI internal network
- SSL Labs scan: achieve A+ rating on public endpoints

### [P9-002] Auth Hardening
- JWT access token TTL: 15 minutes (enforce)
- Refresh token rotation: each use issues new refresh token; old token blacklisted in Redis
- Brute-force protection: rate limit `/auth/login` to 5 attempts/min per IP (NestJS + Redis)
- Failed login audit log

### [P9-003] Audit Trail Implementation
- Immutable append-only `audit_log` table: `actor_id`, `action`, `resource_type`, `resource_id`, `timestamp`, `ip_address`
- Log all: alert acknowledgements, alert resolutions, caregiver link changes, device registrations, intercom sessions
- Admin-only `GET /admin/audit-log` endpoint (paginated, filterable)

### [P9-004] IEC 62304 Controls
- Document software risk class (likely Class B — non-serious injury possible)
- Maintain change log per module in repository (CHANGELOG.md per service)
- Unit test coverage gates: ≥ 80% for DSP service, ≥ 70% for alert pipeline
- Risk mitigation records for: DSP false-negative falls, push notification delivery failures, WebRTC connectivity failures

---

## PHASE 10 — Monitoring, Observability & CI/CD

### [P10-001] Prometheus Instrumentation
- NestJS: expose `/metrics` via `prom-client`; instrument: HTTP request duration, WebSocket connections, alert pipeline duration, BullMQ queue depth
- FastAPI: expose `/metrics` via `prometheus-fastapi-instrumentator`; instrument: DSP processing time, Redis publish latency
- HiveMQ: enable Prometheus extension; scrape MQTT connection count and message throughput

### [P10-002] Grafana Dashboards
- **IoT Pipeline Dashboard:** MQTT messages/sec, DSP lag (ms), vital insert rate, queue depth
- **Alert Pipeline Dashboard:** fall detection count, alert dispatch latency, push delivery success rate
- **System Health Dashboard:** device online/offline counts, occlusion events
- **Application Performance Dashboard:** API p50/p95/p99 latency, WS connections, error rate
- Alert rules: page on-call if alert dispatch latency > 15s, DSP error rate > 1%, any device offline > 30 min

### [P10-003] Loki + Promtail Log Aggregation
- Promtail configured on OCI instance to tail Docker container logs
- NestJS and FastAPI use `pino` / `structlog` for structured JSON logs
- Grafana Loki datasource; log panels embedded in dashboards alongside metrics

### [P10-004] OpenTelemetry Distributed Tracing
- Instrument NestJS with `@opentelemetry/auto-instrumentations-node`
- Instrument FastAPI with `opentelemetry-instrumentation-fastapi`
- Trace context propagated via HTTP headers from NestJS → FastAPI
- Jaeger backend on OCI; Grafana Jaeger datasource for trace exploration
- Key trace: fall event end-to-end span (MQTT receipt → DSP → alert dispatch → push sent)

### [P10-005] GitHub Actions CI/CD Pipeline
- **PR pipeline:** lint (ESLint + Prettier), unit tests, integration tests (Docker Compose), build Docker images
- **Merge to main:** build + push to OCI Container Registry, deploy to staging via SSH
- **Tag release:** deploy to production with manual approval gate
- Secrets: `OCI_INSTANCE_IP`, `SSH_PRIVATE_KEY`, `OCI_REGISTRY_TOKEN` stored in GitHub Secrets
- Slack notification on deploy success/failure

---

## Cross-Cutting Tasks (Any Phase)

| Task | Owner Layer | Notes |
|---|---|---|
| Arabic/English i18n (Flutter + Next.js) | Mobile + Web | RTL layout support in Flutter; `next-intl` for web. Date/number formatting with Arabic-Indic numerals. |
| Accessibility audit (Interface A) | Mobile | Minimum 18pt fonts enforced, tap targets ≥ 48pt, high-contrast color palette audit. |
| Offline mode (Interface A) | Mobile | Show last known vitals from local SQLite when WebSocket disconnected. |
| Performance profiling (Flutter) | Mobile | Ensure Patient Roster with 50 patients maintains 60fps scroll via `ListView.builder`. |
| API versioning | NestJS | All routes under `/v1/` prefix from Phase 1 onwards. |
| Integration test suite | All | End-to-end happy path: device publishes → vital stored → pushed to Flutter → displayed. |

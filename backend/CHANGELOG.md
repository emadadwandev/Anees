# Changelog — Anees Backend (NestJS)

All notable changes to this service are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
IEC 62304 §5.1.1 — Software Development Plan requires a change record per software unit.

---

## [Unreleased]

### Added
- `AdminService` with facility-wide queries: stats, all-patients (live Redis vitals), active/history alerts, 7-day analytics
- `GET /v1/admin/stats` — total patients, online/offline devices, active alert counts, avg signal quality
- `GET /v1/admin/patients` — all care_receiver users with latest vitals from Redis, device info, alert status
- `GET /v1/admin/alerts/active` — dispatched/acknowledged alerts across all patients with patient name and room
- `GET /v1/admin/alerts/history` — resolved alerts with response time in seconds
- `GET /v1/admin/analytics` — 7-day alert frequency via `DATE_TRUNC`, type breakdown, avg response time

### Changed
- `CaregiverGateway.handleConnection`: `admin` role now joins all patient rooms + `admin` room
- `VitalsGateway.handleConnection`: same admin-all-rooms behaviour for live vitals broadcast

### Added
- P9-002: Audit log entry on failed login attempts (`auth.login_failed`)
- P5-005: `alerts:patient:{id}` Redis channel — delivers `fall.detected` with embedded LiveKit token to patient Socket.IO room via `VitalsGateway`
- P5-005: Pre-create LiveKit room and issue patient participant token at fall detection time (in `AlertOrchestrationService`)

---

## [0.4.0] — 2026-06-24

### Added
- P4-001 → P4-007: Full fall detection and alert pipeline (BullMQ grace timer, push notifications, audit log on alert actions)
- P5-002: `IntercomService` — LiveKit room creation and participant token issuance
- P5-002: `POST /intercom/token` — issues caregiver participant tokens
- P6-002: Sleep storage worker — subscribes to `sleep:*` Redis channel, writes to `sleep_epochs` hypertable
- P7-003: `GET /patients` with live HR/RR and alert status projection
- P8-001: `DeviceHealthService` — 60 s scheduled scan, emits `system.device_offline` WebSocket event
- P9-003: Immutable `audit_log` table; `GET /admin/audit-log` paginated endpoint (admin only)
- P10-001: Prometheus `/v1/metrics` endpoint via `prom-client`

### Changed
- `AlertOrchestrationService` subscribes to `alerts:caregiver` Redis channel for caregiver gateway forwarding

---

## [0.3.0] — 2026-06-10

### Added
- P3-001: `VitalsGateway` (Socket.IO `/vitals`) — JWT auth on connect, patient/caregiver room join logic
- P3-001: `CaregiverGateway` (Socket.IO `/caregiver`) — fall/alert event fan-out to caregiver rooms
- P2-002: MQTT consumer → FastAPI DSP bridge with BullMQ retry and DLQ on exhaustion
- P2-004: `VitalStorageWorker` — Redis `vitals:*` subscriber, batch-inserts to TimescaleDB hypertable

---

## [0.2.0] — 2026-05-28

### Added
- P1-001: Auth module — register, login (bcrypt), JWT access (15 min) + refresh (7 day) rotation, Redis blacklist on logout
- P1-002: `GET /users/me`, `PATCH /users/me`
- P1-003: Patient-caregiver invite/accept link flow
- P2-005: Device registry with Redis L1 cache (`device:{serial}` TTL 1 h)

---

## [0.1.0] — 2026-05-14

### Added
- P0-003: NestJS project scaffold with `ConfigModule` (Zod env validation), `nestjs-pino`, OpenTelemetry SDK, Helmet
- P0-002: `PrismaService` singleton; initial schema migration; TimescaleDB hypertables for `vital_readings`, `sleep_epochs`, `motion_events`
- P0-005: MQTT microservice consumer subscribing to `anees/devices/+/raw`
- BullMQ queues: `fall-alert`, `push-notifications`, `sleep-aggregation`, `anomaly-detection`

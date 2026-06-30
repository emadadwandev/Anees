/i# Anees Healthcare Platform — App Context Document
**Version:** 1.0.0  
**Date:** June 2026  
**Scope:** Full-stack system context for engineering team onboarding and architectural reference

---

## 1. Project Overview

**Anees** is a contactless, ambient healthcare monitoring platform powered by **mmWave radar (60–77 GHz FMCW)** sensors deployed statically within a patient's living environment. It continuously extracts physiological signals — heart rate, respiration rate, sleep stages, movement trajectories, and fall events — without any wearable devices or privacy-invasive cameras.

The platform serves two distinct user groups through a single application package with two discrete operational interfaces:

| Interface | User | Primary Job-to-be-Done |
|---|---|---|
| **Interface A** | Care Receiver (Elderly Patient) | Passive, reassuring vitals dashboard. Zero cognitive overhead. |
| **Interface B** | Caregiver (Family / Clinical Staff) | Real-time alerts, historical telemetry, voice intercom to patient room. |

---

## 2. Core System Capabilities

### 2.1 Vital Sign Monitoring
- Continuous **Heart Rate (BPM)** extracted from micro-Doppler chest wall displacement via phase shift equation: `ΔΦ(t) = (4π/λ) · d(t)` at ~77 GHz (λ ≈ 3.9 mm)
- Continuous **Respiration Rate (BRPM)** from thoracic expansion waveforms
- Baseline anomaly thresholds with per-patient calibration windows
- All processed server-side in the Python DSP service; clients receive derived metric streams, never raw ADC data

### 2.2 Sleep Analytics
- Sleep stage classification: Deep / Light / REM / Awake
- Fragmentation index tracking (micro-arousals, restless periods)
- Interface A: qualitative summary ("Good", "Restless")
- Interface B: quantitative breakdown with 30-day longitudinal trend charts

### 2.3 Fall Detection & Emergency Protocol
- Macro-Doppler acceleration vector anomaly triggers fall candidate event
- **10-second grace window** rendered on Interface A for user self-cancel
- On timeout: push notification bypasses APNs/FCM standard priority → caregiver alert
- Caregiver initiates WebRTC voice intercom → bridges to mmWave device's onboard speaker array
- Full sequence completes in ~11.2 seconds from fall detection to caregiver alert delivery

### 2.4 Voice Intercom (WebRTC via LiveKit)
- One-touch initiation from Interface B
- Full-duplex audio over G.711/Opus codecs
- Audio bridged to mmWave hardware speaker unit via LiveKit SFU egress
- Auto-answer on Interface A side (no elderly user action required)

### 2.5 System Health Monitoring
- Interface A: persistent "System Active & Safeguarding" connectivity card
- Interface B: signal strength, physical occlusion flags, device uptime reports

---

## 3. Finalized Technology Stack

### 3.1 Stack Table with Rationale

| Layer | Technology | Rationale / Enhancement Notes |
|---|---|---|
| **Mobile App** | Flutter 3.x | Single codebase for iOS + Android. Dual-interface from single package via role-based routing. |
| **Backend API** | NestJS (Node.js + TypeScript) | Modular architecture, decorators-first DI, native WebSocket gateway support. |
| **AI / DSP Service** | Python FastAPI | Async-native, ideal for numpy/scipy DSP pipelines. Separate process isolation for CPU-intensive signal work. |
| **Primary Database** | PostgreSQL 16 | Relational store for user accounts, device registry, alert logs, caregiver relationships. |
| **Time-Series Database** | TimescaleDB (PostgreSQL extension) | Hypertables for high-frequency vital telemetry. Native time-bucket aggregation queries. Compression policies for cold data. |
| **IoT Message Broker** | HiveMQ (MQTT 5.0) | Enterprise MQTT broker. Persistent sessions, shared subscriptions, rule engine for topic-based routing to NestJS consumers. |
| **Real-Time Transport** | Socket.IO via NestJS Gateway (`@nestjs/platform-socket.io`) | Socket.IO chosen over raw WS: automatic reconnection with exponential backoff, namespace/room model (rooms = patient UUIDs), event acknowledgement receipts. Flutter uses `socket_io_client`. |
| **Voice Intercom** | WebRTC + LiveKit SFU | LiveKit selected over Mediasoup: managed SFU, Flutter SDK (`livekit_client`), built-in recording, lower ops overhead. Coturn retained as TURN server fallback. |
| **Cache / Pub-Sub / Queue** | Redis 7 (via ioredis) + BullMQ | Session cache, JWT blacklist, real-time pub-sub bridge between DSP service → NestJS → Socket.IO rooms. BullMQ (Redis-backed) manages all async jobs: fall grace timers, push dispatch, sleep aggregation, anomaly checks — with retry, backoff, DLQ. |
| **Infrastructure** | Oracle OCI | OCI Compute (ARM Ampere A1 — cost-efficient), OCI Managed PostgreSQL, OCI Object Storage for telemetry exports/backups. |
| **Monitoring** | Grafana + Prometheus + Loki | Prometheus scrapes NestJS + FastAPI metrics endpoints. Loki aggregates structured logs. Grafana dashboards for IoT throughput, DSP lag, and alert pipeline SLAs. |
| **Authentication** | OAuth 2.0 + JWT (short-lived access + refresh token rotation) | NestJS Passport guards. Role claims (`care_receiver` / `caregiver` / `admin`) embedded in JWT for interface routing. |
| **Push Notifications** | FCM (Android) + APNs (iOS) via NestJS service | Critical alerts use FCM `priority: high` + APNs `apns-priority: 10` with `content-available: 1` for background wake. |
| **ORM** | Prisma ORM (PostgreSQL provider) | Schema-first, type-safe migrations across PostgreSQL tables and TimescaleDB hypertables (hypertable promotion via raw SQL in migration files). NestJS `PrismaService` injected across all modules. |
| **Validation** | Zod | Runtime schema validation at MQTT ingestion boundary, FastAPI → Redis publish contracts, and all NestJS DTO shapes. Invalid payloads routed to BullMQ DLQ. |
| **Logging** | Pino (NestJS) + structlog (FastAPI) → Loki | Structured JSON logs from all services. Promtail tails Docker container logs → Loki. Grafana log panels alongside metric panels. Immutable audit trail for IEC 62304. |
| **Distributed Tracing** | OpenTelemetry + Jaeger | Auto-instrumentation on NestJS + FastAPI. Trace context propagated over HTTP headers. Jaeger on OCI. Key trace: MQTT receipt → DSP → Redis → alert dispatch → push delivered. |
| **Infrastructure as Code** | Terraform (OCI Provider) | Modules: `oci_compute`, `oci_vcn`, `oci_object_storage`, `oci_vault`. State in OCI Object Storage. Enables full staging/prod environment parity. |
| **CI/CD** | GitHub Actions | PR: lint + tests + Docker Compose integration. Merge: build → OCI registry → staging deploy. Tag: prod deploy with manual approval gate. Slack deploy notifications. |

### 3.2 Finalized Enhancements (Fully Adopted)

All enhancements below are now **first-class stack members**, not optional additions. They are reflected in the service architecture, data models, and task breakdown.

| Enhancement | Layer | Integration Point |
|---|---|---|
| **Prisma ORM** | NestJS → PostgreSQL/TimescaleDB | Schema-first migrations, type-safe queries, NestJS `PrismaService` singleton. Manages all PostgreSQL tables + TimescaleDB hypertable declarations via raw SQL in migration files. |
| **Zod** | MQTT boundary + inter-service contracts | Validates every incoming MQTT payload in the NestJS consumer before forwarding to FastAPI. Also validates FastAPI → Redis publish schema and all NestJS DTO shapes. Malformed payloads routed to BullMQ dead-letter queue. |
| **BullMQ** (Redis-backed) | Alert orchestration + push dispatch | Replaces all synchronous alert processing. Fall grace timers, push notification dispatch, nightly sleep aggregation, and anomaly detection checks are all BullMQ jobs. Provides retry, backoff, DLQ, and job progress visibility. |
| **Loki + Promtail** | Log aggregation | Promtail tails all Docker container logs on OCI. NestJS uses `pino` (structured JSON), FastAPI uses `structlog`. Loki datasource in Grafana — log panels embedded alongside metric panels. Critical for IEC 62304 audit trails. |
| **OpenTelemetry + Jaeger** | Distributed tracing | NestJS instrumented via `@opentelemetry/auto-instrumentations-node`. FastAPI via `opentelemetry-instrumentation-fastapi`. Trace context propagated over HTTP headers. Jaeger backend on OCI. Key trace: MQTT receipt → DSP processing → Redis pub → alert dispatch → push delivered. |
| **Coturn** | WebRTC TURN relay | Deployed on OCI with static IP. Required for residential NAT traversal. LiveKit configured with Coturn as TURN server. |
| **Terraform (OCI Provider)** | Infrastructure as Code | Modules: `oci_compute`, `oci_vcn`, `oci_object_storage`, `oci_vault`. State stored in OCI Object Storage. Enables staging/prod environment parity and reproducible teardown/rebuild. |
| **GitHub Actions** | CI/CD | PR: lint + unit tests + integration tests (Docker Compose). Merge to main: build → push OCI registry → deploy staging. Tag release: deploy production with manual approval gate. |
| **Socket.IO** (over raw WS) | NestJS WebSocket Gateway | Chosen for: automatic reconnection, namespace/room model mapping to patient UUIDs, event acknowledgement receipts, and Flutter `socket_io_client` compatibility. |

---

## 4. Service Architecture Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          OCI Cloud Boundary                             │
│                                                                         │
│  ┌──────────────┐    MQTT/TLS    ┌─────────────┐                        │
│  │  mmWave HW   │ ─────────────► │   HiveMQ    │                        │
│  │  (Edge Node) │               │  IoT Broker │                        │
│  └──────────────┘               └──────┬──────┘                        │
│                                        │ MQTT Consumer                  │
│                                   ┌────▼────────────┐                  │
│                                   │  NestJS API     │◄── REST (Mobile) │
│                                   │  (Core Backend) │◄── WS (Flutter)  │
│                                   └────┬────────────┘                  │
│                          ┌─────────────┼─────────────┐                 │
│                          │             │             │                  │
│                    ┌─────▼──┐   ┌──────▼──┐  ┌──────▼──┐              │
│                    │FastAPI │   │ Redis 7 │  │Postgres │              │
│                    │DSP Svc │   │+ BullMQ │  │+Timescale│             │
│                    └────────┘   └─────────┘  └─────────┘              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      LiveKit SFU Cluster                        │   │
│  │           (WebRTC voice rooms — patient ↔ caregiver)            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Monitoring Stack: Prometheus + Loki + Grafana + Jaeger (OTEL)   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
         │                           │
  ┌──────▼──────┐             ┌──────▼──────┐
  │  Flutter    │             │  Next.js 14  │
  │  Mobile App │             │  Web Dashboard│
  │  (A + B)    │             │  (Caregiver) │
  └─────────────┘             └─────────────┘
```

---

## 5. Data Models (Core Entities)

### 5.1 Key PostgreSQL Tables

```
users              — id, role (care_receiver|caregiver|admin), profile, created_at
devices            — id, user_id (owner), serial, firmware_version, room_label, status
caregiver_links    — id, caregiver_id, patient_id, relationship_type, is_primary
alert_events       — id, device_id, patient_id, type (fall|vital_anomaly), triggered_at, resolved_at, cancelled_by_user
intercom_sessions  — id, alert_event_id, livekit_room_id, started_at, ended_at, initiated_by
```

### 5.2 TimescaleDB Hypertables

```
vital_readings     — time, device_id, patient_id, heart_rate_bpm, resp_rate_brpm, signal_quality
sleep_epochs       — time, device_id, patient_id, stage (deep|light|rem|awake), duration_sec
motion_events      — time, device_id, patient_id, event_type, doppler_magnitude, coordinates
```

Retention policy: raw vital readings compressed after 30 days, aggregated chunks retained for 2 years.

---

## 6. Inter-Service Communication Contracts

| From | To | Protocol | Payload Format |
|---|---|---|---|
| mmWave Hardware | HiveMQ | MQTT 5.0 / TLS 1.3 | JSON (Zod-validated on ingestion) |
| HiveMQ | NestJS MQTT Consumer | Internal broker subscription | JSON |
| NestJS | FastAPI DSP | HTTP REST (internal VPC) | JSON — raw ADC chunks |
| FastAPI DSP | Redis | Pub/Sub | JSON — derived vital metrics |
| Redis | NestJS WS Gateway | Sub listener | JSON → Socket.IO room broadcast |
| NestJS | Flutter App | WebSocket (Socket.IO) | JSON events: `vitals.update`, `fall.detected`, `system.status` |
| NestJS | FCM / APNs | HTTPS | Platform push payload |
| NestJS | LiveKit Server API | REST | Room create, participant tokens |
| Flutter | LiveKit SDK | WebRTC | Audio tracks |

---

## 7. Security & Compliance Summary

- **Transport:** TLS 1.3 on all external-facing connections; mTLS between internal OCI services
- **Storage:** AES-256-GCM at rest (OCI Block Volume encryption + PostgreSQL TDE)
- **Auth:** OAuth 2.0, short-lived JWTs (15 min access / 7 day refresh with rotation), JWT blacklist in Redis
- **Role Isolation:** NestJS Guards enforce role claims on every route and WS event
- **Privacy:** mmWave captures RF reflections only — no visual data, no PII in sensor stream
- **Audit Logs:** All alert events, caregiver actions, and intercom sessions are immutable append-only records
- **Medical SW Lifecycle:** IEC 62304 software risk classification applied; change verification tracked per module

---

## 8. Environment Topology

| Environment | Purpose | Notes |
|---|---|---|
| `dev` | Local development | Docker Compose — all services local |
| `staging` | QA + integration testing | OCI, scaled-down, seeded test patients |
| `production` | Live deployment | OCI, HA PostgreSQL, LiveKit cluster, Grafana alerts |

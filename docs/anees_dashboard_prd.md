# Anees Caregiver Management Dashboard — Interface B PRD
**Version:** 1.0.0  
**Platform:** Flutter Mobile App + Next.js 14 Web Dashboard  
**Date:** June 2026

---

## 1. Overview

Interface B is the high-performance operational control surface for caregivers and clinical staff. It is engineered to process time-critical fall alerts, monitor longitudinal patient health trends across a multi-patient roster, and establish instant full-duplex voice communication with patient rooms — all within a low-friction, triage-optimized UX.

---

## 2. User Stories

### US-B01 — Alert Triage
> As a caregiver managing multiple patients, I want to see all active alerts sorted by urgency the moment I open the app, so I can immediately identify who needs my attention without scrolling or searching.

**Acceptance Criteria:**
- Active alerts render at the top of the patient list, sorted by: `fall_active > vital_anomaly > system_offline > ok`
- Each alert card shows: patient name, room label, alert type, time elapsed since trigger
- Unread critical alerts play a looping audio tone and vibrate until acknowledged
- Alert acknowledgement persists across caregiver devices in real-time via WebSocket sync

### US-B02 — Fall Event Response
> As a caregiver, when a fall alert fires, I want to see exactly when it happened and immediately open a voice channel to the patient's room, so I can assess the situation without physically being present.

**Acceptance Criteria:**
- Push notification arrives within 12 seconds of fall detection (per system SLA)
- Notification deep-links directly to the fall event detail screen
- "Open Live Audio Channel" button is visible within one tap from the notification
- Voice intercom connects within 3 seconds of button press (LiveKit room pre-warmed)
- Auto-answer activates on Interface A side without elderly user interaction

### US-B03 — Vital Sign Review
> As a caregiver, I want to review a patient's heart rate and respiration history across daily, weekly, and monthly views, so I can identify emerging trends before they become emergencies.

**Acceptance Criteria:**
- Charts load within 1.5 seconds via TimescaleDB time-bucket aggregation
- Zoom controls support: 6h / 24h / 7d / 30d windows
- Anomaly periods highlighted in amber/red directly on chart timeline
- Export to CSV available for 30-day windows (clinical handoff)

### US-B04 — Sleep Report Review
> As a caregiver, I want to see quantitative sleep stage breakdowns for each night, so I can identify fragmentation patterns linked to cognitive or cardiovascular risk.

**Acceptance Criteria:**
- Per-night sleep hypnogram displayed (time vs. stage: Deep/Light/REM/Awake)
- 7-day and 30-day trend bars showing % time in each stage
- Fragmentation index score displayed with contextual risk label (Low / Moderate / High)

### US-B05 — Multi-Patient Roster Management
> As a clinical nurse managing a ward, I want to see all my assigned patients on a single screen with live status indicators, so I can triage at a glance.

**Acceptance Criteria:**
- Patient list supports up to 50 concurrent patients (pagination beyond 20)
- Each row shows: name, age, room, live HR/RR, last sleep quality, last seen timestamp, alert status chip
- List auto-refreshes via WebSocket — no manual pull-to-refresh required
- Search/filter by name, room label, alert status

### US-B06 — Device & System Health
> As a caregiver, I want to know when a patient's mmWave sensor goes offline or is physically obstructed, so I can arrange maintenance before monitoring gaps occur.

**Acceptance Criteria:**
- System health badge visible on every patient card
- Offline duration displayed if device has been unreachable > 5 minutes
- Occlusion flag shown with estimated severity (partial / full)
- Push notification sent to caregiver when device goes offline > 15 minutes

### US-B07 — Caregiver Account & Patient Linking
> As a caregiver, I want to manage which patients are linked to my account and designate primary vs. secondary caregiver roles, so alert routing is correctly prioritized.

**Acceptance Criteria:**
- Caregivers can be linked to patients by admin or via invite code
- Primary caregiver designation routes all critical alerts first
- Secondary caregivers receive escalation alerts if primary does not acknowledge within 2 minutes

---

## 3. Screen Inventory & Navigation Map

```
Interface B Root Navigation
│
├── [TAB 1] Patient Roster (Home)
│     ├── Patient Card List (sorted by alert priority)
│     └── ──► Patient Detail Screen
│               ├── Live Vitals Panel
│               ├── Vital History Charts (HR / RR)
│               ├── Sleep Reports Panel
│               ├── Alert History Log
│               └── Device Status Card
│
├── [TAB 2] Alerts Center
│     ├── Active Alerts List
│     ├── Alert Detail Screen
│     │     ├── Fall Event Timeline
│     │     └── ──► Voice Intercom Screen (LiveKit)
│     └── Historical Alert Log (filterable)
│
├── [TAB 3] Reports (Web Dashboard Primary)
│     ├── Patient Comparative Vitals
│     ├── Sleep Analytics Aggregate
│     └── Export Center (CSV / PDF)
│
└── [TAB 4] Settings
      ├── My Profile
      ├── Linked Patients
      ├── Notification Preferences
      └── Device Management
```

---

## 4. Screen Specifications

### 4.1 Patient Roster Screen

**Layout:** Card list, vertically scrollable. Sticky alert banner at top if any active alerts exist.

**Patient Card Components:**
```
┌──────────────────────────────────────────────────────┐
│ 🔴 FALL ALERT — 00:47 ago          [Open Intercom ▶] │  ← alert state variant
├──────────────────────────────────────────────────────┤
│  [Avatar]  Ahmed Hassan, 78          Room 4B          │
│            HR: 82 BPM  •  RR: 16 BRPM                │
│            Sleep last night: Restless  •  System: ✓  │
└──────────────────────────────────────────────────────┘
```

**Card States:** `ok (green chip)` / `alert_active (red, pulsing)` / `anomaly_warning (amber)` / `system_offline (grey)`

**Data Sources:**
- Live HR/RR: WebSocket event `vitals.update` scoped to patient room
- Alert state: WebSocket event `alert.state_changed`
- Sleep last night: REST `GET /patients/:id/sleep/last-night`

---

### 4.2 Patient Detail Screen

**Sections (scrollable):**

**Section 1 — Live Vitals Panel**
- Large HR and RR cards (real-time, WebSocket-driven)
- Mini waveform sparkline (last 60 seconds)
- Signal quality indicator

**Section 2 — Vital History Charts**
- Tab switcher: HR / RR / Combined
- Time range selector: 6H / 24H / 7D / 30D
- Line chart with anomaly highlight bands (amber = warning threshold, red = critical)
- Data source: `GET /patients/:id/vitals/history?range=24h&resolution=5m`

**Section 3 — Sleep Reports**
- Date picker defaulting to last night
- Hypnogram bar chart (time axis × stage axis)
- Summary stats: Total Sleep, Deep%, REM%, Fragmentation Index
- Data source: `GET /patients/:id/sleep/report?date=YYYY-MM-DD`

**Section 4 — Alert History**
- Chronological list: type, timestamp, duration, resolution (user cancelled / timeout / caregiver resolved)
- Tap to expand full event timeline

**Section 5 — Device Status**
- Sensor model, firmware version, room label
- Signal strength (dBm), last heartbeat timestamp
- Occlusion status flag

---

### 4.3 Alert Detail & Intercom Screen

**Trigger:** Push notification deep-link OR tap on active alert card.

**Layout:**
```
┌────────────────────────────────────┐
│  ⚠️  FALL DETECTED                 │
│  Ahmed Hassan — Room 4B            │
│  12:34:07 PM · 2 min 14 sec ago    │
│                                    │
│  [Timeline]                        │
│  12:34:07  Fall vector detected    │
│  12:34:17  Grace period expired    │
│  12:34:18  Alert dispatched        │
│  12:34:19  ← You acknowledged      │
│                                    │
│  ┌──────────────────────────────┐  │
│  │   🎙 Open Live Audio Channel  │  │  ← Primary CTA
│  └──────────────────────────────┘  │
│                                    │
│  [Mark as Resolved] [False Alarm]  │
└────────────────────────────────────┘
```

**Voice Intercom Flow:**
1. Caregiver taps "Open Live Audio Channel"
2. NestJS issues LiveKit room token for `patient-{uuid}` room
3. Flutter `livekit_client` SDK connects to LiveKit SFU
4. Interface A auto-answers (background LiveKit participant on mmWave device gateway)
5. Full-duplex G.711/Opus audio active
6. UI shows: waveform visualizer, mute toggle, elapsed call duration, end call button

---

### 4.4 Web Dashboard (Next.js 14) — Caregiver Extended View

The web dashboard is the **primary surface for clinical staff** on desktop. It extends Interface B with analytics-heavy features impractical on mobile.

**Dashboard Layout (Grid):**

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: Anees Caregiver Portal  │  [Search Patient]  [⚠️ 3]   │
├────────────────┬────────────────────────────────────────────────┤
│ SIDEBAR        │  MAIN CONTENT AREA                             │
│                │                                                │
│ • Roster       │  [Active Alerts Banner — if any]               │
│ • Alerts       │                                                │
│ • Analytics    │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│ • Reports      │  │ Patients │  │ Alerts   │  │ Offline  │     │
│ • Devices      │  │   24     │  │  Active 2│  │ Devices 1│     │
│ • Settings     │  └──────────┘  └──────────┘  └──────────┘     │
│                │                                                │
│                │  [Patient Roster Table — sortable/filterable]  │
│                │  Name | Room | HR | RR | Sleep | Alert | Action│
└────────────────┴────────────────────────────────────────────────┘
```

**Analytics Pages (Web-Only):**
- **Population Overview:** aggregate HR/RR distributions across all patients
- **Alert Frequency Heatmap:** by hour of day × day of week (identifies high-risk periods)
- **Sleep Quality Trends:** facility-wide sleep score averages over 30/90 days
- **Device Health Overview:** fleet status table with uptime %, last calibration date
- **Export Center:** generate PDF clinical reports per patient for handoff to physicians

---

## 5. API Endpoint Reference (Interface B Consumers)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/patients` | Caregiver's linked patient roster with live status snapshot |
| GET | `/patients/:id` | Single patient full profile |
| GET | `/patients/:id/vitals/live` | Latest vital reading |
| GET | `/patients/:id/vitals/history` | Time-ranged vital history (query: range, resolution) |
| GET | `/patients/:id/sleep/report` | Sleep stage report for a given date |
| GET | `/patients/:id/alerts` | Alert history (paginated) |
| GET | `/patients/:id/device` | Device registration + health status |
| POST | `/alerts/:id/acknowledge` | Mark alert as acknowledged |
| POST | `/alerts/:id/resolve` | Mark alert as resolved |
| POST | `/alerts/:id/false-alarm` | Flag as false alarm + optional note |
| POST | `/intercom/token` | Request LiveKit room token for patient room |
| GET | `/reports/vitals/export` | Export vitals CSV (query: patient_id, start, end) |
| GET | `/devices` | Fleet device health list |
| PATCH | `/devices/:id` | Update room label, notes |

**WebSocket Events (Socket.IO — Interface B namespace: `/caregiver`):**

> Socket.IO is used over raw WebSockets for: automatic reconnection with exponential backoff, patient UUID–scoped rooms, and event acknowledgement receipts ensuring alert delivery confirmation.

| Event | Direction | Payload | ACK Required |
|---|---|---|---|
| `vitals.update` | Server → Client | `{ patientId, hr, rr, timestamp, quality }` | No |
| `fall.detected` | Server → Client | `{ patientId, alertId, room, detectedAt }` | **Yes** — triggers BullMQ grace timer cancellation window |
| `alert.state_changed` | Server → Client | `{ alertId, patientId, state, updatedAt }` | No |
| `system.device_offline` | Server → Client | `{ deviceId, patientId, lastSeen }` | No |
| `intercom.incoming` | Server → Client | `{ roomToken, patientId }` | No |
| `alert.cancel` | Client → Server | `{ alertId }` | **Yes** — server ACK confirms BullMQ job removed |

---

## 6. Non-Functional Requirements

| NFR | Target |
|---|---|
| Fall alert delivery latency | < 12 seconds end-to-end (sensor → caregiver push) |
| Vital chart load time | < 1.5 seconds (24h range at 5-min resolution) |
| WebSocket reconnect | < 2 seconds with exponential backoff |
| LiveKit intercom connect time | < 3 seconds from button press |
| Push notification delivery (critical) | > 99% within 15 seconds |
| Dashboard uptime | 99.9% monthly SLA |
| Concurrent patients per caregiver | 50 (hard cap; 20 visible per screen page) |
| API rate limit | 300 req/min per authenticated caregiver token |

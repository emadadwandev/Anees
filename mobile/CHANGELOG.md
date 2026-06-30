# Changelog — Anees Mobile (Flutter)

IEC 62304 §5.1.1 — Software Development Plan change record.

---

## [Unreleased]

### Added
- P5-005: `patient_home_screen.dart` — listens to `fall.detected` WebSocket event; auto-navigates to `IntercomScreen` if `livekitToken` is present in payload; falls back to `FallGraceScreen` if no token
- P6-004: `patient_detail_screen.dart` — full sleep analytics panel: epoch hypnogram, 30-day stacked bar trend, fragmentation index tile with improving/worsening trend arrow
- P6-004: Alert history panel in `patient_detail_screen.dart` — fetches and renders last 10 alerts per patient

---

## [0.4.0] — 2026-06-24

### Added
- P5-003: `IntercomScreen` — LiveKit full-duplex audio channel with waveform visualizer, mute toggle, elapsed timer, end call → POST /intercom/sessions
- P4-004: `FallGraceScreen` — fullscreen 10 s countdown, TTS voice prompt, 80 pt "I'm OK" cancel button
- P4-005: `AlertsScreen` + `AlertDetailScreen` — active/history tabs, alarm tone, deep-link from push notification

---

## [0.3.0] — 2026-06-10

### Added
- P3-002: `VitalsSocketService` — Socket.IO client with exponential backoff reconnect, typed streams per patient
- P3-003: `PatientHomeScreen` (Interface A) — live HR/RR large cards, signal quality, sleep stage card, system status strip, offline banner with last-seen label
- P3-004 / P3-005: `PatientDetailScreen` + `RosterScreen` (Interface B) — live vitals with history chart, roster with real-time card animations

---

## [0.2.0] — 2026-05-28

### Added
- P1-004: Login, PIN login, register screens; `flutter_secure_storage` JWT persistence; role-based routing (care_receiver → Interface A, caregiver → Interface B)
- P0-002 (mobile): `LocalDb` (Drift) — `CachedVitals` table for offline last-known vital display

---

## [0.1.0] — 2026-05-14

### Added
- Flutter project scaffold; `go_router` routing; Riverpod state management; `app_theme.dart` design system
- `ApiClient` (Dio) with JWT auth interceptor and refresh token rotation

# Changelog — Anees Web Dashboard (Next.js)

IEC 62304 §5.1.1 — Software Development Plan change record.

---

## [Unreleased]

### Added
- Admin dashboard: `/admin/*` route group with dark-theme `AdminShell` (dual Socket.IO connections to `/caregiver` + `/vitals` namespaces)
- Admin dashboard: `KpiBar` — real-time facility stats (online/offline/alerts/warnings/signal quality) driven by `useAdminStore`
- Admin dashboard: `PatientRosterTable` — live-updating roster with filter tabs, sparklines, signal bars, status badges, and slide-over detail trigger
- Admin dashboard: `PatientDetailPanel` — slide-over panel with live vitals, device info, and per-patient alert history
- Admin dashboard: `AlertsGrid` — active incident cards with animated critical border, acknowledge/resolve/false-alarm actions wired to API
- Admin dashboard: `AlertHistoryTable` — paginated history table with response-time colouring
- Admin dashboard: `AnalyticsPanel` — 7-day alert frequency bar chart, type breakdown, avg response time
- `AdminService` backend: `GET /v1/admin/stats`, `GET /v1/admin/patients`, `GET /v1/admin/alerts/active`, `GET /v1/admin/alerts/history`, `GET /v1/admin/analytics`
- `useAdminStore` Zustand store: facility-wide real-time state (patients, live vitals map, active alerts, stats)
- `FacilityStats`, `AdminPatient`, `AdminAlertEvent`, `FacilityAnalytics` types added to `lib/types.ts`

### Changed
- `CaregiverGateway`: `admin` role now joins all patient rooms + `admin` room on connect (was only linked patients)
- `VitalsGateway`: same admin-join behaviour for live vitals broadcast

- P7-006: `ClinicalReportPdf` component (react-pdf) — client-side A4 PDF with patient info, sleep summary stage-proportion bar, and paginated alert history
- P7-006: Reports page fetches patient detail + sleep report + alerts in parallel before PDF generation; date range filters applied to alert list
- P8-003: `/devices` page — fleet table with online/offline filter, inline room label editor (optimistic update), signal quality bar, occlusion badge, last-heartbeat relative timestamp

---

## [0.3.0] — 2026-06-24

### Added
- P7-004: Patient detail page — VitalsChart (Recharts), SleepHypnogram (stage % bar + stats grid), device field grid
- P7-005: Analytics page — HR/RR scatter, alert frequency SVG heatmap (hour × day), 30-day sleep quality multi-line chart
- P7-007: `IntercomModal` component — `@livekit/components-react` `LiveKitRoom` with `AudioConference`, mute toggle, elapsed timer, end call

---

## [0.2.0] — 2026-06-10

### Added
- P7-001: Next.js 14 App Router scaffold; NextAuth v5 JWT strategy; Axios instance with auth interceptor + refresh rotation; Socket.IO client
- P7-002: Dashboard layout — collapsible sidebar (Roster/Alerts/Analytics/Reports/Devices/Settings), TopBar, global alert toast via Sonner, unread badge
- P7-003: `PatientRosterTable` — TanStack Table v8, sortable, live HR/RR cell updates via WebSocket without full re-render

---

## [0.1.0] — 2026-05-28

### Added
- Next.js project scaffold; Tailwind CSS; shadcn/ui; design system tokens (`tailwind.config.ts`)
- `AlertCard`, Socket.IO store (Zustand), auth helpers

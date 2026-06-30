# Changelog — Anees DSP Service (FastAPI)

IEC 62304 §5.1.1 — Software Development Plan change record.

---

## [Unreleased]

---

## [0.3.0] — 2026-06-24

### Added
- P6-001: `SleepClassifier` — 30-second epoch classifier (HR variability + RR + motion amplitude → deep/light/rem/awake)
- P8-002: `OcclusionDetector` — sustained signal quality < 0.3 over 60 s window classified as partial or full occlusion; publishes to `system:{device_id}` Redis channel

---

## [0.2.0] — 2026-06-10

### Added
- P4-001: `FallDetector` — macro-Doppler vertical velocity classifier (threshold −2.5 m/s², debounce 100 ms); publishes `fall_candidate` to `alerts:{device_id}`
- P2-003: `VitalExtractionPipeline` — micro-Doppler phase extraction (77 GHz, λ = 3.9 mm), band-pass filter (HR: 0.8–2.5 Hz, RR: 0.1–0.5 Hz), peak detection; publishes to `vitals:{device_id}`

### Changed
- Pydantic v2 strict mode (`extra='forbid'`) on all request schemas
- Prometheus counter `dsp_validation_errors_total` on Pydantic validation failure

---

## [0.1.0] — 2026-05-14

### Added
- P0-004: FastAPI scaffold with `structlog` JSON logging, OpenTelemetry (Jaeger exporter), Prometheus instrumentator
- `GET /health` and `GET /metrics` endpoints
- Redis pub/sub publisher (`redis_client.py`)
- Multi-stage Dockerfile (`python:3.11-slim`)

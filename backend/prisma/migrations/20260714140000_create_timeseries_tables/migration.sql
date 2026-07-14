-- Apply the raw time-series tables that were previously kept as an untracked SQL file.
CREATE TABLE IF NOT EXISTS "vital_readings" (
  "time" TIMESTAMPTZ NOT NULL,
  "device_id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "heart_rate_bpm" SMALLINT,
  "resp_rate_brpm" SMALLINT,
  "signal_quality" REAL
);

CREATE TABLE IF NOT EXISTS "sleep_epochs" (
  "time" TIMESTAMPTZ NOT NULL,
  "device_id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "stage" TEXT NOT NULL,
  "duration_sec" SMALLINT
);

CREATE TABLE IF NOT EXISTS "motion_events" (
  "time" TIMESTAMPTZ NOT NULL,
  "device_id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "event_type" TEXT,
  "doppler_magnitude" REAL,
  "coordinates" JSONB
);

SELECT create_hypertable('vital_readings', 'time', if_not_exists => TRUE);
SELECT create_hypertable('sleep_epochs', 'time', if_not_exists => TRUE);
SELECT create_hypertable('motion_events', 'time', if_not_exists => TRUE);

ALTER TABLE vital_readings SET (
  timescaledb.compress,
  timescaledb.compress_orderby = 'time DESC',
  timescaledb.compress_segmentby = 'device_id'
);
SELECT add_compression_policy('vital_readings', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_retention_policy('vital_readings', INTERVAL '2 years', if_not_exists => TRUE);
SELECT add_retention_policy('sleep_epochs', INTERVAL '2 years', if_not_exists => TRUE);
SELECT add_retention_policy('motion_events', INTERVAL '2 years', if_not_exists => TRUE);

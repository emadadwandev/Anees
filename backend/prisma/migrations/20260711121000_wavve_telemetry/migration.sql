CREATE TABLE "wavve_vital_details" (
  "time" TIMESTAMPTZ NOT NULL,
  "device_id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "breath_curve" JSONB,
  "heart_curve" JSONB,
  "target_distance_m" REAL,
  "bed_signal_strength" REAL,
  "valid_bit" BOOLEAN,
  "body_move_energy" REAL,
  "body_move_range" REAL
);

SELECT create_hypertable('wavve_vital_details', 'time', if_not_exists => TRUE);
SELECT add_retention_policy('wavve_vital_details', INTERVAL '2 years', if_not_exists => TRUE);

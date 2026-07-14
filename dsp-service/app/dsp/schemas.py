from uuid import UUID
from pydantic import BaseModel, ConfigDict


class PointCloudEntry(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    x: float
    y: float
    z: float
    v: float    # radial velocity m/s
    snr: float  # 0.0–1.0


class MmWavePayload(BaseModel):
    # HTTP JSON transports UUIDs as strings; keep strict point-cloud values but
    # allow Pydantic to parse the UUID fields from their wire representation.
    model_config = ConfigDict(extra="forbid")

    device_id: UUID
    patient_id: UUID
    timestamp: int          # Unix ms
    frame_seq: int
    point_cloud: list[PointCloudEntry]
    firmware_version: str


class VitalResult(BaseModel):
    device_id: UUID
    patient_id: UUID
    timestamp: int
    heart_rate_bpm: int
    resp_rate_brpm: int
    signal_quality: float    # 0.0–1.0
    motion_magnitude: float  # RMS radial velocity; near 0 = still, >0.5 = active


class FallCandidate(BaseModel):
    device_id: UUID
    patient_id: UUID
    timestamp: int
    confidence: float

from dataclasses import dataclass, field
from app.sleep.classifier import SleepStage, classify_epoch

FRAMES_PER_EPOCH = 600  # 30 s × 20 fps


@dataclass
class _EpochAccumulator:
    hr_sum: float = 0.0
    rr_sum: float = 0.0
    motion_sum: float = 0.0
    quality_sum: float = 0.0
    count: int = 0

    def push(self, hr: int, rr: int, motion: float, quality: float) -> None:
        self.hr_sum += hr
        self.rr_sum += rr
        self.motion_sum += motion
        self.quality_sum += quality
        self.count += 1

    def flush(self) -> SleepStage:
        avg_hr = int(self.hr_sum / self.count)
        avg_rr = int(self.rr_sum / self.count)
        avg_motion = self.motion_sum / self.count
        avg_quality = self.quality_sum / self.count
        stage = classify_epoch(avg_hr, avg_rr, avg_motion, avg_quality)
        self._reset()
        return stage

    def _reset(self) -> None:
        self.hr_sum = 0.0
        self.rr_sum = 0.0
        self.motion_sum = 0.0
        self.quality_sum = 0.0
        self.count = 0

    @property
    def is_full(self) -> bool:
        return self.count >= FRAMES_PER_EPOCH


_buffers: dict[str, _EpochAccumulator] = {}


def get_epoch_buffer(device_id: str) -> _EpochAccumulator:
    if device_id not in _buffers:
        _buffers[device_id] = _EpochAccumulator()
    return _buffers[device_id]

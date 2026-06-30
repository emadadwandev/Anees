from collections import deque
from dataclasses import dataclass, field

import numpy as np

FALL_VELOCITY_THRESHOLD = -2.5  # m/s vertical (downward)
DEBOUNCE_FRAMES = 2             # ~100 ms at 20 fps
Z_FLOOR_THRESHOLD = 0.3         # metres — points below this indicate floor-level


@dataclass
class FallDetector:
    history: deque = field(default_factory=lambda: deque(maxlen=10))

    def update(self, point_cloud: list[dict]) -> tuple[bool, float]:
        """Return (is_sustained_fall_candidate, confidence)."""
        if not point_cloud:
            self.history.append(False)
            return False, 0.0

        velocities = np.array([p["v"] for p in point_cloud])
        z_coords = np.array([p["z"] for p in point_cloud])

        mean_velocity = float(np.mean(velocities))
        has_fall_velocity = mean_velocity < FALL_VELOCITY_THRESHOLD

        floor_points = int(np.sum(z_coords < Z_FLOOR_THRESHOLD))
        has_floor_profile = floor_points > len(point_cloud) * 0.3

        is_candidate = has_fall_velocity and has_floor_profile
        self.history.append(is_candidate)

        recent = list(self.history)[-DEBOUNCE_FRAMES:]
        sustained = len(recent) >= DEBOUNCE_FRAMES and all(recent)

        confidence = min(1.0, abs(mean_velocity) / abs(FALL_VELOCITY_THRESHOLD)) if is_candidate else 0.0
        return sustained, confidence


_detectors: dict[str, FallDetector] = {}


def get_detector(device_id: str) -> FallDetector:
    if device_id not in _detectors:
        _detectors[device_id] = FallDetector()
    return _detectors[device_id]

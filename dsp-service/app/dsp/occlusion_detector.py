"""
P8-002: Occlusion detection — sustained signal_quality < 0.3 over 60s triggers OcclusionStatus update.

Published to Redis channel `alerts:{device_id}` with type "occlusion" so NestJS
alert-orchestration service can update Device.occlusionStatus via Prisma.
"""
from __future__ import annotations

import asyncio
import time
from collections import deque
from typing import Deque, Dict


# Sliding window: each entry is (timestamp_s, signal_quality)
_buffers: Dict[str, Deque[tuple[float, float]]] = {}
_occlusion_state: Dict[str, bool] = {}

OCCLUSION_THRESHOLD = 0.3
SUSTAINED_SECONDS = 60.0
CLEAR_THRESHOLD = 0.5  # must rise above this to clear occlusion


def get_occlusion_buffer(device_id: str) -> Deque[tuple[float, float]]:
    if device_id not in _buffers:
        _buffers[device_id] = deque()
    return _buffers[device_id]


async def check_occlusion(
    redis,
    device_id: str,
    patient_id: str,
    signal_quality: float,
) -> bool:
    """
    Returns True if occlusion just transitioned (onset or clearance),
    and publishes the appropriate alert to Redis.
    """
    now = time.time()
    buf = get_occlusion_buffer(device_id)
    buf.append((now, signal_quality))

    # Trim entries older than SUSTAINED_SECONDS
    cutoff = now - SUSTAINED_SECONDS
    while buf and buf[0][0] < cutoff:
        buf.popleft()

    currently_occluded = _occlusion_state.get(device_id, False)

    if not buf:
        return False

    # All readings in window below threshold → occlusion onset
    all_low = all(q < OCCLUSION_THRESHOLD for _, q in buf)
    window_full = (now - buf[0][0]) >= SUSTAINED_SECONDS

    if window_full and all_low and not currently_occluded:
        _occlusion_state[device_id] = True
        await redis.publish(
            f"alerts:{device_id}",
            __import__("json").dumps({
                "type": "occlusion",
                "device_id": device_id,
                "patient_id": patient_id,
                "status": "partial",
                "signal_quality": signal_quality,
                "sustained_seconds": SUSTAINED_SECONDS,
                "timestamp": now,
            }),
        )
        return True

    # Any reading above clear threshold → occlusion resolved
    if currently_occluded and signal_quality >= CLEAR_THRESHOLD:
        _occlusion_state[device_id] = False
        await redis.publish(
            f"alerts:{device_id}",
            __import__("json").dumps({
                "type": "occlusion_cleared",
                "device_id": device_id,
                "patient_id": patient_id,
                "status": "none",
                "signal_quality": signal_quality,
                "timestamp": now,
            }),
        )
        return True

    return False

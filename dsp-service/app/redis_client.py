import json
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import redis.asyncio as aioredis

from app.config import get_settings


async def get_redis() -> AsyncGenerator[aioredis.Redis, None]:
    settings = get_settings()
    client = aioredis.from_url(settings.redis_url, decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


async def publish_vital(
    redis: aioredis.Redis,
    device_id: str,
    patient_id: str,
    timestamp: int,
    heart_rate_bpm: int,
    resp_rate_brpm: int,
    signal_quality: float,
    motion_magnitude: float,
) -> None:
    settings = get_settings()
    channel = f"{settings.redis_vitals_channel}:{device_id}"
    payload = json.dumps({
        "device_id": device_id,
        "patient_id": patient_id,
        "timestamp": timestamp,
        "heart_rate_bpm": heart_rate_bpm,
        "resp_rate_brpm": resp_rate_brpm,
        "signal_quality": signal_quality,
        "motion_magnitude": motion_magnitude,
    })
    await redis.publish(channel, payload)


async def publish_fall_candidate(
    redis: aioredis.Redis,
    device_id: str,
    patient_id: str,
    timestamp: int,
    confidence: float = 1.0,
) -> None:
    settings = get_settings()
    channel = f"{settings.redis_alerts_channel}:{device_id}"
    payload = json.dumps({
        "event_type": "fall_candidate",
        "device_id": device_id,
        "patient_id": patient_id,
        "timestamp": timestamp,
        "confidence": confidence,
    })
    await redis.publish(channel, payload)


async def publish_sleep_epoch(
    redis: aioredis.Redis,
    device_id: str,
    patient_id: str,
    timestamp: int,
    stage: str,
    duration_sec: int,
) -> None:
    settings = get_settings()
    channel = f"{settings.redis_sleep_channel}:{device_id}"
    payload = json.dumps({
        "device_id": device_id,
        "patient_id": patient_id,
        "timestamp": timestamp,
        "stage": stage,
        "duration_sec": duration_sec,
    })
    await redis.publish(channel, payload)

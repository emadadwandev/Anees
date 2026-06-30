import time

from fastapi import APIRouter, Depends, HTTPException
from prometheus_client import Counter, Histogram

from app.dsp.fall_detector import get_detector
from app.dsp.occlusion_detector import check_occlusion
from app.dsp.pipeline import process_frame
from app.dsp.schemas import MmWavePayload, VitalResult
from app.dsp.sleep_epoch_buffer import get_epoch_buffer, FRAMES_PER_EPOCH
from app.logging_config import get_logger
from app.redis_client import get_redis, publish_fall_candidate, publish_vital, publish_sleep_epoch

router = APIRouter(prefix="/dsp", tags=["dsp"])
logger = get_logger("dsp.router")

DSP_PROCESSING_TIME = Histogram("dsp_processing_seconds", "DSP frame processing time")
DSP_VALIDATION_ERRORS = Counter("dsp_validation_errors_total", "DSP payload validation errors")
DSP_FALL_CANDIDATES = Counter("dsp_fall_candidates_total", "Fall candidates detected")


@router.post("/process", response_model=VitalResult)
async def process_mmwave(payload: MmWavePayload, redis=Depends(get_redis)):
    start = time.perf_counter()
    device_id = str(payload.device_id)
    patient_id = str(payload.patient_id)

    try:
        pc = [p.model_dump() for p in payload.point_cloud]

        vitals = process_frame({"point_cloud": pc})

        detector = get_detector(device_id)
        is_fall, confidence = detector.update(pc)
        if is_fall:
            DSP_FALL_CANDIDATES.inc()
            await publish_fall_candidate(redis, device_id, patient_id, payload.timestamp, confidence)
            logger.info("fall_candidate_detected", device_id=device_id, confidence=confidence)

        # P8-002: occlusion check — sustained low signal quality
        await check_occlusion(redis, device_id, patient_id, vitals["signal_quality"])

        await publish_vital(
            redis,
            device_id,
            patient_id,
            payload.timestamp,
            vitals["heart_rate_bpm"],
            vitals["resp_rate_brpm"],
            vitals["signal_quality"],
            vitals["motion_magnitude"],
        )

        # Sleep epoch — accumulate frames; classify and publish every 30 s
        epoch_buf = get_epoch_buffer(device_id)
        epoch_buf.push(
            vitals["heart_rate_bpm"],
            vitals["resp_rate_brpm"],
            vitals["motion_magnitude"],
            vitals["signal_quality"],
        )
        if epoch_buf.is_full:
            stage = epoch_buf.flush()
            await publish_sleep_epoch(
                redis,
                device_id,
                patient_id,
                payload.timestamp,
                stage.value,
                FRAMES_PER_EPOCH // 20,  # duration in seconds
            )
            logger.info("sleep_epoch_classified", device_id=device_id, stage=stage.value)

        DSP_PROCESSING_TIME.observe(time.perf_counter() - start)

        return VitalResult(
            device_id=payload.device_id,
            patient_id=payload.patient_id,
            timestamp=payload.timestamp,
            **vitals,
        )

    except Exception as exc:
        logger.error("dsp_processing_error", error=str(exc), device_id=device_id)
        raise HTTPException(status_code=500, detail="DSP processing failed") from exc

from fastapi import APIRouter

router = APIRouter(prefix="/sleep", tags=["sleep"])
# Sleep classification is driven internally by the DSP pipeline via Redis pub/sub.
# This router is reserved for future direct sleep query endpoints.

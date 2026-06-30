from contextlib import asynccontextmanager

# Telemetry must be configured before any instrumented imports
from app.config import get_settings
from app.telemetry import configure_telemetry

_settings = get_settings()
_tracer = configure_telemetry(_settings.service_name, _settings.otel_exporter_otlp_endpoint)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from prometheus_fastapi_instrumentator import Instrumentator

from app.dsp.router import router as dsp_router
from app.health.router import router as health_router
from app.logging_config import configure_logging, get_logger
from app.sleep.router import router as sleep_router

configure_logging(_settings.service_name, _settings.log_level)
logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("dsp_service_started", port=_settings.port, service=_settings.service_name)
    yield
    logger.info("dsp_service_stopped")


app = FastAPI(
    title="Anees DSP Service",
    version="0.1.0",
    description="mmWave signal processing — vital extraction, fall detection, sleep classification",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(dsp_router)
app.include_router(sleep_router)

# Prometheus /metrics endpoint
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# OpenTelemetry auto-instrumentation
FastAPIInstrumentor.instrument_app(app, tracer_provider=_tracer)

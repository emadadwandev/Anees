from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    redis_url: str = "redis://localhost:6379"
    redis_vitals_channel: str = "vitals"
    redis_alerts_channel: str = "alerts"
    redis_sleep_channel: str = "sleep"
    otel_exporter_otlp_endpoint: str = "http://localhost:4317"
    service_name: str = "anees-dsp"
    log_level: str = "INFO"
    port: int = 8001


@lru_cache
def get_settings() -> Settings:
    return Settings()

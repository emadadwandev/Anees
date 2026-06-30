import logging
import os
import structlog
from structlog.typing import FilteringBoundLogger as BoundLogger


def configure_logging(service_name: str, log_level: str = "INFO") -> None:
    log_level_int = getattr(logging, log_level.upper(), logging.INFO)
    logging.basicConfig(level=log_level_int, format="%(message)s")

    is_production = os.getenv("LOG_LEVEL", "INFO").upper() != "DEBUG"

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
    ]

    if is_production:
        processors = shared_processors + [structlog.processors.JSONRenderer()]
    else:
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(colors=True)
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(log_level_int),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(service=service_name)


def get_logger(name: str) -> BoundLogger:
    return structlog.get_logger(name)

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter


def configure_telemetry(service_name: str, otlp_endpoint: str) -> TracerProvider:
    resource = Resource.create({"service.name": service_name})
    # Use HTTP endpoint (port 4318) — avoids grpcio native build on ARM64
    http_endpoint = otlp_endpoint.replace(":4317", ":4318") + "/v1/traces"
    exporter = OTLPSpanExporter(endpoint=http_endpoint)
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return provider

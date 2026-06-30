import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly alertDispatchLatency = new Histogram({
    name: 'anees_alert_dispatch_latency_seconds',
    help: 'Time from fall detection to first push dispatch',
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly activeWsConnections = new Gauge({
    name: 'anees_active_ws_connections',
    help: 'Currently connected WebSocket clients',
    labelNames: ['namespace'],
    registers: [this.registry],
  });

  readonly pushSentTotal = new Counter({
    name: 'anees_push_sent_total',
    help: 'Total push notifications dispatched',
    labelNames: ['platform', 'type'],
    registers: [this.registry],
  });

  readonly mqttMessagesReceived = new Counter({
    name: 'anees_mqtt_messages_received_total',
    help: 'Total MQTT messages received from devices',
    registers: [this.registry],
  });

  readonly mqttForwardFailures = new Counter({
    name: 'anees_mqtt_forward_failures_total',
    help: 'Total DSP forward failures routed to DLQ',
    registers: [this.registry],
  });

  readonly dspProcessDuration = new Histogram({
    name: 'anees_dsp_process_duration_seconds',
    help: 'HTTP round-trip time to DSP service',
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2],
    registers: [this.registry],
  });

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }
}

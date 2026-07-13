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

  readonly tcpConnectionsActive = new Gauge({
    name: 'anees_tcp_connections_active',
    help: 'Currently connected AeroSense TCP sensors',
    labelNames: ['protocol'],
    registers: [this.registry],
  });

  readonly tcpFramesReceived = new Counter({
    name: 'anees_tcp_frames_received_total',
    help: 'AeroSense TCP frames received by protocol and function code',
    labelNames: ['protocol', 'function_code'],
    registers: [this.registry],
  });

  readonly tcpFramesRejected = new Counter({
    name: 'anees_tcp_frames_rejected_total',
    help: 'Rejected AeroSense TCP frames by protocol and bounded reason',
    labelNames: ['protocol', 'reason'],
    registers: [this.registry],
  });

  readonly tcpHandlerDuration = new Histogram({
    name: 'anees_tcp_handler_duration_seconds',
    help: 'AeroSense TCP frame handler duration',
    labelNames: ['protocol', 'function_code'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    registers: [this.registry],
  });

  readonly tcpCommandDuration = new Histogram({
    name: 'anees_tcp_command_duration_seconds',
    help: 'AeroSense TCP command round-trip duration by protocol, function code, and result',
    labelNames: ['protocol', 'function_code', 'result'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
    registers: [this.registry],
  });

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }
}

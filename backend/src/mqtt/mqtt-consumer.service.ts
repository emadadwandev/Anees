import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as mqtt from 'mqtt';
import axios from 'axios';
import { MmWaveRawPayloadSchema } from './schemas/mmwave-payload.schema';
import { DevicesService } from '../devices/devices.service';
import { MetricsService } from '../metrics/metrics.service';
import { Config } from '../config/config.schema';

@Injectable()
export class MqttConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttConsumerService.name);
  private client: mqtt.MqttClient;

  constructor(
    private readonly config: ConfigService<Config>,
    private readonly devicesService: DevicesService,
    private readonly metrics: MetricsService,
    @InjectQueue('dlq') private readonly dlqQueue: Queue,
  ) {}

  onModuleInit() {
    const brokerUrl = this.config.get('MQTT_BROKER_URL');
    this.client = mqtt.connect(brokerUrl, {
      username: this.config.get('MQTT_USERNAME'),
      password: this.config.get('MQTT_PASSWORD'),
      reconnectPeriod: 3000,
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker: ${brokerUrl}`);
      this.client.subscribe('anees/devices/+/raw', { qos: 1 });
    });

    this.client.on('message', async (topic, payload) => {
      await this.handleMessage(topic, payload.toString());
    });

    this.client.on('error', (err) => {
      this.logger.error('MQTT client error', err);
    });
  }

  async onModuleDestroy() {
    this.client?.end();
  }

  private async handleMessage(topic: string, raw: string) {
    this.metrics.mqttMessagesReceived.inc();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn(`Non-JSON MQTT payload on topic ${topic}`);
      await this.dlqQueue.add('mqtt-parse-error', { topic, raw, reason: 'non-json' });
      this.metrics.mqttForwardFailures.inc();
      return;
    }

    const result = MmWaveRawPayloadSchema.safeParse(parsed);
    if (!result.success) {
      this.logger.warn({ topic, errors: result.error.flatten() }, 'Zod validation failed — routing to DLQ');
      await this.dlqQueue.add('mqtt-invalid-payload', { topic, raw, errors: result.error.flatten() });
      return;
    }

    const payload = result.data;
    const device = await this.devicesService.resolveDeviceById(payload.device_id);
    if (!device) {
      this.logger.warn(`Unknown device UUID: ${payload.device_id}`);
      return;
    }
    if (!device.userId) {
      this.logger.debug(`Unassigned MQTT device ${payload.device_id} — skipping clinical DSP processing`);
      return;
    }

    const end = this.metrics.dspProcessDuration.startTimer();
    try {
      await axios.post(
        `${this.config.get('DSP_SERVICE_URL')}/dsp/process`,
        { ...payload, patient_id: device.userId },
        { timeout: 5000 },
      );
      end();
    } catch (err: any) {
      end();
      this.metrics.mqttForwardFailures.inc();
      this.logger.error({ err }, `DSP forward failed — routing to DLQ with retry`);
      await this.dlqQueue.add(
        'dsp-forward-retry',
        { payload, patientId: device.userId, failedAt: Date.now() },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
    }
  }
}

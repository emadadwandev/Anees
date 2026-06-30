import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { Config } from '../config/config.schema';

@Injectable()
export class RadarCommandService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RadarCommandService.name);
  private client: mqtt.MqttClient;

  constructor(private readonly config: ConfigService<Config>) {}

  onModuleInit() {
    const brokerUrl = this.config.get('MQTT_BROKER_URL');
    this.client = mqtt.connect(brokerUrl, {
      username: this.config.get('MQTT_USERNAME'),
      password: this.config.get('MQTT_PASSWORD'),
      clientId: `anees-radar-cmd-${Date.now()}`,
      reconnectPeriod: 3000,
    });
    this.client.on('error', (err) => this.logger.error('RadarCommand MQTT error', err));
    this.client.on('connect', () => this.logger.log('RadarCommandService MQTT connected'));
  }

  async onModuleDestroy() {
    this.client?.end();
  }

  private setTopic(serial: string) {
    return `/Radar60FL/${serial}/sys/property/set`;
  }

  private publish(serial: string, payload: object): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.publish(this.setTopic(serial), JSON.stringify(payload), { qos: 1 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async setInstallHeight(serial: string, heightCm: number) {
    await this.publish(serial, { version: '1.0', method: 'set', params: { installHeight: String(heightCm) } });
  }

  async setFallDuration(serial: string, seconds: number) {
    await this.publish(serial, { version: '1.0', method: 'set', params: { fallDuration: String(seconds) } });
  }

  async enableFallDetection(serial: string, enabled: boolean) {
    await this.publish(serial, { version: '1.0', method: 'set', params: { fallSwitch: enabled ? '1' : '0' } });
  }

  async enableDwellAlarm(serial: string, enabled: boolean, durationSeconds?: number) {
    const params: Record<string, string> = { residentWarningDurationSwitch: enabled ? '1' : '0' };
    if (durationSeconds !== undefined) params.residentWarningDuration = String(durationSeconds);
    await this.publish(serial, { version: '1.0', method: 'set', params });
  }

  async restrictReporting(serial: string, restrict: {
    motionStatus?: boolean;
    movementSigns?: boolean;
    heartBeat?: boolean;
  }) {
    const params: Record<string, string> = {};
    if (restrict.motionStatus !== undefined) params.motionStatus = restrict.motionStatus ? '1' : '0';
    if (restrict.movementSigns !== undefined) params.movementSigns = restrict.movementSigns ? '1' : '0';
    if (restrict.heartBeat !== undefined) params.heartBeat = restrict.heartBeat ? '1' : '0';
    await this.publish(serial, { version: '1.0', method: 'limit_set', params });
  }

  async queryProperty(serial: string, property: string) {
    await this.publish(serial, { version: '1.0', method: 'get', params: { [property]: '?' } });
  }

  async applyDefaultConfig(serial: string, deviceType: 'fall_sensor' | 'sleep_sensor') {
    if (deviceType === 'fall_sensor') {
      await this.setInstallHeight(serial, 240);       // Standard KSA villa ceiling height
      await this.setFallDuration(serial, 5);          // 5s — nursing home real-time response
      await this.enableFallDetection(serial, true);
      await this.enableDwellAlarm(serial, true, 300); // 5-min static dwell alarm
      await this.restrictReporting(serial, { movementSigns: true }); // reduce MQTT traffic on cellular SIM
    }
    this.logger.log(`Default config applied to ${deviceType} serial=${serial}`);
  }
}

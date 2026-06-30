import 'dart:async';
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../auth/auth_service.dart';

class VitalReading {
  final String patientId;
  final int hr;
  final int rr;
  final double motionMagnitude;
  final DateTime timestamp;
  final double quality;

  const VitalReading({
    required this.patientId,
    required this.hr,
    required this.rr,
    required this.motionMagnitude,
    required this.timestamp,
    required this.quality,
  });

  factory VitalReading.fromJson(Map<String, dynamic> json) => VitalReading(
        patientId: json['patient_id'] as String,
        hr: json['heart_rate_bpm'] as int,
        rr: json['resp_rate_brpm'] as int,
        motionMagnitude: (json['motion_magnitude'] as num?)?.toDouble() ?? 0.0,
        timestamp: DateTime.fromMillisecondsSinceEpoch(json['timestamp'] as int),
        quality: (json['signal_quality'] as num).toDouble(),
      );
}

class SleepEpochEvent {
  final String patientId;
  final String stage; // 'deep' | 'light' | 'rem' | 'awake'
  final int durationSec;
  final DateTime timestamp;

  const SleepEpochEvent({
    required this.patientId,
    required this.stage,
    required this.durationSec,
    required this.timestamp,
  });

  factory SleepEpochEvent.fromJson(Map<String, dynamic> json) =>
      SleepEpochEvent(
        patientId: json['patient_id'] as String,
        stage: json['stage'] as String,
        durationSec: json['duration_sec'] as int,
        timestamp:
            DateTime.fromMillisecondsSinceEpoch(json['timestamp'] as int),
      );
}

class FallEvent {
  final String patientId;
  final String alertId;
  final String room;
  final DateTime detectedAt;
  final String? livekitToken;
  final String? livekitWsUrl;

  const FallEvent({
    required this.patientId,
    required this.alertId,
    required this.room,
    required this.detectedAt,
    this.livekitToken,
    this.livekitWsUrl,
  });

  factory FallEvent.fromJson(Map<String, dynamic> json) => FallEvent(
        patientId: json['patientId'] as String,
        alertId: json['alertId'] as String,
        room: json['room'] as String,
        detectedAt: DateTime.parse(json['detectedAt'] as String),
        livekitToken: json['livekitToken'] as String?,
        livekitWsUrl: json['livekitWsUrl'] as String?,
      );
}

class AlertStateChange {
  final String alertId;
  final String patientId;
  final String state;
  final DateTime updatedAt;

  const AlertStateChange({
    required this.alertId,
    required this.patientId,
    required this.state,
    required this.updatedAt,
  });

  factory AlertStateChange.fromJson(Map<String, dynamic> json) =>
      AlertStateChange(
        alertId: json['alertId'] as String,
        patientId: json['patientId'] as String,
        state: json['state'] as String,
        updatedAt: DateTime.parse(json['updatedAt'] as String),
      );
}

class DeviceOfflineEvent {
  final String deviceId;
  final String patientId;
  final DateTime lastSeen;

  const DeviceOfflineEvent({
    required this.deviceId,
    required this.patientId,
    required this.lastSeen,
  });

  factory DeviceOfflineEvent.fromJson(Map<String, dynamic> json) =>
      DeviceOfflineEvent(
        deviceId: json['deviceId'] as String,
        patientId: json['patientId'] as String,
        lastSeen: DateTime.parse(json['lastSeen'] as String),
      );
}

class VitalsSocketService {
  static const _baseUrl = String.fromEnvironment(
    'SOCKET_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  io.Socket? _socket;
  String? _authToken;

  final _vitalsController =
      StreamController<VitalReading>.broadcast();
  final _fallController = StreamController<FallEvent>.broadcast();
  final _alertStateController =
      StreamController<AlertStateChange>.broadcast();
  final _deviceOfflineController =
      StreamController<DeviceOfflineEvent>.broadcast();
  final _sleepEpochController =
      StreamController<SleepEpochEvent>.broadcast();

  Stream<VitalReading> vitalsStream(String patientId) =>
      _vitalsController.stream.where((v) => v.patientId == patientId);

  Stream<SleepEpochEvent> sleepEpochStream(String patientId) =>
      _sleepEpochController.stream.where((e) => e.patientId == patientId);

  Stream<FallEvent> get fallStream => _fallController.stream;
  Stream<AlertStateChange> get alertStream => _alertStateController.stream;
  Stream<DeviceOfflineEvent> get deviceOfflineStream =>
      _deviceOfflineController.stream;

  void connect(String token) {
    _authToken = token;
    _connectWithBackoff(0);
  }

  void _connectWithBackoff(int attempt) {
    final delay = attempt == 0
        ? Duration.zero
        : Duration(seconds: min(30, pow(2, attempt).toInt()));

    Future.delayed(delay, () {
      _socket = io.io(
        '$_baseUrl/vitals',
        io.OptionBuilder()
            .setTransports(['websocket'])
            .setAuth({'token': _authToken})
            .disableAutoConnect()
            .build(),
      );

      _socket!
        ..onConnect((_) {})
        ..on('vitals.update', (data) {
          if (data is Map<String, dynamic>) {
            _vitalsController.add(VitalReading.fromJson(data));
          }
        })
        ..on('fall.detected', (data) {
          if (data is Map<String, dynamic>) {
            _fallController.add(FallEvent.fromJson(data));
          }
        })
        ..on('alert.state_changed', (data) {
          if (data is Map<String, dynamic>) {
            _alertStateController.add(AlertStateChange.fromJson(data));
          }
        })
        ..on('system.device_offline', (data) {
          if (data is Map<String, dynamic>) {
            _deviceOfflineController
                .add(DeviceOfflineEvent.fromJson(data));
          }
        })
        ..on('sleep.epoch', (data) {
          if (data is Map<String, dynamic>) {
            _sleepEpochController.add(SleepEpochEvent.fromJson(data));
          }
        })
        ..onDisconnect((_) => _connectWithBackoff(attempt + 1))
        ..onConnectError((_) => _connectWithBackoff(attempt + 1))
        ..connect();
    });
  }

  void emitAlertCancel(String alertId, {Function? onAck}) {
    _socket?.emitWithAck(
      'alert.cancel',
      {'alertId': alertId},
      ack: onAck,
    );
  }

  void dispose() {
    _socket?.dispose();
    _vitalsController.close();
    _fallController.close();
    _alertStateController.close();
    _deviceOfflineController.close();
    _sleepEpochController.close();
  }
}

final vitalsSocketServiceProvider =
    Provider<VitalsSocketService>((ref) {
  final service = VitalsSocketService();
  ref.onDispose(service.dispose);

  ref.listen(authStateProvider, (_, next) {
    next.whenData((authState) async {
      if (authState.isAuthenticated) {
        final token = await ref
            .read(authStateProvider.notifier)
            .getAccessToken();
        if (token != null) service.connect(token);
      }
    });
  });

  return service;
});

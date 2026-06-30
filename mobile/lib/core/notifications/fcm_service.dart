import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../network/api_client.dart';

class FcmService {
  final ApiClient _client;
  final GoRouter _router;

  FcmService(this._client, this._router);

  Future<void> init() async {
    // Firebase may not be available (simulator / missing google-services.json).
    if (Firebase.apps.isEmpty) return;

    // 1. Request permission (required on iOS; harmless no-op on Android <13)
    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      criticalAlert: true, // APNs critical alerts bypass silent mode
    );
    if (settings.authorizationStatus == AuthorizationStatus.denied) return;

    // 2. Register FCM token with backend so NestJS can push to this device
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null) await _registerToken(token);

    // Refresh token if FCM rotates it
    FirebaseMessaging.instance.onTokenRefresh.listen(_registerToken);

    // 3. Cold-start: app was killed, user tapped notification
    final initial = await FirebaseMessaging.instance.getInitialMessage();
    if (initial != null) _handleDeepLink(initial);

    // 4. Background → foreground: user tapped notification while app backgrounded
    FirebaseMessaging.onMessageOpenedApp.listen(_handleDeepLink);

    // 5. Foreground messages (app is open): show in-app alert, do not show system banner
    FirebaseMessaging.onMessage.listen(_handleForeground);
  }

  Future<void> _registerToken(String token) async {
    try {
      await _client.post('/devices/fcm-token', {'fcmToken': token});
    } catch (_) {
      // Non-fatal — push will still work until next successful registration
    }
  }

  void _handleDeepLink(RemoteMessage message) {
    final alertId = message.data['alertId'] as String?;
    if (alertId != null) {
      _router.push('/caregiver/alert/$alertId');
    }
  }

  void _handleForeground(RemoteMessage message) {
    // Foreground fall alert — router is live, navigate directly without a banner
    final alertId = message.data['alertId'] as String?;
    final type = message.data['type'] as String?;
    if (type == 'fall.detected' && alertId != null) {
      _router.push('/caregiver/alert/$alertId');
    }
  }
}

final fcmServiceProvider = Provider<FcmService>((ref) {
  throw UnimplementedError('FcmService must be overridden after router is available');
});

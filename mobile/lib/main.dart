import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';

// Must be a top-level function — Firebase background isolate cannot access closures.
// Called when a fall.detected push arrives while the app is terminated or backgrounded.
@pragma('vm:entry-point')
Future<void> _onBackgroundMessage(RemoteMessage message) async {
  // Firebase must be re-initialised inside the background isolate.
  await Firebase.initializeApp();
  // No UI work here — the message will surface via getInitialMessage()
  // or onMessageOpenedApp when the user brings the app to the foreground.
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Lock to portrait — clinical monitoring UI is portrait-optimised.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Transparent status bar so the app can draw edge-to-edge.
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarBrightness: Brightness.light,
    statusBarIconBrightness: Brightness.dark,
  ));

  try {
    await Firebase.initializeApp();
    // Register the background handler BEFORE the app mounts so no messages
    // are missed if the OS delivers one during the runApp() call.
    FirebaseMessaging.onBackgroundMessage(_onBackgroundMessage);
  } catch (_) {
    // Firebase unavailable (simulator / missing google-services.json).
    // App runs without push notifications — all other features unaffected.
  }

  runApp(const ProviderScope(child: AneesApp()));
}

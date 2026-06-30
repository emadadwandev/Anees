import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/auth/auth_service.dart';
import 'core/auth/login_screen.dart';
import 'core/network/api_client.dart';
import 'core/notifications/fcm_service.dart';
import 'core/auth/pin_login_screen.dart';
import 'core/auth/register_screen.dart';
import 'features/alerts/alert_detail_screen.dart';
import 'features/alerts/alerts_screen.dart';
import 'features/caregiver/caregiver_home_screen.dart';
import 'features/caregiver/onboarding/onboarding_screen.dart';
import 'features/caregiver/patient_edit_screen.dart';
import 'features/intercom/intercom_screen.dart';
import 'features/settings/settings_screen.dart';
import 'features/vitals/patient_detail_screen.dart';
import 'features/vitals/patient_home_screen.dart';
import 'features/vitals/roster_screen.dart';
import 'shared/theme/app_theme.dart';

final _routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final auth = authState.value;
      final isLoading = authState.isLoading;
      if (isLoading) return null;

      final isAuthenticated = auth?.isAuthenticated ?? false;
      final role = auth?.role;
      final loc = state.matchedLocation;

      if (!isAuthenticated) {
        if (loc == '/login' || loc == '/register' || loc == '/pin-login') {
          return null;
        }
        return '/login';
      }

      // Authenticated — redirect away from auth screens
      if (loc == '/login' || loc == '/register' || loc == '/pin-login') {
        return role == 'care_receiver' ? '/patient/home' : '/caregiver/home';
      }

      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(path: '/pin-login', builder: (_, __) => const PinLoginScreen()),

      // Care receiver (elderly)
      GoRoute(path: '/patient/home', builder: (_, __) => const PatientHomeScreen()),

      // Caregiver
      GoRoute(path: '/caregiver/home', builder: (_, __) => const CaregiverHomeScreen()),
      GoRoute(path: '/caregiver/roster', builder: (_, __) => const RosterScreen()),
      GoRoute(
        path: '/caregiver/patient/:id',
        builder: (_, state) =>
            PatientDetailScreen(patientId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/caregiver/onboarding', builder: (_, __) => const OnboardingScreen()),
      GoRoute(
        path: '/caregiver/alerts',
        builder: (_, __) => const AlertsScreen(),
      ),
      GoRoute(
        path: '/caregiver/alert/:id',
        builder: (_, state) =>
            AlertDetailScreen(alertId: state.pathParameters['id']!),
      ),

      GoRoute(
        path: '/caregiver/patient/edit',
        builder: (_, state) {
          final extra = state.extra as Map<String, dynamic>;
          return PatientEditScreen(
            patientId: extra['id'] as String,
            initialName: extra['name'] as String,
            initialPhone: extra['phone'] as String?,
            initialLanguage: extra['language'] as String?,
          );
        },
      ),

      // Shared
      GoRoute(
        path: '/intercom/:roomToken',
        builder: (_, state) =>
            IntercomScreen(roomToken: state.pathParameters['roomToken']!),
      ),
      GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
    ],
  );
});

class AneesApp extends ConsumerStatefulWidget {
  const AneesApp({super.key});

  @override
  ConsumerState<AneesApp> createState() => _AneesAppState();
}

class _AneesAppState extends ConsumerState<AneesApp> {
  bool _fcmInitialised = false;

  @override
  void initState() {
    super.initState();
    // Listen for the first authenticated state to init FCM.
    // Done here so the router is available before we call init().
    ref.listenManual<AsyncValue<AuthState>>(authStateProvider,
        (_, next) {
      final auth = next.value;
      if (!_fcmInitialised && (auth?.isAuthenticated ?? false)) {
        _fcmInitialised = true;
        final router = ref.read(_routerProvider);
        final client = ref.read(apiClientProvider);
        FcmService(client, router).init();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(_routerProvider);

    return MaterialApp.router(
      title: 'Anees',
      theme: AppTheme.lightTheme,
      routerConfig: router,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('en'),
        Locale('ar'),
      ],
    );
  }
}

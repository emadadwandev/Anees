import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/socket_service.dart';
import '../../core/storage/local_db.dart';
import '../../features/alerts/fall_grace_screen.dart';
import '../../features/intercom/intercom_screen.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/vital_card.dart';

class PatientHomeScreen extends ConsumerStatefulWidget {
  const PatientHomeScreen({super.key});

  @override
  ConsumerState<PatientHomeScreen> createState() => _PatientHomeScreenState();
}

class _PatientHomeScreenState extends ConsumerState<PatientHomeScreen> {
  VitalReading? _latest;
  SleepEpochEvent? _latestSleep;
  bool _isConnected = false;
  DateTime? _lastUpdateTime;

  @override
  void initState() {
    super.initState();
    _subscribeToVitals();
  }

  void _subscribeToVitals() {
    final authState = ref.read(authStateProvider).value;
    final patientId = authState?.userId;
    if (patientId == null) return;

    final socketService = ref.read(vitalsSocketServiceProvider);

    socketService.vitalsStream(patientId).listen((vital) {
      if (!mounted) return;
      setState(() {
        _latest = vital;
        _isConnected = true;
        _lastUpdateTime = DateTime.now();
      });

      ref.read(localDbProvider).upsertVital(
            patientId,
            CachedVitalsCompanion(
              patientId: Value(patientId),
              heartRateBpm: Value(vital.hr),
              respRateBrpm: Value(vital.rr),
              signalQuality: Value(vital.quality),
              timestamp: Value(vital.timestamp),
            ),
          );
    });

    socketService.sleepEpochStream(patientId).listen((epoch) {
      if (!mounted) return;
      setState(() => _latestSleep = epoch);
    });

    // P5-005: Auto-answer LiveKit call when fall.detected arrives with token
    socketService.fallStream
        .where((e) => e.patientId == patientId)
        .listen((fall) {
      if (!mounted) return;
      if (fall.livekitToken != null) {
        // Auto-connect to intercom — no user interaction needed
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) =>
                IntercomScreen(roomToken: fall.livekitToken!),
          ),
        );
      } else {
        // Show grace period countdown (no LiveKit token yet)
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => FallGraceScreen(alertId: fall.alertId),
            fullscreenDialog: true,
          ),
        );
      }
    });

    socketService.deviceOfflineStream
        .where((e) => e.patientId == patientId)
        .listen((_) {
      if (!mounted) return;
      setState(() => _isConnected = false);
    });

    _loadCachedVitals(patientId);
  }

  Future<void> _loadCachedVitals(String patientId) async {
    final cached = await ref.read(localDbProvider).getLatestVital(patientId);
    if (cached != null && mounted && _latest == null) {
      setState(() => _lastUpdateTime = cached.timestamp);
    }
  }

  String _lastUpdatedLabel() {
    if (_lastUpdateTime == null) return '';
    final diff = DateTime.now().difference(_lastUpdateTime!);
    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} minutes ago';
    return '${diff.inHours} hours ago';
  }

  // ── HR ────────────────────────────────────────────────────────────────────
  String _hrDescription(int? hr) {
    if (hr == null) return 'Checking your heart rate…';
    if (hr < 45) return 'Your heart rate is lower than usual';
    if (hr > 110) return 'Your heart rate is elevated';
    return 'Your heart is beating normally';
  }

  Color? _hrBackground(int? hr) {
    if (hr == null) return null;
    if (hr < 45 || hr > 110) {
      return AppColors.vitalCritical.withValues(alpha: 0.08);
    }
    return null;
  }

  // ── RR ────────────────────────────────────────────────────────────────────
  String _rrDescription(int? rr) {
    if (rr == null) return 'Checking your breathing…';
    if (rr < 8) return 'Your breathing is slower than usual';
    if (rr > 25) return 'Your breathing rate is elevated';
    return 'Your breathing looks good';
  }

  Color? _rrBackground(int? rr) {
    if (rr == null) return null;
    if (rr < 8 || rr > 25) {
      return AppColors.vitalCritical.withValues(alpha: 0.08);
    }
    return null;
  }

  // ── Signal quality ────────────────────────────────────────────────────────
  String _qualityDescription(double? q) {
    if (q == null) return 'Waiting for signal…';
    if (q >= 0.7) return 'Strong sensor signal';
    if (q >= 0.4) return 'Signal is acceptable';
    return 'Weak signal — check sensor';
  }

  Color? _qualityBackground(double? q) {
    if (q == null) return null;
    if (q < 0.4) return AppColors.vitalCritical.withValues(alpha: 0.08);
    if (q < 0.7) return AppColors.vitalWarning.withValues(alpha: 0.08);
    return null;
  }

  // ── Motion ────────────────────────────────────────────────────────────────
  String _motionLabel(double? m) {
    if (m == null) return '--';
    if (m < 0.1) return 'Still';
    if (m < 0.5) return 'Light';
    return 'Active';
  }

  String _motionDescription(double? m) {
    if (m == null) return 'Checking movement…';
    if (m < 0.1) return 'No movement detected';
    if (m < 0.5) return 'Light movement';
    return 'Active movement';
  }

  // ── Sleep stage ───────────────────────────────────────────────────────────
  String _sleepStageLabel(String? stage) {
    switch (stage) {
      case 'deep':
        return 'Deep';
      case 'light':
        return 'Light';
      case 'rem':
        return 'REM';
      case 'awake':
        return 'Awake';
      default:
        return '--';
    }
  }

  String _sleepStageDescription(String? stage) {
    switch (stage) {
      case 'deep':
        return 'Deep restorative sleep';
      case 'light':
        return 'Light sleep';
      case 'rem':
        return 'Dreaming (REM) sleep';
      case 'awake':
        return 'Currently awake';
      default:
        return 'Sleep data will appear at night';
    }
  }

  Color _sleepStageColor(String? stage) {
    switch (stage) {
      case 'deep':
        return const Color(0xFF1565C0);
      case 'rem':
        return const Color(0xFF6A1B9A);
      case 'light':
        return const Color(0xFF00838F);
      case 'awake':
        return AppColors.vitalWarning;
      default:
        return AppColors.alertOffline;
    }
  }

  @override
  Widget build(BuildContext context) {
    final hr = _latest?.hr;
    final rr = _latest?.rr;
    final quality = _latest?.quality;
    final motion = _latest?.motionMagnitude;
    final sleepStage = _latestSleep?.stage;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── App bar ───────────────────────────────────────────
            SliverAppBar(
              backgroundColor: AppColors.background,
              floating: true,
              elevation: 0,
              title: Text(
                'Good day',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              actions: [
                IconButton(
                  tooltip: 'Settings',
                  icon: const Icon(Icons.settings_outlined, size: 28),
                  onPressed: () => context.push('/settings'),
                ),
                const SizedBox(width: 8),
              ],
            ),

            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  Text(
                    'Your health looks good',
                    style: Theme.of(context)
                        .textTheme
                        .bodyLarge
                        ?.copyWith(color: const Color(0xFF777777)),
                  ),
                  const SizedBox(height: 28),

                  // ── Row 1: HR + RR (large) ────────────────────
                  Row(
                    children: [
                      Expanded(
                        child: VitalCard(
                          label: 'Heart Rate',
                          value: hr?.toString() ?? '--',
                          unit: 'BPM',
                          description: _hrDescription(hr),
                          largeMode: true,
                          backgroundColor: _hrBackground(hr),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: VitalCard(
                          label: 'Respiration',
                          value: rr?.toString() ?? '--',
                          unit: 'BRPM',
                          description: _rrDescription(rr),
                          largeMode: true,
                          backgroundColor: _rrBackground(rr),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // ── Row 2: Signal quality + Motion ────────────
                  Row(
                    children: [
                      Expanded(
                        child: VitalCard(
                          label: 'Signal',
                          value: quality != null
                              ? '${(quality * 100).round()}%'
                              : '--',
                          unit: 'SNR',
                          description: _qualityDescription(quality),
                          backgroundColor: _qualityBackground(quality),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: VitalCard(
                          label: 'Motion',
                          value: _motionLabel(motion),
                          unit: '',
                          description: _motionDescription(motion),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // ── Sleep stage card (full-width) ─────────────
                  _SleepStageCard(
                    stageLabel: _sleepStageLabel(sleepStage),
                    description: _sleepStageDescription(sleepStage),
                    color: _sleepStageColor(sleepStage),
                  ),

                  // ── Offline banner ────────────────────────────
                  if (!_isConnected && _lastUpdateTime != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade50,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.amber.shade200),
                      ),
                      child: Text(
                        'Last updated ${_lastUpdatedLabel()}',
                        style: const TextStyle(
                            fontSize: 16, color: Color(0xFF795548)),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),

                  // ── Status strip ──────────────────────────────
                  _SystemStatusStrip(isConnected: _isConnected),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Sleep stage card ──────────────────────────────────────────────────────────
class _SleepStageCard extends StatelessWidget {
  final String stageLabel;
  final String description;
  final Color color;

  const _SleepStageCard({
    required this.stageLabel,
    required this.description,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      color: color.withValues(alpha: 0.07),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(Icons.bedtime_outlined, color: color, size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Sleep Stage',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: const Color(0xFF777777),
                          fontWeight: FontWeight.w500,
                        ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    stageLabel,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          color: color,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    description,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── System status strip ───────────────────────────────────────────────────────
class _SystemStatusStrip extends StatelessWidget {
  final bool isConnected;
  const _SystemStatusStrip({required this.isConnected});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
      decoration: BoxDecoration(
        color: isConnected ? AppColors.vitalNormal : AppColors.alertOffline,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            isConnected ? Icons.shield_outlined : Icons.wifi_off_rounded,
            color: Colors.white,
            size: 22,
          ),
          const SizedBox(width: 10),
          Text(
            isConnected ? 'System Active & Safeguarding' : 'Sensor Offline',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

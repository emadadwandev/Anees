import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/network/socket_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/settings_button.dart';
import '../../shared/widgets/vital_card.dart';

class _PatientSummary {
  final String id;
  final String name;
  final String? accountCode;
  final String room;
  final String? deviceSerial;
  final String? deviceStatus;
  final String? phone;
  final String? language;

  const _PatientSummary({
    required this.id,
    required this.name,
    this.accountCode,
    required this.room,
    this.deviceSerial,
    this.deviceStatus,
    this.phone,
    this.language,
  });

  factory _PatientSummary.fromJson(Map<String, dynamic> j) => _PatientSummary(
        id: j['id'] as String,
        name: j['name'] as String,
        accountCode: j['accountCode'] as String?,
        room: j['room'] as String? ?? '',
        deviceSerial: j['deviceSerial'] as String?,
        deviceStatus: j['deviceStatus'] as String?,
        phone: j['phone'] as String?,
        language: j['language'] as String?,
      );
}

final _linkedPatientProvider =
    FutureProvider.autoDispose<_PatientSummary?>((ref) async {
  final client = ref.read(apiClientProvider);
  final res = await client.get('/caregiver/patient');
  if (res.data == null) return null;
  return _PatientSummary.fromJson(res.data as Map<String, dynamic>);
});

class CaregiverHomeScreen extends ConsumerStatefulWidget {
  const CaregiverHomeScreen({super.key});

  @override
  ConsumerState<CaregiverHomeScreen> createState() =>
      _CaregiverHomeScreenState();
}

class _CaregiverHomeScreenState extends ConsumerState<CaregiverHomeScreen> {
  VitalReading? _latest;
  bool _isConnected = false;

  void _subscribeVitals(String patientId) {
    final svc = ref.read(vitalsSocketServiceProvider);
    svc.vitalsStream(patientId).listen((v) {
      if (!mounted) return;
      setState(() {
        _latest = v;
        _isConnected = true;
      });
    });
    svc.deviceOfflineStream
        .where((e) => e.patientId == patientId)
        .listen((_) {
      if (!mounted) return;
      setState(() => _isConnected = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final patientAsync = ref.watch(_linkedPatientProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Anees'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push('/caregiver/alerts'),
          ),
          const SettingsButton(),
          const SizedBox(width: 4),
        ],
      ),
      body: patientAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (patient) {
          if (patient == null) {
            return _NoPatientView();
          }
          // Subscribe once we have the patient ID
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _subscribeVitals(patient.id);
          });
          return _PatientView(
            patient: patient,
            latest: _latest,
            isConnected: _isConnected,
          );
        },
      ),
    );
  }
}

class _NoPatientView extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.person_add_outlined,
                size: 72, color: AppColors.primary),
            const SizedBox(height: 24),
            Text(
              'No patient linked yet',
              style: Theme.of(context).textTheme.headlineMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              'Set up the sensor and create your patient\'s account to get started.',
              style: Theme.of(context)
                  .textTheme
                  .bodyLarge
                  ?.copyWith(color: const Color(0xFF777777)),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 36),
            ElevatedButton.icon(
              onPressed: () => context.push('/caregiver/onboarding'),
              icon: const Icon(Icons.add),
              label: const Text('Add your first patient'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                textStyle: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PatientView extends ConsumerWidget {
  final _PatientSummary patient;
  final VitalReading? latest;
  final bool isConnected;

  const _PatientView({
    required this.patient,
    required this.latest,
    required this.isConnected,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hr = latest?.hr;
    final rr = latest?.rr;
    final quality = latest?.quality;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Patient card
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                  child: Text(
                    patient.name[0].toUpperCase(),
                    style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(patient.name,
                          style: Theme.of(context).textTheme.titleLarge),
                      if (patient.room.isNotEmpty)
                        Text(patient.room,
                            style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
                _DeviceStatusDot(status: patient.deviceStatus),
                IconButton(
                  icon: const Icon(Icons.edit_outlined, color: AppColors.primary),
                  tooltip: 'Edit patient',
                  onPressed: () async {
                    final refreshed = await context.push<bool>(
                      '/caregiver/patient/edit',
                      extra: {
                        'id': patient.id,
                        'name': patient.name,
                        'phone': patient.phone,
                        'language': patient.language,
                      },
                    );
                    if (refreshed == true) {
                      ref.invalidate(_linkedPatientProvider);
                    }
                  },
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),

        // Live vitals
        Text('Live Vitals', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: VitalCard(
                label: 'Heart Rate',
                value: hr?.toString() ?? '--',
                unit: 'BPM',
                largeMode: true,
                backgroundColor: hr != null && (hr < 45 || hr > 110)
                    ? AppColors.vitalCritical.withValues(alpha: 0.08)
                    : null,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: VitalCard(
                label: 'Respiration',
                value: rr?.toString() ?? '--',
                unit: 'BRPM',
                largeMode: true,
                backgroundColor: rr != null && (rr < 8 || rr > 25)
                    ? AppColors.vitalCritical.withValues(alpha: 0.08)
                    : null,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        VitalCard(
          label: 'Signal Quality',
          value: quality != null ? '${(quality * 100).round()}%' : '--',
          unit: 'SNR',
          description: _qualityDesc(quality),
          backgroundColor: quality != null && quality < 0.4
              ? AppColors.vitalCritical.withValues(alpha: 0.08)
              : null,
        ),
        const SizedBox(height: 20),

        // Quick actions
        Text('Quick Actions', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _QuickAction(
                icon: Icons.warning_amber_outlined,
                label: 'Alerts',
                color: AppColors.alertWarning,
                onTap: () => context.push('/caregiver/alerts'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _QuickAction(
                icon: Icons.sensors,
                label: 'Hardware',
                color: AppColors.primary,
                onTap: () => context.push('/caregiver/onboarding'),
              ),
            ),
          ],
        ),

        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
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
                isConnected ? 'Sensor Active' : 'Sensor Offline',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String? _qualityDesc(double? q) {
    if (q == null) return null;
    if (q >= 0.7) return 'Strong signal';
    if (q >= 0.4) return 'Acceptable';
    return 'Weak — check sensor placement';
  }
}

class _DeviceStatusDot extends StatelessWidget {
  final String? status;
  const _DeviceStatusDot({this.status});

  @override
  Widget build(BuildContext context) {
    final color = status == 'online'
        ? AppColors.vitalNormal
        : status == 'offline'
            ? AppColors.alertOffline
            : Colors.grey;
    return Container(
      width: 12,
      height: 12,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
          child: Column(
            children: [
              Icon(icon, color: color, size: 32),
              const SizedBox(height: 8),
              Text(label,
                  style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w600,
                      fontSize: 14)),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/settings_button.dart';

final _alertDetailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
  (ref, alertId) async {
    final client = ref.read(apiClientProvider);
    final response = await client.get('/alerts/$alertId');
    return response.data as Map<String, dynamic>;
  },
);

class AlertDetailScreen extends ConsumerWidget {
  final String alertId;
  const AlertDetailScreen({super.key, required this.alertId});

  Future<void> _resolve(WidgetRef ref, BuildContext context) async {
    final client = ref.read(apiClientProvider);
    await client.post('/alerts/$alertId/resolve', {});
    if (context.mounted) context.pop();
  }

  Future<void> _falseAlarm(WidgetRef ref, BuildContext context) async {
    final client = ref.read(apiClientProvider);
    await client.post('/alerts/$alertId/false-alarm', {});
    if (context.mounted) context.pop();
  }

  Future<void> _openIntercom(
      WidgetRef ref, BuildContext context, String patientId) async {
    try {
      final client = ref.read(apiClientProvider);
      final res =
          await client.post('/intercom/token', {'patientId': patientId});
      final token = (res.data as Map<String, dynamic>)['token'] as String;
      if (context.mounted) context.push('/intercom/$token');
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open audio channel: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alertAsync = ref.watch(_alertDetailProvider(alertId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Alert Detail'),
        actions: const [SettingsButton(), SizedBox(width: 4)],
      ),
      body: alertAsync.when(
        data: (alert) => _AlertDetailBody(
          alert: alert,
          onResolve: () => _resolve(ref, context),
          onFalseAlarm: () => _falseAlarm(ref, context),
          onOpenIntercom: () => _openIntercom(
              ref, context, alert['patientId'] as String),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error loading alert: $e')),
      ),
    );
  }
}

class _AlertDetailBody extends StatelessWidget {
  final Map<String, dynamic> alert;
  final VoidCallback onResolve;
  final VoidCallback onFalseAlarm;
  final VoidCallback onOpenIntercom;

  const _AlertDetailBody({
    required this.alert,
    required this.onResolve,
    required this.onFalseAlarm,
    required this.onOpenIntercom,
  });

  @override
  Widget build(BuildContext context) {
    final triggeredAt = DateTime.tryParse(
            alert['triggeredAt'] as String? ?? '') ??
        DateTime.now();
    final diff = DateTime.now().difference(triggeredAt);
    final elapsed =
        '${diff.inMinutes} min ${diff.inSeconds % 60} sec ago';

    final timeline = (alert['timeline'] as List? ?? [
      {'time': alert['triggeredAt'], 'event': 'Fall vector detected'},
      {'time': null, 'event': 'Grace period expired'},
      {'time': null, 'event': 'Alert dispatched'},
    ]).cast<Map<String, dynamic>>();

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              Icon(Icons.warning_amber_rounded,
                  color: AppColors.alertActive, size: 32),
              SizedBox(width: 10),
              Text(
                'FALL DETECTED',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppColors.alertActive,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${alert['patientName'] ?? 'Patient'} — ${alert['room'] ?? ''}',
            style: const TextStyle(fontSize: 18, color: Color(0xFF333333)),
          ),
          Text(
            elapsed,
            style: const TextStyle(fontSize: 14, color: Color(0xFF777777)),
          ),
          const SizedBox(height: 24),
          const Text(
            'Timeline',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          ...timeline.map((t) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        t['event'] as String,
                        style: const TextStyle(fontSize: 14),
                      ),
                    ),
                    if (t['time'] != null)
                      Text(
                        _formatTime(t['time'] as String),
                        style: const TextStyle(
                            fontSize: 13, color: Color(0xFF777777)),
                      ),
                  ],
                ),
              )),
          const Spacer(),
          ElevatedButton.icon(
            onPressed: onOpenIntercom,
            icon: const Icon(Icons.mic, size: 22),
            label: const Text('Open Live Audio Channel'),
            style: ElevatedButton.styleFrom(
              minimumSize: const Size.fromHeight(56),
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onResolve,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 48),
                    side: const BorderSide(color: AppColors.vitalNormal),
                    foregroundColor: AppColors.vitalNormal,
                  ),
                  child: const Text('Mark as Resolved'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton(
                  onPressed: onFalseAlarm,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 48),
                    side: const BorderSide(color: AppColors.alertOffline),
                    foregroundColor: AppColors.alertOffline,
                  ),
                  child: const Text('False Alarm'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  String _formatTime(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return '';
    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}:${dt.second.toString().padLeft(2, '0')}';
  }
}

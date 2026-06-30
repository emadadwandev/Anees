import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/settings_button.dart';

enum _AlertType { fall, vitalAnomaly, systemOffline, ok }

class _AlertItem {
  final String id;
  final String patientName;
  final String room;
  final _AlertType type;
  final DateTime triggeredAt;
  final bool isRead;

  const _AlertItem({
    required this.id,
    required this.patientName,
    required this.room,
    required this.type,
    required this.triggeredAt,
    required this.isRead,
  });

  int get priority {
    switch (type) {
      case _AlertType.fall:
        return 0;
      case _AlertType.vitalAnomaly:
        return 1;
      case _AlertType.systemOffline:
        return 2;
      case _AlertType.ok:
        return 3;
    }
  }
}

final _activeAlertsProvider =
    FutureProvider.autoDispose<List<_AlertItem>>((ref) async {
  final client = ref.read(apiClientProvider);
  final response = await client.get('/patients', queryParameters: {
    'alertStatus': 'active',
  });
  final patients = (response.data as List).cast<Map<String, dynamic>>();
  return patients
      .where((p) => p['alertStatus'] != 'ok')
      .map((p) => _AlertItem(
            id: p['alertId'] as String? ?? p['id'] as String,
            patientName: p['name'] as String,
            room: p['room'] as String? ?? '',
            type: _typeFromString(p['alertStatus'] as String? ?? ''),
            triggeredAt: DateTime.tryParse(
                    p['alertTriggeredAt'] as String? ?? '') ??
                DateTime.now(),
            isRead: p['alertAcknowledged'] as bool? ?? false,
          ))
      .toList()
    ..sort((a, b) => a.priority.compareTo(b.priority));
});

_AlertType _typeFromString(String s) {
  switch (s) {
    case 'fall_active':
      return _AlertType.fall;
    case 'anomaly_warning':
      return _AlertType.vitalAnomaly;
    case 'system_offline':
      return _AlertType.systemOffline;
    default:
      return _AlertType.ok;
  }
}

class AlertsScreen extends ConsumerWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Alerts'),
          actions: const [SettingsButton(), SizedBox(width: 4)],
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Active'),
              Tab(text: 'History'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _ActiveAlertsList(),
            _AlertHistoryList(),
          ],
        ),
      ),
    );
  }
}

class _ActiveAlertsList extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alertsAsync = ref.watch(_activeAlertsProvider);

    return alertsAsync.when(
      data: (alerts) {
        if (alerts.isEmpty) {
          return const Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.check_circle_outline,
                    size: 64, color: AppColors.vitalNormal),
                SizedBox(height: 16),
                Text(
                  'No active alerts',
                  style: TextStyle(fontSize: 18, color: Color(0xFF555555)),
                ),
              ],
            ),
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: alerts.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) => _AlertCard(alert: alerts[i]),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
    );
  }
}

class _AlertCard extends StatelessWidget {
  final _AlertItem alert;
  const _AlertCard({required this.alert});

  Color get _borderColor {
    switch (alert.type) {
      case _AlertType.fall:
        return AppColors.alertActive;
      case _AlertType.vitalAnomaly:
        return AppColors.alertWarning;
      case _AlertType.systemOffline:
        return AppColors.alertOffline;
      case _AlertType.ok:
        return AppColors.alertOk;
    }
  }

  String get _typeLabel {
    switch (alert.type) {
      case _AlertType.fall:
        return 'FALL';
      case _AlertType.vitalAnomaly:
        return 'VITAL ANOMALY';
      case _AlertType.systemOffline:
        return 'OFFLINE';
      case _AlertType.ok:
        return 'OK';
    }
  }

  String _timeElapsed() {
    final diff = DateTime.now().difference(alert.triggeredAt);
    if (diff.inSeconds < 60) return '${diff.inSeconds}s ago';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    return '${diff.inHours}h ago';
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: _borderColor, width: 2),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push('/caregiver/alert/${alert.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: _borderColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _typeLabel,
                  style: TextStyle(
                    color: _borderColor,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(alert.patientName,
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    Text(
                      alert.room,
                      style: const TextStyle(
                          fontSize: 14, color: Color(0xFF777777)),
                    ),
                  ],
                ),
              ),
              Text(
                _timeElapsed(),
                style:
                    const TextStyle(fontSize: 13, color: Color(0xFF777777)),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right, color: Color(0xFFBBBBBB)),
            ],
          ),
        ),
      ),
    );
  }
}

final _alertHistoryProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final client = ref.read(apiClientProvider);
  final response =
      await client.get('/alerts/history', queryParameters: {'limit': '50'});
  final body = response.data as Map<String, dynamic>;
  return (body['data'] as List).cast<Map<String, dynamic>>();
});

class _AlertHistoryList extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(_alertHistoryProvider);

    return historyAsync.when(
      data: (items) {
        if (items.isEmpty) {
          return const Center(
            child: Text(
              'No resolved alerts yet',
              style: TextStyle(color: Color(0xFF777777)),
            ),
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: items.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) => _HistoryCard(alert: items[i]),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  final Map<String, dynamic> alert;
  const _HistoryCard({required this.alert});

  Color _statusColor(String status) {
    switch (status) {
      case 'resolved':
        return AppColors.vitalNormal;
      case 'false_alarm':
        return AppColors.alertOffline;
      case 'cancelled_by_user':
        return AppColors.alertWarning;
      default:
        return const Color(0xFF999999);
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'resolved':
        return 'Resolved';
      case 'false_alarm':
        return 'False Alarm';
      case 'cancelled_by_user':
        return 'Cancelled';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = alert['status'] as String? ?? '';
    final triggeredAt =
        DateTime.tryParse(alert['triggeredAt'] as String? ?? '') ?? DateTime.now();
    final color = _statusColor(status);

    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: color.withValues(alpha: 0.4), width: 1.5),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => context.push('/caregiver/alert/${alert['id']}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _statusLabel(status).toUpperCase(),
                  style: TextStyle(
                    color: color,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      alert['patientName'] as String? ?? 'Patient',
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      alert['room'] as String? ?? '',
                      style: const TextStyle(
                          fontSize: 13, color: Color(0xFF777777)),
                    ),
                  ],
                ),
              ),
              Text(
                '${triggeredAt.day}/${triggeredAt.month}',
                style:
                    const TextStyle(fontSize: 13, color: Color(0xFF777777)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

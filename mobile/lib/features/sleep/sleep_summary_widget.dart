import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../shared/theme/app_theme.dart';

class _SleepNight {
  final DateTime date;
  final String qualityLabel;
  _SleepNight({required this.date, required this.qualityLabel});
}

final _sleepLast7Provider =
    FutureProvider.autoDispose.family<List<_SleepNight>, String>(
        (ref, patientId) async {
  final client = ref.read(apiClientProvider);
  final response = await client.get(
    '/patients/$patientId/sleep/report',
    queryParameters: {'last': '7'},
  );
  final nights = (response.data as List).cast<Map<String, dynamic>>();
  return nights
      .map((n) => _SleepNight(
            date: DateTime.parse(n['date'] as String),
            qualityLabel: n['qualityLabel'] as String? ?? 'Unknown',
          ))
      .toList();
});

Color _qualityColor(String label) {
  switch (label.toLowerCase()) {
    case 'good':
      return AppColors.vitalNormal;
    case 'restless':
      return AppColors.vitalWarning;
    case 'poor':
      return AppColors.vitalCritical;
    default:
      return AppColors.alertOffline;
  }
}

String _qualityMessage(String? label) {
  switch (label?.toLowerCase()) {
    case 'good':
      return 'You slept well last night';
    case 'restless':
      return 'Your sleep was restless last night';
    case 'poor':
      return 'You had a rough night';
    default:
      return 'Sleep data loading…';
  }
}

class SleepSummaryWidget extends ConsumerWidget {
  final String patientId;
  const SleepSummaryWidget({super.key, required this.patientId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sleepAsync = ref.watch(_sleepLast7Provider(patientId));

    return sleepAsync.when(
      data: (nights) {
        final lastNight = nights.isNotEmpty ? nights.last : null;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _qualityMessage(lastNight?.qualityLabel),
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: lastNight != null
                        ? _qualityColor(lastNight.qualityLabel)
                        : const Color(0xFF777777),
                  ),
            ),
            const SizedBox(height: 24),
            if (nights.isNotEmpty) ...[
              const Text(
                'Last 7 nights',
                style: TextStyle(fontSize: 16, color: Color(0xFF777777)),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 120,
                child: BarChart(
                  BarChartData(
                    alignment: BarChartAlignment.spaceAround,
                    maxY: 3,
                    barGroups: nights.asMap().entries.map((e) {
                      final color =
                          _qualityColor(e.value.qualityLabel);
                      return BarChartGroupData(
                        x: e.key,
                        barRods: [
                          BarChartRodData(
                            toY: 2,
                            color: color,
                            width: 18,
                            borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(6),
                            ),
                          ),
                        ],
                      );
                    }).toList(),
                    gridData: const FlGridData(show: false),
                    borderData: FlBorderData(show: false),
                    titlesData: FlTitlesData(
                      show: true,
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          getTitlesWidget: (v, _) {
                            final idx = v.toInt();
                            if (idx < 0 || idx >= nights.length) {
                              return const SizedBox.shrink();
                            }
                            final d = nights[idx].date;
                            final label =
                                ['Mo','Tu','We','Th','Fr','Sa','Su']
                                    [d.weekday - 1];
                            return Text(label,
                                style: const TextStyle(fontSize: 12));
                          },
                        ),
                      ),
                      leftTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
                      rightTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
                      topTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
                    ),
                  ),
                ),
              ),
            ],
          ],
        );
      },
      loading: () => const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: CircularProgressIndicator(),
        ),
      ),
      error: (e, _) => Text('Could not load sleep data: $e',
          style: const TextStyle(color: Color(0xFF777777))),
    );
  }
}

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/network/api_client.dart';
import '../../core/network/socket_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/settings_button.dart';
import '../../shared/widgets/vital_card.dart';

const _ranges = ['6H', '24H', '7D', '30D'];

final _vitalHistoryProvider = FutureProvider.autoDispose
    .family<List<FlSpot>, ({String patientId, String range})>(
        (ref, args) async {
  final client = ref.read(apiClientProvider);
  final response = await client.get(
    '/patients/${args.patientId}/vitals/history',
    queryParameters: {'range': args.range.toLowerCase()},
  );
  final readings = (response.data as List).cast<Map<String, dynamic>>();
  return readings.asMap().entries.map((e) {
    return FlSpot(
        e.key.toDouble(), (e.value['heart_rate_bpm'] as num).toDouble());
  }).toList();
});

class PatientDetailScreen extends ConsumerStatefulWidget {
  final String patientId;
  const PatientDetailScreen({super.key, required this.patientId});

  @override
  ConsumerState<PatientDetailScreen> createState() =>
      _PatientDetailScreenState();
}

class _PatientDetailScreenState
    extends ConsumerState<PatientDetailScreen> {
  VitalReading? _liveVital;
  String _selectedRange = '24H';

  @override
  void initState() {
    super.initState();
    ref
        .read(vitalsSocketServiceProvider)
        .vitalsStream(widget.patientId)
        .listen((v) {
      if (mounted) setState(() => _liveVital = v);
    });
  }

  @override
  Widget build(BuildContext context) {
    final historyAsync = ref.watch(_vitalHistoryProvider(
        (patientId: widget.patientId, range: _selectedRange)));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Patient Detail'),
        actions: const [SettingsButton(), SizedBox(width: 4)],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: const Color(0xFFEEEEEE)),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Section 1: Live Vitals
          Text('Live Vitals',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: VitalCard(
                  label: 'Heart Rate',
                  value: _liveVital?.hr.toString() ?? '--',
                  unit: 'BPM',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: VitalCard(
                  label: 'Respiration',
                  value: _liveVital?.rr.toString() ?? '--',
                  unit: 'BRPM',
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Text('Signal Quality',
                  style: TextStyle(fontSize: 14, color: Color(0xFF777777))),
              const SizedBox(width: 12),
              Expanded(
                child: LinearProgressIndicator(
                  value: _liveVital?.quality ?? 0,
                  backgroundColor: const Color(0xFFEEEEEE),
                  color: AppColors.vitalNormal,
                  minHeight: 8,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                _liveVital != null
                    ? '${(_liveVital!.quality * 100).toInt()}%'
                    : '--',
                style: const TextStyle(fontSize: 14),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Section 2: Vital History
          Text('Vital History',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          // Range selector
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: _ranges.map((r) {
                final selected = r == _selectedRange;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(r),
                    selected: selected,
                    onSelected: (_) =>
                        setState(() => _selectedRange = r),
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(
                      color: selected ? Colors.white : null,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 220,
            child: historyAsync.when(
              data: (spots) => spots.isEmpty
                  ? const Center(child: Text('No data for this range'))
                  : LineChart(
                      LineChartData(
                        gridData: const FlGridData(show: false),
                        borderData: FlBorderData(show: false),
                        titlesData: const FlTitlesData(show: false),
                        lineBarsData: [
                          LineChartBarData(
                            spots: spots,
                            isCurved: true,
                            color: AppColors.primary,
                            barWidth: 2,
                            dotData: const FlDotData(show: false),
                            belowBarData: BarAreaData(
                              show: true,
                              color: AppColors.primary.withValues(alpha: 0.08),
                            ),
                          ),
                        ],
                      ),
                    ),
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (e, _) =>
                  Center(child: Text('Error loading chart: $e')),
            ),
          ),
          const SizedBox(height: 24),

          // Section 3: Sleep Analytics (P6-004)
          Text('Sleep Analytics',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          _SleepAnalyticsPanel(patientId: widget.patientId),
          const SizedBox(height: 24),

          // Section 4: Alert history
          Text('Alert History',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          _AlertHistoryPanel(patientId: widget.patientId),
          const SizedBox(height: 24),

          // Section 5: Device Status (PRD 4.2 S5)
          Text('Device Status',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          _DeviceStatusPanel(patientId: widget.patientId),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

// ── Sleep epoch model ─────────────────────────────────────────────────────────
class _SleepEpoch {
  final String time;   // "HH:mm"
  final String stage;  // deep | light | rem | awake
  _SleepEpoch({required this.time, required this.stage});
}

class _NightSummary {
  final String date;
  final double deepPct;
  final double lightPct;
  final double remPct;
  final double awakePct;
  final int totalMin;
  final double fragmentationIndex;
  _NightSummary({
    required this.date,
    required this.deepPct,
    required this.lightPct,
    required this.remPct,
    required this.awakePct,
    required this.totalMin,
    required this.fragmentationIndex,
  });
  factory _NightSummary.fromJson(Map<String, dynamic> j) => _NightSummary(
        date: j['date'] as String,
        deepPct: (j['deepPct'] as num?)?.toDouble() ?? 0,
        lightPct: (j['lightPct'] as num?)?.toDouble() ?? 0,
        remPct: (j['remPct'] as num?)?.toDouble() ?? 0,
        awakePct: (j['awakePct'] as num?)?.toDouble() ?? 0,
        totalMin: (j['totalSleepMin'] as num?)?.toInt() ?? 0,
        fragmentationIndex: (j['fragmentationIndex'] as num?)?.toDouble() ?? 0,
      );
}

// ── Sleep analytics panel (P6-004) ───────────────────────────────────────────
class _SleepAnalyticsPanel extends ConsumerStatefulWidget {
  final String patientId;
  const _SleepAnalyticsPanel({required this.patientId});

  @override
  ConsumerState<_SleepAnalyticsPanel> createState() => _SleepAnalyticsPanelState();
}

class _SleepAnalyticsPanelState extends ConsumerState<_SleepAnalyticsPanel> {
  List<_SleepEpoch>? _epochs;
  List<_NightSummary>? _nights;
  bool _loading = true;
  final _selectedDate = DateFormat('yyyy-MM-dd').format(
    DateTime.now().subtract(const Duration(days: 1)),
  );

  static const _stageColors = {
    'deep':  Color(0xFF3730A3),
    'rem':   Color(0xFF7C3AED),
    'light': Color(0xFF3B82F6),
    'awake': Color(0xFFF59E0B),
  };

  static const _stageOrder = ['deep', 'light', 'rem', 'awake'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final client = ref.read(apiClientProvider);
    try {
      final results = await Future.wait([
        client.get(
          '/patients/${widget.patientId}/sleep/report',
          queryParameters: {'date': _selectedDate},
        ),
        client.get(
          '/patients/${widget.patientId}/sleep/report',
          queryParameters: {'last': '30'},
        ),
      ]);

      final reportData = results[0].data as Map<String, dynamic>;
      final epochs = (reportData['epochs'] as List<dynamic>?)
          ?.cast<Map<String, dynamic>>()
          .map((e) => _SleepEpoch(
                time: e['time'] as String,
                stage: e['stage'] as String,
              ))
          .toList();

      final nights = (results[1].data as List<dynamic>)
          .cast<Map<String, dynamic>>()
          .map(_NightSummary.fromJson)
          .toList();

      if (mounted) {
        setState(() {
          _epochs = epochs;
          _nights = nights;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Hypnogram ─────────────────────────────────────────
        Text(
          'Last Night — $_selectedDate',
          style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF777777),
              fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 8),
        if (_epochs != null && _epochs!.isNotEmpty)
          _Hypnogram(epochs: _epochs!, stageColors: _stageColors)
        else
          const Card(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                child: Text('No epoch data for last night',
                    style: TextStyle(color: Color(0xFF999999))),
              ),
            ),
          ),
        const SizedBox(height: 20),

        // ── 30-day stacked bar trend ───────────────────────────
        const Text(
          '30-Day Sleep Trend',
          style: TextStyle(
              fontSize: 13,
              color: Color(0xFF777777),
              fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 8),
        if (_nights != null && _nights!.isNotEmpty)
          _SleepTrendChart(nights: _nights!, stageColors: _stageColors)
        else
          const Card(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                child: Text('No 30-day data',
                    style: TextStyle(color: Color(0xFF999999))),
              ),
            ),
          ),

        // ── Fragmentation index ────────────────────────────────
        if (_nights != null && _nights!.isNotEmpty) ...[
          const SizedBox(height: 16),
          _FragmentationTile(nights: _nights!),
        ],
      ],
    );
  }
}

// Hypnogram: horizontal colored bar per epoch
class _Hypnogram extends StatelessWidget {
  final List<_SleepEpoch> epochs;
  final Map<String, Color> stageColors;
  const _Hypnogram({required this.epochs, required this.stageColors});

  @override
  Widget build(BuildContext context) {
    const stageOrder = ['deep', 'light', 'rem', 'awake'];
    final barHeight = 12.0;
    final totalEpochs = epochs.length;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Stage axis labels on left
            Row(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: stageOrder.map((s) => SizedBox(
                    height: barHeight + 6,
                    child: Text(
                      s[0].toUpperCase() + s.substring(1),
                      style: TextStyle(
                        fontSize: 10,
                        color: stageColors[s],
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  )).toList(),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: stageOrder.map((stage) {
                      return SizedBox(
                        height: barHeight + 6,
                        child: Row(
                          children: epochs.map((e) {
                            return Expanded(
                              child: Container(
                                margin: const EdgeInsets.symmetric(vertical: 2, horizontal: 0.5),
                                decoration: BoxDecoration(
                                  color: e.stage == stage
                                      ? (stageColors[stage] ?? Colors.grey)
                                      : Colors.transparent,
                                  borderRadius: BorderRadius.circular(1),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            // Time labels
            Padding(
              padding: const EdgeInsets.only(left: 56),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (totalEpochs > 0)
                    Text(epochs.first.time,
                        style: const TextStyle(fontSize: 10, color: Color(0xFF999999))),
                  if (totalEpochs > 1)
                    Text(epochs[totalEpochs ~/ 2].time,
                        style: const TextStyle(fontSize: 10, color: Color(0xFF999999))),
                  if (totalEpochs > 1)
                    Text(epochs.last.time,
                        style: const TextStyle(fontSize: 10, color: Color(0xFF999999))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// 30-day stacked bar chart
class _SleepTrendChart extends StatelessWidget {
  final List<_NightSummary> nights;
  final Map<String, Color> stageColors;
  const _SleepTrendChart({required this.nights, required this.stageColors});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 16, 8, 8),
        child: SizedBox(
          height: 160,
          child: BarChart(
            BarChartData(
              alignment: BarChartAlignment.spaceAround,
              maxY: 100,
              barGroups: nights.asMap().entries.map((e) {
                final n = e.value;
                return BarChartGroupData(
                  x: e.key,
                  barRods: [
                    BarChartRodData(
                      toY: n.deepPct + n.lightPct + n.remPct,
                      width: 6,
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(2)),
                      rodStackItems: [
                        BarChartRodStackItem(0, n.deepPct, stageColors['deep']!),
                        BarChartRodStackItem(n.deepPct, n.deepPct + n.remPct, stageColors['rem']!),
                        BarChartRodStackItem(
                          n.deepPct + n.remPct,
                          n.deepPct + n.remPct + n.lightPct,
                          stageColors['light']!,
                        ),
                      ],
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
                      if (idx % 7 != 0 || idx >= nights.length) {
                        return const SizedBox.shrink();
                      }
                      return Text(
                        nights[idx].date.substring(5),
                        style: const TextStyle(fontSize: 9, color: Color(0xFF999999)),
                      );
                    },
                  ),
                ),
                leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// Fragmentation index summary tile
class _FragmentationTile extends StatelessWidget {
  final List<_NightSummary> nights;
  const _FragmentationTile({required this.nights});

  @override
  Widget build(BuildContext context) {
    if (nights.length < 2) return const SizedBox.shrink();
    final recent = nights.last.fragmentationIndex;
    final prev = nights[nights.length - 2].fragmentationIndex;
    final improving = recent < prev;
    Color color;
    String label;
    if (recent < 0.2) { color = const Color(0xFF2E7D32); label = 'Low'; }
    else if (recent < 0.4) { color = const Color(0xFFE65100); label = 'Moderate'; }
    else { color = const Color(0xFFC62828); label = 'High'; }

    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Icon(Icons.bedtime_outlined, color: color, size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Fragmentation Index',
                      style: TextStyle(fontSize: 13, color: Color(0xFF777777))),
                  const SizedBox(height: 2),
                  Text(
                    '$label  (${recent.toStringAsFixed(2)})',
                    style: TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w600, color: color),
                  ),
                ],
              ),
            ),
            Icon(
              improving ? Icons.trending_down : Icons.trending_up,
              color: improving ? const Color(0xFF2E7D32) : const Color(0xFFC62828),
            ),
            const SizedBox(width: 4),
            Text(
              improving ? 'Improving' : 'Worsening',
              style: TextStyle(
                fontSize: 12,
                color: improving ? const Color(0xFF2E7D32) : const Color(0xFFC62828),
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Device status panel (PRD 4.2 S5) ─────────────────────────────────────────
class _DeviceStatusPanel extends ConsumerWidget {
  final String patientId;
  const _DeviceStatusPanel({required this.patientId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder(
      future: ref.read(apiClientProvider).get('/patients/$patientId/device'),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: CircularProgressIndicator()),
          );
        }
        if (!snapshot.hasData || snapshot.data!.data == null) {
          return const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('No device paired',
                  style: TextStyle(color: Color(0xFF777777))),
            ),
          );
        }

        final d = snapshot.data!.data as Map<String, dynamic>;
        final lastHeartbeat = d['lastHeartbeatAt'] != null
            ? DateTime.tryParse(d['lastHeartbeatAt'] as String)
            : null;
        final isOnline = lastHeartbeat != null &&
            DateTime.now().difference(lastHeartbeat).inMinutes < 5;
        final occluded = d['occluded'] as bool? ?? false;

        return Card(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(
              color: isOnline
                  ? AppColors.vitalNormal.withValues(alpha: 0.4)
                  : AppColors.alertOffline.withValues(alpha: 0.5),
              width: 1.5,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _DeviceRow(
                  icon: Icons.sensors,
                  label: 'Model',
                  value: d['model'] as String? ?? d['serial'] as String? ?? '—',
                ),
                _DeviceRow(
                  icon: Icons.system_update_alt,
                  label: 'Firmware',
                  value: d['firmwareVersion'] as String? ?? '—',
                ),
                _DeviceRow(
                  icon: Icons.room,
                  label: 'Room',
                  value: d['roomLabel'] as String? ?? '—',
                ),
                _DeviceRow(
                  icon: Icons.wifi,
                  label: 'Status',
                  value: isOnline ? 'Online' : 'Offline',
                  valueColor:
                      isOnline ? AppColors.vitalNormal : AppColors.alertOffline,
                ),
                _DeviceRow(
                  icon: Icons.access_time,
                  label: 'Last Heartbeat',
                  value: lastHeartbeat != null
                      ? DateFormat('MMM d, HH:mm').format(lastHeartbeat.toLocal())
                      : '—',
                ),
                if (occluded)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Row(
                      children: [
                        Icon(Icons.visibility_off,
                            color: AppColors.alertWarning, size: 18),
                        SizedBox(width: 8),
                        Text(
                          'Sensor occlusion detected',
                          style: TextStyle(
                              color: AppColors.alertWarning,
                              fontSize: 13,
                              fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _DeviceRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;
  const _DeviceRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF999999)),
          const SizedBox(width: 10),
          SizedBox(
            width: 110,
            child: Text(label,
                style: const TextStyle(
                    fontSize: 13, color: Color(0xFF777777))),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: valueColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Alert history panel ───────────────────────────────────────────────────────
class _AlertHistoryPanel extends ConsumerWidget {
  final String patientId;
  const _AlertHistoryPanel({required this.patientId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder(
      future: ref.read(apiClientProvider).get(
        '/patients/$patientId/alerts',
        queryParameters: {'limit': '10'},
      ),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          );
        }
        // Backend returns paginated shape { data: [...], total, page, limit }.
        final alerts = snapshot.hasData
            ? ((snapshot.data!.data as Map<String, dynamic>)['data'] as List<dynamic>)
                .cast<Map<String, dynamic>>()
            : <Map<String, dynamic>>[];
        if (alerts.isEmpty) {
          return const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('No recent alerts',
                  style: TextStyle(color: Color(0xFF777777))),
            ),
          );
        }
        return Column(
          children: alerts.map((a) {
            final type = a['type'] as String? ?? 'alert';
            final status = a['status'] as String? ?? '';
            final triggeredAt = a['triggeredAt'] != null
                ? DateTime.tryParse(a['triggeredAt'] as String)
                : null;
            Color statusColor;
            switch (status) {
              case 'resolved': statusColor = const Color(0xFF2E7D32); break;
              case 'false_alarm': statusColor = const Color(0xFF777777); break;
              case 'cancelled_by_user': statusColor = const Color(0xFF1565C0); break;
              default: statusColor = const Color(0xFFC62828);
            }
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: Icon(
                  type == 'fall' ? Icons.warning_amber_rounded : Icons.monitor_heart,
                  color: statusColor,
                ),
                title: Text(
                  type == 'fall' ? 'Fall Detected' : 'Vital Anomaly',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: triggeredAt != null
                    ? Text(DateFormat('MMM d, HH:mm').format(triggeredAt.toLocal()))
                    : null,
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    status.replaceAll('_', ' '),
                    style: TextStyle(
                        fontSize: 11, color: statusColor, fontWeight: FontWeight.w500),
                  ),
                ),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

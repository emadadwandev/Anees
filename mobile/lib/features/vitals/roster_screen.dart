import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/network/socket_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/settings_button.dart';

enum _CardStatus { ok, alertActive, anomalyWarning, systemOffline }

class _PatientCard {
  final String id;
  final String name;
  final int age;
  final String room;
  int? hr;
  int? rr;
  final String sleepQuality;
  final _CardStatus status;

  _PatientCard({
    required this.id,
    required this.name,
    required this.age,
    required this.room,
    this.hr,
    this.rr,
    required this.sleepQuality,
    required this.status,
  });

  int get sortPriority {
    switch (status) {
      case _CardStatus.alertActive:
        return 0;
      case _CardStatus.anomalyWarning:
        return 1;
      case _CardStatus.systemOffline:
        return 2;
      case _CardStatus.ok:
        return 3;
    }
  }

  factory _PatientCard.fromJson(Map<String, dynamic> j) => _PatientCard(
        id: j['id'] as String,
        name: j['name'] as String,
        age: j['age'] as int? ?? 0,
        room: j['room'] as String? ?? '',
        hr: j['hr'] as int?,
        rr: j['rr'] as int?,
        sleepQuality: j['sleepQuality'] as String? ?? 'Unknown',
        status: _statusFromString(j['alertStatus'] as String? ?? 'ok'),
      );
}

_CardStatus _statusFromString(String s) {
  switch (s) {
    case 'fall_active':
      return _CardStatus.alertActive;
    case 'anomaly_warning':
      return _CardStatus.anomalyWarning;
    case 'system_offline':
      return _CardStatus.systemOffline;
    default:
      return _CardStatus.ok;
  }
}

final _rosterProvider =
    FutureProvider.autoDispose<List<_PatientCard>>((ref) async {
  final client = ref.read(apiClientProvider);
  final response = await client.get('/patients');
  final list = (response.data as List).cast<Map<String, dynamic>>();
  final cards = list.map(_PatientCard.fromJson).toList()
    ..sort((a, b) => a.sortPriority.compareTo(b.sortPriority));
  return cards;
});

class RosterScreen extends ConsumerStatefulWidget {
  const RosterScreen({super.key});

  @override
  ConsumerState<RosterScreen> createState() => _RosterScreenState();
}

class _RosterScreenState extends ConsumerState<RosterScreen> {
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    // Subscribe to live vitals updates and alert changes
    ref.read(vitalsSocketServiceProvider).alertStream.listen((_) {
      ref.invalidate(_rosterProvider);
    });
  }

  @override
  Widget build(BuildContext context) {
    final rosterAsync = ref.watch(_rosterProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Patients'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push('/caregiver/alerts'),
          ),
          const SettingsButton(),
          const SizedBox(width: 4),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Search by name or room…',
                prefixIcon: Icon(Icons.search),
                contentPadding:
                    EdgeInsets.symmetric(vertical: 0, horizontal: 16),
              ),
              onChanged: (v) => setState(() => _searchQuery = v.toLowerCase()),
            ),
          ),
          Expanded(
            child: rosterAsync.when(
              data: (patients) {
                final filtered = patients.where((p) {
                  if (_searchQuery.isEmpty) return true;
                  return p.name.toLowerCase().contains(_searchQuery) ||
                      p.room.toLowerCase().contains(_searchQuery);
                }).toList();

                return ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: filtered.length,
                  itemBuilder: (_, i) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _PatientListCard(
                      patient: filtered[i],
                      ref: ref,
                    ),
                  ),
                );
              },
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
            ),
          ),
        ],
      ),
    );
  }
}

class _PatientListCard extends StatefulWidget {
  final _PatientCard patient;
  final WidgetRef ref;

  const _PatientListCard({required this.patient, required this.ref});

  @override
  State<_PatientListCard> createState() => _PatientListCardState();
}

class _PatientListCardState extends State<_PatientListCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnim;
  int? _liveHr;
  int? _liveRr;

  @override
  void initState() {
    super.initState();
    _liveHr = widget.patient.hr;
    _liveRr = widget.patient.rr;

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _pulseAnim = Tween<double>(begin: 1.0, end: 1.04).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    if (widget.patient.status == _CardStatus.alertActive) {
      _pulseController.repeat(reverse: true);
    }

    widget.ref
        .read(vitalsSocketServiceProvider)
        .vitalsStream(widget.patient.id)
        .listen((v) {
      if (!mounted) return;
      setState(() {
        _liveHr = v.hr;
        _liveRr = v.rr;
      });
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Color get _borderColor {
    switch (widget.patient.status) {
      case _CardStatus.alertActive:
        return AppColors.alertActive;
      case _CardStatus.anomalyWarning:
        return AppColors.alertWarning;
      case _CardStatus.systemOffline:
        return AppColors.alertOffline;
      case _CardStatus.ok:
        return AppColors.alertOk;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: _pulseAnim,
      child: Card(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: _borderColor, width: 1.5),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () =>
              context.push('/caregiver/patient/${widget.patient.id}'),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                  radius: 24,
                  child: Text(
                    widget.patient.name[0].toUpperCase(),
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.patient.name,
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${widget.patient.age}y · ${widget.patient.room}',
                        style: const TextStyle(
                            fontSize: 13, color: Color(0xFF777777)),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          _VitalChip(
                              label:
                                  '${_liveHr ?? '--'} BPM'),
                          const SizedBox(width: 6),
                          _VitalChip(
                              label:
                                  '${_liveRr ?? '--'} BRPM'),
                          const SizedBox(width: 6),
                          _SleepChip(label: widget.patient.sleepQuality),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _StatusDot(status: widget.patient.status),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _VitalChip extends StatelessWidget {
  final String label;
  const _VitalChip({required this.label});

  @override
  Widget build(BuildContext context) => Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: const Color(0xFFF0F4FF),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(label,
            style: const TextStyle(
                fontSize: 12, color: AppColors.primary)),
      );
}

class _SleepChip extends StatelessWidget {
  final String label;
  const _SleepChip({required this.label});

  @override
  Widget build(BuildContext context) => Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: const Color(0xFFF3E5F5),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(label,
            style: const TextStyle(
                fontSize: 12, color: Color(0xFF7B1FA2))),
      );
}

class _StatusDot extends StatelessWidget {
  final _CardStatus status;
  const _StatusDot({required this.status});

  Color get color {
    switch (status) {
      case _CardStatus.alertActive:
        return AppColors.alertActive;
      case _CardStatus.anomalyWarning:
        return AppColors.alertWarning;
      case _CardStatus.systemOffline:
        return AppColors.alertOffline;
      case _CardStatus.ok:
        return AppColors.alertOk;
    }
  }

  @override
  Widget build(BuildContext context) => Container(
        width: 12,
        height: 12,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      );
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_tts/flutter_tts.dart';

import '../../core/network/socket_service.dart';
import '../../shared/theme/app_theme.dart';

class FallGraceScreen extends ConsumerStatefulWidget {
  final String alertId;
  const FallGraceScreen({super.key, required this.alertId});

  @override
  ConsumerState<FallGraceScreen> createState() => _FallGraceScreenState();
}

class _FallGraceScreenState extends ConsumerState<FallGraceScreen>
    with SingleTickerProviderStateMixin {
  static const _totalSeconds = 10;

  late final AnimationController _controller;
  late final Timer _timer;
  late final StreamSubscription<AlertStateChange> _alertSub;
  int _remaining = _totalSeconds;
  final FlutterTts _tts = FlutterTts();

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: _totalSeconds),
    )..forward();

    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() => _remaining--);
      if (_remaining <= 0) {
        t.cancel();
        if (mounted) Navigator.of(context).pop();
      }
    });

    // Auto-dismiss if the sensor voice "I'm okay" cancels the alert first
    _alertSub = ref
        .read(vitalsSocketServiceProvider)
        .alertStream
        .where((e) =>
            e.alertId == widget.alertId &&
            e.state == 'cancelled_by_user')
        .listen((_) => _dismiss());

    _speakPrompt();
  }

  void _dismiss() {
    _timer.cancel();
    _controller.stop();
    _tts.stop();
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _speakPrompt() async {
    await _tts.setLanguage('en-US');
    await _tts.setSpeechRate(0.45);
    await _tts.speak(
        'A fall was detected. Tap the button if you are okay.');
  }

  void _cancelAlert() {
    _timer.cancel();
    _controller.stop();
    _tts.stop();

    ref.read(vitalsSocketServiceProvider).emitAlertCancel(
          widget.alertId,
          onAck: (_) {},
        );

    if (mounted) Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _timer.cancel();
    _alertSub.cancel();
    _controller.dispose();
    _tts.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFF1A1A2E),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.warning_amber_rounded,
                    size: 56, color: Colors.amber),
                const SizedBox(height: 16),
                const Text(
                  'Fall Detected',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Are you okay? Tap below to cancel the alert.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white70, fontSize: 18),
                ),
                const Spacer(),
                AnimatedBuilder(
                  animation: _controller,
                  builder: (_, __) => SizedBox(
                    width: 180,
                    height: 180,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        SizedBox(
                          width: 180,
                          height: 180,
                          child: CircularProgressIndicator(
                            value: 1 - _controller.value,
                            strokeWidth: 10,
                            color: Colors.amber,
                            backgroundColor: Colors.white24,
                          ),
                        ),
                        Text(
                          '$_remaining',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 64,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const Spacer(),
                SizedBox(
                  height: 80,
                  child: ElevatedButton(
                    onPressed: _cancelAlert,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.vitalNormal,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      textStyle: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    child: const Text("I'm OK — Cancel Alert"),
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

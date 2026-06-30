import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:livekit_client/livekit_client.dart';

import '../../core/network/api_client.dart';
import '../../shared/theme/app_theme.dart';

class IntercomScreen extends ConsumerStatefulWidget {
  final String roomToken;
  const IntercomScreen({super.key, required this.roomToken});

  @override
  ConsumerState<IntercomScreen> createState() => _IntercomScreenState();
}

class _IntercomScreenState extends ConsumerState<IntercomScreen>
    with TickerProviderStateMixin {
  static const _livekitUrl = String.fromEnvironment(
    'LIVEKIT_URL',
    defaultValue: 'ws://localhost:7880',
  );

  Room? _room;
  LocalAudioTrack? _audioTrack;
  bool _isMuted = false;
  bool _isConnecting = true;
  String? _error;

  late final Stopwatch _callwatch;
  late final Timer _durationTimer;
  String _elapsedLabel = '00:00';

  // Waveform animation
  late final AnimationController _waveController;
  final _random = Random();
  List<double> _waveAmplitudes = List.generate(20, (_) => 0.2);

  @override
  void initState() {
    super.initState();
    _callwatch = Stopwatch()..start();
    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    )..addListener(_updateWave);
    _waveController.repeat();
    _durationTimer =
        Timer.periodic(const Duration(seconds: 1), (_) => _updateDuration());
    _connect();
  }

  void _updateWave() {
    if (!_isMuted) {
      setState(() {
        _waveAmplitudes = List.generate(
          20,
          (_) => 0.1 + _random.nextDouble() * 0.9,
        );
      });
    }
  }

  void _updateDuration() {
    if (!mounted) return;
    final elapsed = _callwatch.elapsed;
    final m = elapsed.inMinutes.toString().padLeft(2, '0');
    final s = (elapsed.inSeconds % 60).toString().padLeft(2, '0');
    setState(() => _elapsedLabel = '$m:$s');
  }

  Future<void> _connect() async {
    try {
      _room = Room();
      await _room!.connect(_livekitUrl, widget.roomToken);
      _audioTrack = await LocalAudioTrack.create();
      await _room!.localParticipant?.publishAudioTrack(_audioTrack!);
      if (mounted) setState(() => _isConnecting = false);
    } on ConnectException {
      if (mounted) {
        setState(() {
          _isConnecting = false;
          _error = 'Room has expired. The alert may have already been resolved.';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isConnecting = false;
          _error = 'Failed to connect: ${e.toString()}';
        });
      }
    }
  }

  void _toggleMute() {
    setState(() => _isMuted = !_isMuted);
    _audioTrack?.mute();
    if (!_isMuted) {
      _audioTrack?.unmute();
    }
  }

  Future<void> _endCall() async {
    _callwatch.stop();
    _durationTimer.cancel();
    _waveController.stop();

    try {
      final client = ref.read(apiClientProvider);
      await client.post('/intercom/sessions', {
        'livekitRoomToken': widget.roomToken,
        'durationSeconds': _callwatch.elapsed.inSeconds,
      });
    } catch (_) {}

    await _room?.disconnect();
    if (mounted) Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _durationTimer.cancel();
    _waveController.dispose();
    _room?.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isConnecting) {
      return const Scaffold(
        backgroundColor: Color(0xFF1A1A2E),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: Colors.white),
              SizedBox(height: 24),
              Text('Connecting to room…',
                  style: TextStyle(color: Colors.white70, fontSize: 18)),
            ],
          ),
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        backgroundColor: const Color(0xFF1A1A2E),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline,
                    color: AppColors.error, size: 56),
                const SizedBox(height: 16),
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70, fontSize: 16),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Go Back'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Live Audio Channel',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _elapsedLabel,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: Colors.white54, fontSize: 32, fontFamily: 'monospace'),
              ),
              const Spacer(),
              // Waveform visualiser
              SizedBox(
                height: 80,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: _waveAmplitudes
                      .map((amp) => AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            width: 6,
                            height: _isMuted ? 6 : (amp * 70).clamp(6, 70),
                            decoration: BoxDecoration(
                              color: _isMuted
                                  ? Colors.white24
                                  : AppColors.primary,
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ))
                      .toList(),
                ),
              ),
              const Spacer(),
              // Mute toggle
              Center(
                child: FloatingActionButton.large(
                  onPressed: _toggleMute,
                  backgroundColor: _isMuted
                      ? AppColors.error
                      : AppColors.primary,
                  child: Icon(
                    _isMuted ? Icons.mic_off : Icons.mic,
                    color: Colors.white,
                    size: 32,
                  ),
                ),
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _endCall,
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(56),
                  backgroundColor: AppColors.alertActive,
                  foregroundColor: Colors.white,
                  textStyle: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w600),
                ),
                child: const Text('End Call'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

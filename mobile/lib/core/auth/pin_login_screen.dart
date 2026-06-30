import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'auth_service.dart';
import '../../shared/theme/app_theme.dart';

class PinLoginScreen extends ConsumerStatefulWidget {
  const PinLoginScreen({super.key});

  @override
  ConsumerState<PinLoginScreen> createState() => _PinLoginScreenState();
}

class _PinLoginScreenState extends ConsumerState<PinLoginScreen>
    with SingleTickerProviderStateMixin {
  String _pin = '';
  bool _isLoading = false;
  String? _errorMessage;
  late AnimationController _shakeController;
  late Animation<double> _shakeAnim;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _shakeAnim = TweenSequence([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: -10.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -10.0, end: 10.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 10.0, end: -10.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: -10.0, end: 0.0), weight: 1),
    ]).animate(CurvedAnimation(parent: _shakeController, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _shakeController.dispose();
    super.dispose();
  }

  Future<void> _onDigit(String digit) async {
    if (_pin.length >= 4 || _isLoading) return;
    final newPin = _pin + digit;
    setState(() {
      _pin = newPin;
      _errorMessage = null;
    });
    if (newPin.length == 4) {
      await _submit(newPin);
    }
  }

  void _onBackspace() {
    if (_pin.isEmpty || _isLoading) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _submit(String pin) async {
    final linkedId =
        ref.read(authStateProvider).value?.linkedPatientId;
    if (linkedId == null) return;

    setState(() => _isLoading = true);
    try {
      await ref.read(authStateProvider.notifier).pinLogin(linkedId, pin);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _pin = '';
        _errorMessage = 'Incorrect PIN. Please try again.';
        _isLoading = false;
      });
      _shakeController.forward(from: 0);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            children: [
              const Spacer(),
              const Icon(Icons.favorite_border_rounded,
                  size: 48, color: AppColors.primary),
              const SizedBox(height: 16),
              Text(
                _greeting(),
                style: Theme.of(context).textTheme.displayMedium?.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'Enter your PIN to continue',
                style: Theme.of(context)
                    .textTheme
                    .bodyLarge
                    ?.copyWith(color: const Color(0xFF777777)),
              ),
              const SizedBox(height: 48),

              // PIN dots
              AnimatedBuilder(
                animation: _shakeAnim,
                builder: (_, child) => Transform.translate(
                  offset: Offset(_shakeAnim.value, 0),
                  child: child,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(4, (i) {
                    final filled = i < _pin.length;
                    return Container(
                      margin: const EdgeInsets.symmetric(horizontal: 12),
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: filled ? AppColors.primary : Colors.transparent,
                        border: Border.all(
                          color: _errorMessage != null
                              ? AppColors.error
                              : AppColors.primary,
                          width: 2.5,
                        ),
                      ),
                    );
                  }),
                ),
              ),

              if (_errorMessage != null) ...[
                const SizedBox(height: 16),
                Text(
                  _errorMessage!,
                  style: const TextStyle(
                      color: AppColors.error, fontSize: 16),
                  textAlign: TextAlign.center,
                ),
              ],

              const Spacer(),

              // Number pad
              if (_isLoading)
                const CircularProgressIndicator()
              else
                _NumPad(onDigit: _onDigit, onBackspace: _onBackspace),

              const SizedBox(height: 24),
              TextButton(
                onPressed: () async {
                  final router = GoRouter.of(context);
                  await ref.read(authStateProvider.notifier).unlinkElderlyDevice();
                  if (mounted) router.go('/login');
                },
                child: const Text(
                  'Not this person?',
                  style: TextStyle(color: Color(0xFF9E9E9E), fontSize: 16),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

class _NumPad extends StatelessWidget {
  final void Function(String) onDigit;
  final VoidCallback onBackspace;

  const _NumPad({required this.onDigit, required this.onBackspace});

  @override
  Widget build(BuildContext context) {
    const digits = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', '⌫'],
    ];

    return Column(
      children: digits.map((row) {
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: row.map((label) {
            if (label.isEmpty) return const SizedBox(width: 80, height: 80);
            return _PadButton(
              label: label,
              onTap: label == '⌫'
                  ? onBackspace
                  : () => onDigit(label),
            );
          }).toList(),
        );
      }).toList(),
    );
  }
}

class _PadButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _PadButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isBackspace = label == '⌫';
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 80,
        height: 80,
        margin: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(40),
          boxShadow: const [
            BoxShadow(
              color: Colors.black12,
              blurRadius: 4,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Center(
          child: isBackspace
              ? const Icon(Icons.backspace_outlined,
                  size: 28, color: Color(0xFF555555))
              : Text(
                  label,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF1A1A1A),
                  ),
                ),
        ),
      ),
    );
  }
}

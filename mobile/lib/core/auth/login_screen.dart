import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'auth_service.dart';
import '../network/api_client.dart';
import '../../shared/theme/app_theme.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    // If device is already linked to an elderly patient, open the PIN tab.
    final linked = ref.read(authStateProvider).value?.linkedPatientId != null;
    _tabController = TabController(length: 2, vsync: this, initialIndex: linked ? 1 : 0);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _showError(Object error) {
    if (!mounted) return;
    final msg = error is AppException
        ? error.message
        : error.toString().replaceFirst('Exception: ', '');
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: AppColors.error,
      behavior: SnackBarBehavior.floating,
    ));
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authStateProvider, (_, next) {
      next.whenOrNull(error: (e, _) => _showError(e));
    });

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 32),
            const Icon(Icons.favorite_border_rounded,
                size: 56, color: AppColors.primary),
            const SizedBox(height: 12),
            Text(
              'Anees',
              style: Theme.of(context).textTheme.displayMedium?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 24),
            TabBar(
              controller: _tabController,
              labelColor: AppColors.primary,
              unselectedLabelColor: const Color(0xFF777777),
              indicatorColor: AppColors.primary,
              tabs: const [
                Tab(icon: Icon(Icons.person_outline), text: 'Caregiver'),
                Tab(icon: Icon(Icons.elderly_outlined), text: 'Elderly'),
              ],
            ),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: const [
                  _CaregiverTab(),
                  _ElderlyTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Caregiver tab (email + password) ─────────────────────────────────────────

class _CaregiverTab extends ConsumerStatefulWidget {
  const _CaregiverTab();

  @override
  ConsumerState<_CaregiverTab> createState() => _CaregiverTabState();
}

class _CaregiverTabState extends ConsumerState<_CaregiverTab> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await ref.read(authStateProvider.notifier).login(
          _emailController.text.trim(),
          _passwordController.text,
        );
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(authStateProvider).isLoading;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(28, 32, 28, 16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Caregiver Sign In',
              textAlign: TextAlign.center,
              style: Theme.of(context)
                  .textTheme
                  .bodyLarge
                  ?.copyWith(color: const Color(0xFF777777)),
            ),
            const SizedBox(height: 32),
            TextFormField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Email',
                prefixIcon: Icon(Icons.email_outlined),
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Email is required';
                if (!v.contains('@')) return 'Enter a valid email';
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _passwordController,
              obscureText: _obscurePassword,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                labelText: 'Password',
                prefixIcon: const Icon(Icons.lock_outline),
                suffixIcon: IconButton(
                  icon: Icon(_obscurePassword
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined),
                  onPressed: () =>
                      setState(() => _obscurePassword = !_obscurePassword),
                ),
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Password is required';
                if (v.length < 8) return 'Password must be at least 8 characters';
                return null;
              },
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: isLoading ? null : _submit,
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                textStyle:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              ),
              child: isLoading
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2.5),
                    )
                  : const Text('Sign In'),
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () => context.push('/register'),
              child: const Text('New caregiver? Register here'),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Elderly tab (account code → PIN pad) ─────────────────────────────────────

class _ElderlyTab extends ConsumerStatefulWidget {
  const _ElderlyTab();

  @override
  ConsumerState<_ElderlyTab> createState() => _ElderlyTabState();
}

class _ElderlyTabState extends ConsumerState<_ElderlyTab>
    with SingleTickerProviderStateMixin {
  String? _resolvedPatientId;
  String? _resolvedPatientName;
  bool _pinSet = true; // assume true for returning users; false = first-time setup needed
  bool _resolvingCode = false;
  final _codeController = TextEditingController();

  // Shared PIN pad state (login + first-time setup both use the numpad)
  String _pin = '';
  String _confirmPin = ''; // used only during first-time setup
  bool _settingConfirm = false; // true = on confirm step of setup
  bool _pinLoading = false;
  String? _pinError;
  late final AnimationController _shakeController;
  late final Animation<double> _shakeAnim;

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
    ]).animate(CurvedAnimation(
        parent: _shakeController, curve: Curves.easeInOut));

    // Returning user — phone already linked, skip code entry
    final linked = ref.read(authStateProvider).value?.linkedPatientId;
    if (linked != null) {
      _resolvedPatientId = linked;
      _pinSet = true;
    }
  }

  @override
  void dispose() {
    _shakeController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _resolveCode() async {
    final code = _codeController.text.trim().toUpperCase();
    if (code.isEmpty) return;
    setState(() => _resolvingCode = true);
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.get(
          '/auth/patient-by-code', queryParameters: {'code': code});
      final patientId = res.data['id'] as String;
      final firstName = res.data['firstName'] as String;
      final lastName = res.data['lastName'] as String;
      final pinSet = res.data['pinSet'] as bool;
      await ref.read(authStateProvider.notifier).linkElderlyDevice(patientId);
      if (mounted) {
        setState(() {
          _resolvedPatientId = patientId;
          _resolvedPatientName = '$firstName $lastName';
          _pinSet = pinSet;
          _pin = '';
          _pinError = null;
          _settingConfirm = false;
        });
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Account code not found. Check with your caregiver.'),
        backgroundColor: AppColors.error,
        behavior: SnackBarBehavior.floating,
      ));
    } finally {
      if (mounted) setState(() => _resolvingCode = false);
    }
  }

  // ── First-time PIN setup ────────────────────────────────────────────────────

  Future<void> _onSetupDigit(String digit) async {
    if (_pinLoading) return;
    if (!_settingConfirm) {
      if (_pin.length >= 4) return;
      final newPin = _pin + digit;
      setState(() { _pin = newPin; _pinError = null; });
      if (newPin.length == 4) {
        // Move to confirm step
        setState(() { _settingConfirm = true; _confirmPin = ''; });
      }
    } else {
      if (_confirmPin.length >= 4) return;
      final newConfirm = _confirmPin + digit;
      setState(() { _confirmPin = newConfirm; _pinError = null; });
      if (newConfirm.length == 4) await _submitSetPin(newConfirm);
    }
  }

  void _onSetupBackspace() {
    if (_pinLoading) return;
    if (_settingConfirm) {
      if (_confirmPin.isNotEmpty) {
        setState(() => _confirmPin = _confirmPin.substring(0, _confirmPin.length - 1));
      } else {
        // Go back to first PIN entry
        setState(() { _settingConfirm = false; _pin = ''; });
      }
    } else {
      if (_pin.isNotEmpty) {
        setState(() => _pin = _pin.substring(0, _pin.length - 1));
      }
    }
  }

  Future<void> _submitSetPin(String confirm) async {
    if (_pin != confirm) {
      setState(() {
        _pinError = 'PINs don\'t match. Try again.';
        _settingConfirm = false;
        _pin = '';
        _confirmPin = '';
      });
      _shakeController.forward(from: 0);
      return;
    }
    final id = _resolvedPatientId;
    if (id == null) return;
    setState(() => _pinLoading = true);
    try {
      await ref.read(authStateProvider.notifier).setPin(id, _pin);
      // Router redirects on success
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _pin = '';
        _confirmPin = '';
        _settingConfirm = false;
        _pinError = 'Could not set PIN. Try again.';
        _pinLoading = false;
      });
      _shakeController.forward(from: 0);
    } finally {
      if (mounted) setState(() => _pinLoading = false);
    }
  }

  // ── Returning-user PIN login ────────────────────────────────────────────────

  Future<void> _onLoginDigit(String digit) async {
    if (_pin.length >= 4 || _pinLoading) return;
    final newPin = _pin + digit;
    setState(() { _pin = newPin; _pinError = null; });
    if (newPin.length == 4) await _submitPin(newPin);
  }

  void _onLoginBackspace() {
    if (_pin.isEmpty || _pinLoading) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _submitPin(String pin) async {
    final id = _resolvedPatientId;
    if (id == null) return;
    setState(() => _pinLoading = true);
    try {
      await ref.read(authStateProvider.notifier).pinLogin(id, pin);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _pin = '';
        _pinError = 'Incorrect PIN. Try again.';
        _pinLoading = false;
      });
      _shakeController.forward(from: 0);
    } finally {
      if (mounted) setState(() => _pinLoading = false);
    }
  }

  void _resetToCodeEntry() async {
    await ref.read(authStateProvider.notifier).unlinkElderlyDevice();
    if (mounted) {
      setState(() {
        _resolvedPatientId = null;
        _resolvedPatientName = null;
        _pinSet = true;
        _pin = '';
        _confirmPin = '';
        _settingConfirm = false;
        _pinError = null;
        _codeController.clear();
      });
    }
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    if (_resolvedPatientId != null) {
      if (!_pinSet) {
        // First time: elderly person sets their own PIN
        return _SetPinView(
          patientName: _resolvedPatientName,
          pin: _settingConfirm ? _confirmPin : _pin,
          isConfirmStep: _settingConfirm,
          pinError: _pinError,
          isLoading: _pinLoading,
          shakeAnim: _shakeAnim,
          onDigit: _onSetupDigit,
          onBackspace: _onSetupBackspace,
          onNotThisPerson: _resetToCodeEntry,
        );
      }
      return _PinPadView(
        greeting: _greeting(),
        patientName: _resolvedPatientName,
        pin: _pin,
        pinError: _pinError,
        isLoading: _pinLoading,
        shakeAnim: _shakeAnim,
        onDigit: _onLoginDigit,
        onBackspace: _onLoginBackspace,
        onNotThisPerson: _resetToCodeEntry,
      );
    }

    return _CodeEntryView(
      codeController: _codeController,
      isLoading: _resolvingCode,
      onSubmit: _resolveCode,
    );
  }
}

// ── Code entry view ───────────────────────────────────────────────────────────

class _CodeEntryView extends StatelessWidget {
  final TextEditingController codeController;
  final bool isLoading;
  final VoidCallback onSubmit;

  const _CodeEntryView({
    required this.codeController,
    required this.isLoading,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(28, 32, 28, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Icon(Icons.elderly_outlined, size: 52, color: AppColors.primary),
          const SizedBox(height: 16),
          Text(
            'Enter Account Code',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'Ask your caregiver for the code they received when setting up your account.',
            textAlign: TextAlign.center,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: const Color(0xFF777777)),
          ),
          const SizedBox(height: 32),
          TextField(
            controller: codeController,
            textCapitalization: TextCapitalization.characters,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => onSubmit(),
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              letterSpacing: 3,
            ),
            decoration: const InputDecoration(
              labelText: 'Account code',
              hintText: 'e.g. HASSAN-4291',
              prefixIcon: Icon(Icons.tag),
            ),
          ),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: isLoading ? null : onSubmit,
            style: ElevatedButton.styleFrom(
              minimumSize: const Size.fromHeight(56),
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              textStyle:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            child: isLoading
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2.5),
                  )
                : const Text('Continue'),
          ),
        ],
      ),
    );
  }
}

// ── First-time PIN setup view ─────────────────────────────────────────────────

class _SetPinView extends StatelessWidget {
  final String? patientName;
  final String pin;
  final bool isConfirmStep;
  final String? pinError;
  final bool isLoading;
  final Animation<double> shakeAnim;
  final void Function(String) onDigit;
  final VoidCallback onBackspace;
  final VoidCallback onNotThisPerson;

  const _SetPinView({
    required this.patientName,
    required this.pin,
    required this.isConfirmStep,
    required this.pinError,
    required this.isLoading,
    required this.shakeAnim,
    required this.onDigit,
    required this.onBackspace,
    required this.onNotThisPerson,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        children: [
          const Spacer(),
          const Icon(Icons.lock_outline, size: 44, color: AppColors.primary),
          const SizedBox(height: 12),
          Text(
            isConfirmStep ? 'Confirm your PIN' : 'Create your PIN',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 6),
          Text(
            isConfirmStep
                ? 'Enter the same 4 digits again'
                : 'Choose a 4-digit PIN you\'ll use to sign in',
            textAlign: TextAlign.center,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: const Color(0xFF777777)),
          ),
          const SizedBox(height: 40),
          AnimatedBuilder(
            animation: shakeAnim,
            builder: (_, child) =>
                Transform.translate(offset: Offset(shakeAnim.value, 0), child: child),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(4, (i) {
                final filled = i < pin.length;
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 12),
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: filled ? AppColors.primary : Colors.transparent,
                    border: Border.all(
                      color: pinError != null ? AppColors.error : AppColors.primary,
                      width: 2.5,
                    ),
                  ),
                );
              }),
            ),
          ),
          if (pinError != null) ...[
            const SizedBox(height: 14),
            Text(
              pinError!,
              style: const TextStyle(color: AppColors.error, fontSize: 15),
              textAlign: TextAlign.center,
            ),
          ],
          const Spacer(),
          if (isLoading)
            const CircularProgressIndicator()
          else
            _NumPad(onDigit: onDigit, onBackspace: onBackspace),
          const SizedBox(height: 16),
          TextButton(
            onPressed: onNotThisPerson,
            child: const Text(
              'Not this person?',
              style: TextStyle(color: Color(0xFF9E9E9E), fontSize: 16),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

// ── PIN pad view ──────────────────────────────────────────────────────────────

class _PinPadView extends StatelessWidget {
  final String greeting;
  final String? patientName;
  final String pin;
  final String? pinError;
  final bool isLoading;
  final Animation<double> shakeAnim;
  final void Function(String) onDigit;
  final VoidCallback onBackspace;
  final VoidCallback onNotThisPerson;

  const _PinPadView({
    required this.greeting,
    required this.patientName,
    required this.pin,
    required this.pinError,
    required this.isLoading,
    required this.shakeAnim,
    required this.onDigit,
    required this.onBackspace,
    required this.onNotThisPerson,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        children: [
          const Spacer(),
          Text(
            greeting,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.bold,
                ),
          ),
          if (patientName != null) ...[
            const SizedBox(height: 4),
            Text(
              patientName!,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(color: const Color(0xFF555555)),
            ),
          ],
          const SizedBox(height: 8),
          Text(
            'Enter your PIN',
            style: Theme.of(context)
                .textTheme
                .bodyLarge
                ?.copyWith(color: const Color(0xFF777777)),
          ),
          const SizedBox(height: 40),

          // PIN dots
          AnimatedBuilder(
            animation: shakeAnim,
            builder: (_, child) =>
                Transform.translate(offset: Offset(shakeAnim.value, 0), child: child),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(4, (i) {
                final filled = i < pin.length;
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 12),
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: filled ? AppColors.primary : Colors.transparent,
                    border: Border.all(
                      color: pinError != null ? AppColors.error : AppColors.primary,
                      width: 2.5,
                    ),
                  ),
                );
              }),
            ),
          ),

          if (pinError != null) ...[
            const SizedBox(height: 14),
            Text(
              pinError!,
              style: const TextStyle(color: AppColors.error, fontSize: 15),
              textAlign: TextAlign.center,
            ),
          ],

          const Spacer(),

          if (isLoading)
            const CircularProgressIndicator()
          else
            _NumPad(onDigit: onDigit, onBackspace: onBackspace),

          const SizedBox(height: 16),
          TextButton(
            onPressed: onNotThisPerson,
            child: const Text(
              'Not this person?',
              style: TextStyle(color: Color(0xFF9E9E9E), fontSize: 16),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

// ── Shared numpad ─────────────────────────────────────────────────────────────

class _NumPad extends StatelessWidget {
  final void Function(String) onDigit;
  final VoidCallback onBackspace;

  const _NumPad({required this.onDigit, required this.onBackspace});

  @override
  Widget build(BuildContext context) {
    const rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', '⌫'],
    ];

    return Column(
      children: rows.map((row) {
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: row.map((label) {
            if (label.isEmpty) return const SizedBox(width: 80, height: 80);
            return _PadButton(
              label: label,
              onTap: label == '⌫' ? onBackspace : () => onDigit(label),
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
            BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2)),
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

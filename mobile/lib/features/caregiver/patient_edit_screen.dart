import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../shared/theme/app_theme.dart';

class PatientEditScreen extends ConsumerStatefulWidget {
  final String patientId;
  final String initialName;
  final String? initialPhone;
  final String? initialLanguage;

  const PatientEditScreen({
    super.key,
    required this.patientId,
    required this.initialName,
    this.initialPhone,
    this.initialLanguage,
  });

  @override
  ConsumerState<PatientEditScreen> createState() => _PatientEditScreenState();
}

class _PatientEditScreenState extends ConsumerState<PatientEditScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  // Profile fields
  late final TextEditingController _firstNameController;
  late final TextEditingController _lastNameController;
  late final TextEditingController _phoneController;
  late String _language;
  bool _savingProfile = false;

  // PIN fields
  final _pinController = TextEditingController();
  final _confirmPinController = TextEditingController();
  bool _obscurePin = true;
  bool _savingPin = false;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);

    final parts = widget.initialName.split(' ');
    _firstNameController = TextEditingController(text: parts.first);
    _lastNameController =
        TextEditingController(text: parts.length > 1 ? parts.sublist(1).join(' ') : '');
    _phoneController = TextEditingController(text: widget.initialPhone ?? '');
    _language = widget.initialLanguage ?? 'ar';
  }

  @override
  void dispose() {
    _tabs.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _pinController.dispose();
    _confirmPinController.dispose();
    super.dispose();
  }

  void _showSnack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? AppColors.error : AppColors.vitalNormal,
      behavior: SnackBarBehavior.floating,
    ));
  }

  Future<void> _saveProfile() async {
    final first = _firstNameController.text.trim();
    final last = _lastNameController.text.trim();
    if (first.isEmpty || last.isEmpty) {
      _showSnack('First and last name are required', error: true);
      return;
    }
    setState(() => _savingProfile = true);
    try {
      final client = ref.read(apiClientProvider);
      await client.patch('/caregiver/patient', {
        'firstName': first,
        'lastName': last,
        'phone': _phoneController.text.trim().isEmpty
            ? null
            : _phoneController.text.trim(),
        'language': _language,
      });
      _showSnack('Profile updated');
      if (mounted) context.pop(true); // pop with refresh signal
    } catch (e) {
      _showSnack(e.toString().replaceFirst('Exception: ', ''), error: true);
    } finally {
      if (mounted) setState(() => _savingProfile = false);
    }
  }

  Future<void> _savePin() async {
    final pin = _pinController.text;
    final confirm = _confirmPinController.text;
    if (pin.length != 4) {
      _showSnack('PIN must be exactly 4 digits', error: true);
      return;
    }
    if (pin != confirm) {
      _showSnack('PINs do not match', error: true);
      return;
    }
    setState(() => _savingPin = true);
    try {
      final client = ref.read(apiClientProvider);
      await client.patch('/caregiver/patient/pin', {'pin': pin});
      _pinController.clear();
      _confirmPinController.clear();
      _showSnack('PIN changed successfully');
    } catch (e) {
      _showSnack(e.toString().replaceFirst('Exception: ', ''), error: true);
    } finally {
      if (mounted) setState(() => _savingPin = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: Text(widget.initialName),
        leading: BackButton(onPressed: () => context.pop()),
        bottom: TabBar(
          controller: _tabs,
          labelColor: AppColors.primary,
          indicatorColor: AppColors.primary,
          tabs: const [
            Tab(text: 'Profile'),
            Tab(text: 'PIN'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _ProfileTab(
            firstNameController: _firstNameController,
            lastNameController: _lastNameController,
            phoneController: _phoneController,
            language: _language,
            onLanguageChanged: (v) => setState(() => _language = v),
            isSaving: _savingProfile,
            onSave: _saveProfile,
          ),
          _PinTab(
            pinController: _pinController,
            confirmPinController: _confirmPinController,
            obscurePin: _obscurePin,
            onToggleObscure: () => setState(() => _obscurePin = !_obscurePin),
            isSaving: _savingPin,
            onSave: _savePin,
          ),
        ],
      ),
    );
  }
}

// ── Profile Tab ───────────────────────────────────────────────────────────────

class _ProfileTab extends StatelessWidget {
  final TextEditingController firstNameController;
  final TextEditingController lastNameController;
  final TextEditingController phoneController;
  final String language;
  final void Function(String) onLanguageChanged;
  final bool isSaving;
  final VoidCallback onSave;

  const _ProfileTab({
    required this.firstNameController,
    required this.lastNameController,
    required this.phoneController,
    required this.language,
    required this.onLanguageChanged,
    required this.isSaving,
    required this.onSave,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: firstNameController,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'First name',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: lastNameController,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Last name',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: phoneController,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.done,
            decoration: const InputDecoration(
              labelText: 'Phone (optional)',
              prefixIcon: Icon(Icons.phone_outlined),
            ),
          ),
          const SizedBox(height: 24),
          Text('Language', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          Row(
            children: [
              _LangChip(
                label: 'Arabic',
                value: 'ar',
                selected: language == 'ar',
                onTap: onLanguageChanged,
              ),
              const SizedBox(width: 8),
              _LangChip(
                label: 'English',
                value: 'en',
                selected: language == 'en',
                onTap: onLanguageChanged,
              ),
            ],
          ),
          const SizedBox(height: 40),
          ElevatedButton(
            onPressed: isSaving ? null : onSave,
            style: ElevatedButton.styleFrom(
              minimumSize: const Size.fromHeight(56),
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              textStyle:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            child: isSaving
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2.5),
                  )
                : const Text('Save Profile'),
          ),
        ],
      ),
    );
  }
}

class _LangChip extends StatelessWidget {
  final String label;
  final String value;
  final bool selected;
  final void Function(String) onTap;

  const _LangChip({
    required this.label,
    required this.value,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(value),
      selectedColor: AppColors.primary,
      labelStyle: TextStyle(color: selected ? Colors.white : null),
    );
  }
}

// ── PIN Tab ───────────────────────────────────────────────────────────────────

class _PinTab extends StatelessWidget {
  final TextEditingController pinController;
  final TextEditingController confirmPinController;
  final bool obscurePin;
  final VoidCallback onToggleObscure;
  final bool isSaving;
  final VoidCallback onSave;

  const _PinTab({
    required this.pinController,
    required this.confirmPinController,
    required this.obscurePin,
    required this.onToggleObscure,
    required this.isSaving,
    required this.onSave,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.07),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, color: AppColors.primary),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'The elderly person uses this 4-digit PIN to sign in on their phone.',
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(color: AppColors.primary),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          TextField(
            controller: pinController,
            keyboardType: TextInputType.number,
            obscureText: obscurePin,
            maxLength: 4,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              labelText: 'New 4-digit PIN',
              prefixIcon: const Icon(Icons.pin_outlined),
              counterText: '',
              suffixIcon: IconButton(
                icon: Icon(obscurePin
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined),
                onPressed: onToggleObscure,
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: confirmPinController,
            keyboardType: TextInputType.number,
            obscureText: obscurePin,
            maxLength: 4,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            textInputAction: TextInputAction.done,
            decoration: const InputDecoration(
              labelText: 'Confirm PIN',
              prefixIcon: Icon(Icons.pin_outlined),
              counterText: '',
            ),
          ),
          const SizedBox(height: 40),
          ElevatedButton(
            onPressed: isSaving ? null : onSave,
            style: ElevatedButton.styleFrom(
              minimumSize: const Size.fromHeight(56),
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              textStyle:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            child: isSaving
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2.5),
                  )
                : const Text('Change PIN'),
          ),
        ],
      ),
    );
  }
}

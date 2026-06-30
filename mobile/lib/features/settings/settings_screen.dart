import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_service.dart';
import '../../shared/theme/app_theme.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authAsync = ref.watch(authStateProvider);
    final auth = authAsync.value;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // ── Profile card ──────────────────────────────────────
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    const CircleAvatar(
                      radius: 28,
                      backgroundColor: Color(0x1F1A73E8),
                      child: Icon(
                        Icons.person_outline,
                        size: 30,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _roleLabel(auth?.role),
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          auth?.userId != null
                              ? 'ID: ${auth!.userId!.substring(0, 8)}…'
                              : '—',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 24),

            // ── Section: App ──────────────────────────────────────
            const _SectionHeader(label: 'App'),
            _SettingsTile(
              icon: Icons.notifications_outlined,
              label: 'Notifications',
              trailing: Switch(
                value: true,
                onChanged: (_) {},
                activeThumbColor: AppColors.primary,
              ),
            ),
            _SettingsTile(
              icon: Icons.language_outlined,
              label: 'Language',
              trailing: Text(
                'English',
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: AppColors.primary),
              ),
            ),
            _SettingsTile(
              icon: Icons.info_outline,
              label: 'App version',
              trailing: Text(
                '1.0.0',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),

            const SizedBox(height: 24),

            // ── Section: Caregiver ────────────────────────────────
            if (auth?.role == 'caregiver') ...[
              const _SectionHeader(label: 'Caregiver'),
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: const Icon(Icons.elderly_outlined,
                      color: AppColors.primary, size: 24),
                  title: Text('Set up elderly phone',
                      style: Theme.of(context).textTheme.bodyLarge),
                  subtitle: const Text('Link another device with an account code'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/caregiver/onboarding'),
                ),
              ),
              if (auth?.linkedPatientId != null)
                Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: const Icon(Icons.link_off,
                        color: AppColors.alertWarning, size: 24),
                    title: Text('Unlink elderly device',
                        style: Theme.of(context).textTheme.bodyLarge),
                    subtitle: Text('Patient ID: ${auth!.linkedPatientId!.substring(0, 8)}…'),
                    onTap: () async {
                      final confirmed = await showDialog<bool>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          title: const Text('Unlink device?'),
                          content: const Text(
                              'This phone will no longer log in as the linked patient.'),
                          actions: [
                            TextButton(
                                onPressed: () => Navigator.pop(ctx, false),
                                child: const Text('Cancel')),
                            TextButton(
                                onPressed: () => Navigator.pop(ctx, true),
                                child: const Text('Unlink',
                                    style: TextStyle(color: AppColors.alertWarning))),
                          ],
                        ),
                      );
                      if (confirmed == true && context.mounted) {
                        await ref.read(authStateProvider.notifier).unlinkElderlyDevice();
                      }
                    },
                  ),
                ),
              const SizedBox(height: 24),
            ],

            // ── Section: Account ──────────────────────────────────
            const _SectionHeader(label: 'Account'),

            const SizedBox(height: 12),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                icon: const Icon(Icons.logout),
                label: const Text(
                  'Sign out',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                ),
                onPressed: () async {
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('Sign out?'),
                      content: const Text(
                        'You will need to sign in again to view your health data.',
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('Cancel'),
                        ),
                        TextButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text(
                            'Sign out',
                            style: TextStyle(color: AppColors.error),
                          ),
                        ),
                      ],
                    ),
                  );
                  if (confirmed == true && context.mounted) {
                    await ref.read(authStateProvider.notifier).logout();
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _roleLabel(String? role) {
    switch (role) {
      case 'care_receiver':
        return 'Patient';
      case 'caregiver':
        return 'Caregiver';
      case 'admin':
        return 'Admin';
      default:
        return 'User';
    }
  }
}

class _SectionHeader extends StatelessWidget {
  final String label;
  const _SectionHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        label.toUpperCase(),
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: const Color(0xFF9E9E9E),
            ),
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Widget trailing;

  const _SettingsTile({
    required this.icon,
    required this.label,
    required this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: AppColors.primary, size: 24),
        title: Text(
          label,
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        trailing: trailing,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      ),
    );
  }
}

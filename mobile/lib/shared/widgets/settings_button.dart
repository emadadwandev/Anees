import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class SettingsButton extends StatelessWidget implements PreferredSizeWidget {
  const SettingsButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Settings',
      icon: const Icon(Icons.settings_outlined, size: 26),
      onPressed: () => context.push('/settings'),
    );
  }

  @override
  Size get preferredSize => const Size(48, 48);
}

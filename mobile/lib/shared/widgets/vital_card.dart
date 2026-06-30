import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class VitalCard extends StatelessWidget {
  final String label;
  final String value;
  final String unit;
  final String? description;
  final Color? backgroundColor;
  final bool largeMode;

  const VitalCard({
    super.key,
    required this.label,
    required this.value,
    required this.unit,
    this.description,
    this.backgroundColor,
    this.largeMode = false,
  });

  @override
  Widget build(BuildContext context) {
    final valueFontSize = largeMode ? 48.0 : 28.0;
    final labelFontSize = largeMode ? 18.0 : 14.0;
    final unitFontSize = largeMode ? 16.0 : 12.0;

    return Card(
      color: backgroundColor ?? Colors.white,
      child: Padding(
        padding: EdgeInsets.all(largeMode ? 24.0 : 16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: labelFontSize,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF555555),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    fontSize: valueFontSize,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF1A1A1A),
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  unit,
                  style: TextStyle(
                    fontSize: unitFontSize,
                    fontWeight: FontWeight.w500,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
            if (description != null) ...[
              const SizedBox(height: 8),
              Text(
                description!,
                style: TextStyle(
                  fontSize: largeMode ? 16.0 : 12.0,
                  color: const Color(0xFF777777),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

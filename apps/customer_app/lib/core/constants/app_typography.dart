import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppTypography {
  AppTypography._();

  static const TextStyle display = TextStyle(fontSize: 32, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.5, height: 1.2);
  static const TextStyle heading1 = TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.3, height: 1.25);
  static const TextStyle heading2 = TextStyle(fontSize: 22, fontWeight: FontWeight.w600, color: AppColors.textPrimary, letterSpacing: -0.2, height: 1.3);
  static const TextStyle heading3 = TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.textPrimary, height: 1.35);
  static const TextStyle body = TextStyle(fontSize: 16, fontWeight: FontWeight.w400, color: AppColors.textPrimary, height: 1.5);
  static const TextStyle bodyMedium = TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: AppColors.textPrimary, height: 1.5);
  static const TextStyle bodySm = TextStyle(fontSize: 14, fontWeight: FontWeight.w400, color: AppColors.textSecondary, height: 1.5);
  static const TextStyle label = TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textPrimary, height: 1.4);
  static const TextStyle caption = TextStyle(fontSize: 12, fontWeight: FontWeight.w400, color: AppColors.textMuted, height: 1.4, letterSpacing: 0.2);
  static const TextStyle price = TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.5);
}

class AppSpacing {
  AppSpacing._();
  static const double xs = 4, sm = 8, md = 12, lg = 16, xl = 20, xxl = 24, xxxl = 32, huge = 48;
  static const double screenPadding = 24, cardPadding = 20, buttonHeight = 56;
  static const double radiusXs = 8, radiusSm = 12, radiusMd = 16, radiusLg = 20, radiusXl = 24, radiusFull = 100;
}

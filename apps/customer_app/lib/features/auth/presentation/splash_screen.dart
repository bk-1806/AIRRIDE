import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_typography.dart';
import '../../../providers/auth_provider.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});
  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _navigate();
  }

  Future<void> _navigate() async {
    await Future.delayed(const Duration(milliseconds: 2500));
    if (!mounted) return;
    final user = ref.read(authStateProvider).value;
    context.go(user != null ? '/home' : '/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primary,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 88, height: 88,
              decoration: BoxDecoration(
                color: AppColors.accent.withOpacity(0.15),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(Icons.flight_takeoff_rounded, color: AppColors.accent, size: 44),
            )
            .animate()
            .fadeIn(duration: 600.ms)
            .slideY(begin: 0.3, end: 0, duration: 600.ms, curve: Curves.easeOut),

            const SizedBox(height: 28),

            Text('AIRRIDE', style: AppTypography.display.copyWith(color: Colors.white, letterSpacing: 5, fontWeight: FontWeight.w800))
            .animate(delay: 200.ms).fadeIn(duration: 600.ms),

            const SizedBox(height: 8),

            Text('Premium Airport Transfers', style: AppTypography.bodySm.copyWith(color: Colors.white.withOpacity(0.5), letterSpacing: 1.5))
            .animate(delay: 400.ms).fadeIn(),

            const SizedBox(height: 80),

            SizedBox(
              width: 24, height: 24,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent.withOpacity(0.6)),
            ).animate(delay: 800.ms).fadeIn(),
          ],
        ),
      ),
    );
  }
}

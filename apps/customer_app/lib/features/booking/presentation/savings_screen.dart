import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_typography.dart';

class SavingsScreen extends ConsumerStatefulWidget {
  const SavingsScreen({super.key});
  @override
  ConsumerState<SavingsScreen> createState() => _SavingsScreenState();
}

class _SavingsScreenState extends ConsumerState<SavingsScreen> {
  bool _show = false;
  @override
  void initState() { super.initState(); Future.delayed(const Duration(milliseconds: 800), () { if (mounted) setState(() => _show = true); }); }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.background,
    appBar: AppBar(title: const Text('Great Savings!'), leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20), onPressed: () => context.pop())),
    body: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(children: [
        const SizedBox(height: 24),
        Container(
          width: double.infinity, padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(gradient: AppColors.accentGradient, borderRadius: BorderRadius.circular(20)),
          child: Column(children: [
            const Icon(Icons.savings_outlined, color: Colors.white, size: 48).animate(delay: 200.ms).scale(),
            const SizedBox(height: 16),
            Text("You're saving", style: AppTypography.bodySm.copyWith(color: Colors.white70)),
            const SizedBox(height: 8),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 500),
              child: _show ? Text('₹350', key: const ValueKey('amt'), style: AppTypography.display.copyWith(color: Colors.white, fontSize: 52, fontWeight: FontWeight.w800)) : const SizedBox(height: 60),
            ),
            Text('vs local taxi', style: AppTypography.caption.copyWith(color: Colors.white60)),
          ]),
        ).animate().fadeIn(duration: 600.ms).slideY(begin: 0.3, end: 0),

        const SizedBox(height: 24),
        _CRow(label: 'Local Taxi (estimate)', amount: '₹1,200', airride: false).animate(delay: 300.ms).fadeIn(),
        const Divider(height: 24),
        _CRow(label: 'AIRRIDE (estimated)', amount: '₹850', airride: true).animate(delay: 400.ms).fadeIn(),
        const SizedBox(height: 24),

        ...['✅  Fixed price — no surge pricing', '✅  Professional, vetted drivers', '✅  Flight delay protection', '✅  24/7 customer support'].asMap().entries.map((e) =>
          Padding(padding: const EdgeInsets.only(bottom: 12), child: Align(alignment: Alignment.centerLeft, child: Text(e.value, style: AppTypography.bodySm))).animate(delay: Duration(milliseconds: 500 + e.key * 80)).fadeIn()),

        const Spacer(),
        SizedBox(
          width: double.infinity, height: 56,
          child: ElevatedButton(onPressed: () => context.push('/fare-estimate'), child: const Text('Choose Vehicle', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600))),
        ).animate(delay: 800.ms).fadeIn(),
        const SizedBox(height: 16),
      ]),
    ),
  );
}

class _CRow extends StatelessWidget {
  final String label, amount; final bool airride;
  const _CRow({required this.label, required this.amount, required this.airride});
  @override
  Widget build(BuildContext context) => Row(children: [
    Container(width: 8, height: 8, decoration: BoxDecoration(color: airride ? AppColors.accent : AppColors.textMuted, shape: BoxShape.circle)),
    const SizedBox(width: 12),
    Expanded(child: Text(label, style: AppTypography.body.copyWith(color: airride ? AppColors.textPrimary : AppColors.textSecondary, fontWeight: airride ? FontWeight.w600 : FontWeight.w400, decoration: airride ? null : TextDecoration.lineThrough))),
    Text(amount, style: (airride ? AppTypography.price : AppTypography.body).copyWith(color: airride ? AppColors.accent : AppColors.textMuted, decoration: airride ? null : TextDecoration.lineThrough)),
  ]);
}

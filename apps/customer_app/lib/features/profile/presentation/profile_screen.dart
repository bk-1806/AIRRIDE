import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_typography.dart';
import '../../../providers/auth_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final user = authState.value;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Profile'), leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20), onPressed: () => context.pop())),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Avatar
          Center(child: Column(children: [
            CircleAvatar(
              radius: 44,
              backgroundColor: AppColors.accent,
              child: Text(user?.phoneNumber?.substring(user.phoneNumber!.length - 2) ?? '?', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 12),
            Text(user?.phoneNumber ?? '', style: AppTypography.heading3),
          ])).animate().fadeIn(),

          const SizedBox(height: 32),

          Text('ACCOUNT', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700, letterSpacing: 1)),
          const SizedBox(height: 12),

          _Section(children: [
            _Tile(icon: Icons.person_outline_rounded, label: 'Personal Info', onTap: () {}),
            _Tile(icon: Icons.notifications_outlined, label: 'Notifications', onTap: () {}),
            _Tile(icon: Icons.payment_outlined, label: 'Payment Methods', onTap: () {}),
          ]).animate(delay: 100.ms).fadeIn(),

          const SizedBox(height: 24),
          Text('MORE', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700, letterSpacing: 1)),
          const SizedBox(height: 12),

          _Section(children: [
            _Tile(icon: Icons.help_outline_rounded, label: 'Help & Support', onTap: () {}),
            _Tile(icon: Icons.privacy_tip_outlined, label: 'Privacy Policy', onTap: () {}),
            _Tile(icon: Icons.star_outline_rounded, label: 'Rate AIRRIDE', onTap: () {}),
          ]).animate(delay: 200.ms).fadeIn(),

          const SizedBox(height: 32),

          SizedBox(
            width: double.infinity, height: 56,
            child: OutlinedButton.icon(
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Sign Out', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              style: OutlinedButton.styleFrom(foregroundColor: AppColors.error, side: const BorderSide(color: AppColors.error)),
              onPressed: () async { await ref.read(authNotifierProvider.notifier).signOut(); context.go('/login'); },
            ),
          ).animate(delay: 300.ms).fadeIn(),
          const SizedBox(height: 24),

          Center(child: Text('AIRRIDE v1.0.0 • Made with ❤️ for India', style: AppTypography.caption)).animate(delay: 400.ms).fadeIn(),
          const SizedBox(height: 16),
        ]),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final List<Widget> children;
  const _Section({required this.children});
  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border)),
    child: Column(children: children.asMap().entries.map((e) => Column(children: [e.value, if (e.key < children.length - 1) const Divider(height: 1, indent: 56)])).toList()),
  );
}

class _Tile extends StatelessWidget {
  final IconData icon; final String label; final VoidCallback onTap;
  const _Tile({required this.icon, required this.label, required this.onTap});
  @override
  Widget build(BuildContext context) => ListTile(
    leading: Icon(icon, color: AppColors.textSecondary, size: 22),
    title: Text(label, style: AppTypography.body),
    trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.textMuted),
    onTap: onTap,
  );
}

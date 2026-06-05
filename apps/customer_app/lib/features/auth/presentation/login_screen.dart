import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_typography.dart';
import '../../../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phoneController = TextEditingController();
  String _countryCode = '+91';
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() { _phoneController.dispose(); super.dispose(); }

  Future<void> _sendOtp() async {
    final phone = _phoneController.text.trim();
    if (phone.length < 10) { setState(() => _error = 'Enter a valid 10-digit number'); return; }
    setState(() { _isLoading = true; _error = null; });
    try {
      final fullPhone = '$_countryCode$phone';
      final vId = await ref.read(authNotifierProvider.notifier).sendOtp(fullPhone);
      ref.read(verificationIdProvider.notifier).state = vId;
      if (mounted) context.push('/otp', extra: fullPhone);
    } catch (e) {
      setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Spacer(flex: 2),

              // Logo
              Row(children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(12)),
                  child: const Icon(Icons.flight_takeoff_rounded, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 12),
                Text('AIRRIDE', style: AppTypography.heading1.copyWith(letterSpacing: 2)),
              ]).animate().fadeIn(duration: 500.ms).slideX(begin: -0.2),

              const SizedBox(height: 40),

              Text('Welcome back', style: AppTypography.display)
                  .animate(delay: 100.ms).fadeIn(),

              const SizedBox(height: 8),

              Text('Enter your mobile number to continue', style: AppTypography.bodySm)
                  .animate(delay: 200.ms).fadeIn(),

              const SizedBox(height: 32),

              // Phone input
              Container(
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _error != null ? AppColors.error : AppColors.border),
                ),
                child: Row(children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    decoration: const BoxDecoration(border: Border(right: BorderSide(color: AppColors.border))),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Text('🇮🇳', style: TextStyle(fontSize: 20)),
                      const SizedBox(width: 6),
                      Text(_countryCode, style: AppTypography.bodyMedium),
                      const Icon(Icons.arrow_drop_down, color: AppColors.textMuted, size: 18),
                    ]),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      maxLength: 10,
                      decoration: const InputDecoration(
                        hintText: 'Mobile number',
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        filled: false, counterText: '',
                        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                      ),
                      style: AppTypography.body,
                    ),
                  ),
                ]),
              ).animate(delay: 300.ms).fadeIn(),

              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!, style: AppTypography.caption.copyWith(color: AppColors.error)),
              ],

              const SizedBox(height: 24),

              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _sendOtp,
                  child: _isLoading
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Continue', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ).animate(delay: 400.ms).fadeIn(),

              const Spacer(flex: 3),

              Center(
                child: Text(
                  'By continuing, you agree to our Terms of Service\nand Privacy Policy',
                  style: AppTypography.caption, textAlign: TextAlign.center,
                ),
              ).animate(delay: 500.ms).fadeIn(),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

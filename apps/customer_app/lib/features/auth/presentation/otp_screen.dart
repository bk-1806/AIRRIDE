import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pinput/pinput.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_typography.dart';
import '../../../providers/auth_provider.dart';

class OtpScreen extends ConsumerStatefulWidget {
  final String phoneNumber;
  const OtpScreen({super.key, required this.phoneNumber});
  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _otpController = TextEditingController();
  bool _isLoading = false;
  String? _error;
  int _timer = 30;

  @override
  void initState() { super.initState(); _startTimer(); }

  void _startTimer() => Future.doWhile(() async {
    await Future.delayed(const Duration(seconds: 1));
    if (!mounted) return false;
    setState(() => _timer--);
    return _timer > 0;
  });

  Future<void> _verify(String code) async {
    if (code.length != 6) return;
    setState(() { _isLoading = true; _error = null; });
    try {
      final vId = ref.read(verificationIdProvider);
      await ref.read(authNotifierProvider.notifier).verifyOtp(vId, code);
      await ref.read(authNotifierProvider.notifier).registerUserInBackend(ref);
      if (mounted) context.go('/home');
    } catch (e) {
      setState(() { _error = 'Incorrect OTP. Please try again.'; });
      _otpController.clear();
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = PinTheme(
      width: 56, height: 60,
      textStyle: AppTypography.heading2,
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 24),
              Text('Verify your\nnumber', style: AppTypography.display).animate().fadeIn(),
              const SizedBox(height: 12),
              Text('We sent a 6-digit code to\n${widget.phoneNumber}', style: AppTypography.bodySm)
                  .animate(delay: 100.ms).fadeIn(),
              const SizedBox(height: 40),

              Center(
                child: Pinput(
                  controller: _otpController,
                  length: 6,
                  defaultPinTheme: theme,
                  focusedPinTheme: theme.copyWith(decoration: theme.decoration!.copyWith(border: Border.all(color: AppColors.accent, width: 1.5))),
                  errorPinTheme: theme.copyWith(decoration: theme.decoration!.copyWith(border: Border.all(color: AppColors.error, width: 1.5))),
                  onCompleted: _verify,
                  hapticFeedbackType: HapticFeedbackType.lightImpact,
                ),
              ).animate(delay: 200.ms).fadeIn().slideY(begin: 0.2, end: 0),

              if (_error != null) ...[
                const SizedBox(height: 12),
                Center(child: Text(_error!, style: AppTypography.caption.copyWith(color: AppColors.error))),
              ],

              const SizedBox(height: 20),

              Center(
                child: _timer > 0
                    ? Text('Resend code in ${_timer}s', style: AppTypography.bodySm)
                    : TextButton(
                        onPressed: () async {
                          setState(() => _timer = 30);
                          _startTimer();
                          final vId = await ref.read(authNotifierProvider.notifier).sendOtp(widget.phoneNumber);
                          ref.read(verificationIdProvider.notifier).state = vId;
                        },
                        child: Text('Resend OTP', style: AppTypography.label.copyWith(color: AppColors.accent)),
                      ),
              ).animate(delay: 300.ms).fadeIn(),

              const Spacer(),

              SizedBox(
                width: double.infinity, height: 56,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : () => _verify(_otpController.text),
                  child: _isLoading
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Verify OTP', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ).animate(delay: 400.ms).fadeIn(),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

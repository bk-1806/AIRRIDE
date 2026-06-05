import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_typography.dart';
import '../../../core/network/api_client.dart';
import '../../../providers/booking_provider.dart';

class BookingConfirmationScreen extends ConsumerStatefulWidget {
  const BookingConfirmationScreen({super.key});
  @override
  ConsumerState<BookingConfirmationScreen> createState() => _BookingConfirmationScreenState();
}

class _BookingConfirmationScreenState extends ConsumerState<BookingConfirmationScreen> {
  bool _loading = false, _booked = false;
  Map<String, dynamic>? _booking;
  String? _error;

  Future<void> _confirm() async {
    setState(() { _loading = true; _error = null; });
    final b = ref.read(bookingProvider);
    final fare = b.fareBreakdown ?? {};
    try {
      final res = await ref.read(apiClientProvider).post('/bookings', data: {
        'vehicleType': b.selectedVehicleType,
        'pickupAddress': b.pickupAddress, 'pickupLat': b.pickupLat, 'pickupLng': b.pickupLng,
        'destinationAddress': b.destinationAddress, 'destinationLat': b.destinationLat, 'destinationLng': b.destinationLng,
        'scheduledAt': b.scheduledAt?.toIso8601String(),
        'baseFare': fare['baseFare'], 'distanceFare': fare['distanceFare'], 'airportSurcharge': fare['airportSurcharge'], 'totalFare': b.totalFare,
        'paymentMethod': b.paymentMethod,
      });
      ref.read(bookingProvider.notifier).setConfirmedBooking(Map<String, dynamic>.from(res.data['booking']));
      setState(() { _booked = true; _booking = res.data['booking']; });
    } catch (e) {
      setState(() => _error = 'Failed to confirm booking. Please try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_booked && _booking != null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 80).animate().scale(duration: 600.ms, curve: Curves.elasticOut),
            const SizedBox(height: 24),
            Text('Booking Confirmed!', style: AppTypography.heading1).animate(delay: 300.ms).fadeIn(),
            const SizedBox(height: 12),
            Text('Your booking reference', style: AppTypography.bodySm).animate(delay: 400.ms).fadeIn(),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
              child: Text(_booking!['booking_ref'] as String, style: AppTypography.heading3.copyWith(letterSpacing: 2)),
            ).animate(delay: 500.ms).fadeIn(),
            const SizedBox(height: 16),
            Text('A driver will be assigned shortly.\nYou will receive a notification.', style: AppTypography.bodySm, textAlign: TextAlign.center).animate(delay: 600.ms).fadeIn(),
            const SizedBox(height: 48),
            SizedBox(width: double.infinity, height: 56, child: ElevatedButton(onPressed: () => context.go('/tracking/${_booking!["id"]}'), child: const Text('Track Ride', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)))).animate(delay: 700.ms).fadeIn(),
            const SizedBox(height: 12),
            SizedBox(width: double.infinity, height: 56, child: OutlinedButton(onPressed: () { ref.read(bookingProvider.notifier).reset(); context.go('/home'); }, child: const Text('Back to Home', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)))).animate(delay: 800.ms).fadeIn(),
          ]),
        )),
      );
    }

    final b = ref.watch(bookingProvider);
    final scheduled = b.scheduledAt != null ? DateFormat('EEE, MMM d • h:mm a').format(b.scheduledAt!) : 'Now';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Confirm Booking'), leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20), onPressed: () => context.pop())),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Route
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border)),
            child: Column(children: [
              _RRow(label: 'From', addr: b.pickupAddress, dot: AppColors.accent),
              const SizedBox(height: 4),
              Container(margin: const EdgeInsets.only(left: 4), width: 1, height: 20, color: AppColors.border),
              const SizedBox(height: 4),
              _RRow(label: 'To', addr: b.destinationAddress, dot: AppColors.textPrimary),
            ]),
          ).animate().fadeIn(),

          const SizedBox(height: 12),

          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border)),
            child: Column(children: [
              _DRow(label: 'Vehicle', value: b.selectedVehicleType ?? '-'),
              const Divider(height: 24),
              _DRow(label: 'Pickup Time', value: scheduled),
              const Divider(height: 24),
              _DRow(label: 'Payment', value: (b.paymentMethod ?? 'cash').toUpperCase()),
              if (b.flightNumber != null) ...[const Divider(height: 24), _DRow(label: 'Flight', value: b.flightNumber!)],
            ]),
          ).animate(delay: 100.ms).fadeIn(),

          const SizedBox(height: 12),

          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(20)),
            child: Row(children: [
              Expanded(child: Text('Total Fare', style: AppTypography.body.copyWith(color: Colors.white70))),
              Text('₹${b.totalFare?.toInt() ?? 0}', style: AppTypography.price.copyWith(color: Colors.white)),
            ]),
          ).animate(delay: 200.ms).fadeIn(),

          if (_error != null) ...[const SizedBox(height: 12), Text(_error!, style: AppTypography.caption.copyWith(color: AppColors.error))],

          const SizedBox(height: 32),

          SizedBox(
            width: double.infinity, height: 56,
            child: ElevatedButton(
              onPressed: _loading ? null : _confirm,
              child: _loading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Confirm Booking', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ).animate(delay: 300.ms).fadeIn(),
          const SizedBox(height: 16),
        ]),
      ),
    );
  }
}

class _RRow extends StatelessWidget {
  final String label, addr; final Color dot;
  const _RRow({required this.label, required this.addr, required this.dot});
  @override
  Widget build(BuildContext context) => Row(children: [
    Container(width: 10, height: 10, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
    const SizedBox(width: 12),
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: AppTypography.caption),
      Text(addr, style: AppTypography.bodyMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
    ])),
  ]);
}

class _DRow extends StatelessWidget {
  final String label, value;
  const _DRow({required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Row(children: [
    Text(label, style: AppTypography.bodySm), const Spacer(), Text(value, style: AppTypography.bodyMedium),
  ]);
}

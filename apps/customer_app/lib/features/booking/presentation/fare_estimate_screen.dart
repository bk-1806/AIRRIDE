import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_typography.dart';
import '../../../core/network/api_client.dart';
import '../../../providers/booking_provider.dart';

class FareEstimateScreen extends ConsumerStatefulWidget {
  const FareEstimateScreen({super.key});
  @override
  ConsumerState<FareEstimateScreen> createState() => _FareEstimateScreenState();
}

class _FareEstimateScreenState extends ConsumerState<FareEstimateScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _fares = [];
  String? _selected;
  String _payment = 'cash';
  double _distance = 0;

  @override
  void initState() { super.initState(); _loadFares(); }

  Future<void> _loadFares() async {
    final b = ref.read(bookingProvider);
    try {
      final res = await ref.read(apiClientProvider).post('/fare/estimate', data: {
        'pickupLat': b.pickupLat, 'pickupLng': b.pickupLng,
        'destinationLat': b.destinationLat, 'destinationLng': b.destinationLng,
        'scheduledAt': b.scheduledAt?.toIso8601String(),
      });
      setState(() { _fares = List<Map<String, dynamic>>.from(res.data['fares']); _distance = (res.data['distanceKm'] ?? 0).toDouble(); _loading = false; });
    } catch (_) {
      // fallback fares
      setState(() {
        _fares = [
          {'vehicleType': 'Sedan', 'baseFare': 300, 'distanceFare': 120, 'airportSurcharge': 100, 'totalFare': 520, 'capacity': 4, 'description': 'Comfortable sedan for up to 4'},
          {'vehicleType': 'SUV', 'baseFare': 450, 'distanceFare': 160, 'airportSurcharge': 100, 'totalFare': 710, 'capacity': 6, 'description': 'Spacious SUV'},
          {'vehicleType': 'Premium Sedan', 'baseFare': 700, 'distanceFare': 220, 'airportSurcharge': 100, 'totalFare': 1020, 'capacity': 4, 'description': 'Luxury experience'},
          {'vehicleType': 'Innova', 'baseFare': 550, 'distanceFare': 180, 'airportSurcharge': 100, 'totalFare': 830, 'capacity': 7, 'description': 'Toyota Innova — groups'},
        ];
        _distance = 12.5; _loading = false;
      });
    }
  }

  IconData _icon(String t) {
    switch (t.toLowerCase()) { case 'suv': return Icons.directions_car_filled_rounded; case 'premium sedan': return Icons.star_rounded; case 'innova': return Icons.airport_shuttle_rounded; default: return Icons.directions_car_rounded; }
  }

  @override
  Widget build(BuildContext context) {
    final booking = ref.watch(bookingProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Choose Vehicle'), leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20), onPressed: () => context.pop())),
      body: Column(children: [
        Container(
          margin: const EdgeInsets.all(24),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
          child: Row(children: [
            const Icon(Icons.route_rounded, color: AppColors.accent, size: 20),
            const SizedBox(width: 12),
            Text('${_distance.toStringAsFixed(1)} km', style: AppTypography.bodyMedium),
            const SizedBox(width: 8),
            Text('• Airport Transfer', style: AppTypography.bodySm),
          ]),
        ),

        Expanded(
          child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
            : ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              itemCount: _fares.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (ctx, i) {
                final f = _fares[i];
                final sel = _selected == f['vehicleType'];
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  decoration: BoxDecoration(
                    color: sel ? AppColors.accentLight : AppColors.card,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: sel ? AppColors.accent : AppColors.border, width: sel ? 1.5 : 1),
                  ),
                  child: InkWell(
                    onTap: () {
                      setState(() => _selected = f['vehicleType'] as String);
                      ref.read(bookingProvider.notifier).setVehicleType(f['vehicleType'] as String);
                      ref.read(bookingProvider.notifier).setTotalFare((f['totalFare'] as num).toDouble());
                      ref.read(bookingProvider.notifier).setFareBreakdown(f);
                    },
                    borderRadius: BorderRadius.circular(20),
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Row(children: [
                        Container(
                          width: 56, height: 56,
                          decoration: BoxDecoration(color: sel ? AppColors.accent : AppColors.cardDark, borderRadius: BorderRadius.circular(12)),
                          child: Icon(_icon(f['vehicleType'] as String), color: sel ? Colors.white : AppColors.textSecondary, size: 28),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(f['vehicleType'] as String, style: AppTypography.bodyMedium),
                          Text('${f['capacity']} seats • ${f['description']}', style: AppTypography.caption),
                        ])),
                        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                          Text('₹${f['totalFare']}', style: AppTypography.price.copyWith(fontSize: 20, color: sel ? AppColors.accent : AppColors.textPrimary)),
                          if (sel) const Icon(Icons.check_circle_rounded, color: AppColors.accent, size: 16),
                        ]),
                      ]),
                    ),
                  ),
                ).animate(delay: Duration(milliseconds: i * 80)).fadeIn();
              },
            ),
        ),

        // Bottom bar
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: AppColors.background, boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -2))]),
          child: Column(children: [
            Row(children: [
              Text('Payment:', style: AppTypography.label),
              const SizedBox(width: 12),
              _Chip(label: 'Cash', icon: Icons.payments_outlined, selected: _payment == 'cash', onTap: () { setState(() => _payment = 'cash'); ref.read(bookingProvider.notifier).setPaymentMethod('cash'); }),
              const SizedBox(width: 8),
              _Chip(label: 'UPI', icon: Icons.account_balance_wallet_outlined, selected: _payment == 'upi', onTap: () { setState(() => _payment = 'upi'); ref.read(bookingProvider.notifier).setPaymentMethod('upi'); }),
            ]),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity, height: 56,
              child: ElevatedButton(
                onPressed: _selected == null ? null : () => context.push('/booking-confirmation'),
                child: Text(
                  _selected == null ? 'Select a vehicle' : 'Book $_selected — ₹${booking.totalFare?.toInt()}',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
            ),
            SizedBox(height: MediaQuery.of(context).padding.bottom),
          ]),
        ),
      ]),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label; final IconData icon; final bool selected; final VoidCallback onTap;
  const _Chip({required this.label, required this.icon, required this.selected, required this.onTap});
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: selected ? AppColors.accentLight : AppColors.card,
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: selected ? AppColors.accent : AppColors.border),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 14, color: selected ? AppColors.accent : AppColors.textMuted),
        const SizedBox(width: 4),
        Text(label, style: AppTypography.caption.copyWith(color: selected ? AppColors.accent : AppColors.textSecondary, fontWeight: FontWeight.w500)),
      ]),
    ),
  );
}

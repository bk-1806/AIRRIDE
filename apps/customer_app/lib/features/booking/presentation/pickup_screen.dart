import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_typography.dart';
import '../../../providers/booking_provider.dart';

class PickupScreen extends ConsumerStatefulWidget {
  const PickupScreen({super.key});
  @override
  ConsumerState<PickupScreen> createState() => _PickupScreenState();
}

class _PickupScreenState extends ConsumerState<PickupScreen> {
  final _ctrl = TextEditingController();
  bool _locating = false;

  final _saved = [
    {'title': 'Home', 'subtitle': '123 MG Road, Bangalore', 'icon': Icons.home_outlined, 'lat': 12.9716, 'lng': 77.5946},
    {'title': 'Office', 'subtitle': 'Whitefield, Bangalore', 'icon': Icons.business_outlined, 'lat': 12.9698, 'lng': 77.7500},
    {'title': 'Kempegowda Intl Airport', 'subtitle': 'BIAL, Devanahalli', 'icon': Icons.local_airport_outlined, 'lat': 13.1979, 'lng': 77.7063},
  ];

  Future<void> _currentLocation() async {
    setState(() => _locating = true);
    try {
      final perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied) return;
      final pos = await Geolocator.getCurrentPosition();
      final marks = await placemarkFromCoordinates(pos.latitude, pos.longitude);
      final addr = marks.isNotEmpty ? '${marks[0].street}, ${marks[0].locality}' : 'Current Location';
      ref.read(bookingProvider.notifier).setPickup(address: addr, lat: pos.latitude, lng: pos.longitude);
      if (mounted) context.push('/destination');
    } catch (_) {} finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  void _select(String addr, double lat, double lng) {
    ref.read(bookingProvider.notifier).setPickup(address: addr, lat: lat, lng: lng);
    context.push('/destination');
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.background,
    appBar: AppBar(title: const Text('Pickup Location'), leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20), onPressed: () => context.pop())),
    body: Column(children: [
      Padding(
        padding: const EdgeInsets.all(24),
        child: TextField(controller: _ctrl, autofocus: true, decoration: const InputDecoration(hintText: 'Search pickup location', prefixIcon: Icon(Icons.search_rounded, color: AppColors.textMuted)), onChanged: (_) => setState(() {})),
      ).animate().fadeIn(duration: 300.ms),

      const Divider(height: 1),

      ListTile(
        leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.accentLight, borderRadius: BorderRadius.circular(12)), child: _locating ? const Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent))) : const Icon(Icons.my_location_rounded, color: AppColors.accent, size: 20)),
        title: Text('Use current location', style: AppTypography.label.copyWith(color: AppColors.accent)),
        subtitle: Text('Auto-detect my location', style: AppTypography.caption),
        onTap: _locating ? null : _currentLocation,
      ).animate(delay: 100.ms).fadeIn(),

      const Divider(height: 1),

      Padding(padding: const EdgeInsets.fromLTRB(24,16,24,8), child: Align(alignment: Alignment.centerLeft, child: Text('SAVED & RECENT', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700, letterSpacing: 1)))),

      Expanded(
        child: ListView.separated(
          itemCount: _saved.length,
          separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
          itemBuilder: (ctx, i) {
            final loc = _saved[i];
            return ListTile(
              leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12)), child: Icon(loc['icon'] as IconData, color: AppColors.textSecondary, size: 20)),
              title: Text(loc['title'] as String, style: AppTypography.bodyMedium),
              subtitle: Text(loc['subtitle'] as String, style: AppTypography.caption),
              onTap: () => _select(loc['subtitle'] as String, loc['lat'] as double, loc['lng'] as double),
            ).animate(delay: Duration(milliseconds: 100 + i * 50)).fadeIn();
          },
        ),
      ),
    ]),
  );
}

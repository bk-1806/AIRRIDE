import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_typography.dart';
import '../../../providers/booking_provider.dart';

class DestinationScreen extends ConsumerStatefulWidget {
  const DestinationScreen({super.key});
  @override
  ConsumerState<DestinationScreen> createState() => _DestinationScreenState();
}

class _DestinationScreenState extends ConsumerState<DestinationScreen> {
  final _ctrl = TextEditingController();

  final _airports = [
    {'name': 'Kempegowda Intl Airport', 'code': 'BLR', 'terminal': 'T1 / T2', 'lat': 13.1979, 'lng': 77.7063},
    {'name': 'Chennai Intl Airport', 'code': 'MAA', 'terminal': 'Domestic / International', 'lat': 12.9941, 'lng': 80.1709},
    {'name': 'Chhatrapati Shivaji Intl', 'code': 'BOM', 'terminal': 'T1 / T2', 'lat': 19.0896, 'lng': 72.8656},
    {'name': 'Indira Gandhi Intl Airport', 'code': 'DEL', 'terminal': 'T1 / T2 / T3', 'lat': 28.5562, 'lng': 77.0999},
  ];

  void _select(String addr, double lat, double lng) {
    ref.read(bookingProvider.notifier).setDestination(address: addr, lat: lat, lng: lng);
    context.push('/datetime');
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.background,
    appBar: AppBar(title: const Text('Destination'), leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20), onPressed: () => context.pop())),
    body: Column(children: [
      Padding(
        padding: const EdgeInsets.all(24),
        child: TextField(controller: _ctrl, autofocus: true, decoration: const InputDecoration(hintText: 'Search destination', prefixIcon: Icon(Icons.search_rounded, color: AppColors.textMuted)), onChanged: (_) => setState(() {})),
      ).animate().fadeIn(),

      const Divider(height: 1),
      Padding(padding: const EdgeInsets.fromLTRB(24,16,24,8), child: Align(alignment: Alignment.centerLeft, child: Text('AIRPORTS', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700, letterSpacing: 1)))),

      ..._airports.asMap().entries.map((e) => Column(children: [
        ListTile(
          leading: Container(width: 44, height: 44, decoration: BoxDecoration(color: AppColors.accentLight, borderRadius: BorderRadius.circular(12)),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.local_airport_rounded, color: AppColors.accent, size: 16),
              Text(e.value['code']! as String, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.accent)),
            ])),
          title: Text(e.value['name']! as String, style: AppTypography.bodyMedium),
          subtitle: Text(e.value['terminal']! as String, style: AppTypography.caption),
          trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.textMuted),
          onTap: () => _select('${e.value["name"]} (${e.value["code"]})', e.value['lat']! as double, e.value['lng']! as double),
        ).animate(delay: Duration(milliseconds: 100 + e.key * 50)).fadeIn(),
        const Divider(height: 1, indent: 72),
      ])),
    ]),
  );
}

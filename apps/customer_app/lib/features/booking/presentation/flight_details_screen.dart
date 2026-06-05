import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_typography.dart';
import '../../../providers/booking_provider.dart';

class FlightDetailsScreen extends ConsumerStatefulWidget {
  const FlightDetailsScreen({super.key});
  @override
  ConsumerState<FlightDetailsScreen> createState() => _FlightDetailsScreenState();
}

class _FlightDetailsScreenState extends ConsumerState<FlightDetailsScreen> {
  final _ctrl = TextEditingController();
  bool _searching = false;
  Map<String, dynamic>? _flight;
  String? _error;

  Future<void> _search() async {
    final fn = _ctrl.text.trim().toUpperCase();
    if (fn.isEmpty) return;
    setState(() { _searching = true; _error = null; _flight = null; });
    await Future.delayed(const Duration(milliseconds: 800));
    setState(() {
      _searching = false;
      _flight = {'flightNumber': fn, 'airline': 'IndiGo', 'origin': 'DEL', 'destination': 'BLR', 'status': 'On Time', 'arrival': '14:30', 'terminal': 'T2', 'gate': 'G12'};
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.background,
    appBar: AppBar(
      title: const Text('Flight Details'),
      leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20), onPressed: () => context.pop()),
      actions: [TextButton(onPressed: () { ref.read(bookingProvider.notifier).setFlightNumber(null); context.push('/savings'); }, child: Text('Skip', style: AppTypography.label.copyWith(color: AppColors.accent)))],
    ),
    body: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const SizedBox(height: 16),
        Text('Track your flight', style: AppTypography.heading2).animate().fadeIn(),
        const SizedBox(height: 8),
        Text("We'll monitor your flight and adjust pickup if delayed", style: AppTypography.bodySm).animate(delay: 100.ms).fadeIn(),
        const SizedBox(height: 32),

        Row(children: [
          Expanded(child: TextField(controller: _ctrl, decoration: const InputDecoration(hintText: 'Flight number (e.g. 6E 2341)', prefixIcon: Icon(Icons.flight_rounded, color: AppColors.textMuted, size: 20)), textCapitalization: TextCapitalization.characters)),
          const SizedBox(width: 12),
          ElevatedButton(
            onPressed: _searching ? null : _search,
            style: ElevatedButton.styleFrom(minimumSize: const Size(60, 56), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
            child: _searching ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.search_rounded, size: 22),
          ),
        ]).animate(delay: 200.ms).fadeIn(),

        if (_flight != null) ...[
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text(_flight!['flightNumber'] as String, style: AppTypography.heading3),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.successLight, borderRadius: BorderRadius.circular(20)),
                  child: Text(_flight!['status'] as String, style: AppTypography.caption.copyWith(color: AppColors.success, fontWeight: FontWeight.w600)),
                ),
              ]),
              const SizedBox(height: 4),
              Text(_flight!['airline'] as String, style: AppTypography.bodySm),
              const Divider(height: 24),
              Row(children: [
                _Info('From', _flight!['origin'] as String),
                const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Icon(Icons.arrow_forward_rounded, color: AppColors.textMuted, size: 16)),
                _Info('To', _flight!['destination'] as String),
                const Spacer(),
                _Info('Arrives', _flight!['arrival'] as String),
                const SizedBox(width: 16),
                _Info('Terminal', _flight!['terminal'] as String),
              ]),
            ]),
          ).animate().fadeIn().slideY(begin: 0.2, end: 0),
        ],

        const Spacer(),

        if (_flight != null)
          SizedBox(
            width: double.infinity, height: 56,
            child: ElevatedButton(
              onPressed: () { ref.read(bookingProvider.notifier).setFlightNumber(_flight!['flightNumber'] as String); context.push('/savings'); },
              child: const Text('Track this flight', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ).animate().fadeIn(),
        const SizedBox(height: 16),
      ]),
    ),
  );
}

class _Info extends StatelessWidget {
  final String label, value;
  const _Info(this.label, this.value);
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(label, style: AppTypography.caption),
    const SizedBox(height: 2),
    Text(value, style: AppTypography.bodyMedium),
  ]);
}

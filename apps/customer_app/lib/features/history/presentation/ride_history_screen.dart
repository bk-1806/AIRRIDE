import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_typography.dart';
import '../../../core/network/api_client.dart';

final _historyProvider = FutureProvider<List<dynamic>>((ref) async {
  try { final res = await ref.read(apiClientProvider).get('/bookings'); return res.data['bookings'] ?? []; }
  catch (_) { return []; }
});

class RideHistoryScreen extends ConsumerWidget {
  const RideHistoryScreen({super.key});

  Color _statusColor(String s) {
    switch (s) { case 'completed': return AppColors.success; case 'cancelled': return AppColors.error; case 'in_progress': return AppColors.accent; default: return AppColors.warning; }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hist = ref.watch(_historyProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Ride History'), leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20), onPressed: () => context.pop())),
      body: hist.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
        error: (e, _) => Center(child: Text('Failed to load history', style: AppTypography.bodySm)),
        data: (bookings) {
          if (bookings.isEmpty) return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.history_rounded, size: 64, color: AppColors.border),
            const SizedBox(height: 16),
            Text('No rides yet', style: AppTypography.heading3.copyWith(color: AppColors.textMuted)),
            const SizedBox(height: 8),
            Text('Book your first airport transfer!', style: AppTypography.bodySm),
            const SizedBox(height: 24),
            ElevatedButton(onPressed: () => context.push('/pickup'), child: const Text('Book a Ride')),
          ]));

          return ListView.separated(
            padding: const EdgeInsets.all(24),
            itemCount: bookings.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (ctx, i) {
              final b = bookings[i] as Map<String, dynamic>;
              final dt = b['created_at'] != null ? DateFormat('MMM d, h:mm a').format(DateTime.parse(b['created_at'])) : '';
              return GestureDetector(
                onTap: () => context.push('/tracking/${b['id']}'),
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: _statusColor(b['status'] as String).withOpacity(0.1), borderRadius: BorderRadius.circular(20)), child: Text((b['status'] as String).replaceAll('_', ' ').toUpperCase(), style: AppTypography.caption.copyWith(color: _statusColor(b['status'] as String), fontWeight: FontWeight.w700))),
                      const Spacer(),
                      Text(dt, style: AppTypography.caption),
                    ]),
                    const Divider(height: 16),
                    Text(b['pickup_address'] as String? ?? '', style: AppTypography.bodySm, maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    Text(b['destination_address'] as String? ?? '', style: AppTypography.bodyMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
                    const Divider(height: 16),
                    Row(children: [
                      Text(b['vehicle_type'] as String? ?? '', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w500)),
                      const Spacer(),
                      Text('₹${b['total_fare'] ?? 0}', style: AppTypography.price.copyWith(fontSize: 18)),
                    ]),
                  ]),
                ).animate(delay: Duration(milliseconds: i * 60)).fadeIn(),
              );
            },
          );
        },
      ),
    );
  }
}

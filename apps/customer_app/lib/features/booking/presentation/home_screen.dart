import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_typography.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});
  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  GoogleMapController? _mapController;

  static const _initPos = CameraPosition(target: LatLng(12.9716, 77.5946), zoom: 13);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Full-screen map
          GoogleMap(
            initialCameraPosition: _initPos,
            onMapCreated: (c) => _mapController = c,
            myLocationEnabled: true,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
          ),

          // Top bar
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(100)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.flight_takeoff_rounded, color: AppColors.accent, size: 16),
                      const SizedBox(width: 6),
                      Text('AIRRIDE', style: AppTypography.label.copyWith(color: Colors.white, letterSpacing: 1.5)),
                    ]),
                  ),
                  const Spacer(),
                  _TopBtn(icon: Icons.notifications_none_rounded, onTap: () {}),
                  const SizedBox(width: 8),
                  _TopBtn(icon: Icons.person_outline_rounded, onTap: () => context.push('/profile')),
                ],
              ),
            ),
          ),

          // Bottom booking sheet
          Positioned(
            bottom: 0, left: 0, right: 0,
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 20, offset: const Offset(0, -4))],
              ),
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
                  const SizedBox(height: 20),
                  Text('Good day! 👋', style: AppTypography.bodySm),
                  const SizedBox(height: 4),
                  Text('Where to?', style: AppTypography.heading1),
                  const SizedBox(height: 16),

                  // Search bar
                  GestureDetector(
                    onTap: () => context.push('/pickup'),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(children: [
                        Container(width: 10, height: 10, decoration: BoxDecoration(color: AppColors.accent, shape: BoxShape.circle, border: Border.all(color: AppColors.accentLight, width: 3))),
                        const SizedBox(width: 12),
                        Text('Enter pickup location', style: AppTypography.body.copyWith(color: AppColors.textMuted)),
                        const Spacer(),
                        const Icon(Icons.search_rounded, color: AppColors.textMuted, size: 20),
                      ]),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Quick actions
                  Row(children: [
                    _QuickAction(icon: Icons.flight_land_rounded, label: 'Airport\nDrop', onTap: () => context.push('/pickup')),
                    const SizedBox(width: 12),
                    _QuickAction(icon: Icons.flight_takeoff_rounded, label: 'Airport\nPickup', onTap: () => context.push('/pickup')),
                    const SizedBox(width: 12),
                    _QuickAction(icon: Icons.history_rounded, label: 'History', onTap: () => context.push('/history')),
                  ]),

                  const SizedBox(height: 16),

                  // Airport promo banner
                  GestureDetector(
                    onTap: () => context.push('/pickup'),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: AppColors.accentGradient,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(children: [
                        const Icon(Icons.local_airport_rounded, color: Colors.white, size: 22),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('Book Airport Transfer', style: AppTypography.label.copyWith(color: Colors.white)),
                          Text('Pre-book your ride — fixed price, no surprises', style: AppTypography.caption.copyWith(color: Colors.white.withOpacity(0.8))),
                        ])),
                        const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 14),
                      ]),
                    ),
                  ).animate(delay: 200.ms).fadeIn().slideY(begin: 0.2, end: 0),

                  SizedBox(height: MediaQuery.of(context).padding.bottom + 8),
                ],
              ),
            ),
          ).animate().slideY(begin: 1, end: 0, duration: 500.ms, curve: Curves.easeOut),
        ],
      ),
    );
  }
}

class _TopBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _TopBtn({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      width: 44, height: 44,
      decoration: BoxDecoration(
        color: Colors.white, shape: BoxShape.circle,
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 8)],
      ),
      child: Icon(icon, color: AppColors.primary, size: 20),
    ),
  );
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _QuickAction({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => Expanded(
    child: GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(children: [
          Icon(icon, color: AppColors.accent, size: 22),
          const SizedBox(height: 4),
          Text(label, style: AppTypography.caption.copyWith(color: AppColors.textSecondary), textAlign: TextAlign.center, maxLines: 2),
        ]),
      ),
    ),
  );
}

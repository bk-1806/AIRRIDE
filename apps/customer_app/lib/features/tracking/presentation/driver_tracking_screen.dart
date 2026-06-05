import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_typography.dart';
import '../../../core/network/api_client.dart';

class DriverTrackingScreen extends ConsumerStatefulWidget {
  final String bookingId;
  const DriverTrackingScreen({super.key, required this.bookingId});
  @override
  ConsumerState<DriverTrackingScreen> createState() => _DriverTrackingScreenState();
}

class _DriverTrackingScreenState extends ConsumerState<DriverTrackingScreen> {
  GoogleMapController? _mapCtrl;
  IO.Socket? _socket;
  Set<Marker> _markers = {};
  String _status = 'Driver is on the way';
  Map<String, dynamic>? _booking;

  static const _init = CameraPosition(target: LatLng(12.9716, 77.5946), zoom: 14);

  @override
  void initState() { super.initState(); _loadBooking(); _connect(); }

  Future<void> _loadBooking() async {
    try {
      final res = await ref.read(apiClientProvider).get('/bookings/${widget.bookingId}');
      setState(() => _booking = res.data['booking']);
    } catch (_) {}
  }

  void _connect() {
    _socket = IO.io('http://10.0.2.2:3000', <String, dynamic>{'transports': ['websocket']});
    _socket!.connect();
    _socket!.emit('join_booking_room', {'bookingId': widget.bookingId});
    _socket!.on('driver_location_update', (data) {
      final pos = LatLng((data['lat'] as num).toDouble(), (data['lng'] as num).toDouble());
      setState(() { _markers = {Marker(markerId: const MarkerId('driver'), position: pos, icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue), infoWindow: const InfoWindow(title: 'Your Driver'))}; });
      _mapCtrl?.animateCamera(CameraUpdate.newLatLng(pos));
    });
    _socket!.on('booking_status_update', (data) {
      setState(() { switch(data['status']) { case 'in_progress': _status = 'Trip in progress'; break; case 'completed': _status = 'Trip completed! 🎉'; break; default: _status = 'Driver is on the way'; } });
    });
  }

  @override
  void dispose() { _socket?.disconnect(); _mapCtrl?.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Stack(children: [
      GoogleMap(initialCameraPosition: _init, onMapCreated: (c) => _mapCtrl = c, markers: _markers, myLocationEnabled: true, myLocationButtonEnabled: false, zoomControlsEnabled: false),

      SafeArea(child: Padding(padding: const EdgeInsets.all(16), child: GestureDetector(
        onTap: () => context.go('/home'),
        child: Container(width: 44, height: 44, decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 8)]), child: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: AppColors.primary)),
      ))),

      Positioned(
        bottom: 0, left: 0, right: 0,
        child: Container(
          decoration: const BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            Row(children: [Container(width: 12, height: 12, decoration: const BoxDecoration(color: AppColors.success, shape: BoxShape.circle)), const SizedBox(width: 8), Text(_status, style: AppTypography.bodyMedium)]),
            const SizedBox(height: 16),
            if (_booking != null) Row(children: [
              CircleAvatar(radius: 24, backgroundColor: AppColors.accent, child: Text((_booking!['driver_name'] as String? ?? 'D').substring(0, 1), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18))),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_booking!['driver_name'] as String? ?? 'Assigned Driver', style: AppTypography.bodyMedium),
                Text(_booking!['license_plate'] as String? ?? '', style: AppTypography.caption),
              ])),
              Container(width: 44, height: 44, decoration: const BoxDecoration(color: AppColors.accentLight, shape: BoxShape.circle), child: const Icon(Icons.call_rounded, color: AppColors.accent, size: 20)),
            ]),
            SizedBox(height: MediaQuery.of(context).padding.bottom + 8),
          ]),
        ),
      ),
    ]),
  );
}

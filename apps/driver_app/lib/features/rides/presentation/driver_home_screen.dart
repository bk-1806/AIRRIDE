import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:intl/intl.dart';

class DriverHomeScreen extends ConsumerStatefulWidget {
  const DriverHomeScreen({super.key});
  @override
  ConsumerState<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends ConsumerState<DriverHomeScreen> {
  GoogleMapController? _mapCtrl;
  IO.Socket? _socket;
  bool _online = false;
  List<Map<String, dynamic>> _rides = [];
  Position? _pos;

  static const _init = CameraPosition(target: LatLng(12.9716, 77.5946), zoom: 13);

  @override
  void initState() { super.initState(); _connectSocket(); _startTracking(); }

  void _connectSocket() {
    _socket = IO.io('http://10.0.2.2:3000', <String, dynamic>{'transports': ['websocket']});
    _socket!.connect();
    _socket!.on('ride_assigned', (data) {
      setState(() { final b = data['booking'] as Map<String, dynamic>; _rides.insert(0, b); });
      _showRideAlert(data['booking'] as Map<String, dynamic>);
    });
  }

  Future<void> _startTracking() async {
    final perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied) return;
    Geolocator.getPositionStream(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 20)).listen((pos) {
      setState(() => _pos = pos);
      if (_online && _socket != null) _socket!.emit('driver_location', {'lat': pos.latitude, 'lng': pos.longitude});
    });
  }

  void _showRideAlert(Map<String, dynamic> booking) {
    showModalBottomSheet(context: context, builder: (_) => Container(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.notifications_active_rounded, color: Color(0xFF3B82F6), size: 40),
        const SizedBox(height: 12),
        const Text('New Ride Assigned!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Text(booking['pickup_address'] as String? ?? '', textAlign: TextAlign.center),
        const SizedBox(height: 16),
        ElevatedButton(onPressed: () { Navigator.pop(context); }, style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF3B82F6)), child: const Text('View Details')),
      ]),
    ));
  }

  void _toggleOnline() => setState(() => _online = !_online);

  @override
  void dispose() { _socket?.disconnect(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Stack(children: [
      GoogleMap(initialCameraPosition: _init, onMapCreated: (c) => _mapCtrl = c, myLocationEnabled: true, myLocationButtonEnabled: false, zoomControlsEnabled: false, mapType: MapType.normal),

      SafeArea(child: Padding(padding: const EdgeInsets.all(16), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(100)), child: const Row(mainAxisSize: MainAxisSize.min, children: [Icon(Icons.flight_takeoff_rounded, color: Color(0xFF3B82F6), size: 16), SizedBox(width: 6), Text('DRIVER', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, letterSpacing: 1.5, fontSize: 13))])),
        Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), decoration: BoxDecoration(color: _online ? const Color(0xFF10B981).withOpacity(0.15) : Colors.white, borderRadius: BorderRadius.circular(100), border: Border.all(color: _online ? const Color(0xFF10B981) : const Color(0xFFE2E8F0))), child: GestureDetector(onTap: _toggleOnline, child: Row(mainAxisSize: MainAxisSize.min, children: [Container(width: 8, height: 8, decoration: BoxDecoration(color: _online ? const Color(0xFF10B981) : const Color(0xFF94A3B8), shape: BoxShape.circle)), const SizedBox(width: 6), Text(_online ? 'Online' : 'Offline', style: TextStyle(color: _online ? const Color(0xFF10B981) : const Color(0xFF94A3B8), fontWeight: FontWeight.w600, fontSize: 14))]))),
      ]))),

      Positioned(bottom: 0, left: 0, right: 0, child: Container(
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 16),
          Row(children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Today\'s Earnings', style: TextStyle(fontSize: 13, color: Color(0xFF475569))), const SizedBox(height: 4), const Text('₹0', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)))]),
            const Spacer(),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [const Text('Trips', style: TextStyle(fontSize: 13, color: Color(0xFF475569))), const SizedBox(height: 4), Text('${_rides.length}', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)))]),
          ]),
          const SizedBox(height: 16),
          if (!_online) Container(
            width: double.infinity, padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(16)),
            child: const Row(children: [Icon(Icons.info_outline_rounded, color: Color(0xFF94A3B8), size: 20), SizedBox(width: 12), Expanded(child: Text('Go online to start receiving rides', style: TextStyle(color: Color(0xFF475569), fontSize: 14)))]),
          ),
          if (_rides.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Recent Rides', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
            const SizedBox(height: 8),
            ...(_rides.take(3).map((r) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
              child: Row(children: [
                const Icon(Icons.location_on_outlined, color: Color(0xFF3B82F6), size: 18),
                const SizedBox(width: 8),
                Expanded(child: Text(r['pickup_address'] as String? ?? '', style: const TextStyle(fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis)),
                const Spacer(),
                Text('₹${r['total_fare'] ?? 0}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              ]),
            ))),
          ],
          SizedBox(height: MediaQuery.of(context).padding.bottom + 8),
        ]),
      )),
    ]),
  );
}

import 'package:flutter_riverpod/flutter_riverpod.dart';

class BookingState {
  final String pickupAddress;
  final double? pickupLat, pickupLng;
  final String destinationAddress;
  final double? destinationLat, destinationLng;
  final DateTime? scheduledAt;
  final String? flightNumber, selectedVehicleType, paymentMethod, specialInstructions;
  final double? totalFare;
  final Map<String, dynamic>? fareBreakdown, confirmedBooking;

  const BookingState({
    this.pickupAddress = '',
    this.pickupLat, this.pickupLng,
    this.destinationAddress = '',
    this.destinationLat, this.destinationLng,
    this.scheduledAt, this.flightNumber,
    this.selectedVehicleType, this.totalFare,
    this.paymentMethod = 'cash',
    this.specialInstructions, this.fareBreakdown, this.confirmedBooking,
  });

  bool get isPickupSet => pickupAddress.isNotEmpty && pickupLat != null;
  bool get isDestinationSet => destinationAddress.isNotEmpty && destinationLat != null;
  bool get isReadyForFare => isPickupSet && isDestinationSet && scheduledAt != null;

  BookingState copyWith({
    String? pickupAddress, double? pickupLat, double? pickupLng,
    String? destinationAddress, double? destinationLat, double? destinationLng,
    DateTime? scheduledAt, String? flightNumber, String? selectedVehicleType,
    double? totalFare, String? paymentMethod, String? specialInstructions,
    Map<String, dynamic>? fareBreakdown, Map<String, dynamic>? confirmedBooking,
  }) => BookingState(
    pickupAddress: pickupAddress ?? this.pickupAddress,
    pickupLat: pickupLat ?? this.pickupLat,
    pickupLng: pickupLng ?? this.pickupLng,
    destinationAddress: destinationAddress ?? this.destinationAddress,
    destinationLat: destinationLat ?? this.destinationLat,
    destinationLng: destinationLng ?? this.destinationLng,
    scheduledAt: scheduledAt ?? this.scheduledAt,
    flightNumber: flightNumber ?? this.flightNumber,
    selectedVehicleType: selectedVehicleType ?? this.selectedVehicleType,
    totalFare: totalFare ?? this.totalFare,
    paymentMethod: paymentMethod ?? this.paymentMethod,
    specialInstructions: specialInstructions ?? this.specialInstructions,
    fareBreakdown: fareBreakdown ?? this.fareBreakdown,
    confirmedBooking: confirmedBooking ?? this.confirmedBooking,
  );
}

class BookingNotifier extends Notifier<BookingState> {
  @override
  BookingState build() => const BookingState();

  void setPickup({required String address, required double lat, required double lng}) =>
      state = state.copyWith(pickupAddress: address, pickupLat: lat, pickupLng: lng);

  void setDestination({required String address, required double lat, required double lng}) =>
      state = state.copyWith(destinationAddress: address, destinationLat: lat, destinationLng: lng);

  void setScheduledAt(DateTime dt) => state = state.copyWith(scheduledAt: dt);
  void setFlightNumber(String? fn) => state = state.copyWith(flightNumber: fn);
  void setVehicleType(String vt) => state = state.copyWith(selectedVehicleType: vt);
  void setFareBreakdown(Map<String, dynamic> bd) => state = state.copyWith(fareBreakdown: bd);
  void setTotalFare(double f) => state = state.copyWith(totalFare: f);
  void setPaymentMethod(String m) => state = state.copyWith(paymentMethod: m);
  void setConfirmedBooking(Map<String, dynamic> b) => state = state.copyWith(confirmedBooking: b);
  void reset() => state = const BookingState();
}

final bookingProvider = NotifierProvider<BookingNotifier, BookingState>(BookingNotifier.new);

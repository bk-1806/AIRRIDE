import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/material.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/otp_screen.dart';
import '../../features/booking/presentation/home_screen.dart';
import '../../features/booking/presentation/pickup_screen.dart';
import '../../features/booking/presentation/destination_screen.dart';
import '../../features/booking/presentation/datetime_screen.dart';
import '../../features/booking/presentation/flight_details_screen.dart';
import '../../features/booking/presentation/savings_screen.dart';
import '../../features/booking/presentation/fare_estimate_screen.dart';
import '../../features/booking/presentation/booking_confirmation_screen.dart';
import '../../features/tracking/presentation/driver_tracking_screen.dart';
import '../../features/history/presentation/ride_history_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../providers/auth_provider.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);
  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final isLoggedIn = authState.value != null;
      final isAuthPage = ['/splash', '/login', '/otp'].any((p) => state.matchedLocation.startsWith(p));
      if (!isLoggedIn && !isAuthPage) return '/login';
      if (isLoggedIn && isAuthPage && state.matchedLocation != '/splash') return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/otp', builder: (_, state) => OtpScreen(phoneNumber: state.extra as String? ?? '')),
      GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
      GoRoute(path: '/pickup', builder: (_, __) => const PickupScreen()),
      GoRoute(path: '/destination', builder: (_, __) => const DestinationScreen()),
      GoRoute(path: '/datetime', builder: (_, __) => const DateTimeScreen()),
      GoRoute(path: '/flight-details', builder: (_, __) => const FlightDetailsScreen()),
      GoRoute(path: '/savings', builder: (_, __) => const SavingsScreen()),
      GoRoute(path: '/fare-estimate', builder: (_, __) => const FareEstimateScreen()),
      GoRoute(path: '/booking-confirmation', builder: (_, __) => const BookingConfirmationScreen()),
      GoRoute(path: '/tracking/:bookingId', builder: (_, state) => DriverTrackingScreen(bookingId: state.pathParameters['bookingId']!)),
      GoRoute(path: '/history', builder: (_, __) => const RideHistoryScreen()),
      GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
    ],
    errorBuilder: (_, state) => Scaffold(body: Center(child: Text('Page not found: ${state.error}'))),
  );
});

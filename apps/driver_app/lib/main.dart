import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'features/rides/presentation/driver_home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.dark));
  try { await Firebase.initializeApp(); } catch (_) { debugPrint('⚠️  Firebase not configured'); }
  runApp(const ProviderScope(child: AirrideDriverApp()));
}

class AirrideDriverApp extends ConsumerWidget {
  const AirrideDriverApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp(
    title: 'AIRRIDE Driver', debugShowCheckedModeBanner: false,
    theme: ThemeData(useMaterial3: true, colorScheme: const ColorScheme.light(primary: Color(0xFF3B82F6), onPrimary: Colors.white)),
    home: const DriverHomeScreen(),
  );
}

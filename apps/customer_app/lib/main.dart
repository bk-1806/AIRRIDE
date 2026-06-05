import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    systemNavigationBarColor: Colors.white,
    systemNavigationBarIconBrightness: Brightness.dark,
  ));

  // TODO: Replace with your firebase_options.dart file from `flutterfire configure`
  // await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // For now, initializing without options (add firebase_options.dart after setup)
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // Firebase not configured yet — run `flutterfire configure` to set up
    debugPrint('⚠️  Firebase not configured. Run `flutterfire configure` to set up.');
  }

  runApp(const ProviderScope(child: AirrideApp()));
}

class AirrideApp extends ConsumerWidget {
  const AirrideApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'AIRRIDE',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: router,
    );
  }
}

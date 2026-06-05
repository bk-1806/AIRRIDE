import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../network/api_client.dart';

final authStateProvider = StreamProvider<User?>((ref) {
  return FirebaseAuth.instance.authStateChanges();
});

final verificationIdProvider = StateProvider<String>((ref) => '');

class AuthNotifier extends AsyncNotifier<void> {
  @override
  Future<void> build() async {}

  Future<String> sendOtp(String phoneNumber) async {
    String verificationId = '';
    await FirebaseAuth.instance.verifyPhoneNumber(
      phoneNumber: phoneNumber,
      verificationCompleted: (PhoneAuthCredential credential) async {
        await FirebaseAuth.instance.signInWithCredential(credential);
      },
      verificationFailed: (FirebaseAuthException e) {
        throw Exception(e.message ?? 'OTP verification failed');
      },
      codeSent: (String verId, int? resendToken) {
        verificationId = verId;
      },
      codeAutoRetrievalTimeout: (_) {},
      timeout: const Duration(seconds: 60),
    );
    await Future.delayed(const Duration(milliseconds: 300));
    return verificationId;
  }

  Future<UserCredential> verifyOtp(String verificationId, String smsCode) async {
    final credential = PhoneAuthProvider.credential(
      verificationId: verificationId,
      smsCode: smsCode,
    );
    return FirebaseAuth.instance.signInWithCredential(credential);
  }

  Future<void> registerUserInBackend(Ref ref, {String? fullName, String? fcmToken}) async {
    final client = ref.read(apiClientProvider);
    await client.post('/auth/verify-token', data: {'fullName': fullName, 'fcmToken': fcmToken});
  }

  Future<void> signOut() async {
    await FirebaseAuth.instance.signOut();
  }
}

final authNotifierProvider = AsyncNotifierProvider<AuthNotifier, void>(AuthNotifier.new);

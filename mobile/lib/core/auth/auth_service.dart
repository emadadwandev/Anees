import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../network/api_client.dart';

class AuthState {
  final bool isAuthenticated;
  final String? role;
  final String? userId;
  final String? linkedPatientId;

  const AuthState({
    required this.isAuthenticated,
    this.role,
    this.userId,
    this.linkedPatientId,
  });

  const AuthState.unauthenticated()
      : isAuthenticated = false,
        role = null,
        userId = null,
        linkedPatientId = null;
}

class AuthNotifier extends AsyncNotifier<AuthState> {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _keyAccess = 'access_token';
  static const _keyRefresh = 'refresh_token';
  static const _keyRole = 'user_role';
  static const _keyUserId = 'user_id';
  static const _keyLinkedPatient = 'linked_patient_id';

  @override
  Future<AuthState> build() async {
    return _tryRestoreSession();
  }

  Future<AuthState> _tryRestoreSession() async {
    final accessToken = await _storage.read(key: _keyAccess);
    final role = await _storage.read(key: _keyRole);
    final userId = await _storage.read(key: _keyUserId);
    final linkedPatientId = await _storage.read(key: _keyLinkedPatient);

    if (accessToken == null || role == null || userId == null) {
      return AuthState(
        isAuthenticated: false,
        linkedPatientId: linkedPatientId,
      );
    }
    return AuthState(
      isAuthenticated: true,
      role: role,
      userId: userId,
      linkedPatientId: linkedPatientId,
    );
  }

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final client = ref.read(apiClientProvider);
      final response = await client.post('/auth/login', {
        'email': email,
        'password': password,
      });
      return _handleTokenResponse(response.data as Map<String, dynamic>);
    });
  }

  Future<void> pinLogin(String userId, String pin) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final client = ref.read(apiClientProvider);
      final response = await client.post('/auth/pin-login', {
        'userId': userId,
        'pin': pin,
      });
      return _handleTokenResponse(response.data as Map<String, dynamic>);
    });
  }

  Future<void> setPin(String userId, String pin) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final client = ref.read(apiClientProvider);
      final response = await client.post('/auth/set-pin', {
        'userId': userId,
        'pin': pin,
      });
      return _handleTokenResponse(response.data as Map<String, dynamic>);
    });
  }

  Future<void> register(
    String email,
    String password,
    String firstName,
    String lastName,
  ) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final client = ref.read(apiClientProvider);
      final response = await client.post('/auth/register', {
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
        'role': 'caregiver',
      });
      return _handleTokenResponse(response.data as Map<String, dynamic>);
    });
  }

  Future<AuthState> _handleTokenResponse(Map<String, dynamic> data) async {
    final accessToken = data['accessToken'] as String;
    final refreshToken = data['refreshToken'] as String;
    final role = data['user']['role'] as String;
    final userId = data['user']['id'] as String;
    final linkedPatientId = await _storage.read(key: _keyLinkedPatient);

    await Future.wait([
      _storage.write(key: _keyAccess, value: accessToken),
      _storage.write(key: _keyRefresh, value: refreshToken),
      _storage.write(key: _keyRole, value: role),
      _storage.write(key: _keyUserId, value: userId),
    ]);

    return AuthState(
      isAuthenticated: true,
      role: role,
      userId: userId,
      linkedPatientId: linkedPatientId,
    );
  }

  Future<void> linkElderlyDevice(String patientId) async {
    await _storage.write(key: _keyLinkedPatient, value: patientId);
    final current = state.value;
    state = AsyncData(AuthState(
      isAuthenticated: current?.isAuthenticated ?? false,
      role: current?.role,
      userId: current?.userId,
      linkedPatientId: patientId,
    ));
  }

  Future<void> unlinkElderlyDevice() async {
    await _storage.delete(key: _keyLinkedPatient);
    final current = state.value;
    state = AsyncData(AuthState(
      isAuthenticated: current?.isAuthenticated ?? false,
      role: current?.role,
      userId: current?.userId,
      linkedPatientId: null,
    ));
  }

  Future<void> logout() async {
    try {
      final client = ref.read(apiClientProvider);
      await client.post('/auth/logout', {});
    } catch (_) {}
    finally {
      await _storage.deleteAll();
      state = const AsyncData(AuthState.unauthenticated());
    }
  }

  Future<void> refreshTokens() async {
    final refreshToken = await _storage.read(key: _keyRefresh);
    final userId = await _storage.read(key: _keyUserId);
    if (refreshToken == null || userId == null) {
      state = const AsyncData(AuthState.unauthenticated());
      return;
    }

    try {
      final client = ref.read(apiClientProvider);
      final response = await client.post('/auth/refresh', {
        'userId': userId,
        'refreshToken': refreshToken,
      });

      final data = response.data as Map<String, dynamic>;
      await Future.wait([
        _storage.write(key: _keyAccess, value: data['accessToken'] as String),
        _storage.write(key: _keyRefresh, value: data['refreshToken'] as String),
      ]);
    } catch (_) {
      await _storage.deleteAll();
      state = const AsyncData(AuthState.unauthenticated());
    }
  }

  Future<String?> getAccessToken() => _storage.read(key: _keyAccess);
}

final authStateProvider =
    AsyncNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

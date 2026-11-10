import 'dart:convert';
import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:timezone/data/latest_all.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

import 'news_message.dart';

const apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://10.0.2.2:3001/api/v1',
);

String _initialOf(dynamic value) {
  final text = value?.toString().trim() ?? '';
  return text.isEmpty ? 'S' : text.substring(0, 1).toUpperCase();
}

String _activityType(Map<String, dynamic> row) {
  final type = row['LoaiHoatDong']?.toString().trim();
  if (type != null && type.isNotEmpty) return type;
  if (row['MaCThi'] != null) return 'Cuộc thi';
  if (row['MaSeminar'] != null) return 'Seminar';
  if ('${row['TenHoatDong']}'.toLowerCase().contains('workshop')) {
    return 'Workshop';
  }
  return 'Hoạt động học thuật';
}

typedef _CompetitionTopic = ({String name, String advisor});

Future<_CompetitionTopic?> _askCompetitionTopic(BuildContext context) {
  var name = '';
  var advisor = '';
  return showDialog<_CompetitionTopic>(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        title: const Text('Thông tin đề tài dự thi'),
        scrollable: true,
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              decoration: const InputDecoration(labelText: 'Tên đề tài'),
              maxLength: 250,
              onChanged: (value) => setState(() => name = value.trim()),
            ),
            TextField(
              decoration: const InputDecoration(labelText: 'Giáo viên hướng dẫn'),
              maxLength: 150,
              onChanged: (value) => setState(() => advisor = value.trim()),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: name.length >= 2 && advisor.length >= 2
                ? () => Navigator.pop(dialogContext, (name: name, advisor: advisor))
                : null,
            child: const Text('Gửi đăng ký'),
          ),
        ],
      ),
    ),
  );
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ActivityReminderNotifications.initialize();
  await MobilePushNotifications.initialize();
  runApp(const AcademicApp());
}

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // Firebase remains optional until this app is linked to a Firebase project.
  }
}

class AcademicApp extends StatelessWidget {
  const AcademicApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Công tác học thuật',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xff3156c8),
            primary: const Color(0xff3156c8),
            surface: const Color(0xfff6f7fb),
          ),
          scaffoldBackgroundColor: const Color(0xfff6f7fb),
          fontFamily: 'Roboto',
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xffe5e9f2)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xffe5e9f2)),
            ),
          ),
        ),
        home: const AppGate(),
      );
}

class Api {
  Api._();
  static final client = HttpClient()
    ..connectionTimeout = const Duration(seconds: 12);
  static String? cookie;
  static String? accessToken;

  static Future<void> clearSavedSession() async {
    accessToken = null;
    cookie = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('academic_access_token');
  }

  static Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$apiUrl$path');
    final req = await client.openUrl(method, uri);
    req.headers.set(HttpHeaders.acceptHeader, 'application/json');
    req.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
    if (accessToken != null) {
      req.headers.set(HttpHeaders.authorizationHeader, 'Bearer $accessToken');
    }
    if (cookie != null) req.headers.set(HttpHeaders.cookieHeader, cookie!);
    if (body != null) req.write(jsonEncode(body));
    final res = await req.close();
    final setCookie = res.headers[HttpHeaders.setCookieHeader];
    if (setCookie != null && setCookie.isNotEmpty) {
      final pair = setCookie.first.split(';').first;
      if (pair.endsWith('=')) {
        cookie = null;
      } else {
        cookie = pair;
      }
    }
    final text = await res.transform(utf8.decoder).join();
    final data = text.isEmpty ? null : jsonDecode(text);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final message = data is Map ? data['message'] : null;
      if (res.statusCode == 401)
        throw Exception('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
      if (res.statusCode == 429)
        throw Exception('Bạn đã thử quá nhiều lần. Hãy thử lại sau.');
      throw Exception(
        message is String
            ? message
            : 'Yêu cầu chưa thực hiện được. Vui lòng thử lại.',
      );
    }
    return data;
  }

  static Future<Map<String, dynamic>> login(
    String username,
    String password,
  ) async {
    final data = await request(
      '/auth/mobile/login',
      method: 'POST',
      body: {'username': username, 'password': password},
    );
    accessToken = data['accessToken'] as String?;
    if (accessToken == null || accessToken!.isEmpty) {
      throw Exception('Máy chủ không trả token đăng nhập.');
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('academic_access_token', accessToken!);
    return Map<String, dynamic>.from(data['user'] as Map);
  }

  static Future<List<dynamic>> activities() async {
    // The feed contains published activities. CoTheDangKy controls registration.
    final data = await request('/mobile/activities');
    return data is List ? data : <dynamic>[];
  }

  static Future<List<dynamic>> publicCompetitionTopics() async {
    final data = await request('/mobile/topics');
    return data is List ? data : <dynamic>[];
  }

  static Future<dynamic> seminarDetails(int seminarId) =>
      request('/seminars/$seminarId');

  static Future<List<dynamic>> myRegistrations() async {
    final data = await request('/mobile/my-activities');
    return data is List ? data : <dynamic>[];
  }

  static Future<dynamic> myTrainingPoints() =>
      request('/mobile/my-training-points');

  static Future<dynamic> myProfile() => request('/mobile/profile');

  static Future<List<dynamic>> myCompetitionDetails(
      List<dynamic> registrations) async {
    final competitionIds = registrations
        .whereType<Map>()
        .map((row) => int.tryParse('${row['MaCThi'] ?? ''}'))
        .whereType<int>()
        .toSet();
    if (competitionIds.isEmpty) return <dynamic>[];
    final value = await request('/competition-workflow/competitions');
    final List<Map> competitions = value is List
        ? value
            .whereType<Map>()
            .where((raw) => competitionIds
                .contains(int.tryParse('${raw['MaCThi'] ?? ''}')))
            .toList()
        : <Map>[];
    return Future.wait(competitions.map((raw) async {
      if (raw['MaCThi'] == null) return raw;
      final details =
          await request('/competition-workflow/competitions/${raw['MaCThi']}');
      return {'competition': raw, 'details': details};
    }));
  }

  static Future<List<dynamic>> reminders() async {
    final data = await request('/notifications/my-reminders');
    return data is List ? data : <dynamic>[];
  }

  static Future<List<dynamic>> notifications() async {
    // The mobile endpoint intentionally selects the columns available in the
    // current database schema; the web notification endpoint also selects an
    // optional assignment column that may not exist in older databases.
    final data = await request('/mobile/notifications');
    return data is List ? data : <dynamic>[];
  }

  static Future<dynamic> markNotificationRead(int id) =>
      request('/notifications/$id/read', method: 'PATCH');

  static Future<dynamic> registerIndividual(
    int activityId,
    String type, {
    _CompetitionTopic? topic,
  }) =>
      request(
        '/registrations/individual',
        method: 'POST',
        body: {
          'maHD': activityId,
          'hinhThuc': type,
          if (topic != null) ...{'tenDeTai': topic.name, 'gvhd': topic.advisor},
        },
      );

  static Future<dynamic> checkIn(String code) => request(
        '/attendance/check-in',
        method: 'POST',
        body: {'code': code},
      );

  static Future<dynamic> registerTeam(
    int competitionId,
    String teamName,
    List<String> memberNumbers,
    _CompetitionTopic topic,
  ) =>
      request('/registrations/team', method: 'POST', body: {
        'maCThi': competitionId,
        'tenDoi': teamName,
        'thanhVienMSSV': memberNumbers,
        'tenDeTai': topic.name,
        'gvhd': topic.advisor,
      });

  static Future<dynamic> joinTeam(int teamId) => request(
        '/registrations/team/join',
        method: 'POST',
        body: {'maDoi': teamId},
      );
}

class MobilePushNotifications {
  MobilePushNotifications._();
  static bool enabled = false;
  static bool _listenersInstalled = false;

  static Future<void> initialize() async {
    try {
      await Firebase.initializeApp();
      enabled = true;
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
      await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      if (!_listenersInstalled) {
        _listenersInstalled = true;
        FirebaseMessaging.onMessage.listen(_showForegroundMessage);
        FirebaseMessaging.instance.onTokenRefresh.listen((token) {
          if (Api.accessToken != null) unawaited(_registerToken(token));
        });
      }
    } catch (_) {
      enabled = false;
    }
  }

  static Future<void> registerDevice() async {
    if (!enabled || Api.accessToken == null) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) await _registerToken(token);
    } catch (_) {}
  }

  static Future<void> _registerToken(String token) async {
    await Api.request('/mobile/devices', method: 'POST', body: {
      'token': token,
      'platform': Platform.isAndroid ? 'android' : 'ios',
    });
  }

  static Future<void> unregisterDevice() async {
    if (!enabled || Api.accessToken == null) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) {
        await Api.request('/mobile/devices/unregister', method: 'POST', body: {'token': token});
      }
    } catch (_) {}
  }

  static Future<void> _showForegroundMessage(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;
    final id = int.tryParse(message.data['notificationId'] ?? '') ??
        DateTime.now().millisecondsSinceEpoch.remainder(2147483647);
    await ActivityReminderNotifications.showPush(
      id: id,
      title: notification.title ?? 'Thông báo học thuật',
      body: NewsMessage.parse(notification.body ?? '').summary,
    );
  }
}

class ActivityReminderNotifications {
  ActivityReminderNotifications._();

  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;
    tz_data.initializeTimeZones();
    if (Platform.isAndroid) {
      try {
        final deviceTimezone = await FlutterTimezone.getLocalTimezone();
        tz.setLocalLocation(tz.getLocation(deviceTimezone.identifier));
      } catch (_) {
        tz.setLocalLocation(tz.getLocation('Asia/Ho_Chi_Minh'));
      }
    } else {
      tz.setLocalLocation(tz.getLocation('Asia/Ho_Chi_Minh'));
    }
    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      ),
    );
    if (Platform.isAndroid) {
      await _plugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>()?.createNotificationChannel(
        const AndroidNotificationChannel(
          'academic_inbox',
          'Thông báo học thuật',
          description: 'Thông báo mới từ hệ thống công tác học thuật.',
          importance: Importance.high,
        ),
      );
    }
    _initialized = true;
  }

  static Future<void> showPush({required int id, required String title, required String body}) async {
    await initialize();
    await _plugin.show(
      id: id % 2147483647,
      title: title,
      body: body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'academic_inbox',
          'Thông báo học thuật',
          channelDescription: 'Thông báo mới từ hệ thống công tác học thuật.',
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
      payload: 'academic-inbox:$id',
    );
  }

  static Future<void> requestPermission() async {
    await initialize();
    if (!Platform.isAndroid) return;
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
  }

  static Future<void> syncWithServer({bool requestPermission = false}) async {
    try {
      if (requestPermission)
        await ActivityReminderNotifications.requestPermission();
      final rows = await Api.reminders();
      await schedule(rows);
    } catch (_) {
      // Keep the current app session usable if reminders cannot be loaded.
    }
  }

  static Future<void> schedule(List<dynamic> rows) async {
    await initialize();
    final pending = await _plugin.pendingNotificationRequests();
    for (final item in pending) {
      if (item.payload?.startsWith('academic-activity-reminder:') ?? false) {
        await _plugin.cancel(id: item.id);
      }
    }

    final now = DateTime.now();
    for (final raw in rows) {
      if (raw is! Map) continue;
      final row = Map<String, dynamic>.from(raw);
      final activityId = int.tryParse('${row['MaHD'] ?? ''}');
      if (activityId == null) continue;
      final title = (row['TenHoatDong'] ?? 'Hoạt động học thuật').toString();
      final kind = (row['LoaiNhac'] ?? '').toString();
      final isDeadline = kind.contains('Hạn đăng ký');
      final eventDate = DateTime.tryParse(
        '${isDeadline ? row['HanDangKy'] : row['TgBatDau'] ?? ''}',
      );
      if (eventDate == null) continue;

      final schedules = isDeadline
          ? <(int, Duration, String)>[
              (3, const Duration(hours: 2), 'Hạn đăng ký còn 2 giờ'),
            ]
          : <(int, Duration, String)>[
              (
                1,
                const Duration(hours: 24),
                'Hoạt động sẽ diễn ra trong 24 giờ'
              ),
              (2, const Duration(hours: 2), 'Hoạt động sẽ diễn ra trong 2 giờ'),
            ];

      for (final (slot, leadTime, reminderText) in schedules) {
        final scheduledAt = eventDate.subtract(leadTime);
        if (!scheduledAt.isAfter(now.add(const Duration(minutes: 1)))) continue;
        final id = (activityId * 4 + slot) % 2147483647;
        await _plugin.zonedSchedule(
          id: id,
          title: title,
          body:
              '$reminderText · ${_formatMobileDate(eventDate)}${row['DiaDiem'] == null ? '' : ' · ${row['DiaDiem']}'}',
          scheduledDate: tz.TZDateTime.from(scheduledAt, tz.local),
          notificationDetails: const NotificationDetails(
            android: AndroidNotificationDetails(
              'academic_activity_reminders',
              'Nhắc lịch hoạt động',
              channelDescription:
                  'Nhắc sinh viên trước giờ hoạt động học thuật đã đăng ký.',
              importance: Importance.high,
              priority: Priority.high,
            ),
          ),
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
          payload: 'academic-activity-reminder:$activityId',
        );
      }
    }
  }

  static Future<void> clear() async {
    if (_initialized) await _plugin.cancelAll();
  }
}

class IncomingNotificationWatcher {
  IncomingNotificationWatcher._();

  static Timer? _timer;
  static bool _checking = false;
  static const _seenKey = 'academic_seen_inbox_notifications';

  static Future<void> start({bool requestPermission = false}) async {
    stop();
    if (requestPermission) {
      await ActivityReminderNotifications.requestPermission();
    }
    await check(showLatestWhenFirstRun: true);
    _timer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => unawaited(check()),
    );
  }

  static void stop() {
    _timer?.cancel();
    _timer = null;
  }

  static Future<void> check({bool showLatestWhenFirstRun = false}) async {
    if (_checking || Api.accessToken == null) return;
    _checking = true;
    try {
      await ActivityReminderNotifications.initialize();
      final rows = _recordRows(await Api.notifications())
        ..sort((a, b) => _notificationId(a).compareTo(_notificationId(b)));
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getStringList(_seenKey);
      final seen = saved?.map(int.tryParse).whereType<int>().toSet() ?? {};
      final firstCheck = saved == null;
      final incoming = rows.where((row) {
        final id = _notificationId(row);
        return id > 0 && !seen.contains(id);
      }).toList();

      // On first install, show only the newest unread item to avoid flooding
      // the tray with old inbox history. Later checks show every newly arrived
      // item, even if it was read from the web before the next mobile poll.
      final initialUnread = incoming.where((row) => row['DocLuc'] == null);
      final toShow = firstCheck
          ? (showLatestWhenFirstRun && incoming.isNotEmpty
              ? <Map<String, dynamic>>[initialUnread.isNotEmpty
                  ? initialUnread.last
                  : incoming.last]
              : <Map<String, dynamic>>[])
          : incoming;
      for (final row in toShow) {
        await _show(row);
      }

      seen.addAll(rows.map(_notificationId).where((id) => id > 0));
      if (seen.length > 250) {
        final recent = seen.toList()..sort();
        seen.removeAll(recent.take(seen.length - 200));
      }
      await prefs.setStringList(
          _seenKey, seen.map((id) => id.toString()).toList());
    } catch (_) {
      // Notification polling should not block normal app use.
    } finally {
      _checking = false;
    }
  }

  static int _notificationId(Map<String, dynamic> row) =>
      int.tryParse('${row['MaThongBao'] ?? ''}') ?? 0;

  static Future<void> _show(Map<String, dynamic> row) async {
    final id = _notificationId(row);
    if (id < 1) return;
    final title = (row['TieuDe'] ?? 'Thông báo học thuật').toString();
    final body = NewsMessage.parse('${row['NoiDung'] ?? ''}').summary;
    await ActivityReminderNotifications._plugin.show(
      id: id % 2147483647,
      title: title,
      body: body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'academic_inbox',
          'Thông báo học thuật',
          channelDescription: 'Thông báo mới từ hệ thống công tác học thuật.',
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
      payload: 'academic-inbox:$id',
    );
  }
}

class AppGate extends StatefulWidget {
  const AppGate({super.key});
  @override
  State<AppGate> createState() => _AppGateState();
}

class _AppGateState extends State<AppGate> with WidgetsBindingObserver {
  Map<String, dynamic>? user;
  bool checking = true;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _restoreSession();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    IncomingNotificationWatcher.stop();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !MobilePushNotifications.enabled) {
      unawaited(IncomingNotificationWatcher.check());
    }
  }

  Future<void> _restoreSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      Api.accessToken = prefs.getString('academic_access_token');
      if (Api.accessToken != null) {
        final value = await Api.request('/auth/me');
        user = Map<String, dynamic>.from(value['user'] as Map);
        unawaited(ActivityReminderNotifications.syncWithServer());
        unawaited(MobilePushNotifications.registerDevice());
        if (!MobilePushNotifications.enabled) {
          unawaited(IncomingNotificationWatcher.start(requestPermission: true));
        }
      }
    } catch (_) {
      await Api.clearSavedSession();
    } finally {
      if (mounted) setState(() => checking = false);
    }
  }

  void onLogin(Map<String, dynamic> value) {
    setState(() => user = value);
    unawaited(ActivityReminderNotifications.syncWithServer());
    unawaited(MobilePushNotifications.registerDevice());
    if (!MobilePushNotifications.enabled) {
      unawaited(IncomingNotificationWatcher.start(requestPermission: true));
    }
  }

  Future<void> logout() async {
    await MobilePushNotifications.unregisterDevice();
    try {
      await Api.request('/auth/logout', method: 'POST', body: {});
    } catch (_) {}
    await ActivityReminderNotifications.clear();
    IncomingNotificationWatcher.stop();
    await Api.clearSavedSession();
    if (mounted) setState(() => user = null);
  }

  @override
  Widget build(BuildContext context) {
    if (checking)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    return user == null
        ? LoginScreen(onLogin: onLogin)
        : DashboardScreen(user: user!, onLogout: logout);
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.onLogin});
  final ValueChanged<Map<String, dynamic>> onLogin;
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final username = TextEditingController();
  final password = TextEditingController();
  bool busy = false;
  bool obscure = true;
  String? error;

  Future<void> submit() async {
    if (username.text.trim().isEmpty || password.text.isEmpty) {
      setState(() => error = 'Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      widget.onLogin(await Api.login(username.text.trim(), password.text));
    } catch (e) {
      setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(26),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      height: 76,
                      width: 76,
                      decoration: BoxDecoration(
                        color: const Color(0xffe9edff),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: const Icon(
                        Icons.school_rounded,
                        color: Color(0xff3156c8),
                        size: 40,
                      ),
                    ),
                    const SizedBox(height: 28),
                    const Text(
                      'KHOA CÔNG NGHỆ THÔNG TIN',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                        color: Color(0xff3156c8),
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Công tác học thuật',
                      style: TextStyle(
                        fontSize: 32,
                        height: 1.15,
                        fontWeight: FontWeight.w800,
                        color: Color(0xff17264b),
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Đăng nhập để theo dõi và tham gia các hoạt động học thuật của khoa.',
                      style: TextStyle(height: 1.5, color: Color(0xff667085)),
                    ),
                    const SizedBox(height: 30),
                    TextField(
                      controller: username,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'MSSV / Tên đăng nhập',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: password,
                      obscureText: obscure,
                      onSubmitted: (_) => submit(),
                      decoration: InputDecoration(
                        labelText: 'Mật khẩu',
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          onPressed: () => setState(() => obscure = !obscure),
                          icon: Icon(
                            obscure
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                    ),
                    if (error != null) ...[
                      const SizedBox(height: 14),
                      Text(
                        error!,
                        style: const TextStyle(color: Color(0xffb42318)),
                      ),
                    ],
                    const SizedBox(height: 22),
                    FilledButton.icon(
                      onPressed: busy ? null : submit,
                      icon: busy
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.login_rounded),
                      label: Text(busy ? 'Đang đăng nhập…' : 'Đăng nhập'),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(54),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Center(
                      child: Text(
                        'Nền tảng học thuật của khoa',
                        style:
                            TextStyle(color: Color(0xff98a2b3), fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
}

class Feature {
  const Feature(
    this.title,
    this.detail,
    this.icon,
    this.color, {
    this.live = false,
  });
  final String title, detail;
  final IconData icon;
  final Color color;
  final bool live;
}

const features = <Feature>[
  Feature(
    'Đăng ký tham dự & Cổ vũ',
    'Đăng ký dự thi cá nhân/đội nhóm, tham dự, hỗ trợ hoặc cổ vũ.',
    Icons.how_to_reg_rounded,
    Color(0xff18a781),
    live: true,
  ),
  Feature(
    'Điểm danh di động',
    'Quét mã QR để điểm danh seminar hoặc cuộc thi đã đăng ký.',
    Icons.qr_code_scanner_rounded,
    Color(0xff087e8b),
  ),
  Feature(
    'Nhắc lịch hoạt động',
    'Xem nhắc lịch tự động cho hoạt động đã đăng ký sắp diễn ra.',
    Icons.notifications_active_rounded,
    Color(0xffcf6b9c),
  ),
  Feature(
    'Thông tin cá nhân & lịch sử',
    'Tra cứu hồ sơ, hoạt động, đề tài và lịch sử điểm rèn luyện.',
    Icons.person_search_rounded,
    Color(0xffca8a04),
  ),
  Feature(
    'Tin tức & thông báo',
    'Xem tin về seminar, cuộc thi và các cập nhật hoạt động.',
    Icons.campaign_rounded,
    Color(0xff4169d8),
  ),
];

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    super.key,
    required this.user,
    required this.onLogout,
  });
  final Map<String, dynamic> user;
  final Future<void> Function() onLogout;
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int tab = 0;
  int registrationsVersion = 0;
  String? selected;
  Map<String, dynamic>? activityDetail;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.white,
          elevation: 0,
          centerTitle: true,
          leadingWidth: 56,
          leading: Padding(
            padding: const EdgeInsets.only(left: 12, top: 12, bottom: 12),
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xff1769e8),
                borderRadius: BorderRadius.circular(9),
              ),
              alignment: Alignment.center,
              child: const Text('IT',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w800)),
            ),
          ),
          title: Text(
            selected ?? (activityDetail != null ? 'Chi tiết hoạt động' :
                const [
                  'FIT Academic',
                  'Khám phá',
                  'Thông báo',
                  'Hồ sơ',
                ][tab]),
            style: const TextStyle(
                color: Color(0xff17345b),
                fontSize: 16,
                fontWeight: FontWeight.w700),
          ),
          actions: [
            IconButton(
              tooltip: 'Thông báo',
              onPressed: () => setState(() {
                tab = 2;
                selected = null;
                activityDetail = null;
              }),
              icon: const Icon(Icons.notifications_none_rounded,
                  color: Color(0xff17345b), size: 22),
            ),
            if (selected == 'Đăng ký tham dự & Cổ vũ')
              IconButton(
                tooltip: 'Đăng ký hoạt động',
                onPressed: _openRegistrationDialog,
                icon: const Icon(Icons.add_circle_outline_rounded,
                    color: Color(0xff1769e8)),
              ),
            PopupMenuButton<String>(
              onSelected: (value) {
                if (value == 'logout') widget.onLogout();
                if (value == 'profile') setState(() {
                  tab = 3;
                  selected = null;
                  activityDetail = null;
                });
              },
              itemBuilder: (_) => [
                PopupMenuItem(
                  enabled: false,
                  child: Text((widget.user['name'] ??
                          widget.user['username'] ??
                          'Tài khoản')
                      .toString()),
                ),
                const PopupMenuItem(
                    value: 'profile', child: Text('Hồ sơ cá nhân')),
                const PopupMenuItem(value: 'logout', child: Text('Đăng xuất')),
              ],
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: CircleAvatar(
                  radius: 15,
                  backgroundColor: const Color(0xffdce8f0),
                  child: Text(
                    _initialOf(widget.user['name'] ?? widget.user['username']),
                    style: const TextStyle(
                        color: Color(0xff3156c8),
                        fontSize: 12,
                        fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 2),
          ],
        ),
        body: activityDetail != null
            ? ActivityDetailScreen(
                key: ValueKey('activity-${activityDetail!['MaHD']}'),
                activity: activityDetail!,
                onBack: () => setState(() => activityDetail = null),
                onRegister: _registerActivity,
              )
            : selected != null
            ? FeatureDetail(
                key: ValueKey('$selected-$registrationsVersion'),
                title: selected!,
                onBack: () => setState(() => selected = null),
              )
            : switch (tab) {
                1 => ExploreContent(onOpenActivity: _openActivityDetails),
                2 => NewsContent(onBack: () => setState(() => tab = 0)),
                3 =>
                  StudentRecordsContent(onBack: () => setState(() => tab = 0)),
                _ => HomeContent(
                    user: widget.user,
                    onFeature: _openFeature,
                    onExplore: () => setState(() => tab = 1),
                    onRegistrations: () =>
                        _openFeature('Đăng ký tham dự & Cổ vũ'),
                    onOpenActivity: _openActivityDetails,
                  ),
              },
        bottomNavigationBar: NavigationBar(
          selectedIndex: tab,
          onDestinationSelected: (value) => setState(() {
            tab = value;
            selected = null;
            activityDetail = null;
          }),
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.white,
          indicatorColor: const Color(0xffe8f0ff),
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home_rounded),
              label: 'Trang chủ',
            ),
            NavigationDestination(
              icon: Icon(Icons.explore_outlined),
              selectedIcon: Icon(Icons.explore_rounded),
              label: 'Khám phá',
            ),
            NavigationDestination(
              icon: Icon(Icons.notifications_none_rounded),
              selectedIcon: Icon(Icons.notifications_active_rounded),
              label: 'Thông báo',
            ),
            NavigationDestination(
              icon: Icon(Icons.person_outline_rounded),
              selectedIcon: Icon(Icons.person_rounded),
              label: 'Cá nhân',
            ),
          ],
        ),
      );

  void _openFeature(String title) {
    setState(() {
      selected = null;
      activityDetail = null;
      switch (title) {
        case 'Đăng ký tham dự & Cổ vũ':
          tab = 0;
          selected = title;
          break;
        case 'Điểm danh di động':
          tab = 0;
          selected = title;
          break;
        case 'Nhắc lịch hoạt động':
          tab = 0;
          selected = title;
          break;
        case 'Thông tin cá nhân & lịch sử':
          tab = 3;
          break;
        case 'Tin tức & thông báo':
          tab = 2;
          break;
        default:
          selected = title;
          tab = 0;
      }
    });
  }

  void _openActivityDetails(Map<String, dynamic> activity) {
    setState(() {
      selected = null;
      activityDetail = activity;
    });
  }

  Future<void> _refreshActivityDetails(int activityId) async {
    try {
      final activities = _recordRows(await Api.activities());
      if (!mounted || '${activityDetail?['MaHD']}' != '$activityId') return;
      final updated = activities
          .where((activity) => '${activity['MaHD']}' == '$activityId')
          .firstOrNull;
      if (updated != null) setState(() => activityDetail = updated);
    } catch (_) {
      // Refresh failure does not change the registration result.
    }
  }

  Future<void> _openRegistrationDialog() async {
    final input = await showDialog<RegistrationInput>(
      context: context,
      builder: (_) => const RegistrationDialog(),
    );
    if (!mounted || input == null) return;
    final topic = input.type == 'Dự thi'
        ? await _askCompetitionTopic(context)
        : null;
    if (!mounted || (input.type == 'Dự thi' && topic == null)) return;
    try {
      await Api.registerIndividual(input.activityId, input.type, topic: topic);
      unawaited(ActivityReminderNotifications.syncWithServer());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đăng ký hoạt động thành công.')),
      );
      setState(() => registrationsVersion++);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  Future<void> _registerActivity(Map<String, dynamic> activity) async {
    final maHD = int.tryParse('${activity['MaHD'] ?? ''}');
    final maCThi = int.tryParse('${activity['MaCThi'] ?? ''}');
    if (maHD == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Hoạt động chưa có mã hợp lệ nên chưa thể đăng ký.'),
      ));
      return;
    }

    final action = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title:
            Text((activity['TenHoatDong'] ?? 'Đăng ký hoạt động').toString()),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (maCThi != null) ...[
              _actionTile(dialogContext, 'individual', Icons.person_outline,
                  'Dự thi cá nhân'),
              _actionTile(
                  dialogContext, 'create-team', Icons.group_add, 'Tạo đội thi'),
              _actionTile(dialogContext, 'join-team', Icons.group_outlined,
                  'Tham gia đội bằng mã'),
            ] else
              _actionTile(dialogContext, 'attend', Icons.event_available,
                  'Đăng ký tham dự'),
            _actionTile(dialogContext, 'support', Icons.volunteer_activism,
                'Đăng ký hỗ trợ'),
            _actionTile(dialogContext, 'cheer', Icons.campaign_outlined,
                'Đăng ký cổ vũ'),
          ],
        ),
      ),
    );
    if (action == null) return;

    try {
      dynamic result;
      switch (action) {
        case 'create-team':
          final input = await showDialog<TeamCreationInput>(
            context: context,
            builder: (_) => const TeamCreationDialog(),
          );
          if (!mounted || input == null || maCThi == null) return;
          final teamTopic = await _askCompetitionTopic(context);
          if (!mounted || teamTopic == null) return;
          result = await Api.registerTeam(maCThi, input.name, input.members, teamTopic);
          break;
        case 'join-team':
          final teamId = await showDialog<int>(
            context: context,
            builder: (_) => const JoinTeamDialog(),
          );
          if (teamId == null) return;
          result = await Api.joinTeam(teamId);
          break;
        case 'individual':
          if (!mounted) return;
          final individualTopic = await _askCompetitionTopic(context);
          if (!mounted || individualTopic == null) return;
          result = await Api.registerIndividual(maHD, 'Dự thi', topic: individualTopic);
          break;
        case 'support':
          result = await Api.registerIndividual(maHD, 'Hỗ trợ');
          break;
        case 'cheer':
          result = await Api.registerIndividual(maHD, 'Cổ vũ');
          break;
        default:
          result = await Api.registerIndividual(maHD, 'Tham gia');
      }
      if (!mounted) return;
      final data = result is Map ? result['data'] : null;
      final isWaiting = data is Map && data['trangThai'] == 'Đang chờ';
      final isSameActivity = action != 'join-team' ||
          (data is Map && '${data['maCThi']}' == '$maCThi');
      setState(() {
        registrationsVersion++;
        if (isSameActivity && '${activityDetail?['MaHD']}' == '$maHD') {
          activityDetail = {
            ...activityDetail!,
            'TrangThaiDangKyCuaToi': isWaiting ? 'Đang chờ' : 'Đã đăng ký',
          };
        }
      });
      unawaited(ActivityReminderNotifications.syncWithServer());
      final teamCode = data is Map ? data['maDoi'] : null;
      final responseMessage = result is Map ? result['message'] : null;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(teamCode == null || isWaiting || action != 'create-team'
            ? (responseMessage?.toString() ?? 'Đăng ký thành công.')
            : 'Tạo đội thành công. Mã đội của bạn: $teamCode'),
        duration: const Duration(seconds: 5),
      ));
      await _refreshActivityDetails(maHD);
    } catch (error) {
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Chưa đăng ký được'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Đóng'),
            ),
          ],
        ),
      );
    }
  }

  Widget _actionTile(
    BuildContext context,
    String value,
    IconData icon,
    String label,
  ) =>
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Icon(icon, color: const Color(0xff3156c8)),
        title: Text(label),
        onTap: () => Navigator.pop(context, value),
      );
}

class TeamCreationInput {
  const TeamCreationInput(this.name, this.members);
  final String name;
  final List<String> members;
}

class TeamCreationDialog extends StatefulWidget {
  const TeamCreationDialog({super.key});
  @override
  State<TeamCreationDialog> createState() => _TeamCreationDialogState();
}

class _TeamCreationDialogState extends State<TeamCreationDialog> {
  final nameController = TextEditingController();
  final memberController = TextEditingController();
  String? error;

  @override
  void dispose() {
    nameController.dispose();
    memberController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Tạo đội thi'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(
            controller: nameController,
            decoration: const InputDecoration(labelText: 'Tên đội'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: memberController,
            decoration: const InputDecoration(
              labelText: 'MSSV thành viên',
              helperText: 'Nhập một hoặc nhiều MSSV, cách nhau bằng dấu phẩy.',
            ),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(error!, style: const TextStyle(color: Colors.red)),
            ),
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Hủy')),
          FilledButton(
            onPressed: () {
              final members = memberController.text
                  .split(',')
                  .map((value) => value.trim())
                  .where((value) => value.isNotEmpty)
                  .toSet()
                  .toList();
              if (nameController.text.trim().length < 2 || members.isEmpty) {
                setState(() =>
                    error = 'Nhập tên đội và ít nhất một MSSV thành viên.');
                return;
              }
              Navigator.pop(context,
                  TeamCreationInput(nameController.text.trim(), members));
            },
            child: const Text('Tạo đội'),
          ),
        ],
      );
}

class JoinTeamDialog extends StatefulWidget {
  const JoinTeamDialog({super.key});
  @override
  State<JoinTeamDialog> createState() => _JoinTeamDialogState();
}

class _JoinTeamDialogState extends State<JoinTeamDialog> {
  final codeController = TextEditingController();
  String? error;

  @override
  void dispose() {
    codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Tham gia đội thi'),
        content: TextField(
          controller: codeController,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: 'Mã đội',
            helperText: error,
            helperStyle: const TextStyle(color: Colors.red),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Hủy')),
          FilledButton(
            onPressed: () {
              final code = int.tryParse(codeController.text.trim());
              if (code == null || code < 1) {
                setState(() => error = 'Mã đội phải là số nguyên dương.');
                return;
              }
              Navigator.pop(context, code);
            },
            child: const Text('Tham gia'),
          ),
        ],
      );
}

class RegistrationInput {
  const RegistrationInput(this.activityId, this.type);
  final int activityId;
  final String type;
}

class RegistrationDialog extends StatefulWidget {
  const RegistrationDialog({super.key});
  @override
  State<RegistrationDialog> createState() => _RegistrationDialogState();
}

class _RegistrationDialogState extends State<RegistrationDialog> {
  final idController = TextEditingController();
  String type = 'Dự thi';
  String? error;
  @override
  void dispose() {
    idController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Đăng ký hoạt động'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
                'Nhập mã hoạt động được cung cấp trong thông báo của khoa.'),
            const SizedBox(height: 14),
            TextField(
              controller: idController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Mã hoạt động'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: type,
              decoration: const InputDecoration(labelText: 'Hình thức'),
              items: const ['Dự thi', 'Tham gia', 'Hỗ trợ', 'Cổ vũ']
                  .map(
                    (value) =>
                        DropdownMenuItem(value: value, child: Text(value)),
                  )
                  .toList(),
              onChanged: (value) {
                if (value != null) setState(() => type = value);
              },
            ),
            if (error != null) ...[
              const SizedBox(height: 8),
              Text(error!, style: const TextStyle(color: Color(0xffb42318))),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () {
              final id = int.tryParse(idController.text.trim());
              if (id == null || id < 1) {
                setState(() => error = 'Mã hoạt động phải là số nguyên dương.');
                return;
              }
              Navigator.pop(context, RegistrationInput(id, type));
            },
            child: const Text('Gửi đăng ký'),
          ),
        ],
      );
}

class HomeContent extends StatefulWidget {
  const HomeContent({
    super.key,
    required this.user,
    required this.onFeature,
    required this.onExplore,
    required this.onRegistrations,
    required this.onOpenActivity,
  });
  final Map<String, dynamic> user;
  final ValueChanged<String> onFeature;
  final VoidCallback onExplore;
  final VoidCallback onRegistrations;
  final ValueChanged<Map<String, dynamic>> onOpenActivity;

  @override
  State<HomeContent> createState() => _HomeContentState();
}

class _HomeContentState extends State<HomeContent> {
  late Future<List<dynamic>> data;

  @override
  void initState() {
    super.initState();
    data = _load();
  }

  Future<List<dynamic>> _load() => Future.wait([
        Api.activities(),
        Api.myRegistrations(),
        Api.myTrainingPoints(),
        Api.reminders(),
      ]);

  Future<void> _refresh() async {
    final next = _load();
    // setState callbacks must return synchronously. An expression-bodied
    // callback here returns the Future assigned to `data`.
    setState(() {
      data = next;
    });
    await next;
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<dynamic>>(
        future: data,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _RetryView(
              message:
                  snapshot.error.toString().replaceFirst('Exception: ', ''),
              onRetry: _refresh,
            );
          }
          final values = snapshot.data ?? const <dynamic>[];
          final activities = _recordRows(values[0]);
          final registrations = _recordRows(values[1]);
          final pointData = values[2] is Map
              ? Map<String, dynamic>.from(values[2] as Map)
              : <String, dynamic>{};
          final reminders = _recordRows(values[3]);
          final name = (widget.user['name'] ?? widget.user['username'] ?? 'bạn')
              .toString();
          final upcoming = activities.isEmpty ? null : activities.first;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 26),
              children: [
                Row(children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Chào buổi sáng,',
                            style: TextStyle(
                                color: Color(0xff687b92), fontSize: 13)),
                        Text('$name 👋',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: Color(0xff17345b),
                                fontSize: 20,
                                fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
                  CircleAvatar(
                    backgroundColor: const Color(0xffd8e7eb),
                    child: Text(_initialOf(name),
                        style: const TextStyle(
                            color: Color(0xff31566d),
                            fontWeight: FontWeight.w800)),
                  ),
                ]),
                const SizedBox(height: 14),
                if (upcoming != null)
                  _UpcomingActivityCard(
                    activity: upcoming,
                    isRegistered: registrations.any((row) =>
                        '${row['MaHD'] ?? ''}' == '${upcoming['MaHD'] ?? ''}'),
                    onTap: () => widget.onOpenActivity(upcoming),
                    onCalendar: () => widget.onFeature('Nhắc lịch hoạt động'),
                  )
                else
                  _EmptyUpcoming(onExplore: widget.onExplore),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                      child: _DashboardStat(
                          icon: Icons.task_alt_rounded,
                          value:
                              '${registrations.length.toString().padLeft(2, '0')}',
                          label: 'Đã tham gia',
                          color: const Color(0xff18a781))),
                  const SizedBox(width: 9),
                  Expanded(
                      child: _DashboardStat(
                          icon: Icons.auto_awesome_rounded,
                          value: '${pointData['tongDiem'] ?? 0}',
                          label: 'Điểm rèn luyện',
                          color: const Color(0xff8060d6))),
                  const SizedBox(width: 9),
                  Expanded(
                      child: _DashboardStat(
                          icon: Icons.event_available_rounded,
                          value:
                              '${reminders.length.toString().padLeft(2, '0')}',
                          label: 'Sắp tới',
                          color: const Color(0xff3a80ef))),
                ]),
                const SizedBox(height: 17),
                Row(children: [
                  const Expanded(
                    child: Text('Dành cho bạn',
                        style: TextStyle(
                            fontSize: 17,
                            color: Color(0xff17345b),
                            fontWeight: FontWeight.w800)),
                  ),
                  TextButton(
                      onPressed: widget.onExplore,
                      child: const Text('Xem tất cả')),
                ]),
                if (activities.isEmpty)
                  const _EmptyActivityCard()
                else
                  ...activities.take(2).map((activity) => _CompactActivityCard(
                        activity: activity,
                        onTap: () => widget.onOpenActivity(activity),
                      )),
                if (reminders.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  _ReminderBanner(
                    count: reminders.length,
                    nextReminder: reminders.first,
                    onTap: () => widget.onFeature('Nhắc lịch hoạt động'),
                  ),
                ],
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: _QuickAction(
                        icon: Icons.qr_code_scanner_rounded,
                        label: 'Điểm danh QR',
                        onTap: () => widget.onFeature('Điểm danh di động')),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _QuickAction(
                        icon: Icons.assignment_turned_in_outlined,
                        label: 'Đăng ký của tôi',
                        onTap: widget.onRegistrations),
                  ),
                ]),
              ],
            ),
          );
        },
      );
}

class _UpcomingActivityCard extends StatelessWidget {
  const _UpcomingActivityCard(
      {required this.activity,
      required this.isRegistered,
      required this.onTap,
      required this.onCalendar});
  final Map<String, dynamic> activity;
  final bool isRegistered;
  final VoidCallback onTap;
  final VoidCallback onCalendar;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
            color: const Color(0xff102d4c),
            borderRadius: BorderRadius.circular(19)),
        child: Stack(children: [
          Positioned(
              right: -36,
              top: -46,
              child: Container(
                  width: 110,
                  height: 110,
                  decoration: const BoxDecoration(
                      color: Color(0xff174577), shape: BoxShape.circle))),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Expanded(
                  child: Text('SẮP DIỄN RA',
                      style: TextStyle(
                          color: Color(0xffa9c8f4),
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          letterSpacing: .5))),
              IconButton(
                  onPressed: onCalendar,
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.calendar_month_outlined,
                      color: Colors.white, size: 18)),
            ]),
            Text((activity['TenHoatDong'] ?? 'Hoạt động học thuật').toString(),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    height: 1.2,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 9),
            Text(
                '${_formatMobileDate(activity['TgBatDau'] ?? activity['TgDuKien'])} · ${activity['DiaDiem'] ?? 'Chưa cập nhật địa điểm'}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Color(0xffc3d2e3), fontSize: 10)),
            const SizedBox(height: 12),
            Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                    onPressed: onTap,
                    style: TextButton.styleFrom(
                        backgroundColor: isRegistered
                            ? const Color(0xffd8f3e7)
                            : const Color(0xff1769e8),
                        foregroundColor: isRegistered
                            ? const Color(0xff147653)
                            : Colors.white,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 13, vertical: 5),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                    child: Text(isRegistered ? 'Đã đăng ký' : 'Xem hoạt động',
                        style: const TextStyle(
                            fontSize: 10, fontWeight: FontWeight.w700)))),
          ]),
        ]),
      );
}

class _DashboardStat extends StatelessWidget {
  const _DashboardStat(
      {required this.icon,
      required this.value,
      required this.label,
      required this.color});
  final IconData icon;
  final String value;
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        height: 69,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(13),
            border: Border.all(color: const Color(0xffe7edf4))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 5),
            Text(value,
                style: const TextStyle(
                    color: Color(0xff17345b),
                    fontSize: 14,
                    fontWeight: FontWeight.w800))
          ]),
          const Spacer(),
          Text(label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Color(0xff718096), fontSize: 8.5)),
        ]),
      );
}

class _CompactActivityCard extends StatelessWidget {
  const _CompactActivityCard({required this.activity, required this.onTap});
  final Map<String, dynamic> activity;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final type = _activityType(activity);
    final isContest = type == 'Cuộc thi';
    return Card(
        color: Colors.white,
        elevation: 0,
        margin: const EdgeInsets.only(bottom: 8),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: const BorderSide(color: Color(0xffe7edf4))),
        child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: onTap,
            child: Padding(
                padding: const EdgeInsets.all(9),
                child: Row(children: [
                  Container(
                      width: 62,
                      height: 58,
                      decoration: BoxDecoration(
                          color: const Color(0xffe8f1ff),
                          borderRadius: BorderRadius.circular(10)),
                      child: Icon(
                          isContest
                              ? Icons.emoji_events_outlined
                              : Icons.groups_2_outlined,
                          color: const Color(0xff3983e8),
                          size: 23)),
                  const SizedBox(width: 10),
                  Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(
                                color: const Color(0xffe6f6ef),
                                borderRadius: BorderRadius.circular(20)),
                            child: Text(type,
                                style: const TextStyle(
                                    color: Color(0xff18815e), fontSize: 8))),
                        const SizedBox(height: 4),
                        Text(
                            (activity['TenHoatDong'] ?? 'Hoạt động học thuật')
                                .toString(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: Color(0xff183250),
                                fontSize: 11,
                                fontWeight: FontWeight.w700)),
                        Text(
                            '${_formatMobileDate(activity['TgBatDau'] ?? activity['TgDuKien'])} · ${activity['DiaDiem'] ?? 'Chưa có địa điểm'}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: Color(0xff718096), fontSize: 8.5)),
                      ])),
                  const Icon(Icons.chevron_right,
                      color: Color(0xff92a2b3), size: 18),
                ]))));
  }
}

class _ReminderBanner extends StatelessWidget {
  const _ReminderBanner(
      {required this.count, required this.nextReminder, required this.onTap});
  final int count;
  final Map<String, dynamic> nextReminder;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
      color: const Color(0xfffff3df),
      borderRadius: BorderRadius.circular(13),
      child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(13),
          child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
              child: Row(children: [
                const Icon(Icons.notifications_active_outlined,
                    color: Color(0xffdf8b1b), size: 17),
                const SizedBox(width: 9),
                Expanded(
                    child: Text(
                        'Bạn có $count hoạt động sắp tới cần chuẩn bị: ${nextReminder['TenHoatDong'] ?? 'xem nhắc lịch'}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: Color(0xff6f5629),
                            fontSize: 9,
                            height: 1.25))),
                const Icon(Icons.chevron_right,
                    color: Color(0xffdf8b1b), size: 17),
              ]))));
}

class _QuickAction extends StatelessWidget {
  const _QuickAction(
      {required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 16),
      label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
      style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xff3156c8),
          backgroundColor: Colors.white,
          textStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          side: const BorderSide(color: Color(0xffdce6f4)),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))));
}

class _EmptyUpcoming extends StatelessWidget {
  const _EmptyUpcoming({required this.onExplore});
  final VoidCallback onExplore;
  @override
  Widget build(BuildContext context) => Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: const Color(0xff102d4c),
          borderRadius: BorderRadius.circular(19)),
      child: Row(children: [
        const Icon(Icons.event_available_outlined,
            color: Colors.white, size: 25),
        const SizedBox(width: 11),
        const Expanded(
            child: Text('Chưa có hoạt động sắp tới',
                style: TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w700))),
        TextButton(onPressed: onExplore, child: const Text('Khám phá'))
      ]));
}

class _EmptyActivityCard extends StatelessWidget {
  const _EmptyActivityCard();
  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xffe7edf4))),
      child: const Text('Không có hoạt động phù hợp.',
          style: TextStyle(color: Color(0xff718096), fontSize: 11)));
}

class _EmptyTopicCard extends StatelessWidget {
  const _EmptyTopicCard();
  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xffe7edf4))),
      child: const Text('Chưa có đề tài nào trong các cuộc thi đã công bố.',
          style: TextStyle(color: Color(0xff718096), fontSize: 11)));
}

class ExploreContent extends StatefulWidget {
  const ExploreContent({super.key, required this.onOpenActivity});
  final ValueChanged<Map<String, dynamic>> onOpenActivity;
  @override
  State<ExploreContent> createState() => _ExploreContentState();
}

class _ExploreContentState extends State<ExploreContent> {
  late Future<List<dynamic>> activities;
  final searchController = TextEditingController();
  String category = 'Tất cả';
  Future<List<dynamic>>? topics;

  @override
  void initState() {
    super.initState();
    activities = Api.activities();
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  void _choose(String value) {
    setState(() {
      category = value;
      if (value == 'Đề tài' && topics == null) topics = Api.publicCompetitionTopics();
    });
  }

  void _retryTopics() => setState(() {
        topics = Api.publicCompetitionTopics();
      });

  Future<void> _refresh() async {
    final next = Api.activities();
    final nextTopics =
        category == 'Đề tài' ? Api.publicCompetitionTopics() : null;
    setState(() {
      activities = next;
      if (nextTopics != null) topics = nextTopics;
    });
    try {
      await Future.wait([next, if (nextTopics != null) nextTopics]);
    } catch (_) {
      // The activity and topic builders display their own retry states.
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<dynamic>>(
        future: activities,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting &&
              !snapshot.hasData)
            return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError)
            return _RetryView(
                message:
                    snapshot.error.toString().replaceFirst('Exception: ', ''),
                onRetry: _refresh);
          final rows = _recordRows(snapshot.data);
          final search = searchController.text.trim().toLowerCase();
          final filtered = rows.where((row) {
            final type = _activityType(row);
            final categoryMatch = category == 'Tất cả' || type == category;
            final text =
                '${row['TenHoatDong'] ?? ''} ${row['ChuDe'] ?? ''} ${row['DiaDiem'] ?? ''} $type'
                    .toLowerCase();
            return categoryMatch && text.contains(search);
          }).toList();
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
              children: [
                TextField(
                    controller: searchController,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.search_rounded),
                        hintText: 'Tìm hoạt động, seminar...',
                        contentPadding: EdgeInsets.symmetric(vertical: 11))),
                const SizedBox(height: 9),
                SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(children: [
                      for (final item in [
                        'Tất cả',
                        'Seminar',
                        'Cuộc thi',
                        'Workshop',
                        'Đề tài'
                      ])
                        Padding(
                            padding: const EdgeInsets.only(right: 7),
                            child: ChoiceChip(
                                label: Text(item),
                                selected: category == item,
                                onSelected: (_) => _choose(item),
                                showCheckmark: false,
                                labelStyle: TextStyle(
                                    color: category == item
                                        ? Colors.white
                                        : const Color(0xff52667f),
                                    fontSize: 10),
                                selectedColor: const Color(0xff1769e8),
                                backgroundColor: Colors.white,
                                side:
                                    const BorderSide(color: Color(0xffe1e8f0)),
                                visualDensity: VisualDensity.compact)),
                    ])),
                if (category == 'Đề tài')
                  _CompetitionTopicsPanel(
                      future: topics,
                      searchQuery: search,
                      onRetry: _retryTopics)
                else ...[
                  if (category == 'Tất cả' &&
                      search.isEmpty &&
                      filtered.isNotEmpty) ...[
                    const SizedBox(height: 5),
                    _ExploreHero(
                        activity: filtered.first,
                        onTap: () => widget.onOpenActivity(filtered.first)),
                  ],
                  const SizedBox(height: 12),
                  Row(children: [
                    const Expanded(
                        child: Text('Hoạt động đã công bố',
                            style: TextStyle(
                                color: Color(0xff17345b),
                                fontWeight: FontWeight.w800,
                                fontSize: 16))),
                    Text('${filtered.length} hoạt động',
                        style: const TextStyle(
                            color: Color(0xff397ce3), fontSize: 10))
                  ]),
                  const SizedBox(height: 7),
                  if (filtered.isEmpty)
                    const _EmptyActivityCard()
                  else
                    ...filtered.map((activity) => _CompactActivityCard(
                        activity: activity,
                        onTap: () => widget.onOpenActivity(activity))),
                ],
              ],
            ),
          );
        },
      );
}

class _ExploreHero extends StatelessWidget {
  const _ExploreHero({required this.activity, required this.onTap});
  final Map<String, dynamic> activity;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
      color: const Color(0xff15567a),
      borderRadius: BorderRadius.circular(15),
      child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(15),
          child: Container(
              height: 88,
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(15),
                  gradient: const LinearGradient(
                      colors: [Color(0xff126e94), Color(0xff163957)])),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('NỔI BẬT',
                        style: TextStyle(
                            color: Color(0xffbce8ff),
                            fontSize: 8,
                            fontWeight: FontWeight.w800)),
                    const Spacer(),
                    Text(
                        (activity['TenHoatDong'] ?? 'Hoạt động học thuật')
                            .toString(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w700)),
                    Text(
                        '${_formatMobileDate(activity['TgBatDau'] ?? activity['TgDuKien'])} · ${activity['DiaDiem'] ?? 'Địa điểm sẽ cập nhật'}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: Color(0xffd1e7f3), fontSize: 8))
                  ]))));
}

class ActivityDetailScreen extends StatefulWidget {
  const ActivityDetailScreen({
    super.key,
    required this.activity,
    required this.onBack,
    required this.onRegister,
  });
  final Map<String, dynamic> activity;
  final VoidCallback onBack;
  final Future<void> Function(Map<String, dynamic>) onRegister;

  @override
  State<ActivityDetailScreen> createState() => _ActivityDetailScreenState();
}

class _ActivityDetailScreenState extends State<ActivityDetailScreen> {
  late Future<dynamic>? seminar;
  bool _registering = false;

  Future<void> _submitRegistration() async {
    if (_registering) return;
    setState(() => _registering = true);
    try {
      await widget.onRegister(widget.activity);
    } finally {
      if (mounted) setState(() => _registering = false);
    }
  }

  @override
  void initState() {
    super.initState();
    final id = int.tryParse('${widget.activity['MaSeminar'] ?? ''}');
    seminar = id == null ? null : Api.seminarDetails(id);
  }

  List<Map<String, dynamic>> _speakers(dynamic value) {
    if (value is List) return _recordRows(value);
    if (value is String && value.trim().isNotEmpty) {
      try {
        return _recordRows(jsonDecode(value));
      } catch (_) {
        return const [];
      }
    }
    return const [];
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<dynamic>(
        future: seminar,
        builder: (context, snapshot) {
          final extra = snapshot.data is Map
              ? Map<String, dynamic>.from(snapshot.data as Map)
              : <String, dynamic>{};
          final activity = widget.activity;
          final canRegister = activity['CoTheDangKy'] == true ||
              activity['CoTheDangKy'] == 1 ||
              activity['CoTheDangKy']?.toString() == '1';
          final registrationStatus = activity['TrangThaiDangKyCuaToi'] as String?;
          final canSubmit = canRegister && registrationStatus == null && !_registering;
          final registrationLabel = registrationStatus ??
              (_registering
                  ? 'Đang xử lý…'
                  : canRegister ? 'Đăng ký tham gia' : 'Chưa mở đăng ký');
          final start = activity['ThoiGianBatDau'] ??
              extra['ThoiGianBatDau'] ??
              activity['TgDuKien'];
          final end = activity['ThoiGianKetThuc'] ??
              extra['ThoiGianKetThuc'];
          final capacity = int.tryParse(
              '${activity['SLSVDuKien'] ?? extra['SLToiDa'] ?? ''}');
          final registered = int.tryParse('${activity['SoLuongDangKy'] ?? 0}') ?? 0;
          final speakers = _speakers(extra['DienGia']);
          final host = (extra['DVChuTri'] ?? '').toString().trim();
          final description = (activity['NoiDung'] ??
                  activity['MoTa'] ??
                  extra['NoiDung'] ??
                  'Thông tin chi tiết của hoạt động sẽ được cập nhật.')
              .toString();
          final type = _activityType(activity);

          return Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 2, 16, 4),
              child: Row(children: [
                IconButton(
                  tooltip: 'Quay lại danh sách hoạt động',
                  onPressed: widget.onBack,
                  icon: const Icon(Icons.arrow_back_rounded),
                  color: const Color(0xff17345b),
                ),
                const Expanded(
                  child: Text(
                    'Chi tiết hoạt động',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        color: Color(0xff17345b),
                        fontSize: 16,
                        fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(width: 48),
              ]),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 18),
                children: [
                  Container(
                    height: 154,
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      gradient: const LinearGradient(
                        colors: [Color(0xff0d7297), Color(0xff102d4c)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          _smallPill(type, Colors.white),
                          const Spacer(),
                          const Icon(Icons.auto_awesome_rounded,
                              color: Color(0xffbce8ff), size: 28),
                        ]),
                        const Spacer(),
                        Text(
                          (activity['TenHoatDong'] ??
                                  activity['TenCuocThi'] ??
                                  'Hoạt động học thuật')
                              .toString(),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 19,
                              fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 4),
                        Text(activity['TrangThai']?.toString() ?? 'Đang cập nhật',
                            style: const TextStyle(
                                color: Color(0xffd1e7f3), fontSize: 11)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    (activity['TenHoatDong'] ?? activity['TenCuocThi'] ?? '')
                        .toString(),
                    style: const TextStyle(
                        color: Color(0xff17345b),
                        fontSize: 22,
                        fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 12),
                  _activityInfo(Icons.calendar_month_rounded, 'Thời gian', [
                    _formatMobileDate(start),
                    if (end != null) 'đến ${_formatMobileDate(end)}',
                  ].join(' · ')),
                  _activityInfo(Icons.location_on_outlined, 'Địa điểm',
                      (activity['DiaDiem'] ?? extra['DiaDiem'] ?? 'Chưa cập nhật').toString()),
                  if (host.isNotEmpty)
                    _activityInfo(Icons.account_balance_outlined, 'Đơn vị chủ trì', host),
                  for (final speaker in speakers)
                    _activityInfo(Icons.person_outline_rounded, 'Người trình bày',
                        (speaker['hoTen'] ?? speaker['DienGia'] ?? 'Chưa cập nhật').toString()),
                  const Divider(height: 22),
                  const Text('Giới thiệu',
                      style: TextStyle(
                          color: Color(0xff17345b),
                          fontSize: 16,
                          fontWeight: FontWeight.w800)),
                  const SizedBox(height: 7),
                  Text(description,
                      style: const TextStyle(
                          color: Color(0xff667085), height: 1.55)),
                  const SizedBox(height: 14),
                  if (capacity != null && capacity > 0) ...[
                    _activityInfo(Icons.groups_2_outlined, 'Đăng ký',
                        '$registered / $capacity sinh viên · Còn ${(capacity - registered).clamp(0, capacity)} chỗ'),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: (registered / capacity).clamp(0, 1).toDouble(),
                        minHeight: 7,
                        backgroundColor: const Color(0xffe7edf5),
                      ),
                    ),
                  ],
                  if (snapshot.hasError) ...[
                    const SizedBox(height: 10),
                    const Text('Một số thông tin mở rộng của seminar chưa tải được.',
                        style: TextStyle(color: Color(0xff8493a5), fontSize: 11)),
                  ],
                ],
              ),
            ),
            if (!canRegister && registrationStatus == null)
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 2, 16, 4),
                child: Text(
                  'Hoạt động đã công bố nhưng chưa đủ điều kiện đăng ký. Kế hoạch chi tiết cần được khoa và Phòng CTSV ký duyệt.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xff718096), fontSize: 11),
                ),
              ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: canSubmit ? _submitRegistration : null,
                    icon: Icon(switch (registrationStatus) {
                      'Đã đăng ký' => Icons.check_circle_outline_rounded,
                      null when canSubmit => Icons.event_available_rounded,
                      _ => Icons.hourglass_top_rounded,
                    }),
                    label: Text(registrationLabel),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      backgroundColor: const Color(0xff1769e8),
                    ),
                  ),
                ),
              ),
            ),
          ]);
        },
      );

  Widget _smallPill(String text, Color background) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
            color: background.withValues(alpha: .16),
            borderRadius: BorderRadius.circular(20)),
        child: Text(text,
            style: const TextStyle(
                color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
      );

  Widget _activityInfo(IconData icon, String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 9),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, color: const Color(0xff3479e8), size: 19),
          const SizedBox(width: 10),
          Expanded(
            child: Text('$label\n$value',
                style: const TextStyle(
                    color: Color(0xff52667f), fontSize: 12, height: 1.4)),
          ),
        ]),
      );
}

class _CompetitionTopicsPanel extends StatefulWidget {
  const _CompetitionTopicsPanel({required this.future, required this.searchQuery, required this.onRetry});
  final Future<List<dynamic>>? future;
  final String searchQuery;
  final VoidCallback onRetry;

  @override
  State<_CompetitionTopicsPanel> createState() => _CompetitionTopicsPanelState();
}

class _CompetitionTopicsPanelState extends State<_CompetitionTopicsPanel> {
  String area = 'Tất cả';

  void _showTopic(BuildContext context, Map<String, dynamic> topic) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: EdgeInsets.fromLTRB(
            20, 12, 20, 24 + MediaQuery.viewInsetsOf(context).bottom),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          top: false,
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Center(child: Container(width: 38, height: 4, decoration: BoxDecoration(color: const Color(0xffd7deea), borderRadius: BorderRadius.circular(8)))),
            const SizedBox(height: 18),
            Text((topic['TenDeTai'] ?? 'Đề tài dự thi').toString(),
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xff17345b))),
            const SizedBox(height: 6),
            Text('${topic['TenCuocThi'] ?? ''} · ${topic['LinhVuc'] ?? 'Chưa phân loại'}',
                style: const TextStyle(color: Color(0xff397ce3), fontSize: 12)),
            const Divider(height: 24),
            Text((topic['MoTa'] ?? 'Chưa có mô tả cho đề tài này.').toString(),
                style: const TextStyle(color: Color(0xff52667f), height: 1.5)),
            const SizedBox(height: 14),
            if ((topic['TenDoi'] ?? '').toString().isNotEmpty)
              Text('Đội thực hiện: ${topic['TenDoi']}', style: const TextStyle(color: Color(0xff52667f), fontSize: 12)),
            if ((topic['TenChuNhiem'] ?? topic['GVHD'] ?? '').toString().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 7),
                child: Text('Người hướng dẫn / chủ nhiệm: ${topic['TenChuNhiem'] ?? topic['GVHD']}',
                    style: const TextStyle(color: Color(0xff52667f), fontSize: 12)),
              ),
            const SizedBox(height: 16),
            Align(alignment: Alignment.centerRight, child: TextButton(onPressed: () => Navigator.pop(context), child: const Text('Đóng'))),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.future == null)
      return const Padding(
          padding: EdgeInsets.all(30),
          child: Center(child: CircularProgressIndicator()));
    return FutureBuilder<List<dynamic>>(
        future: widget.future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting)
            return const Padding(
                padding: EdgeInsets.all(30),
                child: Center(child: CircularProgressIndicator()));
          if (snapshot.hasError)
            return _RetryView(
                message:
                    snapshot.error.toString().replaceFirst('Exception: ', ''),
                onRetry: widget.onRetry);
          final allRows = _recordRows(snapshot.data);
          final areas = <String>{
            'Tất cả',
            ...allRows.map((row) => '${row['LinhVuc'] ?? ''}'.trim()).where((value) => value.isNotEmpty),
          }.toList();
          if (!areas.contains(area)) area = 'Tất cả';
          final rows = allRows.where((row) {
            final title = '${row['TenDeTai'] ?? ''} ${row['TenCuocThi'] ?? ''} ${row['LinhVuc'] ?? ''}'.toLowerCase();
            return (area == 'Tất cả' || '${row['LinhVuc'] ?? ''}' == area) && title.contains(widget.searchQuery);
          }).toList();
          if (rows.isEmpty) return const _EmptyTopicCard();
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: areas.map((item) => Padding(
                padding: const EdgeInsets.only(right: 7),
                child: ChoiceChip(
                  label: Text(item),
                  selected: area == item,
                  onSelected: (_) => setState(() => area = item),
                  showCheckmark: false,
                  selectedColor: const Color(0xff1769e8),
                  backgroundColor: Colors.white,
                  labelStyle: TextStyle(color: area == item ? Colors.white : const Color(0xff52667f), fontSize: 10),
                  visualDensity: VisualDensity.compact,
                ),
              )).toList()),
            ),
            const SizedBox(height: 6),
            ...rows.map((topic) => Card(
                color: Colors.white,
                elevation: 0,
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(13),
                    side: const BorderSide(color: Color(0xffe5ebf4))),
                child: ListTile(
                    onTap: () => _showTopic(context, topic),
                    leading: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(color: const Color(0xffeaf1ff), borderRadius: BorderRadius.circular(12)),
                      child: const Icon(Icons.lightbulb_outline, color: Color(0xff3479e8)),
                    ),
                    title: Text(
                        (topic['TenDeTai'] ?? 'Đề tài dự thi').toString(),
                        style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w700)),
                    subtitle: Text(
                        '${topic['TenCuocThi'] ?? ''} · ${topic['LinhVuc'] ?? topic['TrangThai'] ?? ''}',
                        style: const TextStyle(fontSize: 9)),
                    trailing: const Icon(Icons.favorite_border_rounded, color: Color(0xffe65c73), size: 18),
                ))),
          ]);
        });
  }
}

class ActivityFeed extends StatefulWidget {
  const ActivityFeed({super.key, required this.onRegister});
  final ValueChanged<Map<String, dynamic>> onRegister;

  @override
  State<ActivityFeed> createState() => _ActivityFeedState();
}

class _ActivityFeedState extends State<ActivityFeed> {
  late Future<List<dynamic>> activities;

  @override
  void initState() {
    super.initState();
    activities = Api.activities();
  }

  Future<void> refresh() async {
    setState(() {
      activities = Api.activities();
    });
    await activities;
  }

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Cuộc thi & Seminar',
                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
              IconButton(
                tooltip: 'Làm mới',
                onPressed: refresh,
                icon: const Icon(Icons.refresh_rounded),
              ),
            ],
          ),
          FutureBuilder<List<dynamic>>(
            future: activities,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              if (snapshot.hasError) {
                return Card(
                  child: ListTile(
                    leading: const Icon(Icons.cloud_off_outlined),
                    title: const Text('Chưa tải được danh sách hoạt động'),
                    subtitle: Text(snapshot.error
                        .toString()
                        .replaceFirst('Exception: ', '')),
                    trailing: IconButton(
                      onPressed: refresh,
                      icon: const Icon(Icons.refresh),
                    ),
                  ),
                );
              }
              final rows = snapshot.data ?? <dynamic>[];
              if (rows.isEmpty) {
                return Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xffe8ebf2)),
                  ),
                  child:
                      const Text('Hiện chưa có cuộc thi hoặc seminar sắp tới.'),
                );
              }
              return Column(
                children: rows.map((item) {
                  final activity = item is Map
                      ? Map<String, dynamic>.from(item)
                      : <String, dynamic>{};
                  return ActivityCard(
                    activity: activity,
                    onRegister: () => widget.onRegister(activity),
                  );
                }).toList(),
              );
            },
          ),
        ],
      );
}

class ActivityCard extends StatelessWidget {
  const ActivityCard({
    super.key,
    required this.activity,
    required this.onRegister,
  });
  final Map<String, dynamic> activity;
  final VoidCallback onRegister;

  String _shortDate(dynamic value) => (value ?? 'Chưa cập nhật')
      .toString()
      .replaceFirst('T', ' ')
      .split('.')
      .first;

  @override
  Widget build(BuildContext context) {
    final type = _activityType(activity);
    final isCompetition = type == 'Cuộc thi';
    final isSeminar = type == 'Seminar';
    final kind = type.toUpperCase();
    final subtitle = [
      _shortDate(activity['TgBatDau']),
      (activity['DiaDiem'] ?? 'Chưa có địa điểm').toString(),
      if (activity['HanDangKy'] != null)
        'Hạn đăng ký: ${_shortDate(activity['HanDangKy'])}',
    ].join(' · ');
    final details = (activity['ChuDe'] ??
            activity['TheLe'] ??
            activity['MoTa'] ??
            'Chưa có mô tả chi tiết.')
        .toString();

    return Card(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xffe8ebf2)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => showDialog<void>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: Text((activity['TenHoatDong'] ?? 'Hoạt động').toString()),
            content: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(kind,
                      style: const TextStyle(
                          color: Color(0xff3156c8),
                          fontWeight: FontWeight.w800)),
                  const SizedBox(height: 12),
                  Text('Thời gian: ${_shortDate(activity['TgBatDau'])}'),
                  Text('Kết thúc: ${_shortDate(activity['TgKetThuc'])}'),
                  Text('Địa điểm: ${activity['DiaDiem'] ?? 'Chưa cập nhật'}'),
                  if (activity['HanDangKy'] != null)
                    Text('Hạn đăng ký: ${_shortDate(activity['HanDangKy'])}'),
                  const SizedBox(height: 12),
                  Text(details),
                  if (activity['SLToiDa'] != null)
                    Text('Số lượng tối đa: ${activity['SLToiDa']}'),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Đóng'),
              ),
              FilledButton(
                onPressed: () {
                  Navigator.pop(dialogContext);
                  onRegister();
                },
                child: const Text('Đăng ký'),
              ),
            ],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(
                  isCompetition
                      ? Icons.emoji_events_rounded
                      : (isSeminar ? Icons.groups_rounded : Icons.event_note),
                  color: const Color(0xff3156c8),
                ),
                const SizedBox(width: 8),
                Text(kind,
                    style: const TextStyle(
                        fontSize: 10,
                        letterSpacing: .7,
                        color: Color(0xff3156c8),
                        fontWeight: FontWeight.w800)),
                const Spacer(),
                TextButton(onPressed: onRegister, child: const Text('Đăng ký')),
              ]),
              Text(
                (activity['TenHoatDong'] ?? 'Hoạt động học thuật').toString(),
                style:
                    const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
              ),
              const SizedBox(height: 6),
              Text(subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 12, color: Color(0xff667085), height: 1.4)),
              const SizedBox(height: 5),
              Text(details,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 12, color: Color(0xff475467), height: 1.4)),
            ],
          ),
        ),
      ),
    );
  }
}

class QrAttendanceContent extends StatefulWidget {
  const QrAttendanceContent({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  State<QrAttendanceContent> createState() => _QrAttendanceContentState();
}

class _QrAttendanceContentState extends State<QrAttendanceContent> {
  static const _qrFormats = [BarcodeFormat.qrCode];
  final MobileScannerController controller = MobileScannerController(
    formats: _qrFormats,
  );
  final ImagePicker _imagePicker = ImagePicker();
  bool processing = false;
  bool checkedIn = false;
  String? message;
  Map<String, dynamic> checkInResult = <String, dynamic>{};

  Iterable<String> _qrCodes(BarcodeCapture? capture) sync* {
    if (capture == null) return;
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue?.trim();
      if (barcode.format == BarcodeFormat.qrCode &&
          value != null && value.isNotEmpty) {
        yield value;
      }
    }
  }

  void _onDetect(BarcodeCapture capture) {
    if (processing || checkedIn) return;
    final code = _qrCodes(capture).firstOrNull;
    if (code != null) unawaited(_checkIn(cameraCode: code));
  }

  Future<String?> _pickQrCode() async {
    final Set<String> codes;
    try {
      final image = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        requestFullMetadata: false,
      );
      if (!mounted || image == null) return null;
      setState(() => message = 'Đang đọc mã QR từ ảnh…');
      final capture = await controller.analyzeImage(image.path, formats: _qrFormats);
      codes = _qrCodes(capture).toSet();
    } catch (_) {
      throw Exception('Không thể đọc ảnh. Vui lòng chọn ảnh khác.');
    }
    if (codes.isEmpty) {
      throw Exception('Không tìm thấy mã QR trong ảnh.');
    }
    if (codes.length > 1) {
      throw Exception('Ảnh có nhiều mã QR. Hãy chọn ảnh chỉ có mã điểm danh.');
    }
    return codes.single;
  }

  Future<void> _checkIn({String? cameraCode}) async {
    if (processing || checkedIn) return;
    setState(() => processing = true);
    try {
      final code = cameraCode ?? await _pickQrCode();
      if (!mounted || code == null) return;
      setState(() => message = 'Đang xác nhận điểm danh…');
      await controller.stop();
      if (!mounted) return;
      final result = await Api.checkIn(code);
      if (!mounted) return;
      final trainingPoints = result is Map && result['diemRenLuyen'] is Map
          ? Map<String, dynamic>.from(result['diemRenLuyen'] as Map)
          : null;
      final pointMessage = trainingPoints == null
          ? 'Điểm danh thành công. Điểm rèn luyện sẽ được cập nhật theo hoạt động.'
          : 'Điểm danh thành công. Ghi nhận ${trainingPoints['soDiem'] ?? 0} điểm, trạng thái: ${trainingPoints['trangThai'] ?? 'Chờ xác nhận'}.';
      setState(() {
        checkedIn = true;
        if (result is Map) checkInResult = Map<String, dynamic>.from(result);
        message = (result is Map && result['message'] is String)
            ? result['message'] as String
            : pointMessage;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        message = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => processing = false);
    }
  }

  Future<void> _scanAgain() async {
    setState(() {
      checkedIn = false;
      message = null;
    });
    if (!controller.value.isRunning) await controller.start();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Widget _successView() {
    final points = checkInResult['diemRenLuyen'] is Map
        ? Map<String, dynamic>.from(checkInResult['diemRenLuyen'] as Map)
        : <String, dynamic>{};
    return ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 28),
        children: [
          Row(children: [
            IconButton(
                onPressed: widget.onBack, icon: const Icon(Icons.arrow_back)),
            const Expanded(
                child: Center(
                    child: Text('Điểm danh',
                        style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Color(0xff17345b))))),
            IconButton(
                onPressed: _scanAgain,
                icon: const Icon(Icons.help_outline_rounded))
          ]),
          const SizedBox(height: 18),
          const Center(
              child: CircleAvatar(
                  radius: 34,
                  backgroundColor: Color(0xffe5f6ef),
                  child: CircleAvatar(
                      radius: 25,
                      backgroundColor: Color(0xff12825f),
                      child: Icon(Icons.check_rounded,
                          color: Colors.white, size: 27)))),
          const SizedBox(height: 14),
          const Text('Điểm danh thành công!',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: Color(0xff17345b),
                  fontSize: 19,
                  fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(
              message ??
                  'Bạn đã được ghi nhận tham gia seminar. Dữ liệu đã đồng bộ với hệ thống khoa.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                  color: Color(0xff718096), fontSize: 10, height: 1.4)),
          const SizedBox(height: 18),
          Card(
              color: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(15),
                  side: const BorderSide(color: Color(0xffe4eaf1))),
              child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 9, vertical: 5),
                            decoration: BoxDecoration(
                                color: const Color(0xffeaf1ff),
                                borderRadius: BorderRadius.circular(20)),
                            child: const Text('HOẠT ĐỘNG',
                                style: TextStyle(
                                    color: Color(0xff3479e8),
                                    fontSize: 8,
                                    fontWeight: FontWeight.w800))),
                        const SizedBox(height: 8),
                        Text(
                            (checkInResult['TenHoatDong'] ??
                                    'Hoạt động học thuật')
                                .toString(),
                            style: const TextStyle(
                                color: Color(0xff17345b),
                                fontWeight: FontWeight.w800,
                                fontSize: 14)),
                        const Divider(height: 18),
                        _checkinInfo(
                            Icons.access_time_rounded,
                            'Thời gian',
                            _formatMobileDate(checkInResult['TgBatDau'] ??
                                checkInResult['BatDauLuc'])),
                        _checkinInfo(
                            Icons.location_on_outlined,
                            'Vị trí',
                            (checkInResult['DiaDiem'] ??
                                    'Đã xác nhận tại hoạt động')
                                .toString()),
                        _checkinInfo(
                            Icons.verified_user_outlined,
                            'Mã điểm danh',
                            (checkInResult['MaDD'] ?? 'Đã ghi nhận')
                                .toString()),
                      ]))),
          const SizedBox(height: 8),
          Container(
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                  color: const Color(0xfff0eaff),
                  borderRadius: BorderRadius.circular(12)),
              child: Row(children: [
                const Icon(Icons.auto_awesome_rounded,
                    color: Color(0xff8060d6), size: 17),
                const SizedBox(width: 8),
                Expanded(
                    child: Text(
                        'Hoàn thành hoạt động sẽ được cộng ${points['soDiem'] ?? 0} điểm rèn luyện${points['trangThai'] == null ? '' : ' · ${points['trangThai']}'}',
                        style: const TextStyle(
                            color: Color(0xff5e4c91),
                            fontSize: 9,
                            height: 1.3)))
              ])),
          const SizedBox(height: 15),
          Center(
              child: FilledButton.icon(
                  onPressed: widget.onBack,
                  icon: const Icon(Icons.home_outlined, size: 17),
                  label: const Text('Về trang chủ'),
                  style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xff1769e8),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10))))),
        ]);
  }

  Widget _checkinInfo(IconData icon, String label, String value) => Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Row(children: [
        Icon(icon, color: const Color(0xff4381ee), size: 15),
        const SizedBox(width: 8),
        Text('$label  ',
            style: const TextStyle(color: Color(0xff8593a5), fontSize: 9)),
        Expanded(
            child: Text(value,
                style: const TextStyle(
                    color: Color(0xff17345b),
                    fontWeight: FontWeight.w600,
                    fontSize: 9)))
      ]));

  @override
  Widget build(BuildContext context) => checkedIn
      ? _successView()
      : ListView(
          padding: const EdgeInsets.all(20),
          children: [
            IconButton(
              onPressed: widget.onBack,
              icon: const Icon(Icons.arrow_back),
              alignment: Alignment.centerLeft,
            ),
            const Text('Quét mã QR điểm danh',
                style: TextStyle(
                    fontSize: 23,
                    fontWeight: FontWeight.w800,
                    color: Color(0xff17264b))),
            const SizedBox(height: 8),
            const Text(
                'Quét mã do ban tổ chức cung cấp. Bạn cần đăng ký hoạt động trước khi điểm danh.',
                style: TextStyle(color: Color(0xff667085), height: 1.5)),
            const SizedBox(height: 18),
            ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: SizedBox(
                height: 360,
                child: MobileScanner(
                  controller: controller,
                  onDetect: _onDetect,
                ),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: processing ? null : _checkIn,
              icon: const Icon(Icons.photo_library_outlined),
              label: const Text('Chọn ảnh từ thư viện'),
            ),
            if (message != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: checkedIn
                      ? const Color(0xffe8f7ef)
                      : const Color(0xfff0f4ff),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Icon(
                      checkedIn ? Icons.check_circle : Icons.info_outline,
                      color: checkedIn
                          ? const Color(0xff16834b)
                          : const Color(0xff3156c8),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Text(message!)),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),
            if (checkedIn || (message != null && !processing))
              OutlinedButton.icon(
                onPressed: _scanAgain,
                icon: const Icon(Icons.refresh),
                label: const Text('Quét lại'),
              ),
          ],
        );
}

class FeatureDetail extends StatefulWidget {
  const FeatureDetail({super.key, required this.title, required this.onBack});
  final String title;
  final VoidCallback onBack;

  @override
  State<FeatureDetail> createState() => _FeatureDetailState();
}

class _FeatureDetailState extends State<FeatureDetail> {
  @override
  Widget build(BuildContext context) {
    if (widget.title == 'Đăng ký tham dự & Cổ vũ') {
      return const RegistrationsScreen();
    }
    if (widget.title == 'Điểm danh di động') {
      return QrAttendanceContent(onBack: widget.onBack);
    }
    if (widget.title == 'Nhắc lịch hoạt động') {
      return RemindersContent(onBack: widget.onBack);
    }
    if (widget.title == 'Thông tin cá nhân & lịch sử') {
      return StudentRecordsContent(onBack: widget.onBack);
    }
    if (widget.title == 'Tin tức & thông báo') {
      return NewsContent(onBack: widget.onBack);
    }
    final title = widget.title;
    final feature = features.firstWhere((item) => item.title == title);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        IconButton(
            onPressed: widget.onBack,
            icon: const Icon(Icons.arrow_back),
            alignment: Alignment.centerLeft),
        const SizedBox(height: 8),
        CircleAvatar(
            radius: 32,
            backgroundColor: feature.color.withValues(alpha: .12),
            child: Icon(feature.icon, size: 32, color: feature.color)),
        const SizedBox(height: 18),
        Text(title,
            style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: Color(0xff17264b))),
        const SizedBox(height: 8),
        Text(feature.detail,
            style: const TextStyle(color: Color(0xff667085), height: 1.5)),
        const SizedBox(height: 20),
      ],
    );
  }
}

String _formatMobileDate(dynamic value) {
  if (value == null || value.toString().trim().isEmpty) return 'Chưa cập nhật';
  final parsed =
      value is DateTime ? value : DateTime.tryParse(value.toString());
  if (parsed == null) return value.toString();
  final local = parsed.toLocal();
  String two(int number) => number.toString().padLeft(2, '0');
  return '${two(local.day)}/${two(local.month)}/${local.year} ${two(local.hour)}:${two(local.minute)}';
}

List<Map<String, dynamic>> _recordRows(dynamic value) => value is List
    ? value
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList()
    : <Map<String, dynamic>>[];

class StudentRecordsContent extends StatefulWidget {
  const StudentRecordsContent({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  State<StudentRecordsContent> createState() => _StudentRecordsContentState();
}

class _StudentRecordsContentState extends State<StudentRecordsContent> {
  late Future<List<dynamic>> data;
  bool showingPointHistory = false;

  @override
  void initState() {
    super.initState();
    data = _load();
  }

  Future<List<dynamic>> _load() async {
    final values = await Future.wait([
      Api.myProfile(),
      Api.myRegistrations(),
      Api.myTrainingPoints(),
    ]);
    final competitionDetails =
        await Api.myCompetitionDetails(_recordRows(values[1]));
    return [...values, competitionDetails];
  }

  Future<void> _refresh() async {
    final next = _load();
    setState(() {
      data = next;
    });
    await next;
  }

  void _showPersonalCode(Map<String, dynamic> profile) {
    final mssv = (profile['MSSV'] ?? profile['MaSV'] ?? 'Chưa có mã sinh viên').toString();
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Mã sinh viên'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 150,
            height: 150,
            decoration: BoxDecoration(color: const Color(0xfff2f6ff), borderRadius: BorderRadius.circular(18)),
            child: const Icon(Icons.qr_code_2_rounded, size: 112, color: Color(0xff3156c8)),
          ),
          const SizedBox(height: 12),
          Text(mssv, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, letterSpacing: 1)),
          const SizedBox(height: 6),
          const Text('Dùng mã này để nhận diện hồ sơ sinh viên trong hệ thống.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xff667085), fontSize: 12)),
        ]),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Đóng'))],
      ),
    );
  }

  void _showCertificates(List<Map<String, dynamic>> activities) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Giấy chứng nhận tham gia', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: Color(0xff17345b))),
            const SizedBox(height: 8),
            const Text('Danh sách hoạt động đã đăng ký. Giấy chứng nhận sẽ xuất hiện sau khi ban tổ chức phát hành.', style: TextStyle(color: Color(0xff667085), fontSize: 12, height: 1.4)),
            const SizedBox(height: 12),
            if (activities.isEmpty)
              const Padding(padding: EdgeInsets.symmetric(vertical: 18), child: Text('Bạn chưa có hoạt động tham gia.'))
            else
              Flexible(child: ListView(shrinkWrap: true, children: activities.take(20).map((row) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const CircleAvatar(backgroundColor: Color(0xffeaf1ff), child: Icon(Icons.workspace_premium_outlined, color: Color(0xff3479e8))),
                title: Text((row['TenHoatDong'] ?? 'Hoạt động học thuật').toString(), maxLines: 2, overflow: TextOverflow.ellipsis),
                subtitle: Text('Trạng thái: ${row['TrangThai'] ?? 'Đang cập nhật'}'),
              )).toList())),
          ]),
        ),
      ),
    );
  }

  void _showHelp() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => const SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(20, 4, 20, 28),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Trợ giúp & phản hồi', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: Color(0xff17345b))),
            SizedBox(height: 12),
            ListTile(contentPadding: EdgeInsets.zero, leading: Icon(Icons.how_to_reg_outlined), title: Text('Đăng ký hoạt động'), subtitle: Text('Chọn hoạt động trong Khám phá, xem chi tiết rồi nhấn Đăng ký tham gia.')),
            ListTile(contentPadding: EdgeInsets.zero, leading: Icon(Icons.qr_code_scanner_rounded), title: Text('Điểm danh QR'), subtitle: Text('Mở Điểm danh QR và quét mã do Ban tổ chức cung cấp.')),
            ListTile(contentPadding: EdgeInsets.zero, leading: Icon(Icons.support_agent_outlined), title: Text('Cần hỗ trợ?'), subtitle: Text('Liên hệ Ban chủ nhiệm khoa hoặc Ban tổ chức hoạt động.')),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<dynamic>>(
        future: data,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _RetryView(
              message:
                  snapshot.error.toString().replaceFirst('Exception: ', ''),
              onRetry: _refresh,
            );
          }
          final values = snapshot.data ?? const <dynamic>[];
          final profile = values[0] is Map
              ? Map<String, dynamic>.from(values[0] as Map)
              : <String, dynamic>{};
          final activities = _recordRows(values[1]);
          final points = values[2] is Map
              ? Map<String, dynamic>.from(values[2] as Map)
              : <String, dynamic>{};
          final pointRows = _recordRows(points['chiTiet']);
          final competitions =
              values[3] is List ? values[3] as List : <dynamic>[];

          if (showingPointHistory) {
            return TrainingPointsScreen(
              total: points['tongDiem'] ?? 0,
              rows: pointRows,
              onBack: () => setState(() => showingPointHistory = false),
            );
          }

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
              children: [
                IconButton(
                    onPressed: widget.onBack,
                    icon: const Icon(Icons.arrow_back),
                    alignment: Alignment.centerLeft),
                const Text('Thông tin cá nhân & lịch sử',
                    style:
                        TextStyle(fontSize: 23, fontWeight: FontWeight.w800)),
                const SizedBox(height: 14),
                _ProfileSummaryCard(
                  profile: profile,
                  onShowCode: () => _showPersonalCode(profile),
                ),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: _ProfileMetric(
                    value: '${points['tongDiem'] ?? 0}', label: 'Điểm RL',
                    onTap: () => setState(() => showingPointHistory = true),
                  )),
                  const SizedBox(width: 8),
                  Expanded(child: _ProfileMetric(
                    value: '${activities.length.toString().padLeft(2, '0')}', label: 'Đã tham gia',
                  )),
                  const SizedBox(width: 8),
                  Expanded(child: _ProfileMetric(
                    value: '${competitions.length.toString().padLeft(2, '0')}', label: 'Cuộc thi',
                  )),
                ]),
                const SizedBox(height: 12),
                _RecordsCard(
                  title: 'Thông tin cá nhân',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                          (profile['HoTen'] ??
                                  profile['TenDangNhap'] ??
                                  'Sinh viên')
                              .toString(),
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w800)),
                      _recordLine('MSSV', profile['MSSV'] ?? profile['MaSV']),
                      _recordLine('Lớp', profile['TenLop'] ?? profile['MaLop']),
                      _recordLine('Khoa', profile['TenKhoa']),
                      _recordLine('Email', profile['Email']),
                      _recordLine('Điện thoại', profile['SDT']),
                    ],
                  ),
                ),
                _RecordsCard(
                  title: 'Lịch sử hoạt động tham gia',
                  child: activities.isEmpty
                      ? const Text('Bạn chưa đăng ký hoạt động nào.')
                      : Column(
                          children: activities
                              .map((row) => _ActivityRecord(row: row))
                              .toList()),
                ),
                _RecordsCard(
                  title: 'Đề tài thi học thuật',
                  child: competitions.isEmpty
                      ? const Text('Chưa có đề tài được ghi nhận.')
                      : Column(
                          children: competitions.map((raw) {
                            final bundle = raw is Map
                                ? Map<String, dynamic>.from(raw)
                                : <String, dynamic>{};
                            final competition = bundle['competition'] is Map
                                ? Map<String, dynamic>.from(
                                    bundle['competition'] as Map)
                                : <String, dynamic>{};
                            final detail = bundle['details'] is Map
                                ? Map<String, dynamic>.from(
                                    bundle['details'] as Map)
                                : <String, dynamic>{};
                            final registration = detail['registration'] is Map
                                ? Map<String, dynamic>.from(
                                    detail['registration'] as Map)
                                : <String, dynamic>{};
                            final teams = _recordRows(detail['teams']);
                            final teamIds = teams
                                .map((team) => team['MaDoi'].toString())
                                .toSet();
                            final topics = _recordRows(detail['topics'])
                                .where((topic) =>
                                    (registration['MaDK'] != null &&
                                        topic['MaDK'].toString() ==
                                            registration['MaDK'].toString()) ||
                                    (topic['MaDoi'] != null &&
                                        teamIds.contains(
                                            topic['MaDoi'].toString())))
                                .toList();
                            final results = _recordRows(detail['results']);
                            return _CompetitionRecord(
                                competition: competition,
                                topics: topics,
                                results: results);
                          }).toList(),
                        ),
                ),
                _RecordsCard(
                  title: 'Lịch sử cộng/trừ điểm rèn luyện',
                  trailing: Text('Tổng: ${points['tongDiem'] ?? 0}',
                      style: const TextStyle(
                          color: Color(0xff3156c8),
                          fontWeight: FontWeight.w800)),
                  child: pointRows.isEmpty
                      ? const Text('Chưa có điểm rèn luyện được ghi nhận.')
                      : Column(
                          children: pointRows
                              .map((row) => _PointRecord(row: row))
                              .toList()),
                ),
                _RecordsCard(
                  title: 'Tiện ích',
                  child: Column(children: [
                    _ProfileUtilityTile(
                      icon: Icons.workspace_premium_outlined,
                      label: 'Giấy chứng nhận tham gia',
                      onTap: () => _showCertificates(activities),
                    ),
                    const Divider(height: 1),
                    _ProfileUtilityTile(
                      icon: Icons.history_rounded,
                      label: 'Xem lịch sử điểm rèn luyện',
                      onTap: () => setState(() => showingPointHistory = true),
                    ),
                    const Divider(height: 1),
                    _ProfileUtilityTile(
                      icon: Icons.help_outline_rounded,
                      label: 'Trợ giúp & phản hồi',
                      onTap: _showHelp,
                    ),
                  ]),
                ),
              ],
            ),
          );
        },
      );
}

class RemindersContent extends StatefulWidget {
  const RemindersContent({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  State<RemindersContent> createState() => _RemindersContentState();
}

class _RemindersContentState extends State<RemindersContent> {
  late Future<List<dynamic>> data;

  @override
  void initState() {
    super.initState();
    data = _load();
  }

  Future<List<dynamic>> _load() async {
    await ActivityReminderNotifications.requestPermission();
    final rows = await Api.reminders();
    await ActivityReminderNotifications.schedule(rows);
    return rows;
  }

  Future<void> _refresh() async {
    final next = _load();
    setState(() {
      data = next;
    });
    await next;
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<dynamic>>(
        future: data,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting)
            return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError)
            return _RetryView(
                message:
                    snapshot.error.toString().replaceFirst('Exception: ', ''),
                onRetry: _refresh);
          final rows = snapshot.data ?? <dynamic>[];
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.all(18),
              children: [
                IconButton(
                    onPressed: widget.onBack,
                    icon: const Icon(Icons.arrow_back),
                    alignment: Alignment.centerLeft),
                const Text('Nhắc lịch hoạt động',
                    style:
                        TextStyle(fontSize: 23, fontWeight: FontWeight.w800)),
                const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                        'Danh sách nhắc lịch được tổng hợp tự động từ hoạt động bạn đã đăng ký.',
                        style: TextStyle(color: Color(0xff667085)))),
                if (rows.isEmpty)
                  const Card(
                      color: Colors.white,
                      child: Padding(
                          padding: EdgeInsets.all(18),
                          child: Text(
                              'Hiện chưa có hoạt động sắp diễn ra cần nhắc.')))
                else
                  ...rows.map((raw) {
                    final row = raw is Map
                        ? Map<String, dynamic>.from(raw)
                        : <String, dynamic>{};
                    final date = row['TgBatDau'] ?? row['HanDangKy'];
                    return Card(
                      color: Colors.white,
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ListTile(
                        leading: const CircleAvatar(
                            backgroundColor: Color(0xfffff1f5),
                            child: Icon(Icons.notifications_active_outlined,
                                color: Color(0xffcf6b9c))),
                        title: Text(
                            (row['TenHoatDong'] ?? 'Hoạt động học thuật')
                                .toString(),
                            style:
                                const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text([
                          if (row['LoaiNhac'] != null)
                            row['LoaiNhac'].toString(),
                          if (date != null) _formatMobileDate(date),
                          if (row['DiaDiem'] != null) row['DiaDiem'].toString(),
                        ].join(' · ')),
                      ),
                    );
                  }),
              ],
            ),
          );
        },
      );
}

class _RetryView extends StatelessWidget {
  const _RetryView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton.tonal(
                  onPressed: onRetry, child: const Text('Thử lại')),
            ],
          ),
        ),
      );
}

class _RecordsCard extends StatelessWidget {
  const _RecordsCard({required this.title, required this.child, this.trailing});
  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Card(
        color: Colors.white,
        elevation: 0,
        margin: const EdgeInsets.only(bottom: 12),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xffe8ebf2))),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                  child: Text(title,
                      style: const TextStyle(fontWeight: FontWeight.w800))),
              if (trailing != null) trailing!
            ]),
            const SizedBox(height: 10),
            child,
          ]),
        ),
      );
}

class _ProfileSummaryCard extends StatelessWidget {
  const _ProfileSummaryCard({required this.profile, required this.onShowCode});
  final Map<String, dynamic> profile;
  final VoidCallback onShowCode;

  @override
  Widget build(BuildContext context) {
    final name = (profile['HoTen'] ?? profile['TenDangNhap'] ?? 'Sinh viên').toString();
    final initials = name.trim().isEmpty ? 'SV' : name.trim().split(RegExp(r'\s+')).take(2).map((part) => part[0]).join().toUpperCase();
    return Card(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xffe2e9f2))),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          CircleAvatar(radius: 30, backgroundColor: const Color(0xffeaf1ff), child: Text(initials, style: const TextStyle(color: Color(0xff3156c8), fontWeight: FontWeight.w800))),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xff17345b), fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text('${profile['MSSV'] ?? 'Chưa có MSSV'} · ${profile['TenLop'] ?? 'Chưa có lớp'}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xff718096), fontSize: 10)),
            const SizedBox(height: 7),
            const Text('Sinh viên', style: TextStyle(color: Color(0xff3156c8), fontSize: 10, fontWeight: FontWeight.w600)),
          ])),
          IconButton(onPressed: onShowCode, tooltip: 'Mã sinh viên', icon: const Icon(Icons.qr_code_2_rounded, color: Color(0xff3156c8), size: 27)),
        ]),
      ),
    );
  }
}

class _ProfileMetric extends StatelessWidget {
  const _ProfileMetric({required this.value, required this.label, this.onTap});
  final String value;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(13),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(13),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 11),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(13), border: Border.all(color: const Color(0xffe2e9f2))),
            child: Column(children: [
              Text(value, style: const TextStyle(color: Color(0xff1769e8), fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 3),
              Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xff718096), fontSize: 9)),
            ]),
          ),
        ),
      );
}

class _ProfileUtilityTile extends StatelessWidget {
  const _ProfileUtilityTile({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => ListTile(
        contentPadding: EdgeInsets.zero,
        dense: true,
        leading: Icon(icon, size: 19, color: const Color(0xff1769e8)),
        title: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xff17345b))),
        trailing: const Icon(Icons.chevron_right_rounded, size: 18, color: Color(0xff718096)),
        onTap: onTap,
      );
}

class TrainingPointsScreen extends StatelessWidget {
  const TrainingPointsScreen({super.key, required this.total, required this.rows, required this.onBack});
  final dynamic total;
  final List<Map<String, dynamic>> rows;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final score = num.tryParse('$total') ?? 0;
    final plus = rows.fold<num>(0, (sum, row) {
      final value = num.tryParse('${row['SoDiem'] ?? 0}') ?? 0;
      return sum + (value > 0 ? value : 0);
    });
    final minus = rows.fold<num>(0, (sum, row) {
      final value = num.tryParse('${row['SoDiem'] ?? 0}') ?? 0;
      return sum + (value < 0 ? value.abs() : 0);
    });
    final pending = rows.where((row) => '${row['TrangThai'] ?? ''}'.contains('Chờ')).length;
    return Column(children: [
      ListTile(leading: IconButton(onPressed: onBack, icon: const Icon(Icons.arrow_back_rounded)), title: const Text('Điểm rèn luyện', textAlign: TextAlign.center, style: TextStyle(color: Color(0xff17345b), fontWeight: FontWeight.w700)), trailing: const Icon(Icons.help_outline_rounded, color: Color(0xff718096))),
      Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(color: const Color(0xff102d4c), borderRadius: BorderRadius.circular(18)),
          child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('TỔNG ĐIỂM RÈN LUYỆN', style: TextStyle(color: Color(0xffa9c8f4), fontSize: 9, fontWeight: FontWeight.w800)),
              const SizedBox(height: 5),
              Text('$total / 100 điểm', style: const TextStyle(color: Colors.white, fontSize: 23, fontWeight: FontWeight.w800)),
              const SizedBox(height: 5),
              Text(score >= 80 ? 'Xếp loại tốt' : 'Điểm được cập nhật theo xác nhận của khoa', style: const TextStyle(color: Color(0xffd1e7f3), fontSize: 10)),
            ])),
            SizedBox(width: 58, height: 58, child: Stack(alignment: Alignment.center, children: [
              CircularProgressIndicator(value: (score / 100).clamp(0, 1).toDouble(), strokeWidth: 5, backgroundColor: const Color(0xff29486b), valueColor: const AlwaysStoppedAnimation(Color(0xff58a1ff))),
              Text('${score.toStringAsFixed(0)}%', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
            ])),
          ]),
        ),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: _ScoreStat(value: '+${plus.toStringAsFixed(0)}', label: 'Điểm cộng', color: const Color(0xffe3f5ed))),
          const SizedBox(width: 8),
          Expanded(child: _ScoreStat(value: '−${minus.toStringAsFixed(0)}', label: 'Điểm trừ', color: const Color(0xffffe9ec))),
          const SizedBox(width: 8),
          Expanded(child: _ScoreStat(value: '$pending', label: 'Chờ duyệt', color: const Color(0xfffff2db))),
        ]),
        const SizedBox(height: 18),
        const Text('Lịch sử cộng / trừ', style: TextStyle(color: Color(0xff17345b), fontSize: 16, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        if (rows.isEmpty)
          const Card(color: Colors.white, child: Padding(padding: EdgeInsets.all(18), child: Text('Chưa có điểm rèn luyện được ghi nhận.')))
        else
          _RecordsCard(title: 'Chi tiết điểm rèn luyện', child: Column(children: rows.map((row) => _PointRecord(row: row)).toList())),
      ])),
    ]);
  }
}

class _ScoreStat extends StatelessWidget {
  const _ScoreStat(
      {required this.value, required this.label, required this.color});
  final String value;
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 11),
        decoration: BoxDecoration(
            color: color, borderRadius: BorderRadius.circular(12)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value,
              style: const TextStyle(
                  color: Color(0xff17345b),
                  fontSize: 15,
                  fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Color(0xff718096), fontSize: 8)),
        ]),
      );
}

Widget _recordLine(String label, dynamic value) =>
    value == null || value.toString().trim().isEmpty
        ? const SizedBox.shrink()
        : Padding(
            padding: const EdgeInsets.only(top: 5),
            child: Text('$label: $value',
                style: const TextStyle(color: Color(0xff667085))));

class _ActivityRecord extends StatelessWidget {
  const _ActivityRecord({required this.row});
  final Map<String, dynamic> row;

  @override
  Widget build(BuildContext context) => ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const Icon(Icons.event_available_outlined,
            color: Color(0xff3156c8)),
        title: Text(
            (row['TenHoatDong'] ?? row['ChuDe'] ?? 'Hoạt động học thuật')
                .toString()),
        subtitle: Text([
          if (row['TgBatDau'] != null) _formatMobileDate(row['TgBatDau']),
          if (row['DiaDiem'] != null) row['DiaDiem'].toString(),
          'Hình thức: ${row['HinhThuc'] ?? 'Tham gia'}',
          'Trạng thái: ${row['TrangThai'] ?? 'Đã đăng ký'}',
        ].join(' · ')),
      );
}

class _CompetitionRecord extends StatelessWidget {
  const _CompetitionRecord(
      {required this.competition, required this.topics, required this.results});
  final Map<String, dynamic> competition;
  final List<Map<String, dynamic>> topics;
  final List<Map<String, dynamic>> results;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
              (competition['TenCuocThi'] ??
                      competition['TenHoatDong'] ??
                      'Cuộc thi học thuật')
                  .toString(),
              style: const TextStyle(fontWeight: FontWeight.w700)),
          if (topics.isEmpty)
            const Text('Chưa có đề tài gắn với đăng ký của bạn.',
                style: TextStyle(color: Color(0xff667085)))
          else
            ...topics.map((topic) => _recordLine(
                'Đề tài', topic['TenDeTai'] ?? 'Đề tài đã đăng ký')),
          ...results.map((result) => _recordLine(
              'Kết quả',
              [
                result['TenGiaiThuong'] ??
                    result['TenGiai'] ??
                    result['XepHang'] ??
                    'Đã công bố',
                if (result['TenDoi'] != null) result['TenDoi']
              ].join(' · '))),
        ]),
      );
}

class NewsContent extends StatefulWidget {
  const NewsContent({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  State<NewsContent> createState() => _NewsContentState();
}

class _NewsContentState extends State<NewsContent> {
  late Future<List<dynamic>> data;
  String filter = 'Tất cả';

  @override
  void initState() {
    super.initState();
    data = _load();
  }

  Future<List<dynamic>> _load() async {
    final values = await Future.wait([Api.notifications(), Api.reminders()]);
    final notices =
        _recordRows(values[0]).map((row) => {...row, '_kind': 'Thông báo'});
    final reminders =
        _recordRows(values[1]).map((row) => {...row, '_kind': 'Nhắc lịch'});
    return [...reminders, ...notices];
  }

  Future<void> _refresh() async {
    final next = _load();
    setState(() {
      data = next;
    });
    await next;
  }

  Future<void> _openNotice(Map<String, dynamic> row, NewsMessage message) async {
    final id = int.tryParse('${row['MaThongBao'] ?? ''}');
    if (row['_kind'] != 'Nhắc lịch' && row['DocLuc'] == null && id != null) {
      try {
        await Api.markNotificationRead(id);
        if (mounted) await _refresh();
      } catch (error) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ));
      }
    }
    if (!mounted) return;
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text((row['TieuDe'] ?? row['TenHoatDong'] ?? 'Thông báo')
            .toString()),
        content: SingleChildScrollView(
          child: SizedBox(width: 360, child: message.details(dialogContext)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Đóng'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<dynamic>>(
        future: data,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                        snapshot.error
                            .toString()
                            .replaceFirst('Exception: ', ''),
                        textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    FilledButton.tonal(
                        onPressed: _refresh, child: const Text('Thử lại')),
                  ],
                ),
              ),
            );
          }
          final allRows = snapshot.data ?? <dynamic>[];
          final unreadCount = allRows
              .where((raw) =>
                  raw is Map &&
                  raw['_kind'] != 'Nhắc lịch' &&
                  raw['DocLuc'] == null)
              .length;
          final rows = allRows.where((raw) {
            if (filter == 'Chưa đọc')
              return raw is Map &&
                  raw['_kind'] != 'Nhắc lịch' &&
                  raw['DocLuc'] == null;
            if (filter == 'Nhắc lịch')
              return raw is Map && raw['_kind'] == 'Nhắc lịch';
            return true;
          }).toList();
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
              children: [
                Wrap(spacing: 7, children: [
                  for (final item in ['Tất cả', 'Chưa đọc', 'Nhắc lịch'])
                    ChoiceChip(
                      label: Text(
                          item == 'Chưa đọc' ? 'Chưa đọc $unreadCount' : item),
                      selected: filter == item,
                      onSelected: (_) => setState(() {
                        filter = item;
                      }),
                      showCheckmark: false,
                      selectedColor: const Color(0xff1769e8),
                      backgroundColor: Colors.white,
                      labelStyle: TextStyle(
                          color: filter == item
                              ? Colors.white
                              : const Color(0xff52667f),
                          fontSize: 10),
                      visualDensity: VisualDensity.compact,
                    ),
                ]),
                const SizedBox(height: 12),
                const Text('HÔM NAY',
                    style: TextStyle(
                        color: Color(0xff8493a5),
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: .7)),
                const SizedBox(height: 7),
                if (rows.isEmpty)
                  const Card(
                      color: Colors.white,
                      child: Padding(
                          padding: EdgeInsets.all(18),
                          child: Text('Chưa có thông báo hoặc nhắc lịch.')))
                else
                  ...rows.map((raw) {
                    final row = raw is Map
                        ? Map<String, dynamic>.from(raw)
                        : <String, dynamic>{};
                    final isReminder = row['_kind'] == 'Nhắc lịch';
                    final message = NewsMessage.parse(
                      (row['NoiDung'] ?? row['LoaiNhac'] ??
                              'Hoạt động sắp diễn ra.')
                          .toString(),
                    );
                    return Card(
                      color: Colors.white,
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 8),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(13),
                          side: const BorderSide(color: Color(0xffe8edf4))),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 3),
                        onTap: () => _openNotice(row, message),
                        leading: CircleAvatar(
                          radius: 17,
                          backgroundColor: isReminder
                              ? const Color(0xfffff1dc)
                              : const Color(0xffe9f7f0),
                          child: Icon(
                              isReminder
                                  ? Icons.event_available_rounded
                                  : Icons.task_alt_rounded,
                              size: 17,
                              color: isReminder
                                  ? const Color(0xffd88a19)
                                  : const Color(0xff20a377)),
                        ),
                        title: Text(
                            (isReminder ? row['TenHoatDong'] : row['TieuDe'])
                                    ?.toString() ??
                                (isReminder
                                    ? 'Sắp đến giờ tham gia'
                                    : 'Thông báo hoạt động'),
                            style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xff183250),
                                fontWeight: FontWeight.w700)),
                        subtitle: Padding(
                            padding: const EdgeInsets.only(top: 3),
                            child: Text(
                                isReminder
                                    ? [
                                        if (row['LoaiNhac'] != null)
                                          row['LoaiNhac'],
                                        if (row['TgBatDau'] != null)
                                          _formatMobileDate(row['TgBatDau']),
                                        if (row['DiaDiem'] != null)
                                          row['DiaDiem']
                                      ].join(' · ')
                                    : [
                                        message.summary,
                                        if (row['GuiLuc'] != null)
                                          _formatMobileDate(row['GuiLuc'])
                                      ].join(' · '),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 9, color: Color(0xff718096)))),
                        trailing: isReminder
                            ? const Icon(Icons.circle,
                                size: 7, color: Color(0xff1769e8))
                            : null,
                      ),
                    );
                  }),
              ],
            ),
          );
        },
      );
}

class _PointRecord extends StatelessWidget {
  const _PointRecord({required this.row});
  final Map<String, dynamic> row;

  @override
  Widget build(BuildContext context) {
    final score = num.tryParse((row['SoDiem'] ?? 0).toString()) ?? 0;
    final add = score >= 0;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(
          add ? Icons.add_circle_outline : Icons.remove_circle_outline,
          color: add ? const Color(0xff16834b) : const Color(0xffb42318)),
      title: Text('${add ? 'Cộng' : 'Trừ'} ${score.abs()} điểm',
          style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text([
        if (row['LyDo'] != null) row['LyDo'].toString(),
        if (row['TenHoatDong'] != null) row['TenHoatDong'].toString(),
        if (row['HocKy'] != null || row['NamHoc'] != null)
          'Học kỳ ${row['HocKy'] ?? ''} ${row['NamHoc'] ?? ''}',
        if (row['TrangThai'] != null) row['TrangThai'].toString(),
      ].join(' · ')),
    );
  }
}

class RegistrationsScreen extends StatefulWidget {
  const RegistrationsScreen({super.key});
  @override
  State<RegistrationsScreen> createState() => _RegistrationsScreenState();
}

class _RegistrationsScreenState extends State<RegistrationsScreen> {
  late Future<List<dynamic>> data;
  @override
  void initState() {
    super.initState();
    data = Api.myRegistrations();
  }

  Future<void> refresh() async {
    setState(() {
      data = Api.myRegistrations();
    });
    await data;
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<dynamic>>(
        future: data,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting)
            return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError)
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.cloud_off_outlined,
                      size: 42,
                      color: Color(0xff98a2b3),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      snapshot.error.toString().replaceFirst('Exception: ', ''),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    FilledButton.tonal(
                      onPressed: refresh,
                      child: const Text('Thử lại'),
                    ),
                  ],
                ),
              ),
            );
          final rows = snapshot.data ?? [];
          if (rows.isEmpty)
            return RefreshIndicator(
              onRefresh: refresh,
              child: ListView(
                children: const [
                  SizedBox(height: 140),
                  Icon(
                    Icons.assignment_outlined,
                    size: 52,
                    color: Color(0xff98a2b3),
                  ),
                  SizedBox(height: 16),
                  Center(
                    child: Text(
                      'Bạn chưa có đăng ký nào.',
                      style: TextStyle(color: Color(0xff667085)),
                    ),
                  ),
                ],
              ),
            );
          return RefreshIndicator(
            onRefresh: refresh,
            child: ListView(
              padding: const EdgeInsets.all(18),
              children: [
                const Text(
                  'Hoạt động đã đăng ký',
                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 14),
                ...rows.map((row) => RegistrationCard(row: row)),
              ],
            ),
          );
        },
      );
}

class RegistrationCard extends StatelessWidget {
  const RegistrationCard({super.key, required this.row});
  final dynamic row;
  @override
  Widget build(BuildContext context) {
    final map = row is Map ? row : <String, dynamic>{};
    final title = map['TenHoatDong'] ??
        map['tenHoatDong'] ??
        map['ten_hoat_dong'] ??
        'Hoạt động học thuật';
    final status = map['TrangThai'] ?? map['trangThai'] ?? 'Đã đăng ký';
    return Card(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xffe8ebf2)),
      ),
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: const CircleAvatar(
          backgroundColor: Color(0xffeaf7f2),
          child: Icon(Icons.event_available_rounded, color: Color(0xff168765)),
        ),
        title: Text(
          title.toString(),
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text('Trạng thái: $status'),
        isThreeLine: false,
      ),
    );
  }
}

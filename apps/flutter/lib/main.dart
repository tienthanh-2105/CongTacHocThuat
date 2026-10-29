import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:shared_preferences/shared_preferences.dart';

const apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://10.0.2.2:3001/api/v1',
);

void main() => runApp(const AcademicApp());

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
    final data = await request('/activities');
    return data is List ? data : <dynamic>[];
  }

  static Future<List<dynamic>> myRegistrations() async {
    final data = await request('/mobile/my-activities');
    return data is List ? data : <dynamic>[];
  }

  static Future<dynamic> myTrainingPoints() =>
      request('/mobile/my-training-points');

  static Future<dynamic> myProfile() => request('/mobile/profile');

  static Future<List<dynamic>> seminars() async {
    final data = await request('/seminars');
    return data is List ? data : <dynamic>[];
  }

  static Future<List<dynamic>> reminders() async {
    final data = await request('/notifications/my-reminders');
    return data is List ? data : <dynamic>[];
  }

  static Future<List<dynamic>> notifications() async {
    final results = await Future.wait([
      request('/notifications/mine'),
      request('/notifications/my-reminders'),
    ]);
    final saved = results[0] is List ? results[0] as List : <dynamic>[];
    final reminders = results[1] is List ? results[1] as List : <dynamic>[];
    return [
      ...saved.map((row) => {...(row as Map), '_kind': 'Thông báo'}),
      ...reminders.map((row) => {...(row as Map), '_kind': 'Nhắc lịch'}),
    ];
  }

  static Future<dynamic> registerIndividual(int activityId, String type) =>
      request(
        '/registrations/individual',
        method: 'POST',
        body: {'maHD': activityId, 'hinhThuc': type},
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
  ) =>
      request('/registrations/team', method: 'POST', body: {
        'maCThi': competitionId,
        'tenDoi': teamName,
        'thanhVienMSSV': memberNumbers,
      });

  static Future<dynamic> joinTeam(int teamId) => request(
        '/registrations/team/join',
        method: 'POST',
        body: {'maDoi': teamId},
      );
}

class AppGate extends StatefulWidget {
  const AppGate({super.key});
  @override
  State<AppGate> createState() => _AppGateState();
}

class _AppGateState extends State<AppGate> {
  Map<String, dynamic>? user;
  bool checking = true;
  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      Api.accessToken = prefs.getString('academic_access_token');
      if (Api.accessToken != null) {
        final value = await Api.request('/auth/me');
        user = Map<String, dynamic>.from(value['user'] as Map);
      }
    } catch (_) {
      await Api.clearSavedSession();
    } finally {
      if (mounted) setState(() => checking = false);
    }
  }

  void onLogin(Map<String, dynamic> value) => setState(() => user = value);
  Future<void> logout() async {
    try {
      await Api.request('/auth/logout', method: 'POST', body: {});
    } catch (_) {}
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
    'Kế hoạch năm học',
    'Kế hoạch hoạt động và dự trù kinh phí',
    Icons.calendar_month_rounded,
    Color(0xff4169d8),
  ),
  Feature(
    'Tổ chức cuộc thi',
    'Cuộc thi, ban tổ chức và phân công',
    Icons.emoji_events_rounded,
    Color(0xffe39a2f),
  ),
  Feature(
    'Đăng ký dự thi',
    'Đăng ký hoạt động cá nhân hoặc theo đội',
    Icons.how_to_reg_rounded,
    Color(0xff18a781),
    live: true,
  ),
  Feature(
    'Quét QR điểm danh',
    'Điểm danh hoạt động đã đăng ký bằng mã QR',
    Icons.qr_code_scanner_rounded,
    Color(0xff087e8b),
  ),
  Feature(
    'Hỗ trợ & cổ vũ',
    'Theo dõi phân công hỗ trợ theo lớp',
    Icons.volunteer_activism_rounded,
    Color(0xff8c67d5),
  ),
  Feature(
    'Điểm rèn luyện',
    'Ghi nhận điểm từ hoạt động học thuật',
    Icons.stars_rounded,
    Color(0xffdc6e69),
  ),
  Feature(
    'Đề tài & kết quả',
    'Đề tài dự thi và kết quả đạt được',
    Icons.workspace_premium_rounded,
    Color(0xff1b9bb4),
  ),
  Feature(
    'Kinh phí & quyết toán',
    'Chi phí thực tế và hồ sơ quyết toán',
    Icons.account_balance_wallet_rounded,
    Color(0xff63814a),
  ),
  Feature(
    'Seminar học thuật',
    'Lịch, địa điểm và người tham dự',
    Icons.groups_rounded,
    Color(0xff426eaa),
  ),
  Feature(
    'Tin tức & thông báo',
    'Thông tin cuộc thi và seminar',
    Icons.campaign_rounded,
    Color(0xffcf6b9c),
  ),
  Feature(
    'Thống kê & báo cáo',
    'Tổng hợp hoạt động và chi phí',
    Icons.bar_chart_rounded,
    Color(0xff6a68bd),
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
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          titleSpacing: 18,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'KHOA CNTT',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1,
                  color: Color(0xff3156c8),
                ),
              ),
              Text(
                selected ?? (tab == 0 ? 'Tổng quan' : 'Đăng ký của tôi'),
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
            ],
          ),
          actions: [
            PopupMenuButton<String>(
              icon: const CircleAvatar(
                radius: 17,
                backgroundColor: Color(0xffe9edff),
                child: Icon(Icons.person, size: 19, color: Color(0xff3156c8)),
              ),
              onSelected: (value) {
                if (value == 'logout') widget.onLogout();
              },
              itemBuilder: (_) => [
                PopupMenuItem(
                  enabled: false,
                  child: Text(
                    (widget.user['name'] ??
                            widget.user['username'] ??
                            'Tài khoản')
                        .toString(),
                  ),
                ),
                const PopupMenuItem(value: 'logout', child: Text('Đăng xuất')),
              ],
            ),
            if (tab == 1)
              IconButton(
                tooltip: 'Đăng ký hoạt động',
                onPressed: _openRegistrationDialog,
                icon: const Icon(
                  Icons.add_circle_outline_rounded,
                  color: Color(0xff3156c8),
                ),
              ),
            const SizedBox(width: 8),
          ],
        ),
        body: tab == 1
            ? RegistrationsScreen(key: ValueKey(registrationsVersion))
            : selected != null
                ? FeatureDetail(
                    title: selected!,
                    onBack: () => setState(() => selected = null),
                  )
                : HomeContent(
                    user: widget.user,
                    onFeature: (title) => setState(() => selected = title),
                    onRegistrations: () => setState(() => tab = 1),
                    onRegisterActivity: _registerActivity,
                  ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: tab,
          onDestinationSelected: (value) => setState(() {
            tab = value;
            selected = null;
          }),
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home_rounded),
              label: 'Trang chủ',
            ),
            NavigationDestination(
              icon: Icon(Icons.assignment_outlined),
              selectedIcon: Icon(Icons.assignment_rounded),
              label: 'Đăng ký',
            ),
          ],
        ),
      );

  Future<void> _openRegistrationDialog() async {
    final input = await showDialog<RegistrationInput>(
      context: context,
      builder: (_) => const RegistrationDialog(),
    );
    if (input == null) return;
    try {
      await Api.registerIndividual(input.activityId, input.type);
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
    if (maHD == null) return;

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
          if (input == null || maCThi == null) return;
          result = await Api.registerTeam(maCThi, input.name, input.members);
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
          result = await Api.registerIndividual(maHD, 'Dự thi');
          break;
        case 'support':
          result = await Api.registerIndividual(maHD, 'Hỗ trợ');
          break;
        case 'cheer':
          result = await Api.registerIndividual(maHD, 'Cổ vũ');
          break;
        default:
          result = await Api.registerIndividual(
              maHD, maCThi == null ? 'Tham gia' : 'Dự thi');
      }
      if (!mounted) return;
      setState(() => registrationsVersion++);
      final data = result is Map ? result['data'] : null;
      final teamCode = data is Map ? data['maDoi'] : null;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(teamCode == null
            ? 'Đăng ký thành công.'
            : 'Tạo đội thành công. Mã đội của bạn: $teamCode'),
        duration: const Duration(seconds: 5),
      ));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(error.toString().replaceFirst('Exception: ', '')),
      ));
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

class HomeContent extends StatelessWidget {
  const HomeContent({
    super.key,
    required this.user,
    required this.onFeature,
    required this.onRegistrations,
    required this.onRegisterActivity,
  });
  final Map<String, dynamic> user;
  final ValueChanged<String> onFeature;
  final VoidCallback onRegistrations;
  final ValueChanged<Map<String, dynamic>> onRegisterActivity;

  @override
  Widget build(BuildContext context) {
    final name = (user['name'] ?? user['username'] ?? 'bạn').toString();
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
      children: [
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xff2749af), Color(0xff5277e5)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'KHÔNG GIAN HỌC THUẬT',
                style: TextStyle(
                  color: Color(0xffdbe4ff),
                  fontWeight: FontWeight.w700,
                  fontSize: 11,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Xin chào, $name',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Khám phá hoạt động và cơ hội học thuật của khoa.',
                style: TextStyle(color: Color(0xffe9edff), height: 1.45),
              ),
              const SizedBox(height: 18),
              OutlinedButton.icon(
                onPressed: onRegistrations,
                icon: const Icon(Icons.assignment_outlined, size: 18),
                label: const Text('Xem đăng ký của tôi'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Color(0x77ffffff)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        ActivityFeed(onRegister: onRegisterActivity),
        const SizedBox(height: 25),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Chức năng',
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w800,
                color: Color(0xff17264b),
              ),
            ),
            Text(
              '${features.length} phân hệ',
              style: const TextStyle(color: Color(0xff667085), fontSize: 12),
            ),
          ],
        ),
        const SizedBox(height: 13),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: .93,
          ),
          itemCount: features.length,
          itemBuilder: (context, index) {
            final item = features[index];
            return Material(
              color: Colors.white,
              borderRadius: BorderRadius.circular(19),
              child: InkWell(
                borderRadius: BorderRadius.circular(19),
                onTap: () =>
                    item.live ? onRegistrations() : onFeature(item.title),
                child: Container(
                  padding: const EdgeInsets.all(15),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(19),
                    border: Border.all(color: const Color(0xffe8ebf2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        height: 40,
                        width: 40,
                        decoration: BoxDecoration(
                          color: item.color.withValues(alpha: .11),
                          borderRadius: BorderRadius.circular(13),
                        ),
                        child: Icon(item.icon, color: item.color, size: 22),
                      ),
                      const Spacer(),
                      Text(
                        item.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          height: 1.2,
                          color: Color(0xff1d2939),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        item.detail,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11.5,
                          height: 1.35,
                          color: Color(0xff667085),
                        ),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        item.live ? 'ĐÃ KẾT NỐI API' : 'PHÂN HỆ',
                        style: TextStyle(
                          fontSize: 9,
                          letterSpacing: .5,
                          fontWeight: FontWeight.w800,
                          color: item.live
                              ? const Color(0xff168765)
                              : const Color(0xff8b93a4),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
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
    setState(() => activities = Api.activities());
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
    final isCompetition = activity['MaCThi'] != null;
    final isSeminar = activity['MaSeminar'] != null;
    final kind =
        isCompetition ? 'CUỘC THI' : (isSeminar ? 'SEMINAR' : 'HOẠT ĐỘNG');
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
  final MobileScannerController controller = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
  );
  bool processing = false;
  bool checkedIn = false;
  String? message;

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (processing || checkedIn) return;
    String? code;
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue;
      if (value != null && value.isNotEmpty) {
        code = value;
        break;
      }
    }
    if (code == null || code.isEmpty) return;
    setState(() {
      processing = true;
      message = 'Đang xác nhận điểm danh…';
    });
    await controller.stop();
    try {
      final result = await Api.checkIn(code);
      if (!mounted) return;
      setState(() {
        checkedIn = true;
        message = (result is Map && result['message'] is String)
            ? result['message'] as String
            : 'Điểm danh thành công. +5 điểm rèn luyện đã được gửi chờ xác nhận.';
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
    await controller.start();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListView(
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
  Future<dynamic>? data;

  @override
  void initState() {
    super.initState();
    if (widget.title == 'Điểm rèn luyện') data = Api.myTrainingPoints();
    if (widget.title == 'Seminar học thuật') data = Api.seminars();
    if (widget.title == 'Tin tức & thông báo') data = Api.notifications();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.title == 'Quét QR điểm danh') {
      return QrAttendanceContent(onBack: widget.onBack);
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
        if (data == null)
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xffe7eaf1))),
            child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline_rounded, color: Color(0xff3156c8)),
                  SizedBox(height: 12),
                  Text('Phân hệ đang được chuẩn bị',
                      style:
                          TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  SizedBox(height: 8),
                  Text(
                      'API nghiệp vụ tương ứng chưa được triển khai trên máy chủ hiện tại.',
                      style: TextStyle(color: Color(0xff667085), height: 1.5)),
                ]),
          )
        else
          FutureBuilder<dynamic>(
            future: data,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting)
                return const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(child: CircularProgressIndicator()));
              if (snapshot.hasError)
                return Text(
                    snapshot.error.toString().replaceFirst('Exception: ', ''),
                    style: const TextStyle(color: Color(0xffb42318)));
              if (title == 'Điểm rèn luyện') {
                final result = snapshot.data as Map? ?? {};
                final rows = result['chiTiet'] as List? ?? [];
                return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16)),
                          child: Text(
                              'Tổng điểm đã xác nhận: ${result['tongDiem'] ?? 0}',
                              style: const TextStyle(
                                  fontSize: 17, fontWeight: FontWeight.w700))),
                      const SizedBox(height: 12),
                      if (rows.isEmpty)
                        const Text('Chưa có điểm rèn luyện được ghi nhận.'),
                      ...rows.map((row) => _featureRow(row, 'TenHoatDong',
                          '${row['SoDiem'] ?? ''} điểm · ${row['TrangThai'] ?? ''}')),
                    ]);
              }
              final rows =
                  snapshot.data is List ? snapshot.data as List : <dynamic>[];
              if (rows.isEmpty) return const Text('Chưa có dữ liệu.');
              return Column(
                  children: rows.map((row) {
                final isSeminar = title == 'Seminar học thuật';
                final isNotification = title == 'Tin tức & thông báo';
                final eventName = (isNotification
                        ? row['TieuDe'] ?? row['TenHoatDong'] ?? row['LoaiNhac']
                        : row['TenHoatDong'] ?? row['ChuDe'] ?? 'Hoạt động')
                    .toString();
                final subtitle = isSeminar
                    ? '${row['ChuDe'] ?? ''} · ${row['TgBatDau'] ?? ''}\n${row['DiaDiem'] ?? 'Chưa có địa điểm'}'
                    : isNotification
                        ? '${row['NoiDung'] ?? row['LoaiNhac'] ?? ''} · ${row['GuiLuc'] ?? row['TgBatDau'] ?? ''}'
                        : '${row['LoaiNhac'] ?? ''} · ${row['TgBatDau'] ?? ''} · ${row['DiaDiem'] ?? ''}';
                return Card(
                    color: Colors.white,
                    elevation: 0,
                    margin: const EdgeInsets.only(bottom: 10),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: const BorderSide(color: Color(0xffe8ebf2))),
                    child: ListTile(
                      leading: Icon(
                          isSeminar
                              ? Icons.groups_rounded
                              : Icons.notifications_active_outlined,
                          color: const Color(0xff3156c8)),
                      title: Text(eventName,
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text(subtitle,
                          maxLines: 3, overflow: TextOverflow.ellipsis),
                      trailing: isSeminar
                          ? TextButton(
                              onPressed: () => _registerSeminar(row),
                              child: const Text('Đăng ký'))
                          : null,
                    ));
              }).toList());
            },
          ),
      ],
    );
  }

  Widget _featureRow(dynamic row, String titleKey, String subtitle) => Card(
        color: Colors.white,
        elevation: 0,
        margin: const EdgeInsets.only(top: 8),
        child: ListTile(
            title: Text((row[titleKey] ?? 'Hoạt động').toString()),
            subtitle: Text(subtitle)),
      );

  Future<void> _registerSeminar(dynamic row) async {
    try {
      await Api.request('/seminars/${row['MaSeminar']}/register',
          method: 'POST', body: {});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đăng ký seminar thành công.')));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', ''))));
    }
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
    setState(() => data = Api.myRegistrations());
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

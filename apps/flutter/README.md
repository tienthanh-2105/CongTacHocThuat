# Ứng dụng Flutter — Công tác học thuật

## Chạy bằng Android Studio

1. Cài Flutter SDK và plugin Flutter cho Android Studio.
2. Mở thư mục `apps/flutter` (thư mục có `pubspec.yaml`).
3. Chạy API tại thư mục gốc dự án bằng `npm run dev:api`; bật Android Emulator trong Device Manager.
4. Chọn emulator trong Android Studio và bấm Run.

API mặc định là `http://10.0.2.2:3001/api/v1` để emulator gọi API trên máy tính. Có thể thay URL khi chạy bằng thiết bị khác:

```powershell
flutter run --dart-define=API_URL=http://<IP-may-tinh>:3001/api/v1
```

## Chức năng

- Đăng nhập qua `/auth/mobile/login`, lưu Bearer token bằng `shared_preferences`, tự xác thực lại khi mở app và xóa token khi đăng xuất.
- Trang chủ tải cuộc thi, seminar và hoạt động sắp diễn ra qua `GET /activities`; hiển thị thời gian, hạn đăng ký, địa điểm và thông tin chính.
- Đăng ký cá nhân/tham gia/hỗ trợ/cổ vũ qua `/registrations/individual`.
- Tạo đội qua `/registrations/team`; tham gia đội bằng mã đội qua `/registrations/team/join`.
- Xem danh sách hoạt động đã đăng ký.
- Quét QR bằng camera để điểm danh; hệ thống ghi nhận điểm danh và tạo khoản +5 DRL ở trạng thái chờ Phòng Công tác sinh viên xác nhận.
- Xem thông báo đã lưu và nhắc lịch hoạt động/hạn đăng ký.

Để quét QR trên thiết bị Android, cấp quyền camera khi ứng dụng hỏi. `API_URL` trên thiết bị thật cần dùng địa chỉ IP LAN của máy chạy API, không dùng `10.0.2.2`.

Trước khi chạy các API workflow mới, áp dụng migration bổ sung từ thư mục gốc bằng `npm run db:migrate`. API mới gồm duyệt kế hoạch, vòng thi/nộp bài/chấm điểm, QR attendance, duyệt DRL, danh sách chờ, thông báo và báo cáo tổng hợp. Khởi động lại API sau khi cập nhật backend.

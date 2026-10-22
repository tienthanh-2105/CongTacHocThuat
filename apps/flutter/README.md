# Ứng dụng Flutter — Công tác học thuật

Ứng dụng Android viết bằng Flutter, nằm độc lập tại `apps/flutter` để không ảnh hưởng ứng dụng Expo đang có.

## Mở và chạy bằng Android Studio

1. Cài Flutter SDK và plugin Flutter cho Android Studio.
2. Mở thư mục `apps/flutter` (thư mục có `pubspec.yaml`).
3. Chọn thiết bị Android hoặc emulator rồi chạy cấu hình `main.dart`.

API mặc định trỏ tới `http://10.0.2.2:3001/api/v1` để emulator Android truy cập máy chủ chạy trên máy tính. Đổi địa chỉ khi chạy bằng thiết bị thật:

```bash
flutter run --dart-define=API_URL=http://<IP-may-tinh>:3001/api/v1
```

Ứng dụng đăng nhập bằng `/auth/mobile/login` và dùng Bearer token cho các request. Các màn hình kết nối hoạt động đã đăng ký, điểm rèn luyện, seminar, nhắc lịch và đăng ký seminar. Các phân hệ quản lý còn lại chỉ được hiển thị dưới dạng trạng thái chuẩn bị.

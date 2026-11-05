# Bật thông báo đẩy Firebase cho ứng dụng Android

Mã nguồn đã tích hợp FCM ở Flutter và API. Firebase cần cấu hình riêng cho dự án; không commit khóa Admin hoặc tệp cấu hình Android lên Git.

## 1. Tạo Firebase project và thêm Android app

1. Mở [Firebase Console](https://console.firebase.google.com/) và tạo/chọn project.
2. Chọn **Add app → Android**. Android package name phải đúng là `vn.edu.cong_tac_hoc_thuat`.
3. Tải `google-services.json` và đặt tại:
   `apps/flutter/android/app/google-services.json`
4. Trong Firebase Console, mở **Project settings → Cloud Messaging** và bảo đảm FCM API đã bật.

Tệp `google-services.json` chỉ có cấu hình nhận diện app; khóa dịch vụ Admin ở bước sau mới là bí mật. Tệp này đã được thêm vào `.gitignore`.

## 2. Cấp quyền gửi push cho API

1. Firebase Console → **Project settings → Service accounts** → **Generate new private key**.
2. Lưu JSON ở ngoài thư mục mã nguồn, ví dụ `E:\secrets\firebase-admin.json`. Không gửi tệp này qua chat hoặc commit lên Git.
3. Trong `apps/api/.env`, thêm:

   ```env
   GOOGLE_APPLICATION_CREDENTIALS=E:/secrets/firebase-admin.json
   FIREBASE_PROJECT_ID=ma-project-firebase
   ```

   `FIREBASE_PROJECT_ID` là Project ID trong Project settings, không phải tên hiển thị.

## 3. Cập nhật SQL Server và chạy lại

Từ thư mục gốc của dự án:

```powershell
npm run db:migrate
npm run dev:api
```

Migration `046_firebase_push.sql` thêm bảng thiết bị, hàng đợi push và trigger theo dõi thông báo mới được ghi vào `THONGBAO`. Câu lệnh migration không xóa dữ liệu hiện có.

## 4. Cài lại ứng dụng Android

Trong Android Studio, chạy lại Flutter app sau khi đã đặt `google-services.json`. Hoặc dùng:

```powershell
cd apps/flutter
flutter pub get
flutter run --dart-define=API_URL=http://DIA-CHI-IP-MAY-TINH:3001/api/v1
```

Điện thoại thật và máy tính cần cùng mạng; thay `DIA-CHI-IP-MAY-TINH` bằng IPv4 của máy chạy API. Mở app, đăng nhập và chấp nhận quyền thông báo. App tự đăng ký token thiết bị với API.

## 5. Gửi thử

Tạo một thông báo mới trên web bằng chức năng **Thông báo & điểm rèn luyện**. API sẽ gửi push tới thiết bị đã đăng ký cho từng tài khoản nhận thông báo. App đang mở sẽ hiện thông báo cục bộ; khi app ở nền hoặc đã đóng, Android hiển thị notification từ FCM. Hàng đợi thử gửi lại lỗi tạm thời và hết hạn sau 3 ngày.

Nếu thiếu service-account key, API vẫn khởi động và dùng luồng thông báo hiện tại; push FCM chưa gửi cho tới khi cấu hình key và chạy migration.

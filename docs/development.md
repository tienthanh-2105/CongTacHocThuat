# Phát triển Web, Mobile và API

Thư mục chính: `E:\Khoa_Luan_Cu_Nhan\DuAn_KhoaLuan`. Cài dependency tại thư mục gốc bằng `npm install`; khi lấy source có lockfile, dùng `npm ci`.

```text
apps/
├── web/       Next.js + TypeScript (App Router)
│   └── src/app/
├── mobile/    React Native + Expo + TypeScript
│   └── src/
│       ├── screens/
│       └── services/
└── api/       NestJS + PostgreSQL
    └── src/
        ├── presentation/
        ├── business/
        └── data/
```

Mỗi thành viên làm việc trên nhánh Git riêng. Web và Mobile có giao diện riêng, cùng sử dụng API NestJS. Mobile hiện có một màn hình; khi bổ sung điều hướng dùng Expo Router theo AGENTS.md.

## Chạy trên máy phát triển

Mở các terminal tại thư mục gốc:

```powershell
# Terminal 1: PostgreSQL đang chạy, apps/api/.env đã được cấu hình
npm run dev:api
# Terminal 2
npm run dev:web
# Terminal 3
npm run dev:mobile
```

Web: http://localhost:3000. API: http://localhost:3001/api/v1. Swagger: http://localhost:3001/docs. Mobile khởi động Metro; dùng Expo Go phù hợp SDK hoặc emulator để mở app. Chưa build APK/IPA.

Web đọc `NEXT_PUBLIC_API_URL` (mặc định localhost:3001/api/v1). Có thể copy apps/web/.env.example sang apps/web/.env.local. Mobile đọc `EXPO_PUBLIC_API_URL`; copy apps/mobile/.env.example sang apps/mobile/.env.local và sửa theo thiết bị:

| Thiết bị | Địa chỉ API |
| --- | --- |
| Web trên máy chạy backend | http://localhost:3001/api/v1 |
| Android emulator mặc định | http://10.0.2.2:3001/api/v1 |
| Điện thoại thật cùng Wi-Fi | http://IP_LAN_MAY_CHAY_API:3001/api/v1 |

Backend hiện nghe tại 127.0.0.1:3001. Muốn điện thoại thật hoặc máy khác gọi được API, cần đổi host listen sang 0.0.0.0 và cho phép cổng 3001 qua firewall trong mạng riêng. Source khởi tạo không tự thay đổi cấu hình mạng máy. Biến NEXT_PUBLIC_/EXPO_PUBLIC_ chỉ chứa địa chỉ công khai, không chứa mật khẩu database.

Web có giao diện đăng nhập tại / và /login, kết nối API bằng cookie HttpOnly và hiển thị tài khoản sau khi đăng nhập. Mobile hiện có màn hình khởi đầu và kiểm tra kết nối API; chưa có cơ chế phiên native Mobile. Quên mật khẩu trên Web hướng dẫn liên hệ quản trị viên, chưa có API cấp lại mật khẩu.

## Kiểm tra

```powershell
npm run typecheck
npm run lint
npm run build
npm run check:mobile
npm run test:api
```

`build` biên dịch API và Web; không tạo APK/IPA. `test:api` chạy kiểm thử trên database thật với tài khoản tạm. Trên Windows có thể chạy Android emulator; build iOS native cần macOS hoặc dịch vụ build phù hợp.

Tài liệu: [Next.js](https://nextjs.org/docs/app/getting-started/installation), [Expo TypeScript](https://docs.expo.dev/guides/typescript/), [Expo monorepo](https://docs.expo.dev/guides/monorepos/).

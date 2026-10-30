# Phát triển Web, Mobile và API

## Thành phần

- `apps/api`: NestJS + TypeScript, kết nối Microsoft SQL Server bằng `mssql`.
- `apps/web`: Next.js + TypeScript.
- `apps/mobile`: React Native + Expo.
- `apps/flutter`: ứng dụng Flutter mở trực tiếp trong Android Studio.

## Cấu hình và khởi chạy API

Cài SQL Server và tạo database `QL_CongTacHocThuat` trong SSMS. Copy `apps/api/.env.example` thành `apps/api/.env`, cấu hình `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`; với môi trường local có thể đặt `DB_ENCRYPT=false` và `DB_TRUST_SERVER_CERTIFICATE=true`.

```powershell
npm ci
npm run db:migrate
npm run db:seed
npm run db:check
npm run dev:api
```

Schema khởi tạo nằm tại `apps/api/migrations/001_sqlserver_initial_schema.sql`. Lệnh migrate tạo 31 bảng trong database rỗng, không xóa dữ liệu; schema đang có một phần sẽ bị từ chối để người quản trị xử lý rõ ràng. File `docs/database/QL_CongTacHocThuat_SqlServer.sql` là script reset thủ công có xóa bảng và chèn dữ liệu mẫu.

API: http://localhost:3001/api/v1. Swagger: http://localhost:3001/docs. `apps/api/.env` không được commit; không dùng thông tin mẫu trong `.env.example` như mật khẩu thực.

## Web và mobile

Web dùng `NEXT_PUBLIC_API_URL` (mặc định `http://localhost:3001/api/v1`). Expo dùng `EXPO_PUBLIC_API_URL`; Android emulator thường truy cập máy host qua `http://10.0.2.2:3001/api/v1`. Điện thoại thật cần IP LAN của máy chạy API và backend/firewall cho phép kết nối.

```powershell
npm run dev:web
npm run dev:mobile
```

Flutter: mở `apps/flutter` bằng Android Studio, cấu hình địa chỉ API trong app theo emulator hoặc thiết bị đang dùng, sau đó chạy cấu hình Android.

## Kiểm tra mã nguồn

```powershell
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm run check:mobile
```

`npm run test:unit` chạy các kiểm thử nghiệp vụ dùng mock, không cần kết nối SQL Server. Checklist thao tác từng phân hệ nằm tại `docs/testing/test-cases-nghiep-vu.md`.

`npm run test:api` dùng SQL Server thật và cần database được cấu hình sẵn. Lệnh này có thể tạo/xóa dữ liệu kiểm thử.

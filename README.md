# Quản lý công tác học thuật

Repository gồm API NestJS (`apps/api`), web Next.js (`apps/web`), mobile Expo (`apps/mobile`) và ứng dụng Flutter (`apps/flutter`). API sử dụng Microsoft SQL Server qua thư viện `mssql`.

## Chạy API với SQL Server

1. Tạo database `QL_CongTacHocThuat` trong SQL Server/SSMS (hoặc đổi `DB_NAME`).
2. Copy `apps/api/.env.example` thành `apps/api/.env`, rồi điền host, tài khoản và mật khẩu SQL Server. Không đưa `.env` lên Git.
3. Tại thư mục gốc chạy:

```powershell
npm ci
npm run db:migrate
npm run db:seed
npm run db:check
npm run dev:api
```

`db:migrate` chỉ tạo schema ban đầu khi chưa có bảng ứng dụng; nếu schema đã có đầy đủ thì không thay đổi, nếu chỉ có một phần thì dừng để tránh ghi đè. `db:seed` tạo tài khoản quản trị từ `SEED_USERNAME`/`SEED_PASSWORD` nếu tài khoản chưa tồn tại.

API: http://localhost:3001/api/v1 · Swagger: http://localhost:3001/docs.

SQL reset có dữ liệu mẫu tại [docs/database/QL_CongTacHocThuat_SqlServer.sql](docs/database/QL_CongTacHocThuat_SqlServer.sql) sẽ xóa các bảng hiện có. Không dùng file này cho cài đặt thông thường.

Hướng dẫn chi tiết: [docs/development.md](docs/development.md), [docs/database/schema.md](docs/database/schema.md), [docs/api/auth.md](docs/api/auth.md).

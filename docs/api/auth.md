# API xác thực và kết nối SQL Server

Backend sử dụng Microsoft SQL Server qua thư viện `mssql`. Cấu hình kết nối trong `apps/api/.env` theo mẫu `apps/api/.env.example`: `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE`.

Khởi tạo schema và tài khoản quản trị:

```powershell
npm run db:migrate
npm run db:seed
npm run db:check
```

## Endpoint

| Method | URL | Kết quả |
|---|---|---|
| POST | `/api/v1/auth/login` | Đăng nhập, nhận phiên/token |
| POST | `/api/v1/auth/logout` | Thu hồi phiên hiện tại |
| POST | `/api/v1/auth/change-password` | Đổi mật khẩu |
| GET | `/api/v1/auth/me` | Tài khoản hiện tại; cần xác thực |
| GET | `/api/v1/health` | Kiểm tra API và kết nối database |

Swagger chạy tại `http://localhost:3001/docs`. Tài khoản seed được lấy từ `SEED_USERNAME` và `SEED_PASSWORD`; đặt mật khẩu riêng, ít nhất 12 ký tự. Seed không thay đổi mật khẩu nếu tài khoản đã tồn tại.

Schema SQL Server: `apps/api/migrations/001_sqlserver_initial_schema.sql`. Không chạy script reset `docs/database/QL_CongTacHocThuat_SqlServer.sql` trừ khi muốn xóa và tạo lại dữ liệu.

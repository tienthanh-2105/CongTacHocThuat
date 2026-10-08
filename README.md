# Dự án khóa luận — API xác thực

Thư mục làm việc chính: `E:\Khoa_Luan_Cu_Nhan\DuAn_KhoaLuan`.

Source theo mô hình ba lớp: `apps/api/src/presentation` → `business` → `data/repositories`. NestJS/TypeScript; truy cập PostgreSQL bằng thư viện `pg` và SQL tham số hóa để khớp các bảng tiếng Việt trong `QL_CongTacHocThuat.sql`.

Đã cài đặt API đăng nhập, đăng xuất, đổi mật khẩu, xem tài khoản hiện tại và kiểm tra kết nối. Web dùng Next.js + TypeScript tại `apps/web`; Mobile dùng React Native/Expo + TypeScript tại `apps/mobile`, mỗi nền tảng có source và màn hình khởi đầu riêng.

Hướng dẫn chạy cả ba nền tảng, cấu hình địa chỉ API và làm việc nhóm: [docs/development.md](docs/development.md).

## Chạy

```powershell
cd E:\Khoa_Luan_Cu_Nhan\DuAn_KhoaLuan
npm install
# Cấu hình apps/api/.env theo apps/api/.env.example
npm run db:check
npm run db:migrate
npm run dev:api
```

API: http://localhost:3001/api/v1. Swagger: http://localhost:3001/docs.

Tài khoản demo local: `admin.demo`. Mật khẩu được sinh ngẫu nhiên và lưu ở `SEED_PASSWORD` trong `apps/api/.env`. Đây là mật khẩu ứng dụng, khác mật khẩu kết nối PostgreSQL. `npm run db:seed` không đổi mật khẩu tài khoản đã tồn tại.

Chi tiết: [docs/api/auth.md](docs/api/auth.md). File chứa mật khẩu không đưa vào Git.

Kiểm tra: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`. Test HTTP dùng PostgreSQL thật, tạo tài khoản tạm và xóa sau kiểm thử; cần chạy migration và seed trước.

# API xác thực

## Kết nối database

PostgreSQL 18 trên máy: host `localhost`, port `5432`, database **QL_CongTacHocThuat**, user `postgres`. Mật khẩu kết nối lưu trong `apps/api/.env` tại `PGPASSWORD`, không nằm trong source.

pgAdmin 4 là công cụ quản lý; backend kết nối PostgreSQL trực tiếp. Trong pgAdmin: Servers → PostgreSQL → Databases → Refresh → QL_CongTacHocThuat → Schemas → public → Tables. Nếu chưa đăng ký server: Register → Server → Connection, điền các thông tin trên.

Database có 31 bảng: 23 bảng gốc và 8 bảng bổ sung. Schema hiện hành tại apps/api/migrations/006_cau_truc_theo_ban_sql_cua_ban.sql. Bảng phiên là phiendangnhap và cột phiên bản mật khẩu là taikhoan.pbmatkhau. Chi tiết tại docs/database/schema.md.

Tên đăng nhập lấy từ `taikhoan.tendangnhap`, phân biệt hoa/thường, bỏ khoảng trắng hai đầu. `matkhau` chứa bcrypt hash; tài khoản cũ có mật khẩu plaintext/kiểu hash khác cần chuyển đổi, API không so sánh plaintext. Trạng thái tài khoản và người dùng liên quan phải là `Hoạt động`. Vai trò được đọc từ `vaitro`, chưa triển khai quản trị tài khoản/phân quyền chi tiết.

## Endpoint

| Method | URL | Kết quả |
|---|---|---|
| POST | /api/v1/auth/login | 200, user và thời hạn, cookie phiên |
| POST | /api/v1/auth/logout | 204, thu hồi phiên hiện tại và xóa cookie |
| POST | /api/v1/auth/change-password | 200, đổi mật khẩu và thu hồi tất cả phiên |
| GET | /api/v1/auth/me | 200, tài khoản hiện tại; cần đăng nhập |
| GET | /api/v1/health | 200 nếu kết nối database thành công, 503 khi truy vấn thất bại |

Đăng nhập:

```json
{"username":"admin.demo","password":"mật khẩu SEED_PASSWORD trong file .env"}
```

Đổi mật khẩu, gửi kèm cookie đăng nhập:

```json
{"currentPassword":"mật khẩu hiện tại","newPassword":"mật khẩu mới từ 12 ký tự"}
```

Đăng xuất: POST với `{}` hoặc body trống. Lặp lại vẫn trả 204. Sau khi đổi mật khẩu phải đăng nhập lại.

Swagger `/docs`: mở POST login → Try it out → điền mật khẩu demo → Execute; trình duyệt nhận cookie tự động. Sau đó thử GET me, change-password hoặc logout. Postman giữ cookie qua cookie jar; frontend fetch cần `credentials: 'include'`.

## Bảo vệ và lỗi

- Bcrypt cost 12; mật khẩu tối đa 72 byte UTF-8, mật khẩu mới ít nhất 12 ký tự và khác mật khẩu cũ.
- Token ngẫu nhiên 32 byte, database chỉ lưu SHA-256 hash; cookie HttpOnly, SameSite=Strict, Secure khi production; thời hạn mặc định 8 giờ.
- 400 dữ liệu sai/mật khẩu hiện tại sai; 401 thông tin đăng nhập sai/phiên hết hạn/tài khoản bị khóa; 403 nguồn gửi không được phép; 429 vượt giới hạn đăng nhập.
- Sai tên đăng nhập và sai mật khẩu trả cùng thông báo. DTO cấm trường thừa. Không trả passwordHash/tokenHash trong phản hồi.
- Giới hạn 20 yêu cầu login/15 phút/IP, lưu bộ nhớ của tiến trình, phù hợp local; khi triển khai nhiều instance cần kho giới hạn dùng chung.
- Đổi mật khẩu trong transaction, khóa tài khoản/phiên và tăng pbmatkhau. Phiên tạo đồng thời với đổi mật khẩu cũng bị từ chối nếu phiên bản cũ.
- HTTPS và origin Web/API phải được cấu hình đúng khi production. Phiên cookie này phục vụ web; xác thực native mobile cần thiết kế riêng khi triển khai mobile.

## Lệnh database

`npm run db:check`: kiểm tra kết nối và bảng; `npm run db:migrate`: áp dụng schema auth; `npm run db:seed`: tạo demo nếu chưa tồn tại. Nếu database chưa có, chạy `node scripts/database.cjs create` trong `apps/api` bằng user có quyền tạo database.

Nếu pgAdmin chưa thấy bảng, Refresh nút Tables. Nếu kết nối lỗi: kiểm tra service PostgreSQL, host/cổng, tên database đúng hoa/thường, user và PGPASSWORD. Không đổi mật khẩu PostgreSQL từ API đổi mật khẩu ứng dụng.



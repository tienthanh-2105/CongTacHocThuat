# Schema SQL Server

API kết nối Microsoft SQL Server bằng `mssql`. Schema khởi tạo được quản lý tại `apps/api/migrations/001_sqlserver_initial_schema.sql` và tạo 31 bảng nghiệp vụ trong schema `dbo`.

Các bảng bao gồm danh mục khoa/bộ môn/lớp, người dùng/tài khoản/vai trò, sinh viên/giảng viên, kế hoạch và hoạt động học thuật, cuộc thi/seminar, đăng ký và điểm danh, điểm rèn luyện, chi phí thực tế và hồ sơ quyết toán.

## Khởi tạo an toàn

Tạo database trong SSMS, cấu hình `apps/api/.env`, sau đó chạy từ thư mục gốc:

```powershell
npm run db:migrate
npm run db:seed
npm run db:check
```

Migration chỉ chạy trên database chưa có bảng ứng dụng; nếu đã có đủ 31 bảng thì bỏ qua, nếu có schema một phần thì báo lỗi và không sửa bảng. Migration không thêm dữ liệu mẫu.

## Script reset thủ công

`docs/database/QL_CongTacHocThuat_SqlServer.sql` là script thiết lập đầy đủ cho SSMS nhưng có thao tác xóa toàn bộ foreign key và bảng hiện hữu, sau đó tạo lại schema và chèn dữ liệu mẫu. Chỉ chạy khi chủ động muốn reset database; không cần chạy trong quy trình `npm run db:migrate`.

Các file PostgreSQL cũ được lưu trong thư mục `archive/postgresql` dưới `apps/api/migrations`, `apps/api/scripts` hoặc `docs/database`. Chúng chỉ để tham khảo lịch sử, không thuộc quy trình chạy API hiện tại.

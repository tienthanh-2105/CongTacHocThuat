# Database QL_CongTacHocThuat — 31 bảng

Đã thay 43 bảng cũ bằng 31 bảng theo thiết kế thống nhất. Các bảng cũ và dữ liệu đã được sao lưu vào backups/truoc_khi_reset_31_bang_1791388780249.dump. Sau reset đã tạo lại tài khoản demo từ cấu hình local.

## File SQL hiện hành

- apps/api/migrations/003_cau_truc_31_bang.sql: chỉ tạo 31 bảng, dùng với database chưa có bảng.
- apps/api/migrations/004_xoa_va_tao_lai_31_bang.sql: xóa toàn bộ bảng public và dữ liệu, rồi tạo 31 bảng trong transaction; kiểm tra tên database trước khi chạy.
- 000_cau_truc_goc.sql và 002_bo_sung.sql là tài liệu nguồn/lịch sử, không chạy kết hợp để cài schema hiện hành.

## 23 bảng gốc

khoa, lop, nguoi_dung, vai_tro, tai_khoan, phan_quyen, vai_tro_phan_quyen, sinh_vien, giang_vien, can_bo_khoa, quan_tri_vien, ke_hoach_hoc_thuat, hoat_dong_hoc_thuat, cuoc_thi, seminar, dang_ky_tham_gia, phan_cong_co_vu, de_tai, ma_qr, diem_danh, giai_thuong, ket_qua_hoc_thuat, diem_ren_luyen.

## 8 bảng bổ sung

phien_dang_nhap, bo_mon, ban_cuoc_thi, thanh_vien_ban, doi_thi, thanh_vien_doi, chi_phi_thuc_te, ho_so_quyet_toan.

## Điều chỉnh để đáp ứng yêu cầu với 31 bảng

- Kế hoạch phân biệt KHOA/BO_MON, hoạt động giữ kế hoạch nguồn và liên kết kế hoạch khoa tổng hợp; kinh phí dự trù lưu trên hoạt động. Lịch sử duyệt kế hoạch lưu JSONB.
- Thành viên ban lưu danh sách nhiệm vụ JSONB. Chi phí thực tế liên kết hồ sơ quyết toán và lưu danh sách chứng từ JSONB.
- Đề tài/kết quả có liên kết đội thi. Kết quả yêu cầu đúng một chủ thể cá nhân hoặc đội. Một đội có tối đa một trưởng đội.
- Đăng ký bổ sung DU_THI/HO_TRO và thời điểm đã nhắc. Phân công theo lớp phân biệt hỗ trợ/cổ vũ.
- Thông tin công bố lưu trên hoạt động; diễn giả seminar lưu JSONB. Chưa có trang tin nhiều bài độc lập và hộp thư thông báo riêng.
- Điểm rèn luyện dùng các khoản có dấu cộng/trừ, tham chiếu nguồn và người ghi nhận; điều chỉnh bằng khoản mới, không ghi đè lịch sử. Bảng phiên vẫn có hash token, thời hạn và phiên bản mật khẩu.

Quy tắc xuyên bảng (đúng bộ môn/khoa/cuộc thi, chỉ tiêu, quyền duyệt, điều kiện tham gia) cần Service kiểm tra khi triển khai nghiệp vụ. Các bảng tồn tại không đồng nghĩa đã có API nghiệp vụ.

Trong pgAdmin: mở Query Tool của QL_CongTacHocThuat, Open File để đọc SQL. Refresh Schemas/public/Tables để xem 31 bảng.

## Cập nhật ngày 08/10/2026
Schema hiện hành đã chuyển sang tên bảng/cột theo bản SQL người dùng: KHOA, TAIKHOAN, DIEMRENLUYEN, BANTOCHUC... File tạo bảng hiện hành: apps/api/migrations/006_cau_truc_theo_ban_sql_cua_ban.sql. File reset: 007_xoa_va_tao_lai_theo_sql_moi.sql. PostgreSQL lưu tên không đặt trong dấu ngoặc kép thành chữ thường, ví dụ TAIKHOAN hiển thị taikhoan. API xác thực, seed và kiểm thử đã cập nhật tương ứng. Các file 003–005 là các bản thiết kế cũ.
Backup trước thay đổi: backups/truoc_khi_doi_ten_bang_1791394989524.dump.


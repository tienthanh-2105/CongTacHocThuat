# Nghiệp vụ học thuật Khoa Công nghệ thông tin

1. Giảng viên tạo đề xuất từng cuộc thi/seminar trong **Hoạt động học thuật**, chọn bộ môn và năm học. Nhập bản chi phí tại **Kinh phí hoạt động**. Gửi đề xuất sẽ gửi cả kế hoạch và bản chi phí; hệ thống chặn hồ sơ chưa có khoản chi phí.
2. Trưởng khoa ký bản chi phí rồi duyệt đề xuất. Cán bộ khoa tổng hợp các đề xuất đã ký vào **Kế hoạch năm học**, cùng khoa và năm học; Trưởng khoa ký kế hoạch chung. Kế hoạch chung không công bố trực tiếp cho sinh viên.
3. Trong **Kế hoạch tổ chức**, bộ môn lập nội dung, thể lệ, tiêu chí chấm, lịch tổ chức và mức điểm rèn luyện từ hoạt động thuộc kế hoạch chung đã duyệt. Trình Trưởng khoa ký rồi Phòng CTSV ký. Yêu cầu bổ sung làm hồ sơ quay về chỉnh sửa và phải xin ký lại.
4. Ban tổ chức được phân công công bố kế hoạch đã có cả hai chữ ký. Hệ thống gửi thông báo cho sinh viên CNTT. Sinh viên đăng ký hoạt động, sau đó đăng ký từng vòng tại **Tổ chức cuộc thi**.
5. Ban tổ chức phân công tài khoản giảng viên ra đề và chấm từng vòng. Người được phân công ra đề lưu, phát hành đề trước khi mở vòng. Sinh viên chỉ xem đề đã phát hành trong thời gian mở vòng và khi có đăng ký hợp lệ.
6. Sinh viên/các đội nộp nội dung và đường dẫn tệp bài làm. Hệ thống chặn nộp trùng hoặc quá hạn. Người được phân công chấm lưu điểm 0–100 khi vòng kết thúc hoặc đóng. Lưu điểm riêng từng giám khảo và điểm trung bình.
7. Ban tổ chức lập giải thưởng và kết quả từ bài đã được chấm đầy đủ; công bố kết quả và gửi thông báo cho thí sinh/đội đạt giải.

Điểm danh lấy mức điểm rèn luyện trong kế hoạch đã được CTSV ký, gửi chờ CTSV xác nhận. Các hồ sơ cũ giữ nguyên trạng thái và lịch sử; không tự động coi hồ sơ cũ là đã hoàn tất chữ ký mới.

## Kiểm tra

`npm run test:unit` kiểm tra quyền, thứ tự ký, điều kiện mở đăng ký và các trường hợp chặn trong vòng thi.

Sau `npm run build -w apps/api` và `npm run db:migrate`, chạy từ thư mục gốc:

```powershell
node scripts/verify-academic-workflow.cjs
```

Kiểm thử này cần SQL Server local và tài khoản admin, giảng viên CNTT, sinh viên có sẵn. Tạo hồ sơ gắn nhãn `VERIFY-`, đi đủ bảy bước với cả các trường hợp phải bị chặn, rồi xóa các hồ sơ thử trong `finally`. Không dùng trên dữ liệu sản xuất.

Các migration 017–020 bổ sung bảng kế hoạch tổ chức, phân công/đề/đăng ký vòng thi, chữ ký đề xuất và trạng thái công bố; không xóa hay chuyển trạng thái hồ sơ có sẵn.

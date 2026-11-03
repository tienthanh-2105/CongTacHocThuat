# Phạm vi nghiệp vụ nền tảng Web

## Chức năng và màn hình

| Yêu cầu | Màn hình Web | Nghiệp vụ |
|---|---|---|
| Kế hoạch năm học và dự trù | Hoạt động học thuật, Ban bộ môn, Kế hoạch học thuật, Kinh phí hoạt động, Dự trù kinh phí | Bộ môn lập hoạt động và các khoản chi; Phụ trách bộ môn xem xét; Trưởng ban học thuật tổng hợp; Trưởng khoa ký kế hoạch chung và duyệt kinh phí liên quan. |
| Kế hoạch tổ chức chi tiết | Kế hoạch tổ chức | Lập thể lệ, lịch, địa điểm, mức điểm rèn luyện; thành lập Ban tổ chức, Ban đề thi, Ban thư ký, Ban giám khảo hoặc ban khác; giao vai trò, nhiệm vụ, hạn hoàn thành, sản phẩm cho giảng viên. Khoa ký trước, CTSV ký sau. |
| Đăng ký cá nhân/đội, hỗ trợ/cổ vũ | Đăng ký dự thi, Hỗ trợ & cổ vũ, Tổ chức cuộc thi | Sinh viên đăng ký hoạt động cá nhân hoặc lập/tham gia đội; đăng ký hỗ trợ/cổ vũ; cán bộ phân chỉ tiêu theo lớp. Sau đăng ký hoạt động, sinh viên đăng ký từng vòng thi. |
| Điểm rèn luyện | Điểm danh, Điểm rèn luyện | Điểm danh tạo khoản điểm theo kế hoạch CTSV đã ký; CTSV xác nhận. Sinh viên xem tổng điểm đã xác nhận và các khoản chi tiết, bao gồm khoản đang chờ. |
| Đề tài, kết quả, đội đạt giải | Đề tài & kết quả, Tổ chức cuộc thi | Sinh viên đăng ký đề tài cá nhân/đội; Ban tổ chức theo dõi trạng thái. Giảng viên được giao ra đề/chấm từng vòng; lưu bài, điểm từng giám khảo, điểm trung bình và công bố giải từ bài đã chấm đầy đủ. |
| Chi phí thực tế, quyết toán | Quản lý kinh phí → Kinh phí thực tế | Ghi khoản chi, ngày chi, đường dẫn chứng từ; tổng hợp hồ sơ; người lập gửi, khoa duyệt. Hiển thị tổng chi so với dự trù. |
| Seminar | Seminar học thuật | Tạo từ kế hoạch tổ chức đã ký; theo dõi chủ đề, lịch, địa điểm, đơn vị chủ trì/phối hợp, diễn giả, chương trình, thời lượng, tài liệu và đăng ký tham dự. |
| Tin tức, thông báo | Tin tức & thông báo, chuông thông báo | Công bố hoạt động tạo bản tin và thông báo. Ban tổ chức soạn, sửa, đăng, ẩn bản tin theo hoạt động phụ trách. Sinh viên tìm tin theo từ khóa/loại hoạt động, xem thông báo cá nhân và đi đến đăng ký. |

## Luồng bước 3–7

1. Bộ môn lấy hoạt động từ kế hoạch chung đã duyệt, lập kế hoạch tổ chức, các ban và phân công. Bản dự thảo có thể chưa đủ thành viên; khi trình ký, các ban đã lập phải có giảng viên, luôn có Ban tổ chức và cuộc thi có Ban đề thi.
2. Khoa ký, rồi CTSV ký làm căn cứ ghi nhận điểm rèn luyện. Nội dung và danh sách phân công khóa khi đang trình ký/đã duyệt. Hồ sơ yêu cầu bổ sung được sửa và xin ký lại.
3. Ban tổ chức được phân công công bố hoạt động sau khi có đủ chữ ký và kinh phí được duyệt. Hệ thống tạo thông báo mở đăng ký và bản tin; sinh viên đăng ký cá nhân/đội, hỗ trợ hoặc cổ vũ.
4. Ban tổ chức lập nhiều vòng thi, phân công người ra đề và người chấm. Nếu có ban tương ứng trong kế hoạch đã ký, giảng viên được giao phải thuộc ban đó. Ban đề thi soạn, phát hành đề; sinh viên chỉ xem đề trong thời gian mở vòng và khi có đăng ký hợp lệ.
5. Sinh viên nộp bài; hệ thống lưu nội dung và đường dẫn tệp, chặn bài trùng/quá hạn. Giám khảo được phân công lưu điểm sau khi vòng kết thúc hoặc đóng.
6. Ban tổ chức tổng kết từ bài đã chấm đủ, lập/công bố giải cho cá nhân/đội. Chi thực tế và hồ sơ quyết toán được quản lý theo hoạt động.

## Cài đặt và kiểm tra

Migration `033` lưu các ban/phân công trong `KEHOACHTOCHUC.CacBan`; migration `034` tạo `TINTUCHOCTHUAT` và tương thích bảng đề tài của schema SQL nhập sẵn. Không tự chuyển trạng thái hoặc thêm chữ ký cho kế hoạch cũ.

```powershell
npm run db:migrate
npm run test:unit
npm run build -w apps/api
node scripts/verify-academic-workflow.cjs
npm run build -w apps/web
npm run start -w apps/web -- --port 3100
```

Trong cửa sổ khác:

```powershell
node scripts/verify-plan-committees-ui.mjs
node scripts/verify-student-news-ui.mjs
```

Kiểm thử SQL dùng các hồ sơ `VERIFY-` và dọn đúng mã đã tạo trong `finally`; cần tài khoản admin, giảng viên, Phụ trách bộ môn và sinh viên có sẵn. Kiểm thử giao diện giả lập API, không ghi dữ liệu nghiệp vụ; kiểm tra biểu mẫu, nội dung gửi, phân quyền hiển thị, trình ký, tin tức, seminar và quyết toán. Ảnh kiểm tra nằm trong `artifacts/test-video/` đã được Git bỏ qua. Đặt `E2E_BASE_URL` hoặc `CHROME_EXECUTABLE` nếu máy dùng địa chỉ/trình duyệt khác.

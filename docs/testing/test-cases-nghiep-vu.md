# Bộ ca kiểm thử nghiệp vụ

Đối chiếu theo phiếu khảo sát nghiệp vụ và các phân hệ hiện có trong web/API/mobile. Chạy thử thao tác trên **database kiểm thử riêng**; không dùng dữ liệu thật vì một số bước tạo, duyệt hoặc xóa dữ liệu.

## Kiểm thử tự động không cần SQL Server

Tại thư mục gốc:

```powershell
npm run test:unit
```

Bộ này kiểm tra quy tắc nghiệp vụ của đăng nhập, đăng ký, seminar, quyết toán, duyệt hoạt động và DRL bằng repository giả lập. Nó không thay thế kiểm thử tích hợp với SQL Server.

## Quay video kiểm thử giao diện tự động theo vai trò

Khi web và API đang chạy, sao chép `docs/testing/test-accounts.example.json` thành `artifacts/test-video/accounts.json`, điền tài khoản kiểm thử tại máy của bạn, sau đó chạy:

```powershell
npm run test:web:video
```

Script đăng nhập từng tài khoản, mở các mục được cấp trong menu, ghi lỗi JavaScript và phản hồi HTTP 5xx, rồi lưu video WebM cùng báo cáo JSON trong `artifacts/test-video/`. Thư mục này đã được Git bỏ qua; không đưa thông tin tài khoản lên Git hoặc gửi qua chat. Kịch bản chỉ mở màn hình và tải dữ liệu, không tạo, sửa hoặc xóa nghiệp vụ.

## Checklist kiểm thử web/API/mobile với database kiểm thử

| Mã | Chức năng | Các bước | Kết quả mong đợi |
|---|---|---|---|
| AUTH-01 | Đăng nhập | Đăng nhập bằng tài khoản hợp lệ; thử sai mật khẩu và tài khoản ngừng hoạt động | Tài khoản hợp lệ vào đúng giao diện theo quyền; trường hợp sai bị từ chối; không trả mật khẩu/token thô trong dữ liệu người dùng |
| ROLE-01 | Phân quyền | Mở từng tài khoản ADMIN, cán bộ khoa, Trưởng khoa, KHCN, CTSV, giảng viên, sinh viên | Chỉ thấy chức năng được cấp quyền; gọi API không đủ quyền phải nhận 403 |
| USER-01 | Tài khoản và hồ sơ | Tạo hồ sơ sinh viên, tạo/liên kết tài khoản, đổi mật khẩu, ngừng/hoạt động lại tài khoản | MSSV và tài khoản liên kết đúng một hồ sơ; đăng nhập theo trạng thái; tài khoản không hoạt động không được cấp phiên |
| CLASS-01 | Lớp và hồ sơ cán bộ | Tạo/sửa lớp, tạo/sửa hồ sơ cán bộ và gán bộ môn | Khóa ngoại hợp lệ; danh sách lớp, khoa và bộ môn hiển thị chính xác |
| PLAN-01 | Lập kế hoạch | Tạo kế hoạch năm học, thêm cuộc thi/seminar và dự toán, gửi duyệt | Kế hoạch và các hoạt động con được lưu, trạng thái chuyển sang chờ duyệt |
| PLAN-02 | Duyệt kế hoạch | Duyệt lần lượt Trưởng khoa → Phòng KHCN → Ban giám hiệu; thử yêu cầu bổ sung/từ chối | Chỉ vai trò đúng duyệt được bước hiện tại; lưu người duyệt, thời điểm, ghi chú và lịch sử |
| ACT-01 | Hoạt động chi tiết | Tạo hoạt động, gửi khoa duyệt, kiểm tra trạng thái trước/sau duyệt | Không công bố hoặc mở đăng ký trước khi đủ các bước duyệt nghiệp vụ |
| BUD-01 | Dự trù kinh phí | Thêm nhiều khoản cho một hoạt động; gửi khoa duyệt; duyệt/từ chối; tải file dự trù | Tổng tiền bằng tổng các khoản; trạng thái và người duyệt đúng; file chỉ gồm hồ sơ cần tổng hợp |
| SET-01 | Quyết toán | Ghi hóa đơn/chi phí thực tế; gửi hồ sơ; duyệt; thử chi vượt dự toán | Hồ sơ tổng hợp đúng hoạt động; chi phí vượt giới hạn bị chặn hoặc báo rõ theo quy định |
| SEM-01 | Seminar | Tạo seminar đủ chủ đề, nội dung, đơn vị/người chủ trì, diễn giả, chương trình và tài liệu; mở lại chi tiết | Dữ liệu nhập được lưu và hiển thị lại; thiếu trường bắt buộc bị báo rõ; không tự công bố khi chưa duyệt |
| REG-01 | Đăng ký cá nhân | Đăng ký hoạt động còn hạn; thử đăng ký trùng, quá hạn, hết chỉ tiêu | Đăng ký thành công một lần; trùng/quá hạn bị chặn; đủ chỉ tiêu thì đóng đăng ký hoặc xếp hàng theo thời gian |
| REG-02 | Đăng ký đội | Tạo đội, thêm MSSV hợp lệ; thử thành viên trùng đội, MSSV không tồn tại, quá số lượng | Thành viên không bị nhân đôi; đội và các thành viên cùng trạng thái; danh sách chờ không tách rời đội nếu nghiệp vụ yêu cầu giữ đội nguyên vẹn |
| QUOTA-01 | Chỉ tiêu theo lớp | Phân bổ số lượng hỗ trợ/cổ vũ cho lớp rồi cho sinh viên đăng ký vượt số lượng | Hệ thống đếm đúng lớp và loại phân công, không cho vượt chỉ tiêu |
| ATT-01 | Điểm danh QR | Tạo QR còn hạn; quét bằng sinh viên đã đăng ký; quét lại, dùng QR hết hạn/chưa đăng ký | Lần đầu ghi nhận; lần sau/trường hợp không hợp lệ bị chặn; có log và thông báo kết quả |
| ATT-02 | Danh sách ký tên | Ghi nhận sinh viên theo danh sách; kiểm tra bản ghi và quy trình CTSV xác nhận | Có người xác nhận, nguồn điểm danh và trạng thái DRL chờ duyệt rõ ràng |
| DRL-01 | Điểm rèn luyện | CTSV duyệt, từ chối, điều chỉnh; sinh viên xem tổng điểm và lịch sử | Chỉ điểm được xác nhận mới cộng tổng; điều chỉnh có liên kết bản ghi gốc và lý do |
| COMP-01 | Cuộc thi | Tạo cuộc thi, vòng thi, nộp bài, chấm điểm, lập/công bố kết quả và giải thưởng | Dữ liệu đúng cuộc thi/vòng; chỉ người được giao chấm; kết quả gửi đúng thí sinh/đội |
| NOTI-01 | Thông báo/nhắc lịch | Đăng ký, thay đổi lịch, đến gần hạn đăng ký và giờ diễn ra | Sinh viên nhận đúng nội dung, đúng hoạt động và thời gian; thông báo thay đổi được phát sinh |
| REPORT-01 | Báo cáo | Lọc kỳ/năm/khoa/bộ môn; so sánh đăng ký với điểm danh, DRL, giải thưởng và chi phí | Số liệu khớp dữ liệu gốc, tổng hợp đúng phạm vi và tải được báo cáo cần dùng |
| MOB-01 | Flutter | Đăng nhập, xem hoạt động, đăng ký, mở lịch sử, DRL, seminar/thông báo và quét QR | Màn hình lấy dữ liệu API; trạng thái loading/rỗng/lỗi có thể xử lý; đăng ký/điểm danh cập nhật kết quả |

## Ghi nhận kết quả

Khi chạy checklist, ghi cho từng mã: `Đạt / Không đạt / Chưa kiểm tra`, tài khoản vai trò dùng thử, mã bản ghi thử, ảnh/log lỗi và ngày kiểm tra. Xóa dữ liệu kiểm thử sau khi hoàn tất theo khóa liên kết và chỉ trên database kiểm thử.

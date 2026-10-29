# API Thành viên 3: Mobile, Seminar, quyết toán và báo cáo

Tất cả endpoint dưới đây nằm dưới tiền tố `/api/v1`. Các endpoint cần đăng nhập chấp nhận phiên web bằng cookie `academic_session` hoặc token mobile trong header `Authorization: Bearer <accessToken>`.

## Cổng Mobile

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| `POST` | `/auth/mobile/login` | Đăng nhập, trả `accessToken`, `tokenType`, `expiresAt` và `user`. |
| `GET` | `/mobile/profile` | Thông tin tài khoản, sinh viên, lớp, khoa và tổng điểm đã xác nhận. |
| `GET` | `/mobile/my-activities` | Lịch sử hoạt động đã đăng ký, gồm seminar/cuộc thi nếu có. |
| `GET` | `/mobile/my-training-points` | Tổng điểm và các khoản điểm rèn luyện của sinh viên hiện tại. |
| `GET` | `/notifications/my-reminders` | Hoạt động sắp diễn ra trong 8 ngày và hạn đăng ký trong 24 giờ; trả loại nhắc mốc 24h/2h để ứng dụng hiển thị khi đồng bộ. |
| `GET` | `/notifications/mine` | Hộp thông báo đã lưu, gồm hoạt động mới và thay đổi lịch. Ứng dụng cần đồng bộ endpoint này; chưa tích hợp dịch vụ push nền. |
| `GET` | `/activities` | Danh sách cuộc thi, seminar và hoạt động sắp diễn ra cho trang chủ mobile. |

Token Mobile là token phiên ngẫu nhiên hiện có trong hệ thống; database chỉ lưu hash. Token hết hạn theo `SESSION_TTL_SECONDS` và có thể đăng xuất/thu hồi qua `POST /auth/logout`.

## Seminar

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| `GET` | `/seminars` | Danh sách seminar kèm thời gian, địa điểm và trạng thái hoạt động. |
| `POST` | `/seminars` | Tạo hoạt động học thuật và seminar trong cùng transaction; nhận thêm `dienGia` (hồ sơ diễn giả) và `chuongTrinh` (lịch trình). Gửi thông báo hộp thư cho sinh viên. |
| `GET` | `/seminars/:id` | Chi tiết seminar. |
| `POST` | `/seminars/:id/materials` | Lưu liên kết tài liệu/slides của seminar. |
| `POST` | `/seminars/:id/register` | Sinh viên đăng ký tham gia; áp dụng kiểm tra hạn, sức chứa và đăng ký trùng như API đăng ký hiện có. |

Body tạo seminar gồm `tenHoatDong`, `tgBatDau`, `tgKetThuc`, `chuDe`; có thể truyền thêm `moTa`, `hanDangKy`, `diaDiem`, `slToiDa`, `noiDung`, `doiTuongTG`, `thoiLuong`, `dvChuTri`, `dvPhoiHop`. Seminar mới được công bố ngay sau khi tạo.

## Kế hoạch, cuộc thi, điểm danh và DRL

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| `GET` / `POST` | `/plans` | Liệt kê hoặc tạo kế hoạch năm học. `GET /plans/:id` trả kế hoạch kèm các hoạt động chi tiết. |
| `POST` | `/plans/:id/activities` | Thêm hoạt động, đối tượng, chỉ tiêu, thời gian, người phụ trách và dự toán vào kế hoạch. |
| `POST` | `/plans/:id/submit` | Trình kế hoạch; `PATCH /plans/:id/review` ghi nhận duyệt, yêu cầu bổ sung hoặc từ chối. Chuỗi duyệt cấu hình theo vai trò cán bộ khoa → Phòng KHCN → Hiệu trưởng. |
| `POST` | `/plans/details/:detailId/publish` | Tạo hoạt động đã công bố từ hạng mục thuộc kế hoạch đã duyệt và gửi thông báo hộp thư cho sinh viên. |
| `GET` / `POST` | `/competition-rounds/:competitionId`, `/competition-rounds` | Xem hoặc tạo vòng thi và hạn nộp. |
| `POST` / `GET` | `/competition-rounds/:id/submissions` | Sinh viên nộp bài; giám khảo/cán bộ xem danh sách bài và điểm trung bình. |
| `PATCH` | `/submissions/:id/score` | Giám khảo ghi/chỉnh điểm 0–100 và nhận xét. |
| `POST` / `GET` | `/competitions/:competitionId/results` | Ghi kết quả nháp cho một cá nhân/đội hoặc xem kết quả đã công bố. |
| `PATCH` | `/competitions/results/:resultId/publish` | Công bố kết quả và thông báo cho cá nhân/đội đạt kết quả. |
| `POST` | `/attendance/activities/:activityId/qr` | Tạo mã QR có hạn dùng; phản hồi gồm mã cần mã hóa thành QR trên giao diện. |
| `POST` | `/attendance/check-in` | Sinh viên đã đăng ký gửi `{ "code": "..." }` để ghi nhận điểm danh. |
| `POST` / `PATCH` | `/training-points`, `/training-points/:id/approve`, `/training-points/:id/reject`, `/training-points/:id/adjust` | Phòng CTSV ghi nhận, duyệt/từ chối hoặc tạo khoản điều chỉnh có liên kết bản ghi gốc. |
| `GET` / `POST` | `/activities/:activityId/waitlist`, `/activities/:activityId/waitlist/promote-next` | Xem danh sách chờ và mời tiếp người đăng ký sớm nhất. Hủy đăng ký sẽ tự động nhận người tiếp theo nếu còn chỗ. |
| `PATCH` | `/activities/:activityId/time-change` | Cập nhật thời gian/địa điểm và lưu thông báo cho người đã đăng ký. |
| `GET` | `/reports/summary`, `/reports/training-points` | Tổng hợp tham dự/chi phí theo hoạt động và điểm DRL theo học kỳ/năm học. Báo cáo từng hoạt động cũng trả danh sách đăng ký để đối chiếu điểm danh. |

Các API quản trị yêu cầu vai trò phù hợp; API duyệt kế hoạch/DRL và cập nhật trạng thái đăng ký đã kiểm tra quyền tại server. Tài liệu/slides được lưu dưới dạng liên kết, chưa phải API tải tệp lên.

## Đăng ký trong ứng dụng Mobile

Ứng dụng dùng các endpoint sau để đăng ký cá nhân hoặc theo đội:

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| `POST` | `/registrations/individual` | Đăng ký hoạt động với `maHD` và `hinhThuc`: `Dự thi`, `Tham gia`, `Hỗ trợ` hoặc `Cổ vũ`. |
| `POST` | `/registrations/team` | Tạo đội cho cuộc thi với `maCThi`, `tenDoi` và danh sách `thanhVienMSSV`. Sinh viên đăng nhập là trưởng đội. |
| `POST` | `/registrations/team/join` | Tham gia đội có sẵn bằng `{ "maDoi": 123 }`. Mã đội được trả về khi tạo đội thành công. |
| `GET` | `/registrations/my-registrations` | Xem lại đăng ký của sinh viên hiện tại. |

## Chi phí, quyết toán và báo cáo

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| `POST` | `/expenses` | Ghi khoản chi và gắn vào hồ sơ quyết toán nháp. Body: `maHD`, `noiDung`, `soTien`, `ngChi`; có thể kèm `chungTu` là danh sách tối đa 20 đường dẫn/mã chứng từ. |
| `GET` | `/settlements/:activityId` | Hồ sơ mới nhất cùng các khoản chi liên kết và tổng tiền. |
| `POST` | `/settlements/:id/submit` | Người lập gửi hồ sơ có chi phí từ nháp sang chờ duyệt. |
| `PATCH` | `/settlements/:id/approve` | Cán bộ khoa duyệt hồ sơ đang chờ duyệt. |
| `GET` | `/reports/activities/:activityId` | Báo cáo đăng ký, danh sách người tham dự để đối chiếu, chi phí và kết quả đã công bố. |

Tạo chi phí và hồ sơ quyết toán liên quan được thực hiện trong transaction. CSDL mới chặn tổng chi vượt `KinhPhiDuTru` khi hoạt động đã có dự toán lớn hơn 0. Ghi chi phí cần vai trò quản trị viên, cán bộ khoa hoặc giảng viên; gửi/duyệt quyết toán là hai bước riêng.

Chạy `npm run db:migrate -w apps/api` để áp dụng migration bổ sung `002_workflow_extensions.sql` sau khi xác nhận API đang trỏ đúng schema SQL Server hiện hành. Migration chỉ bổ sung bảng/cột, không xóa dữ liệu; nếu script SQL thủ công của dự án có schema lệch, lệnh sẽ báo lỗi schema một phần và cần đối chiếu trước khi chạy. Kiểm tra sau đó bằng `npm run db:check -w apps/api`.

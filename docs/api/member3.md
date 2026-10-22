# API Thành viên 3: Mobile, Seminar, quyết toán và báo cáo

Tất cả endpoint dưới đây nằm dưới tiền tố `/api/v1`. Các endpoint cần đăng nhập chấp nhận phiên web bằng cookie `academic_session` hoặc token mobile trong header `Authorization: Bearer <accessToken>`.

## Cổng Mobile

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| `POST` | `/auth/mobile/login` | Đăng nhập, trả `accessToken`, `tokenType`, `expiresAt` và `user`. |
| `GET` | `/mobile/profile` | Thông tin tài khoản, sinh viên, lớp, khoa và tổng điểm đã xác nhận. |
| `GET` | `/mobile/my-activities` | Lịch sử hoạt động đã đăng ký, gồm seminar/cuộc thi nếu có. |
| `GET` | `/mobile/my-training-points` | Tổng điểm và các khoản điểm rèn luyện của sinh viên hiện tại. |
| `GET` | `/notifications/my-reminders` | Hoạt động đã đăng ký sắp diễn ra trong 7 ngày tới. Nhắc lịch được suy ra từ đăng ký và thời gian hoạt động, chưa lưu thành thông báo riêng. |

Token Mobile là token phiên ngẫu nhiên hiện có trong hệ thống; database chỉ lưu hash. Token hết hạn theo `SESSION_TTL_SECONDS` và có thể đăng xuất/thu hồi qua `POST /auth/logout`.

## Seminar

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| `GET` | `/seminars` | Danh sách seminar kèm thời gian, địa điểm và trạng thái hoạt động. |
| `POST` | `/seminars` | Tạo hoạt động học thuật và bản ghi seminar trong cùng transaction. Cần vai trò quản trị viên, cán bộ khoa hoặc giảng viên. |
| `GET` | `/seminars/:id` | Chi tiết seminar. |
| `POST` | `/seminars/:id/register` | Sinh viên đăng ký tham gia; áp dụng kiểm tra hạn, sức chứa và đăng ký trùng như API đăng ký hiện có. |

Body tạo seminar gồm `tenHoatDong`, `tgBatDau`, `tgKetThuc`, `chuDe`; có thể truyền thêm `moTa`, `hanDangKy`, `diaDiem`, `slToiDa`, `noiDung`, `doiTuongTG`, `thoiLuong`, `dvChuTri`, `dvPhoiHop`. Seminar mới được công bố ngay sau khi tạo.

## Chi phí, quyết toán và báo cáo

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| `POST` | `/expenses` | Ghi khoản chi và gắn vào hồ sơ quyết toán nháp. Body: `maHD`, `noiDung`, `soTien`, `ngChi`; có thể kèm `chungTu` là danh sách tối đa 20 đường dẫn/mã chứng từ. |
| `GET` | `/settlements/:activityId` | Hồ sơ mới nhất cùng các khoản chi liên kết và tổng tiền. |
| `PATCH` | `/settlements/:id/approve` | Duyệt hồ sơ nháp/chờ duyệt; chỉ quản trị viên hoặc cán bộ khoa. |
| `GET` | `/reports/activities/:activityId` | Báo cáo số lượt đăng ký, điểm danh, chi phí và kết quả đã công bố của hoạt động. |

Tạo chi phí và hồ sơ quyết toán liên quan được thực hiện trong transaction. Ghi chi phí cần vai trò quản trị viên, cán bộ khoa hoặc giảng viên; xem quyết toán/báo cáo cần quyền nhân sự tương ứng. API chưa cung cấp luồng gửi hồ sơ sang trạng thái `Chờ duyệt`; hiện cán bộ khoa có thể duyệt hồ sơ ở trạng thái `Dự thảo` hoặc `Chờ duyệt`.

Các endpoint trên dùng bảng `SEMINAR`, `HOATDONGHOCTHUAT`, `DKTHAMGIA`, `DIEMDANH`, `DIEMRENLUYEN`, `HOSOQUYETTOAN`, `CHIPHITHUCTE` và các bảng kết quả trong schema SQL Server hiện hành. Không cần migration bổ sung.

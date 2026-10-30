# Hướng dẫn kiểm thử thủ công hệ thống

Tài liệu này dùng để bạn tự kiểm tra từng phân hệ trên giao diện web hoặc Swagger. Thực hiện lần lượt theo thứ tự; ghi lại kết quả trước khi chuyển sang nhóm kế tiếp.

> **Dùng database kiểm thử và tài khoản kiểm thử.** Các bước tạo, duyệt, đăng ký, ghi chi phí và điểm danh sẽ thêm dữ liệu vào SQL Server. Đặt tiền tố `TEST-2026-` vào tên dữ liệu thử để dễ nhận biết. Không dùng tài khoản hoặc hồ sơ sinh viên thật để kiểm tra thao tác ghi/xóa.

## 1. Khởi động hệ thống

Mở PowerShell tại thư mục gốc dự án. Kiểm tra SQL Server đang chạy và cấu hình kết nối trong `apps/api/.env`.

```powershell
npm run db:check
```

Nếu kiểm tra kết nối thành công, mở hai cửa sổ PowerShell tại thư mục gốc:

**Cửa sổ 1 – API:**

```powershell
npm run dev:api
```

**Cửa sổ 2 – Web:**

```powershell
npm run dev:web
```

**Tuỳ chọn – ứng dụng Mobile Expo:** mở cửa sổ PowerShell thứ ba:

```powershell
npm run dev:mobile
```

Quét mã QR Expo bằng Expo Go hoặc chạy trên Android Emulator. Mobile và API phải cùng truy cập được; trên Android Emulator, địa chỉ máy chủ thường không dùng `localhost` của điện thoại/emulator. Dùng địa chỉ API đã cấu hình trong ứng dụng.

Mở các địa chỉ:

- Web: `http://localhost:3000`
- Swagger: `http://localhost:3001/docs` (nếu `PORT` trong `.env` khác 3001 thì thay bằng cổng đó)
- API health: `http://localhost:3001/api/v1/health`

Không chạy `db:migrate`, `db:seed`, hoặc lệnh xóa/reset dữ liệu nếu chưa xác nhận đang trỏ đúng database kiểm thử.

## 2. Cách ghi kết quả

Với mỗi mã kiểm thử, ghi `Đạt`, `Không đạt` hoặc `Chưa kiểm tra`, kèm tài khoản theo vai trò, mã bản ghi mới và ảnh chụp lỗi nếu có. Khi kiểm tra bằng Swagger, mở nhóm API tương ứng, chọn **Try it out**, điền dữ liệu, chọn **Execute**, rồi xem HTTP status và response.

Đăng nhập Swagger bằng `POST /api/v1/auth/login`; dùng tài khoản thử của bạn. Các API bảo vệ yêu cầu phiên đăng nhập. Nếu kiểm thử ứng dụng Mobile, dùng `POST /api/v1/auth/mobile/login`; lấy `accessToken` từ response và chọn **Authorize** để nhập Bearer token.

Mẫu đăng nhập (thay giá trị trong dấu `<...>`):

```json
{
  "username": "<tai_khoan_test>",
  "password": "<mat_khau_test>"
}
```

Không ghi mật khẩu thật vào tài liệu kết quả. Các mã `maHD`, `maTK`, `maSV`, `maCThi`, `maDK`, `maLop`, `maKhoa`, `maBM` phải lấy từ response hoặc danh sách API của chính database đang kiểm thử; đừng dùng số ví dụ nếu không có bản ghi tương ứng.

## 3. Kiểm tra sẵn sàng và đăng nhập

| Mã | Thao tác | Kết quả mong đợi | Kết quả của bạn |
|---|---|---|---|
| SYS-01 | Mở `/api/v1/health` | API phản hồi thành công; không báo lỗi kết nối SQL Server | ☐ Đạt ☐ Không đạt |
| AUTH-01 | Đăng nhập web với tài khoản đang hoạt động | Vào đúng trang theo vai trò; không hiện lỗi xác thực | ☐ Đạt ☐ Không đạt |
| AUTH-02 | Đăng nhập sai mật khẩu | Bị từ chối; không tạo phiên | ☐ Đạt ☐ Không đạt |
| AUTH-03 | Đăng nhập tài khoản đã ngừng hoạt động | Bị từ chối | ☐ Đạt ☐ Không đạt |
| AUTH-04 | Đăng xuất rồi gọi `/api/v1/auth/me` | Phiên cũ không còn được chấp nhận | ☐ Đạt ☐ Không đạt |

## 4. Vai trò và quản lý tài khoản

Dùng một tài khoản thử cho từng vai trò có trong hệ thống: quản trị, cán bộ khoa, Trưởng khoa, Phòng KHCN, Ban giám hiệu, CTSV/giảng viên và sinh viên. Không đổi quyền của tài khoản quản trị chính.

| Mã | Thao tác | Kết quả mong đợi | Kết quả của bạn |
|---|---|---|---|
| ROLE-01 | Đăng nhập từng vai trò, xem menu và trang chủ | Mỗi vai trò chỉ hiện các phân hệ được cấp | ☐ Đạt ☐ Không đạt |
| ROLE-02 | Dùng sinh viên thử gọi API quản trị `/api/v1/admin/accounts` | Bị từ chối với 403 (hoặc phản hồi không đủ quyền tương đương) | ☐ Đạt ☐ Không đạt |
| USER-01 | Mở trang tài khoản, tìm theo tên đăng nhập/MSSV | Tìm đúng tài khoản; thông tin trạng thái và vai trò khớp dữ liệu | ☐ Đạt ☐ Không đạt |
| USER-02 | Tạo tài khoản thử theo biểu mẫu; thử mật khẩu ngắn hơn 12 ký tự | Mật khẩu không đạt yêu cầu bị báo lỗi; dữ liệu hợp lệ tạo tài khoản | ☐ Đạt ☐ Không đạt |
| USER-03 | Đổi mật khẩu tài khoản thử, đăng nhập lại | Mật khẩu mới dùng được; mật khẩu cũ không dùng được | ☐ Đạt ☐ Không đạt |
| USER-04 | Ngừng rồi kích hoạt lại tài khoản thử | Trạng thái và khả năng đăng nhập thay đổi đúng | ☐ Đạt ☐ Không đạt |
| USER-05 | Tạo hồ sơ sinh viên thử rồi liên kết với tài khoản thử | MSSV duy nhất, hồ sơ và tài khoản liên kết chính xác; Mobile nhận đúng hồ sơ | ☐ Đạt ☐ Không đạt |
| USER-06 | Kiểm tra nút xóa trên tài khoản thử | Chỉ xóa tài khoản thử; thao tác được xác nhận và không ảnh hưởng hồ sơ khác | ☐ Đạt ☐ Không đạt |

## 5. Lớp, cán bộ và kế hoạch năm học

Lấy mã khoa/bộ môn hiện có trước khi tạo dữ liệu. Thực hiện bằng tài khoản có quyền quản lý tương ứng.

| Mã | Thao tác | Kết quả mong đợi | Kết quả của bạn |
|---|---|---|---|
| CLASS-01 | Tạo lớp có tên `TEST-2026-...`, gắn khoa hợp lệ; mở danh sách lớp | Lớp xuất hiện đúng khoa | ☐ Đạt ☐ Không đạt |
| CLASS-02 | Sửa tên lớp thử; thử xóa lớp thử không còn hồ sơ liên quan | Thay đổi hiển thị; xóa không phá dữ liệu liên kết | ☐ Đạt ☐ Không đạt |
| STAFF-01 | Tạo/sửa hồ sơ cán bộ thử, gán bộ môn | Hồ sơ hiển thị đúng và liên kết bộ môn hợp lệ | ☐ Đạt ☐ Không đạt |
| PLAN-01 | Tạo kế hoạch năm học và thêm ít nhất hai hoạt động/dự toán | Kế hoạch lưu ở trạng thái dự thảo; số liệu chi tiết đúng | ☐ Đạt ☐ Không đạt |
| PLAN-02 | Gửi kế hoạch duyệt; lần lượt đăng nhập vai trò Trưởng khoa, KHCN, Ban giám hiệu để ký/duyệt bước của họ | Chỉ vai trò đúng thực hiện được bước hiện tại; trạng thái và lịch sử duyệt tiến đúng thứ tự nghiệp vụ | ☐ Đạt ☐ Không đạt |
| PLAN-03 | Thử gửi lại kế hoạch chưa đủ thông tin hoặc dùng vai trò sai để duyệt | Thao tác bị chặn và có thông báo dễ hiểu | ☐ Đạt ☐ Không đạt |

Mẫu tạo kế hoạch để tham khảo tại `POST /api/v1/plans` (thay `maKhoa` bằng mã có thật):

```json
{
  "tenKeHoach": "TEST-2026-Kế hoạch hoạt động học thuật",
  "namHoc": "2026-2027",
  "hocKy": "HK1",
  "maKhoa": 1,
  "loaiKeHoach": "KHOA",
  "mucDich": "Dữ liệu phục vụ kiểm thử",
  "noiDung": "Không dùng cho hoạt động thật"
}
```

Thêm hoạt động cho kế hoạch vừa tạo qua `POST /api/v1/plans/{maKeHoach}/activities`:

```json
{
  "tenHoatDong": "TEST-2026-Seminar kỹ năng nghiên cứu",
  "noiDung": "Kiểm tra luồng kế hoạch và dự toán",
  "thoiGianDuKien": "2027-01-15T08:00:00.000Z",
  "thoiGianKetThuc": "2027-01-15T11:00:00.000Z",
  "diaDiem": "Phòng kiểm thử",
  "doiTuong": "Sinh viên thử nghiệm",
  "chiTieu": 20,
  "nguoiPhuTrach": "Cán bộ kiểm thử",
  "duToan": 1000000
}
```

Gửi duyệt bằng `POST /api/v1/plans/{maKeHoach}/submit`. Mỗi người duyệt gọi `PATCH /api/v1/plans/{maKeHoach}/review` với:

```json
{
  "action": "approve",
  "ghiChu": "TEST-2026-Duyệt thử"
}
```

Đăng nhập đúng vai trò cho từng bước. Có thể thay `approve` bằng `request_changes` hoặc `reject` để kiểm tra yêu cầu chỉnh sửa/từ chối; nên làm trên một kế hoạch thử riêng.

## 6. Hoạt động, ban tổ chức và kinh phí

| Mã | Thao tác | Kết quả mong đợi | Kết quả của bạn |
|---|---|---|---|
| ACT-01 | Tạo hoạt động học thuật với tên tiền tố `TEST-2026-`; mở lại chi tiết | Nội dung, loại, ngày giờ, địa điểm, đối tượng và chỉ tiêu được lưu đúng | ☐ Đạt ☐ Không đạt |
| ACT-02 | Thêm người vào ban chỉ đạo, ban tổ chức, ban hỗ trợ; sau đó sửa/xóa dữ liệu thử | Người và vai trò gắn đúng hoạt động; cập nhật phản ánh đúng | ☐ Đạt ☐ Không đạt |
| ACT-03 | Gửi hoạt động duyệt rồi thử duyệt bằng tài khoản đúng/sai vai trò | Trạng thái theo đúng quy trình; sinh viên chỉ thấy hoạt động đủ điều kiện mở đăng ký | ☐ Đạt ☐ Không đạt |
| BUD-01 | Thêm nhiều khoản dự trù cho một hoạt động, kiểm tra tổng, gửi khoa duyệt | Mỗi khoản gắn với đúng hoạt động; tổng bằng tổng các khoản; trạng thái duyệt cập nhật đúng | ☐ Đạt ☐ Không đạt |
| BUD-02 | Tải file dự trù sau khi có dữ liệu thử | Nút tải hoạt động; file mở được và số liệu khớp các khoản đã lưu | ☐ Đạt ☐ Không đạt |
| BUD-03 | Tạo khoản dự trù sai số tiền hoặc duyệt bằng vai trò không có quyền | Dữ liệu không hợp lệ bị chặn; người không có quyền không duyệt được | ☐ Đạt ☐ Không đạt |

Mẫu khoản dự trù tại `POST /api/v1/academic-activities/{maHD}/budget`:

```json
{
  "noiDung": "TEST-2026-Nước uống cho người tham dự",
  "soLuong": 20,
  "donViTinh": "suất",
  "donGia": 15000,
  "soTien": 300000,
  "thuyetMinh": "Khoản thử nghiệm",
  "nguonKinhPhi": "Kinh phí khoa"
}
```

## 6.1. Tạo hoạt động học thuật để dùng cho đăng ký/điểm danh

Nếu chưa có hoạt động thử, tạo bằng tài khoản có quyền tại `POST /api/v1/academic-activities`. Mã bộ môn có thể lấy từ danh sách bộ môn trong giao diện hoặc dữ liệu có sẵn.

```json
{
  "namHoc": "2026-2027",
  "hocKy": "HK2",
  "maBM": 1,
  "tenHoatDong": "TEST-2026-Hoạt động kiểm thử",
  "loaiHoatDong": "Seminar",
  "noiDung": "Hoạt động tạo riêng để kiểm thử đăng ký, điểm danh và quyết toán",
  "tgDuKien": "2027-02-10T08:00:00.000Z",
  "tgBatDau": "2027-02-10T08:00:00.000Z",
  "tgKetThuc": "2027-02-10T11:00:00.000Z",
  "diaDiem": "Hội trường kiểm thử",
  "tienDoTH": "Dự kiến",
  "doiTuongThamDu": "Sinh viên kiểm thử",
  "slsvDuKien": 30
}
```

Sau đó thử `PATCH /api/v1/academic-activities/{maHD}/submit` và thao tác duyệt bằng tài khoản có quyền qua `PATCH /api/v1/academic-activities/{maHD}/approve`. Lưu ý: nếu dữ liệu được tạo từ kế hoạch, hãy ưu tiên kiểm tra luồng duyệt kế hoạch trước rồi mới kiểm tra hoạt động được sinh từ kế hoạch.

## 7. Seminar và đăng ký

Mẫu tạo seminar tại `POST /api/v1/seminars`. Ngày bên dưới là ngày tương lai; có thể đổi sang thời gian tương lai khác.

```json
{
  "tenHoatDong": "TEST-2026-Seminar ứng dụng công nghệ",
  "moTa": "Seminar chỉ dùng để kiểm thử",
  "tgBatDau": "2027-02-10T08:00:00.000Z",
  "tgKetThuc": "2027-02-10T11:00:00.000Z",
  "hanDangKy": "2027-02-08T23:59:00.000Z",
  "diaDiem": "Hội trường kiểm thử",
  "slToiDa": 30,
  "chuDe": "Ứng dụng công nghệ trong học thuật",
  "noiDung": "Nội dung mô tả thử nghiệm",
  "doiTuongTG": "Sinh viên",
  "thoiLuong": 180,
  "dvChuTri": "Khoa thử nghiệm",
  "dvPhoiHop": "Bộ môn thử nghiệm",
  "dienGia": [
    {
      "hoTen": "Diễn giả kiểm thử",
      "hocVi": "Thạc sĩ",
      "donVi": "Khoa thử nghiệm",
      "tieuSu": "Thông tin thử nghiệm",
      "chuDeTrinhBay": "Chủ đề trình bày"
    }
  ],
  "chuongTrinh": [
    {
      "thoiGian": "08:00-08:15",
      "noiDung": "Khai mạc",
      "phuTrach": "Ban tổ chức"
    },
    {
      "thoiGian": "08:15-10:30",
      "noiDung": "Trình bày và thảo luận",
      "phuTrach": "Diễn giả kiểm thử"
    }
  ]
}
```

| Mã | Thao tác | Kết quả mong đợi | Kết quả của bạn |
|---|---|---|---|
| SEM-01 | Tạo seminar mẫu; mở `GET /api/v1/seminars/{maSeminar}` | Chủ đề, nội dung, diễn giả và chương trình hiển thị đầy đủ sau khi tải lại | ☐ Đạt ☐ Không đạt |
| SEM-02 | Thử tạo seminar thiếu chủ đề hoặc có ngày kết thúc trước ngày bắt đầu | API báo lỗi kiểm tra dữ liệu; không tạo bản ghi lỗi | ☐ Đạt ☐ Không đạt |
| SEM-03 | Đăng nhập bằng sinh viên đã liên kết hồ sơ, đăng ký seminar; xem lịch sử | Đăng ký xuất hiện một lần trong danh sách của sinh viên | ☐ Đạt ☐ Không đạt |
| SEM-04 | Thử đăng ký lần hai hoặc khi hết hạn/đã đủ chỗ | Không tạo đăng ký trùng; thông báo trạng thái phù hợp | ☐ Đạt ☐ Không đạt |
| REG-01 | Đăng ký cá nhân tại `POST /api/v1/registrations/individual` với mã hoạt động hợp lệ | Trả thành công; đơn xuất hiện ở `/registrations/my-registrations` | ☐ Đạt ☐ Không đạt |
| REG-02 | Gửi lại cùng đơn đăng ký | Bị chặn đăng ký trùng | ☐ Đạt ☐ Không đạt |
| REG-03 | Đăng ký đội tại `/api/v1/registrations/team` với cuộc thi và MSSV thử hợp lệ | Tạo đội và liên kết đúng trưởng đội/thành viên | ☐ Đạt ☐ Không đạt |
| REG-04 | Thử thêm MSSV không tồn tại hoặc đã thuộc đội khác | Bị chặn và nêu được nguyên nhân | ☐ Đạt ☐ Không đạt |
| REG-05 | Cán bộ mở danh sách `/registrations/manage/{maHD}` và cập nhật trạng thái đơn | Chỉ người có quyền thay đổi được trạng thái; danh sách phản ánh trạng thái mới | ☐ Đạt ☐ Không đạt |

Ví dụ đăng ký cá nhân:

```json
{
  "maHD": 123,
  "hinhThuc": "Tham gia"
}
```

Ví dụ tạo đội (MSSV thành viên không gồm MSSV trưởng đội):

```json
{
  "maCThi": 123,
  "tenDoi": "TEST-2026-Đội Một",
  "thanhVienMSSV": ["<MSSV_thanh_vien_1>", "<MSSV_thanh_vien_2>"]
}
```

## 8. Cuộc thi, nộp bài và kết quả

| Mã | Thao tác | Kết quả mong đợi | Kết quả của bạn |
|---|---|---|---|
| COMP-01 | Tạo vòng thi cho cuộc thi thử tại `POST /api/v1/competition-rounds` | Vòng thi đúng cuộc thi, thứ tự và hạn nộp | ☐ Đạt ☐ Không đạt |
| COMP-02 | Thí sinh nộp bài qua `/competition-rounds/{maVong}/submissions` | Bài nộp được liên kết đúng đăng ký/vòng thi | ☐ Đạt ☐ Không đạt |
| COMP-03 | Người chấm cập nhật điểm 0–100 và nhận xét | Điểm hiển thị đúng; điểm ngoài khoảng bị từ chối | ☐ Đạt ☐ Không đạt |
| COMP-04 | Tạo kết quả, công bố kết quả; xem bằng tài khoản sinh viên | Kết quả công khai đúng thí sinh/đội và thứ hạng | ☐ Đạt ☐ Không đạt |

## 9. Điểm danh và điểm rèn luyện

| Mã | Thao tác | Kết quả mong đợi | Kết quả của bạn |
|---|---|---|---|
| ATT-01 | Tạo QR cho hoạt động đã duyệt với hạn dùng trong tương lai | Trả mã/QR sử dụng được và đúng hoạt động | ☐ Đạt ☐ Không đạt |
| ATT-02 | Sinh viên đã đăng ký quét QR; kiểm tra lịch sử điểm danh | Ghi nhận đúng sinh viên, thời gian và hoạt động | ☐ Đạt ☐ Không đạt |
| ATT-03 | Quét lại, dùng QR hết hạn hoặc chưa đăng ký hoạt động | Không ghi nhận lần trùng/không hợp lệ; trả thông báo phù hợp | ☐ Đạt ☐ Không đạt |
| ATT-04 | Cán bộ ghi nhận thủ công bằng mã đơn đăng ký | Ghi nhận đúng đơn; có thể phân biệt nguồn thủ công với QR | ☐ Đạt ☐ Không đạt |
| DRL-01 | Ghi nhận điểm rèn luyện cho sinh viên thử, sau đó CTSV duyệt | Điểm ở trạng thái chờ trước duyệt; chỉ cộng tổng sau duyệt | ☐ Đạt ☐ Không đạt |
| DRL-02 | Thử từ chối hoặc điều chỉnh một bản ghi điểm thử | Trạng thái/điểm mới và lý do được lưu trong lịch sử | ☐ Đạt ☐ Không đạt |
| DRL-03 | Sinh viên xem điểm rèn luyện trên Web/Mobile | Tổng và chi tiết khớp các bản ghi đã được duyệt | ☐ Đạt ☐ Không đạt |

Tạo QR qua `POST /api/v1/attendance/activities/{maHD}/qr`:

```json
{
  "expiresAt": "2027-02-10T11:30:00.000Z"
}
```

Ghi nhận điểm thử qua `POST /api/v1/training-points` (thay `maSV` và `maHD` bằng mã thật):

```json
{
  "maSV": 1001,
  "maHD": 123,
  "hocKy": "HK2",
  "namHoc": "2026-2027",
  "diem": 5,
  "lyDo": "TEST-2026-Tham gia hoạt động thử"
}
```

## 10. Chi phí thực tế và quyết toán

| Mã | Thao tác | Kết quả mong đợi | Kết quả của bạn |
|---|---|---|---|
| SET-01 | Ghi ít nhất hai khoản chi thật giả định cho hoạt động thử bằng `POST /api/v1/expenses` | Khoản chi gắn đúng hoạt động; hồ sơ quyết toán nháp được tạo/cập nhật | ☐ Đạt ☐ Không đạt |
| SET-02 | Mở `GET /api/v1/settlements/{maHD}` | Hồ sơ tổng hợp đủ hóa đơn/chi phí, tổng tiền và mã hoạt động | ☐ Đạt ☐ Không đạt |
| SET-03 | Người lập gửi hồ sơ bằng `POST /settlements/{maHoSo}/submit`; khoa duyệt bằng `PATCH /settlements/{maHoSo}/approve` | Chỉ đúng vai trò gửi/duyệt; trạng thái chuyển đúng | ☐ Đạt ☐ Không đạt |
| SET-04 | Thử gửi lại hoặc duyệt hồ sơ đã duyệt bằng vai trò sai | Thao tác không hợp lệ bị chặn | ☐ Đạt ☐ Không đạt |

Mẫu ghi chi phí tại `POST /api/v1/expenses`:

```json
{
  "maHD": 123,
  "noiDung": "TEST-2026-In tài liệu seminar",
  "soTien": 250000,
  "ngChi": "2027-02-10T09:00:00.000Z",
  "chungTu": ["TEST-2026-hoa-don-01"]
}
```

## 11. Thông báo, báo cáo và Mobile

| Mã | Thao tác | Kết quả mong đợi | Kết quả của bạn |
|---|---|---|---|
| NOTI-01 | Sinh viên mở `/api/v1/notifications/mine` và `/notifications/my-reminders` | Chỉ thấy thông báo của mình; nhắc lịch đúng hoạt động đã đăng ký | ☐ Đạt ☐ Không đạt |
| NOTI-02 | Cán bộ đổi lịch hoạt động thử | Thời gian/địa điểm cập nhật; thông báo đổi lịch được ghi nhận cho đối tượng liên quan | ☐ Đạt ☐ Không đạt |
| REPORT-01 | Mở báo cáo tổng quan và báo cáo điểm rèn luyện theo kỳ/năm | Kết quả có dữ liệu và bộ lọc đúng kỳ/năm | ☐ Đạt ☐ Không đạt |
| REPORT-02 | Xem `/api/v1/reports/activities/{maHD}` | Số đăng ký, điểm danh, chi phí và kết quả khớp hoạt động thử | ☐ Đạt ☐ Không đạt |
| MOB-01 | Đăng nhập Mobile; mở hồ sơ, hoạt động của tôi, điểm rèn luyện | Hiển thị đúng hồ sơ tài khoản sinh viên, dữ liệu API và trạng thái rỗng/lỗi rõ ràng | ☐ Đạt ☐ Không đạt |
| MOB-02 | Trong Mobile, đăng ký hoạt động và quét QR còn hạn | Kết quả phản hồi rõ; tải lại màn hình vẫn thấy trạng thái cập nhật | ☐ Đạt ☐ Không đạt |

Các API Mobile chính:

- `POST /api/v1/auth/mobile/login`
- `GET /api/v1/mobile/profile`
- `GET /api/v1/mobile/my-activities`
- `GET /api/v1/mobile/my-training-points`
- `GET /api/v1/notifications/my-reminders`
- `GET /api/v1/activities`

## 12. Ghi log khi gặp lỗi

Nếu một bước không đạt, ghi lại: mã kiểm thử, vai trò đăng nhập (không ghi mật khẩu), thao tác vừa làm, URL API, mã HTTP, nội dung lỗi đầy đủ, mã bản ghi thử và thời điểm xảy ra. Nếu gặp `500 Internal Server Error`, lưu cả log tương ứng ở cửa sổ chạy API; chỉ ảnh giao diện thường chưa đủ để xác định lỗi.

| Mã kiểm thử | Đạt / Không đạt / Chưa kiểm tra | Vai trò | Mã dữ liệu thử | Ghi chú / vị trí ảnh lỗi |
|---|---|---|---|---|
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |


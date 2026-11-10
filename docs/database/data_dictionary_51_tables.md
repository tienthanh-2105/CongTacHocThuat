# Từ điển dữ liệu — 51 bảng được chọn

Nguồn: metadata đọc trực tiếp từ database `QL_CongTacHocThuat` trên `LAPTOP-E5S8NVIT\SQLEXPRESS`. Phạm vi gồm 39 bảng gốc (không kể `QUANTRIVIEN`) và 12 bảng bổ sung người dùng nêu.

## Quy ước

- `PK`: khóa chính; `FK → bảng.cột`: khóa ngoại được khai báo trong database; `UQ`: thuộc chỉ mục duy nhất. `identity` là tự tăng.
- Cột “Được NULL” cho biết cột có cho phép nhận giá trị NULL hay không. Mô tả diễn giải theo vai trò nghiệp vụ của trường.
- Phân loại chính/phụ theo mức độ trung tâm trong luồng nghiệp vụ. Các bảng danh mục, liên kết và chức năng chi tiết được xếp phụ.

## Phân loại bảng

### Người dùng và tài khoản

**Bảng chính:** `NGUOIDUNG`, `TAIKHOAN`.

### Kế hoạch và hoạt động

**Bảng chính:** `KEHOACHHOCTHUAT`, `HOATDONGHOCTHUAT`, `SEMINAR`.

### Cuộc thi

**Bảng chính:** `CUOCTHI`.

### Kinh phí

**Bảng chính:** `DUTRUKINHPHI`, `KINHPHIHOATDONG`, `KINHPHITHUCTE`.

### Bảng phụ — tổng hợp theo nhóm (42 bảng)

| Nhóm bảng phụ | Các bảng | Mục đích chung |
|---|---|---|
| Danh mục đơn vị và phân quyền | KHOA, BOMON, LOP, VAITRO, PHANQUYEN, VAITRO_QUYEN | Quản lý cơ cấu khoa/bộ môn/lớp và vai trò, quyền truy cập. |
| Hồ sơ sinh viên, giảng viên và cán bộ | SINHVIEN, GIANGVIEN, CANBOKHOA, GIANGVIEN_BOMON | Bổ sung hồ sơ chuyên biệt và liên kết người với lớp, bộ môn, khoa. |
| Tổ chức và phân công hoạt động | BANCHIDAO, BANTOCHUC, BANHOTRO, BANCUOCTHI, PHANCONGTHUCHIEN, PHANCONGCOVU, TOCHUCCUOCTHI | Quản lý các ban, lịch trình và nhiệm vụ tổ chức hoạt động/cuộc thi. |
| Nội dung seminar | CHUDE | Lưu các chủ đề, diễn giả và nội dung báo cáo trong seminar. |
| Quy trình và kết quả cuộc thi | TIEUBAN, BANGIAMKHAO, GIAMKHAO_TIEUBAN, DETAI, DOITHI, THANHVIENDOI, GIAITHUONG, KETQUAHOCTHUAT, VONGTHI, BAITHI, CHAMDIEMVONG | Quản lý tiểu ban, giám khảo, đội/đề tài, bài thi, điểm và kết quả. |
| Đăng ký, điểm danh và rèn luyện | DKTHAMGIA, MAQR, DIEMDANH, DIEMRENLUYEN | Theo dõi đăng ký tham gia, điểm danh QR và điểm rèn luyện. |
| Hồ sơ và báo cáo quyết toán | HOSOQUYETTOAN, BAOCAOQUYETTOAN | Theo dõi hồ sơ phê duyệt và báo cáo tổng hợp quyết toán. |
| Kế hoạch, đề xuất và thông tin hệ thống | CHITIETKEHOACH, KEHOACHCUOCTHIBOMON, KEHOACHTOCHUC, PHANCONGDEXUATBOMON, THONGBAO, TINTUCHOCTHUAT, PHIENDANGNHAP | Bổ sung chi tiết kế hoạch, giao xử lý đề xuất, thông báo, tin tức và phiên đăng nhập. |

Trong bảng tóm tắt này, PK/FK của từng bảng không liệt kê riêng để giữ bảng gọn; có thể tra cứu trong metadata database hoặc danh sách khóa chi tiết.

## Người dùng và tài khoản — mô tả bảng chính

### dbo.NGUOIDUNG

| Tên trường | Kiểu dữ liệu | Khóa | Được NULL | Mô tả |
|---|---|---|---|---|
| MaNgDung | int | PK (identity) | Không | Mã định danh hồ sơ người dùng. |
| HoTen | nvarchar(100) | — | Không | Họ và tên người dùng. |
| Email | varchar(150) | UQ | Có | Địa chỉ email. |
| SDT | varchar(11) | — | Có | Số điện thoại. |
| NgaySinh | date | — | Có | Ngày sinh. |
| GioiTinh | nvarchar(5) | — | Có | Giới tính. |
| TrangThai | nvarchar(30) | — | Không | Trạng thái hiện tại. |

### dbo.TAIKHOAN

| Tên trường | Kiểu dữ liệu | Khóa | Được NULL | Mô tả |
|---|---|---|---|---|
| MaTK | int | PK (identity) | Không | Mã định danh tài khoản. |
| MaNgDung | int | FK → NGUOIDUNG.MaNgDung | Có | Mã định danh hồ sơ người dùng. |
| MaVaiTro | int | FK → VAITRO.MaVaiTro | Không | Mã vai trò gán cho tài khoản. |
| TenDangNhap | varchar(100) | UQ | Không | Tên đăng nhập. |
| MatKhau | varchar(255) | — | Không | Giá trị băm mật khẩu; không lưu mật khẩu dạng rõ. |
| PBMatKhau | int | — | Không | Phiên bản mật khẩu phục vụ quản lý phiên đăng nhập. |
| TrangThai | nvarchar(30) | — | Không | Trạng thái hiện tại. |

## Kế hoạch và hoạt động — mô tả bảng chính

### dbo.KEHOACHHOCTHUAT

| Tên trường | Kiểu dữ liệu | Khóa | Được NULL | Mô tả |
|---|---|---|---|---|
| MaKeHoach | int | PK (identity) | Không | Mã kế hoạch học thuật. |
| MaKhoa | int | FK → KHOA.MaKhoa | Không | Mã khoa lập kế hoạch. |
| SoKeHoach | nvarchar(50) | — | Không | Số hiệu kế hoạch. |
| TenKeHoach | nvarchar(200) | — | Không | Tên kế hoạch. |
| NgayBanHanh | date | — | Có | Ngày ban hành kế hoạch. |
| NamHoc | varchar(20) | — | Có | Năm học áp dụng. |
| CanCu | nvarchar(max) | — | Có | Căn cứ lập kế hoạch/hoạt động. |
| MucDich | nvarchar(max) | — | Có | Mục đích. |
| YeuCau | nvarchar(max) | — | Có | Yêu cầu thực hiện. |
| NoiDung | nvarchar(max) | — | Có | Nội dung mô tả. |
| NgPhuTrach | int | FK → CANBOKHOA.MaCanBo | Có | Mã cán bộ khoa phụ trách. |
| LoaiKeHoach | nvarchar(20) | — | Không | Loại kế hoạch. |
| TrangThai | nvarchar(30) | — | Không | Trạng thái hiện tại. |
| NguoiDuyet | int | FK → TAIKHOAN.MaTK | Có | Mã tài khoản người duyệt. |
| NgayDuyet | datetimeoffset(7) | — | Có | Thời điểm duyệt. |
| LichSuDuyet | nvarchar(max) | — | Không | Lịch sử duyệt dạng JSON. |
| KinhPhiTC | nvarchar(225) | — | Có | Kinh phí tổ chức dự kiến. |

### dbo.HOATDONGHOCTHUAT

| Tên trường | Kiểu dữ liệu | Khóa | Được NULL | Mô tả |
|---|---|---|---|---|
| MaHD | int | PK (identity) | Không | Mã định danh hoạt động. |
| TenHoatDong | nvarchar(250) | — | Không | Tên hoạt động. |
| LoaiHoatDong | nvarchar(50) | — | Không | Loại hoạt động. |
| NoiDung | nvarchar(max) | — | Có | Nội dung mô tả. |
| TgDuKien | nvarchar(225) | — | Có | Thời gian dự kiến (đang lưu chuỗi). |
| DiaDiem | nvarchar(255) | — | Có | Địa điểm tổ chức. |
| TienDoTH | nvarchar(max) | — | Có | Tiến độ thực hiện. |
| DoiTuongThamDu | nvarchar(max) | — | Có | Đối tượng tham dự. |
| SLSVDuKien | nvarchar(225) | — | Có | Số sinh viên dự kiến. |
| TrangThai | nvarchar(30) | — | Không | Trạng thái hiện tại. |
| MaBM | int | FK → BOMON.MaBM | Có | Mã bộ môn phụ trách. |
| NguoiLap | int | FK → TAIKHOAN.MaTK | Có | Mã tài khoản người lập. |
| HocKy | nvarchar(30) | — | Có | Học kỳ. |
| NamHoc | nvarchar(20) | — | Có | Năm học áp dụng. |
| TgBatDau | time(7) | — | Có | Giờ bắt đầu. |
| TgKetThuc | time(7) | — | Có | Giờ kết thúc. |
| MaKeHoachKhoa | int | — | Có | Mã kế hoạch cấp khoa liên kết. |
| MaKeHoach | bigint | — | Có | Mã kế hoạch liên kết. |
| HanDangKy | datetime2(7) | — | Có | Hạn đăng ký. |
| NguoiDuyetDeXuat | bigint | — | Có | Mã người duyệt đề xuất. |
| NgayDuyetDeXuat | datetimeoffset(7) | — | Có | Thời điểm duyệt đề xuất. |
| LichSuDuyetDeXuat | nvarchar(max) | — | Không | Lịch sử duyệt đề xuất dạng JSON. |
| CapTC | nvarchar(50) | — | Có | Cấp tổ chức hoạt động. |
| BanThamGia | nvarchar(max) | — | Có | Danh sách ban tham gia. |
| ThanhPhanTD | nvarchar(max) | — | Có | Thành phần tham dự. |

### dbo.SEMINAR

| Tên trường | Kiểu dữ liệu | Khóa | Được NULL | Mô tả |
|---|---|---|---|---|
| MaSeminar | int | PK (identity) | Không | Mã seminar. |
| SoKeHoach | nvarchar(50) | — | Có | Số hiệu kế hoạch. |
| MaHD | int | FK → HOATDONGHOCTHUAT.MaHD | Không | Mã hoạt động học thuật gốc của seminar. |
| ChuDe | nvarchar(250) | — | Không | Chủ đề seminar. |
| CanCu | nvarchar(max) | — | Có | Căn cứ lập kế hoạch/hoạt động. |
| MucDich | nvarchar(max) | — | Có | Mục đích. |
| YeuCau | nvarchar(max) | — | Có | Yêu cầu thực hiện. |
| ThoiGian | nvarchar(225) | — | Có | Thời gian tổ chức (đang lưu chuỗi). |
| DiaDiem | nvarchar(255) | — | Có | Địa điểm tổ chức. |
| SLSVDuKien | int | — | Có | Số sinh viên dự kiến. |
| DSChiDao | nvarchar(200) | — | Có | Danh sách ban chỉ đạo. |
| DSToChuc | nvarchar(200) | — | Có | Danh sách ban tổ chức. |
| NoiDung | nvarchar(max) | — | Có | Nội dung mô tả. |
| DoiTuongTG | nvarchar(max) | — | Có | Đối tượng tham gia. |
| ThoiLuong | int | — | Có | Thời lượng seminar. |
| DVChuTri | nvarchar(200) | — | Có | Đơn vị chủ trì. |
| ChuongTrinh | nvarchar(max) | — | Không | Chương trình seminar dạng JSON. |
| TaoTuQuanLy | bit | — | Không | Cờ cho biết seminar được tạo từ màn quản lý. |
| DaDangThongBao | bit | — | Không | Cờ đã đăng thông báo. |
| DiemRenLuyenDeXuat | decimal(5,2) | — | Có | Điểm rèn luyện đề xuất. |

## Cuộc thi — mô tả bảng chính

### dbo.CUOCTHI

| Tên trường | Kiểu dữ liệu | Khóa | Được NULL | Mô tả |
|---|---|---|---|---|
| MaCThi | int | PK (identity) | Không | Mã cuộc thi. |
| MaHD | int | FK → HOATDONGHOCTHUAT.MaHD | Không | Mã hoạt động học thuật gốc của cuộc thi. |
| SoKeHoach | nvarchar(50) | — | Có | Số hiệu kế hoạch. |
| TenCuocThi | nvarchar(250) | — | Không | Tên cuộc thi. |
| VongThi | nvarchar(250) | — | Có | Thông tin vòng thi dạng văn bản (legacy). |
| CanCu | nvarchar(max) | — | Có | Căn cứ lập kế hoạch/hoạt động. |
| MucDich | nvarchar(max) | — | Có | Mục đích. |
| YeuCau | nvarchar(max) | — | Có | Yêu cầu thực hiện. |
| ThoiGian | nvarchar(225) | — | Có | Thời gian tổ chức (đang lưu chuỗi). |
| DiaDiem | nvarchar(255) | — | Có | Địa điểm tổ chức. |
| DoiTuongTG | nvarchar(max) | — | Có | Đối tượng tham gia. |
| SLSVDuKien | int | — | Có | Số sinh viên dự kiến. |
| CapToChuc | nvarchar(100) | — | Có | Cấp tổ chức cuộc thi. |
| TheLe | nvarchar(max) | — | Có | Thể lệ cuộc thi. |
| TieuChiCham | nvarchar(max) | — | Có | Tiêu chí chấm điểm. |
| SLSinhVien | int | — | Có | Số lượng sinh viên. |
| HinhThucThi | nvarchar(50) | — | Có | Hình thức thi. |
| DSBanGiamKhao | nvarchar(max) | — | Có | Danh sách ban giám khảo. |
| GiaiThuong | nvarchar(max) | — | Có | Thông tin giải thưởng. |

## Kinh phí — mô tả bảng chính

### dbo.DUTRUKINHPHI

| Tên trường | Kiểu dữ liệu | Khóa | Được NULL | Mô tả |
|---|---|---|---|---|
| MaDuTruKP | int | PK (identity) | Không | Mã dự trù kinh phí. |
| TenTieuDe | nvarchar(250) | — | Không | Tiêu đề bản dự trù. |
| NamHoc | varchar(20) | — | Không | Năm học áp dụng. |
| TongKinhPhi | decimal(18,2) | — | Không | Tổng kinh phí dự trù. |
| NguoiLap | int | FK → TAIKHOAN.MaTK | Không | Mã tài khoản người lập. |
| NgayLap | datetime2(7) | — | Không | Thời điểm lập. |
| NguoiDuyet | int | FK → TAIKHOAN.MaTK | Có | Mã tài khoản người duyệt. |
| NgayDuyet | datetime2(7) | — | Có | Thời điểm duyệt. |
| TrangThai | nvarchar(30) | — | Không | Trạng thái hiện tại. |
| MaHD | int | FK → HOATDONGHOCTHUAT.MaHD | Có | Mã hoạt động học thuật. |
| GhiChuDuyet | nvarchar(500) | — | Có | Ghi chú phê duyệt. |

### dbo.KINHPHIHOATDONG

| Tên trường | Kiểu dữ liệu | Khóa | Được NULL | Mô tả |
|---|---|---|---|---|
| MaKPHD | int | PK (identity) | Không | Mã dòng kinh phí hoạt động. |
| MaDuTruKP | int | FK → DUTRUKINHPHI.MaDuTruKP | Có | Mã dự trù kinh phí. |
| MaHD | int | FK → HOATDONGHOCTHUAT.MaHD | Không | Mã hoạt động được cấp dự toán. |
| NoiDung | nvarchar(max) | — | Không | Nội dung mô tả. |
| SoLuong | decimal(10,2) | — | Có | Số lượng. |
| DonViTinh | nvarchar(50) | — | Có | Đơn vị tính. |
| DonGia | decimal(18,2) | — | Có | Đơn giá. |
| SoTien | decimal(18,2) | — | Không | Số tiền dự toán của dòng. |
| ThuyetMinh | nvarchar(500) | — | Có | Thuyết minh khoản kinh phí. |
| NguonKinhPhi | nvarchar(100) | — | Không | Nguồn kinh phí. |
| GhiChu | nvarchar(500) | — | Có | Ghi chú. |
| TrangThai | nvarchar(30) | — | Không | Trạng thái hiện tại. |
| SLSinhVien | int | — | Có | Số lượng sinh viên. |
| TongTienV1 | decimal(18,2) | — | Có | Tổng tiền phiên đề xuất thứ nhất. |
| TongTienV2 | decimal(18,2) | — | Có | Tổng tiền phiên đề xuất thứ hai. |

### dbo.KINHPHITHUCTE

| Tên trường | Kiểu dữ liệu | Khóa | Được NULL | Mô tả |
|---|---|---|---|---|
| MaChiPhi | int | PK (identity) | Không | Mã khoản chi thực tế. |
| MaKPHD | int | FK → KINHPHIHOATDONG.MaKPHD | Không | Mã dòng kinh phí hoạt động. |
| MaHD | int | FK → HOATDONGHOCTHUAT.MaHD | Không | Mã hoạt động phát sinh khoản chi. |
| NoiDungChi | nvarchar(250) | — | Không | Nội dung khoản chi. |
| SoTienChi | decimal(18,2) | — | Không | Số tiền thực chi. |
| NgayChi | date | — | Không | Ngày chi. |
| NguoiChi | int | FK → TAIKHOAN.MaTK | Không | Mã tài khoản người chi. |
| SoHoaDon | nvarchar(100) | — | Có | Số hóa đơn/chứng từ. |
| DVCungCap | nvarchar(200) | — | Có | Đơn vị cung cấp. |
| GhiChu | nvarchar(max) | — | Có | Ghi chú. |

## Ghi chú đối chiếu

Một số cột có tên mã tham chiếu nhưng metadata hiện không ghi nhận ràng buộc FK (ví dụ các mã vòng/đăng ký trong quy trình bài thi). Tài liệu đánh dấu theo constraint thực tế, không tự suy diễn thành FK. Mô tả là diễn giải nghiệp vụ; database không có extended property cho mô tả cột.

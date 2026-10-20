-- =============================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU: QUẢN LÝ CÔNG TÁC HỌC THUẬT (FIT - HUIT)
-- NỀN TẢNG: MICROSOFT SQL SERVER (T-SQL) - CHUẨN 31 BẢNG & RÀNG BUỘC
-- DÀNH CHO: SQL SERVER MANAGEMENT STUDIO (SSMS) / AZURE DATA STUDIO
-- =============================================================================

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'QL_CongTacHocThuat')
BEGIN
    CREATE DATABASE QL_CongTacHocThuat COLLATE Vietnamese_CI_AS;
END
GO

USE QL_CongTacHocThuat;
GO

-- XÓA RÀNG BUỘC VÀ BẢNG CŨ NẾU ĐÃ TỒN TẠI (ĐỂ CHẠY LẠI TỪ ĐẦU)
-- =============================================================================
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += N'ALTER TABLE ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) 
             + N' DROP CONSTRAINT ' + QUOTENAME(f.name) + N';' + CHAR(13)
FROM sys.foreign_keys f
INNER JOIN sys.tables t ON f.parent_object_id = t.object_id
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id;
EXEC sp_executesql @sql;

SET @sql = N'';
SELECT @sql += N'DROP TABLE ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) + N';' + CHAR(13)
FROM sys.tables t
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id;
EXEC sp_executesql @sql;
GO

-- =============================================================================
-- I. TẠO CÁC BẢNG DANH MỤC CƠ BẢN VÀ NGƯỜI DÙNG
-- =============================================================================

-- 1. KHOA
CREATE TABLE KHOA (
    MaKhoa BIGINT IDENTITY(1,1) PRIMARY KEY,
    TenKhoa NVARCHAR(100) NOT NULL UNIQUE
);
GO

-- 2. BỘ MÔN
CREATE TABLE BOMON (
    MaBM BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaKhoa BIGINT NOT NULL,
    TenBM NVARCHAR(150) NOT NULL,
    CONSTRAINT FK_BOMON_KHOA FOREIGN KEY (MaKhoa) REFERENCES KHOA(MaKhoa) ON UPDATE CASCADE ON DELETE NO ACTION,
    CONSTRAINT UQ_BOMON_KHOA UNIQUE (MaKhoa, TenBM)
);
GO

-- 3. LỚP
CREATE TABLE LOP (
    MaLop BIGINT IDENTITY(1,1) PRIMARY KEY,
    TenLop NVARCHAR(100) NOT NULL,
    KhoaHoc NVARCHAR(50),
    MaKhoa BIGINT NOT NULL,
    CONSTRAINT FK_LOP_KHOA FOREIGN KEY (MaKhoa) REFERENCES KHOA(MaKhoa) ON UPDATE CASCADE ON DELETE NO ACTION,
    CONSTRAINT UQ_LOP_KHOA UNIQUE (TenLop, MaKhoa)
);
GO

-- 4. NGƯỜI DÙNG
CREATE TABLE NGUOIDUNG (
    MaNgDung BIGINT IDENTITY(1,1) PRIMARY KEY,
    HoTen NVARCHAR(150) NOT NULL,
    Email VARCHAR(150) UNIQUE,
    SDT VARCHAR(15),
    NgaySinh DATE,
    GioiTinh NVARCHAR(20),
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Hoạt động',
    CONSTRAINT CK_NGDUNG_TRANGTHAI CHECK (TrangThai IN (N'Hoạt động', N'Khóa', N'Ngừng hoạt động'))
);
GO

-- 5. VAI TRÒ
CREATE TABLE VAITRO (
    MaVaiTro BIGINT IDENTITY(1,1) PRIMARY KEY,
    TenVaiTro NVARCHAR(100) NOT NULL UNIQUE
);
GO

-- 6. TÀI KHOẢN
CREATE TABLE TAIKHOAN (
    MaTK BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaNgDung BIGINT UNIQUE,
    MaVaiTro BIGINT NOT NULL,
    TenDangNhap VARCHAR(100) NOT NULL UNIQUE,
    MatKhau VARCHAR(255) NOT NULL,
    PBMatKhau INT NOT NULL DEFAULT 0,
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Hoạt động',
    CONSTRAINT FK_TAIKHOAN_NGUOIDUNG FOREIGN KEY (MaNgDung) REFERENCES NGUOIDUNG(MaNgDung) ON UPDATE CASCADE ON DELETE NO ACTION,
    CONSTRAINT FK_TAIKHOAN_VAITRO FOREIGN KEY (MaVaiTro) REFERENCES VAITRO(MaVaiTro) ON UPDATE CASCADE ON DELETE NO ACTION,
    CONSTRAINT CK_TAIKHOAN_TRANGTHAI CHECK (TrangThai IN (N'Hoạt động', N'Khóa', N'Ngừng hoạt động'))
);
GO

-- 7. PHÂN QUYỀN
CREATE TABLE PHANQUYEN (
    MaQuyen BIGINT IDENTITY(1,1) PRIMARY KEY,
    TenQuyen NVARCHAR(100) NOT NULL UNIQUE,
    MoTa NVARCHAR(MAX)
);
GO

-- 8. GÁN QUYỀN CHO VAI TRÒ
CREATE TABLE VAITRO_QUYEN (
    MaVT BIGINT NOT NULL,
    MaQuyen BIGINT NOT NULL,
    PRIMARY KEY (MaVT, MaQuyen),
    CONSTRAINT FK_VTQUYEN_VAITRO FOREIGN KEY (MaVT) REFERENCES VAITRO(MaVaiTro) ON DELETE CASCADE,
    CONSTRAINT FK_VTQUYEN_QUYEN FOREIGN KEY (MaQuyen) REFERENCES PHANQUYEN(MaQuyen) ON DELETE CASCADE
);
GO

-- 9. SINH VIÊN
CREATE TABLE SINHVIEN (
    MaSV BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaNgDung BIGINT UNIQUE,
    MaLop BIGINT NOT NULL,
    MSSV VARCHAR(20) UNIQUE,
    CONSTRAINT FK_SINHVIEN_NGUOIDUNG FOREIGN KEY (MaNgDung) REFERENCES NGUOIDUNG(MaNgDung) ON UPDATE CASCADE ON DELETE NO ACTION,
    CONSTRAINT FK_SINHVIEN_LOP FOREIGN KEY (MaLop) REFERENCES LOP(MaLop) ON UPDATE CASCADE ON DELETE NO ACTION
);
GO

-- 10. GIẢNG VIÊN
CREATE TABLE GIANGVIEN (
    MaGV BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaNgDung BIGINT UNIQUE,
    HocVi NVARCHAR(100),
    MaBM BIGINT,
    CONSTRAINT FK_GIANGVIEN_NGDUNG FOREIGN KEY (MaNgDung) REFERENCES NGUOIDUNG(MaNgDung) ON UPDATE CASCADE ON DELETE NO ACTION,
    CONSTRAINT FK_GIANGVIEN_BOMON FOREIGN KEY (MaBM) REFERENCES BOMON(MaBM) ON UPDATE CASCADE ON DELETE SET NULL
);
GO

-- 11. CÁN BỘ KHOA
CREATE TABLE CANBOKHOA (
    MaCanBo BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaNgDung BIGINT UNIQUE,
    MaKhoa BIGINT NOT NULL,
    ChucVu NVARCHAR(150),
    CONSTRAINT FK_CANBO_NGDUNG FOREIGN KEY (MaNgDung) REFERENCES NGUOIDUNG(MaNgDung) ON UPDATE CASCADE ON DELETE NO ACTION,
    CONSTRAINT FK_CANBO_KHOA FOREIGN KEY (MaKhoa) REFERENCES KHOA(MaKhoa) ON UPDATE CASCADE ON DELETE NO ACTION
);
GO

-- 12. QUẢN TRỊ VIÊN
CREATE TABLE QUANTRIVIEN (
    MaQuanTri BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaNgDung BIGINT UNIQUE,
    MoTa NVARCHAR(MAX),
    CONSTRAINT FK_QUANTRI_NGDUNG FOREIGN KEY (MaNgDung) REFERENCES NGUOIDUNG(MaNgDung) ON UPDATE CASCADE ON DELETE NO ACTION
);
GO

-- =============================================================================
-- II. KẾ HOẠCH & HOẠT ĐỘNG HỌC THUẬT (CUỘC THI, SEMINAR, CÁC BAN)
-- =============================================================================

-- 13. KẾ HOẠCH HỌC THUẬT
CREATE TABLE KEHOACHHOCTHUAT (
    MaKeHoach BIGINT IDENTITY(1,1) PRIMARY KEY,
    TenKeHoach NVARCHAR(200) NOT NULL,
    NamHoc VARCHAR(20) NOT NULL,
    HocKy NVARCHAR(30),
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Dự thảo',
    MaKhoa BIGINT NOT NULL,
    NgPhuTrach BIGINT,
    MaBM BIGINT,
    LoaiKeHoach VARCHAR(20) NOT NULL DEFAULT 'KHOA',
    NguoiDuyet BIGINT,
    NgayDuyet DATETIMEOFFSET,
    LichSuDuyet NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
    CONSTRAINT FK_KEHOACH_KHOA FOREIGN KEY (MaKhoa) REFERENCES KHOA(MaKhoa) ON UPDATE CASCADE ON DELETE NO ACTION,
    CONSTRAINT FK_KEHOACH_PHUTRACH FOREIGN KEY (NgPhuTrach) REFERENCES CANBOKHOA(MaCanBo) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT FK_KEHOACH_BOMON FOREIGN KEY (MaBM) REFERENCES BOMON(MaBM) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT FK_KEHOACH_NGUOIDUYET FOREIGN KEY (NguoiDuyet) REFERENCES TAIKHOAN(MaTK) ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT CK_KEHOACH_TRANGTHAI CHECK (TrangThai IN (N'Dự thảo', N'Chờ duyệt', N'Cần bổ sung', N'Đã duyệt', N'Không duyệt')),
    CONSTRAINT CK_KEHOACH_LOAI CHECK (LoaiKeHoach IN ('KHOA', 'BO_MON')),
    CONSTRAINT CK_KEHOACH_BOMON CHECK (LoaiKeHoach <> 'BO_MON' OR MaBM IS NOT NULL),
    CONSTRAINT CK_KEHOACH_LICHSU_JSON CHECK (ISJSON(LichSuDuyet) > 0)
);
GO

-- 14. HOẠT ĐỘNG HỌC THUẬT
CREATE TABLE HOATDONGHOCTHUAT (
    MaHD BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaKeHoach BIGINT,
    MaKeHoachKhoa BIGINT,
    TenHoatDong NVARCHAR(250) NOT NULL,
    MoTa NVARCHAR(MAX),
    TgBatDau DATETIME2 NOT NULL,
    TgKetThuc DATETIME2 NOT NULL,
    HanDangKy DATETIME2,
    DiaDiem NVARCHAR(255),
    SLToiDa INT,
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Dự thảo',
    KinhPhiDuTru DECIMAL(18,2) NOT NULL DEFAULT 0,
    NoiDungCongBo NVARCHAR(MAX),
    NgayCongBo DATETIMEOFFSET,
    CONSTRAINT FK_HT_KEHOACH FOREIGN KEY (MaKeHoach) REFERENCES KEHOACHHOCTHUAT(MaKeHoach) ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT FK_HT_KEHOACHKHOA FOREIGN KEY (MaKeHoachKhoa) REFERENCES KEHOACHHOCTHUAT(MaKeHoach) ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT CK_HOATDONG_TG CHECK (TgKetThuc > TgBatDau),
    CONSTRAINT CK_HOATDONG_SOLUONG CHECK (SLToiDa IS NULL OR SLToiDa > 0),
    CONSTRAINT CK_HOATDONG_TRANGTHAI CHECK (TrangThai IN (N'Dự thảo', N'Chờ duyệt', N'Đã công bố', N'Đang diễn ra', N'Đã kết thúc', N'Đã hủy')),
    CONSTRAINT CK_HOATDONG_KINHPHI CHECK (KinhPhiDuTru >= 0)
);
GO

-- 15. CUỘC THI
CREATE TABLE CUOCTHI (
    MaCThi BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaHD BIGINT UNIQUE NOT NULL,
    TenCuocThi NVARCHAR(250) NOT NULL,
    CapToChuc NVARCHAR(100),
    TheLe NVARCHAR(MAX) NOT NULL,
    TieuChiCham NVARCHAR(MAX),
    SLSinhVien INT,
    HinhThucThi NVARCHAR(30) DEFAULT N'Cá nhân',
    CONSTRAINT FK_CUOCTHI_HOATDG FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT CK_CUOCTHI_SL CHECK (SLSinhVien IS NULL OR SLSinhVien > 0),
    CONSTRAINT CK_CUOCTHI_HINHTHUC CHECK (HinhThucThi IN (N'Cá nhân', N'Theo đội'))
);
GO

-- 16. SEMINAR
CREATE TABLE SEMINAR (
    MaSeminar BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaHD BIGINT UNIQUE NOT NULL,
    ChuDe NVARCHAR(250) NOT NULL,
    NoiDung NVARCHAR(MAX),
    DoiTuongTG NVARCHAR(MAX),
    ThoiLuong INT,
    DVChuTri NVARCHAR(200),
    DVPhoiHop NVARCHAR(200),
    DienGia NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
    CONSTRAINT FK_SEMINAR_HOATDG FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT CK_SEMINAR_THLUONG CHECK (ThoiLuong IS NULL OR ThoiLuong > 0),
    CONSTRAINT CK_SEMINAR_DIENGIA_JSON CHECK (ISJSON(DienGia) > 0)
);
GO

-- 17. BAN CUỘC THI
CREATE TABLE BANCUOCTHI (
    MaBan BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaCThi BIGINT NOT NULL,
    TenBanTC NVARCHAR(150) NOT NULL,
    CONSTRAINT FK_BAN_CUOCTHI FOREIGN KEY (MaCThi) REFERENCES CUOCTHI(MaCThi) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT UQ_BAN_CUOCTHI UNIQUE (MaCThi, TenBanTC)
);
GO

-- 18. THÀNH VIÊN BAN TỔ CHỨC / PHÂN CÔNG GIẢNG VIÊN
CREATE TABLE BANTOCHUC (
    MaBanTC BIGINT NOT NULL,
    MaGV BIGINT NOT NULL,
    ChucVu NVARCHAR(100),
    NhiemVu NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
    PRIMARY KEY (MaBanTC, MaGV),
    CONSTRAINT FK_BANTOCHUC_BAN FOREIGN KEY (MaBanTC) REFERENCES BANCUOCTHI(MaBan) ON DELETE CASCADE,
    CONSTRAINT FK_BANTOCHUC_GV FOREIGN KEY (MaGV) REFERENCES GIANGVIEN(MaGV) ON DELETE CASCADE,
    CONSTRAINT CK_BANTOCHUC_NHIEMVU_JSON CHECK (ISJSON(NhiemVu) > 0)
);
GO

-- 19. ĐỘI THI
CREATE TABLE DOITHI (
    MaDoi BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaCThi BIGINT NOT NULL,
    TenDoi NVARCHAR(150) NOT NULL,
    CONSTRAINT FK_DOITHI_CUOCTHI FOREIGN KEY (MaCThi) REFERENCES CUOCTHI(MaCThi) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT UQ_DOITHI_CUOCTHI UNIQUE (MaCThi, TenDoi)
);
GO

-- 20. THÀNH VIÊN ĐỘI
CREATE TABLE THANHVIENDOI (
    MaDoi BIGINT NOT NULL,
    MaSV BIGINT NOT NULL,
    VaiTro NVARCHAR(30) NOT NULL DEFAULT N'Thành viên',
    PRIMARY KEY (MaDoi, MaSV),
    CONSTRAINT FK_TVDOI_DOI FOREIGN KEY (MaDoi) REFERENCES DOITHI(MaDoi) ON DELETE CASCADE,
    CONSTRAINT FK_TVDOI_SV FOREIGN KEY (MaSV) REFERENCES SINHVIEN(MaSV) ON DELETE CASCADE,
    CONSTRAINT CK_TVDOI_VAITRO CHECK (VaiTro IN (N'Trưởng đội', N'Thành viên'))
);
GO

-- =============================================================================
-- III. ĐĂNG KÝ, ĐIỂM DANH QR, ĐỀ TÀI & KẾT QUẢ
-- =============================================================================

-- 21. ĐĂNG KÝ THAM GIA
CREATE TABLE DKTHAMGIA (
    MaDK BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaHD BIGINT NOT NULL,
    MaSV BIGINT NOT NULL,
    NgayDK DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    HinhThuc NVARCHAR(30) NOT NULL,
    NguonDK NVARCHAR(30) NOT NULL DEFAULT N'Sinh viên',
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Đã đăng ký',
    DaNhacLuc DATETIMEOFFSET,
    CONSTRAINT FK_DANGKY_HOATDG FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE NO ACTION,
    CONSTRAINT FK_DANGKY_SV FOREIGN KEY (MaSV) REFERENCES SINHVIEN(MaSV) ON DELETE NO ACTION,
    CONSTRAINT UQ_DK_SV_HOATDG UNIQUE (MaHD, MaSV),
    CONSTRAINT CK_DK_HINHTHUC CHECK (HinhThuc IN (N'Tham gia', N'Dự thi', N'Hỗ trợ', N'Cổ vũ')),
    CONSTRAINT CK_DK_NGUON CHECK (NguonDK IN (N'Sinh viên', N'Giảng viên', N'Khoa')),
    CONSTRAINT CK_DK_TRANGTHAI CHECK (TrangThai IN (N'Đã đăng ký', N'Đã xác nhận', N'Đã hủy', N'Từ chối'))
);
GO

-- 22. PHÂN CÔNG CỔ VŨ & HỖ TRỢ THEO LỚP
CREATE TABLE PHANCONGCOVU (
    MaCoVu BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaHD BIGINT NOT NULL,
    MaLop BIGINT NOT NULL,
    SoLuong INT NOT NULL,
    NhiemVu NVARCHAR(MAX),
    NgayPhCong DATETIME2 DEFAULT SYSDATETIME(),
    TrangThai NVARCHAR(30) DEFAULT N'Đang thực hiện',
    LoaiPhanCong NVARCHAR(20) NOT NULL DEFAULT N'Cổ vũ',
    CONSTRAINT FK_COVU_HOATDG FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE NO ACTION,
    CONSTRAINT FK_COVU_LOP FOREIGN KEY (MaLop) REFERENCES LOP(MaLop) ON DELETE NO ACTION,
    CONSTRAINT UQ_COVU_HOATDG_LOP UNIQUE (MaHD, MaLop),
    CONSTRAINT CK_COVU_SL CHECK (SoLuong > 0),
    CONSTRAINT CK_COVU_LOAI CHECK (LoaiPhanCong IN (N'Cổ vũ', N'Hỗ trợ'))
);
GO

-- 23. ĐỀ TÀI DỰ THI
CREATE TABLE DETAI (
    MaDeTai BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaCThi BIGINT NOT NULL,
    MaDK BIGINT NULL,
    MaDoi BIGINT NULL,
    TenDeTai NVARCHAR(250) NOT NULL,
    LinhVuc NVARCHAR(200),
    MoTa NVARCHAR(MAX),
    NgBatDau DATE,
    NgKetThuc DATE,
    TrangThai NVARCHAR(30) DEFAULT N'Đang thực hiện',
    CONSTRAINT FK_DETAI_CTHI FOREIGN KEY (MaCThi) REFERENCES CUOCTHI(MaCThi) ON DELETE CASCADE,
    CONSTRAINT FK_DETAI_DANGKY FOREIGN KEY (MaDK) REFERENCES DKTHAMGIA(MaDK) ON DELETE SET NULL,
    CONSTRAINT FK_DETAI_DOI FOREIGN KEY (MaDoi) REFERENCES DOITHI(MaDoi) ON DELETE SET NULL,
    CONSTRAINT CK_DETAI_THOIGIAN CHECK (NgKetThuc IS NULL OR NgBatDau IS NULL OR NgKetThuc >= NgBatDau),
    CONSTRAINT CK_DETAI_CHUSOHUU CHECK (NOT (MaDoi IS NOT NULL AND MaDK IS NOT NULL))
);
GO

-- 24. MÃ QR ĐIỂM DANH
CREATE TABLE MAQR (
    MaQR BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaHD BIGINT NOT NULL,
    MaQRCode VARCHAR(255) NOT NULL UNIQUE,
    TGMo DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    TGHetHan DATETIMEOFFSET NOT NULL,
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Hoạt động',
    CONSTRAINT FK_MAQR_HOATDONG FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE CASCADE,
    CONSTRAINT CK_MAQR_THOIGIAN CHECK (TGHetHan > TGMo),
    CONSTRAINT CK_MAQR_TRANGTHAI CHECK (TrangThai IN (N'Hoạt động', N'Hết hạn', N'Thu hồi'))
);
GO

-- 25. ĐIỂM DANH MOBILE
CREATE TABLE DIEMDANH (
    MaDD BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaQR BIGINT NOT NULL,
    MaDK BIGINT NOT NULL,
    BatDauLuc DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    KetThucLuc DATETIME2,
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Đã điểm danh',
    CONSTRAINT FK_DIEMDANH_QR FOREIGN KEY (MaQR) REFERENCES MAQR(MaQR) ON DELETE NO ACTION,
    CONSTRAINT FK_DIEMDANH_DANGKY FOREIGN KEY (MaDK) REFERENCES DKTHAMGIA(MaDK) ON DELETE NO ACTION,
    CONSTRAINT UQ_DIEMDANH_DANGKY UNIQUE (MaDK),
    CONSTRAINT CK_DIEMDANH_TRANGTHAI CHECK (TrangThai IN (N'Đã điểm danh', N'Đã xác nhận', N'Từ chối'))
);
GO

-- 26. GIẢI THƯỞNG CUỘC THI
CREATE TABLE GIAITHUONG (
    MaGT BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaCThi BIGINT NOT NULL,
    TenGT NVARCHAR(150) NOT NULL,
    CapGiai NVARCHAR(100),
    CONSTRAINT FK_GIAITHUONG_CUOCTHI FOREIGN KEY (MaCThi) REFERENCES CUOCTHI(MaCThi) ON DELETE CASCADE
);
GO

-- 27. KẾT QUẢ HỌC THUẬT
CREATE TABLE KETQUAHOCTHUAT (
    MaKQ BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaCThi BIGINT NOT NULL,
    MaDK BIGINT NULL,
    MaDoi BIGINT NULL,
    MaGT BIGINT NULL,
    LoaiKQ NVARCHAR(50),
    XepHang INT,
    Diem NUMERIC(5,2),
    GhiChu NVARCHAR(MAX),
    TrangThai NVARCHAR(30) DEFAULT N'Dự thảo',
    CONSTRAINT FK_KETQUA_CUOCTHI FOREIGN KEY (MaCThi) REFERENCES CUOCTHI(MaCThi) ON DELETE CASCADE,
    CONSTRAINT FK_KETQUA_DANGKY FOREIGN KEY (MaDK) REFERENCES DKTHAMGIA(MaDK) ON DELETE NO ACTION,
    CONSTRAINT FK_KETQUA_DOI FOREIGN KEY (MaDoi) REFERENCES DOITHI(MaDoi) ON DELETE NO ACTION,
    CONSTRAINT FK_KETQUA_GIAITHUONG FOREIGN KEY (MaGT) REFERENCES GIAITHUONG(MaGT) ON DELETE SET NULL,
    CONSTRAINT CK_KETQUA_DIEM CHECK (Diem IS NULL OR (Diem >= 0 AND Diem <= 100)),
    CONSTRAINT CK_KETQUA_XEPHANG CHECK (XepHang IS NULL OR XepHang > 0),
    CONSTRAINT CK_KETQUA_TRANGTHAI CHECK (TrangThai IN (N'Dự thảo', N'Đã xác nhận', N'Đã công bố')),
    CONSTRAINT CK_DOI_HOAC_CANHAN CHECK ((CASE WHEN MaDoi IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN MaDK IS NOT NULL THEN 1 ELSE 0 END) = 1)
);
GO

-- =============================================================================
-- IV. ĐIỂM RÈN LUYỆN, TÀI CHÍNH & PHIÊN ĐĂNG NHẬP
-- =============================================================================

-- 28. ĐIỂM RÈN LUYỆN
CREATE TABLE DIEMRENLUYEN (
    MaDiem BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaSV BIGINT NOT NULL,
    MaHD BIGINT NOT NULL,
    HocKy NVARCHAR(30) NOT NULL,
    NamHoc VARCHAR(20) NOT NULL,
    SoDiem NUMERIC(5,2) NOT NULL,
    LyDo NVARCHAR(MAX),
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Chờ xác nhận',
    MaDiemGoc BIGINT NULL,
    NguoiGhi BIGINT NULL,
    GhiLuc DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT FK_DRL_SINHVIEN FOREIGN KEY (MaSV) REFERENCES SINHVIEN(MaSV) ON DELETE NO ACTION,
    CONSTRAINT FK_DRL_HOATDONG FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE NO ACTION,
    CONSTRAINT FK_DRL_DIEMGOC FOREIGN KEY (MaDiemGoc) REFERENCES DIEMRENLUYEN(MaDiem) ON DELETE NO ACTION,
    CONSTRAINT FK_DRL_NGUOIGHI FOREIGN KEY (NguoiGhi) REFERENCES TAIKHOAN(MaTK) ON DELETE NO ACTION,
    CONSTRAINT CK_DRL_SODIEM CHECK (SoDiem <> 0),
    CONSTRAINT CK_DRL_TRANGTHAI CHECK (TrangThai IN (N'Chờ xác nhận', N'Đã xác nhận', N'Đã điều chỉnh', N'Từ chối')),
    CONSTRAINT CK_DIEM_KHONG_TUTHAMCHIEU CHECK (MaDiemGoc IS NULL OR MaDiemGoc <> MaDiem)
);
GO

-- 29. HỒ SƠ QUYẾT TOÁN
CREATE TABLE HOSOQUYETTOAN (
    MaHS BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaHD BIGINT NOT NULL,
    NguoiLap BIGINT NOT NULL,
    NguoiDuyet BIGINT NULL,
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Dự thảo',
    NgayLap DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    NgayDuyet DATETIMEOFFSET NULL,
    GhiChu NVARCHAR(MAX),
    CONSTRAINT FK_HSQT_HOATDONG FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE NO ACTION,
    CONSTRAINT FK_HSQT_NGUOILAP FOREIGN KEY (NguoiLap) REFERENCES TAIKHOAN(MaTK) ON DELETE NO ACTION,
    CONSTRAINT FK_HSQT_NGUOIDUYET FOREIGN KEY (NguoiDuyet) REFERENCES TAIKHOAN(MaTK) ON DELETE NO ACTION,
    CONSTRAINT CK_HSQT_TRANGTHAI CHECK (TrangThai IN (N'Dự thảo', N'Chờ duyệt', N'Đã duyệt', N'Cần bổ sung', N'Từ chối'))
);
GO

-- 30. CHI PHÍ THỰC TẾ
CREATE TABLE CHIPHITHUCTE (
    MaCP BIGINT IDENTITY(1,1) PRIMARY KEY,
    MaHD BIGINT NOT NULL,
    MaHS BIGINT NULL,
    NoiDung NVARCHAR(MAX) NOT NULL,
    SoTien DECIMAL(18,2) NOT NULL,
    NgChi DATE NOT NULL,
    NguoiGhi BIGINT NOT NULL,
    ChungTu NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
    CONSTRAINT FK_CPTT_HOATDONG FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE NO ACTION,
    CONSTRAINT FK_CPTT_HOSO FOREIGN KEY (MaHS) REFERENCES HOSOQUYETTOAN(MaHS) ON DELETE SET NULL,
    CONSTRAINT FK_CPTT_NGUOIGHI FOREIGN KEY (NguoiGhi) REFERENCES TAIKHOAN(MaTK) ON DELETE NO ACTION,
    CONSTRAINT CK_CPTT_SOTIEN CHECK (SoTien >= 0),
    CONSTRAINT CK_CPTT_CHUNGTU_JSON CHECK (ISJSON(ChungTu) > 0)
);
GO

-- 31. PHIÊN ĐĂNG NHẬP
CREATE TABLE PHIENDANGNHAP (
    MaPhien UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    MaBamToken CHAR(64) NOT NULL UNIQUE,
    MaTK BIGINT NOT NULL,
    PBMatKhau INT NOT NULL,
    TaoLuc DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    HetHanLuc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_PHIEN_TAIKHOAN FOREIGN KEY (MaTK) REFERENCES TAIKHOAN(MaTK) ON DELETE CASCADE
);
GO

-- =============================================================================
-- V. CHỈ MỤC (INDEXES) TỐI ƯU HIỆU NĂNG TRUY VẤN
-- =============================================================================

CREATE NONCLUSTERED INDEX IDX_LOP_KHOA ON LOP(MaKhoa);
CREATE NONCLUSTERED INDEX IDX_SV_LOP ON SINHVIEN(MaLop);
CREATE NONCLUSTERED INDEX IDX_HOATDONG_KEHOACH ON HOATDONGHOCTHUAT(MaKeHoach);
CREATE NONCLUSTERED INDEX IDX_HOATDONG_THOIGIAN ON HOATDONGHOCTHUAT(TgBatDau, TgKetThuc);
CREATE NONCLUSTERED INDEX IDX_DANGKY_HOATDONG ON DKTHAMGIA(MaHD);
CREATE NONCLUSTERED INDEX IDX_DANGKY_SINHVIEN ON DKTHAMGIA(MaSV);
CREATE NONCLUSTERED INDEX IDX_DIEMDANH_DANGKY ON DIEMDANH(MaDK);
CREATE NONCLUSTERED INDEX IDX_DRL_SINHVIEN ON DIEMRENLUYEN(MaSV);
CREATE NONCLUSTERED INDEX IDX_DRL_HOATDONG ON DIEMRENLUYEN(MaHD);
CREATE NONCLUSTERED INDEX IDX_PHIEN_TAIKHOAN ON PHIENDANGNHAP(MaTK);
CREATE NONCLUSTERED INDEX IDX_PHIEN_HETHAN ON PHIENDANGNHAP(HetHanLuc);

-- Ràng buộc một đội thi chỉ có tối đa một Trưởng đội (Filtered Unique Index trong SQL Server)
CREATE UNIQUE NONCLUSTERED INDEX IDX_MOT_TRUONGDOI ON THANHVIENDOI(MaDoi) WHERE VaiTro = N'Trưởng đội';
GO

-- =============================================================================
-- VI. DỮ LIỆU MẪU (SEED DATA) - HỌC KỲ 2 NĂM HỌC 2025-2026
-- Mật khẩu mặc định: MatKhau@123456
-- Chuỗi băm Bcrypt: $2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC
-- =============================================================================

BEGIN TRANSACTION;

-- 1. KHOA
SET IDENTITY_INSERT KHOA ON;
INSERT INTO KHOA (MaKhoa, TenKhoa) VALUES
(1, N'Khoa Công nghệ Thông tin'),
(2, N'Khoa Kinh tế và Quản trị Kinh doanh'),
(3, N'Khoa Ngoại ngữ');
SET IDENTITY_INSERT KHOA OFF;

-- 2. BỘ MÔN
SET IDENTITY_INSERT BOMON ON;
INSERT INTO BOMON (MaBM, MaKhoa, TenBM) VALUES
(1, 1, N'Bộ môn Khoa học Máy tính'),
(2, 1, N'Bộ môn Kỹ thuật Phần mềm'),
(3, 1, N'Bộ môn Hệ thống Thông tin'),
(4, 1, N'Bộ môn Mạng máy tính & An toàn thông tin');
SET IDENTITY_INSERT BOMON OFF;

-- 3. LỚP
SET IDENTITY_INSERT LOP ON;
INSERT INTO LOP (MaLop, TenLop, KhoaHoc, MaKhoa) VALUES
(1, N'CNTT_K19A', N'2023-2027', 1),
(2, N'CNTT_K19B', N'2023-2027', 1),
(3, N'KTPM_K19',  N'2023-2027', 1),
(4, N'HTTT_K19',  N'2023-2027', 1);
SET IDENTITY_INSERT LOP OFF;

-- 4. VAI TRÒ
SET IDENTITY_INSERT VAITRO ON;
INSERT INTO VAITRO (MaVaiTro, TenVaiTro) VALUES
(1, N'ADMIN'),
(2, N'CAN_BO_KHOA'),
(3, N'GIANG_VIEN'),
(4, N'SINH_VIEN');
SET IDENTITY_INSERT VAITRO OFF;

-- 5. PHÂN QUYỀN
SET IDENTITY_INSERT PHANQUYEN ON;
INSERT INTO PHANQUYEN (MaQuyen, TenQuyen, MoTa) VALUES
(1,  N'XEM_DANH_SACH_HOAT_DONG', N'Xem danh sách và chi tiết các hoạt động học thuật'),
(2,  N'DANG_KY_HOAT_DONG',       N'Đăng ký tham gia hoặc dự thi các hoạt động'),
(3,  N'QUAN_LY_KE_HOACH',        N'Tạo, chỉnh sửa kế hoạch công tác học thuật'),
(4,  N'PHE_DUYET_KE_HOACH',      N'Duyệt kế hoạch công tác học thuật khoa/bộ môn'),
(5,  N'QUAN_LY_HOAT_DONG',       N'Tạo mới, chỉnh sửa và công bố hoạt động học thuật'),
(6,  N'DIEM_DANH_QR',            N'Quản lý mã QR và xác nhận điểm danh sinh viên'),
(7,  N'NHAP_KET_QUA_CUOC_THI',   N'Chấm điểm, cập nhật xếp hạng và giải thưởng cuộc thi'),
(8,  N'QUAN_LY_DIEM_REN_LUYEN',  N'Ghi nhận, điều chỉnh điểm rèn luyện cho sinh viên'),
(9,  N'QUYET_TOAN_KINH_PHI',     N'Lập và duyệt hồ sơ quyết toán, chi phí thực tế'),
(10, N'QUAN_TRI_HE_THONG',      N'Toàn quyền quản trị tài khoản, vai trò và phân quyền');
SET IDENTITY_INSERT PHANQUYEN OFF;

-- 6. GÁN QUYỀN VAI TRÒ
INSERT INTO VAITRO_QUYEN (MaVT, MaQuyen) VALUES
(1, 1), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10),
(2, 1), (2, 3), (2, 4), (2, 5), (2, 6), (2, 7), (2, 8), (2, 9),
(3, 1), (3, 3), (3, 5), (3, 6), (3, 7),
(4, 1), (4, 2);

-- 7. NGƯỜI DÙNG
SET IDENTITY_INSERT NGUOIDUNG ON;
INSERT INTO NGUOIDUNG (MaNgDung, HoTen, Email, SDT, NgaySinh, GioiTinh, TrangThai) VALUES
(1,  N'Nguyễn Văn Quản Trị',   'admin@university.edu.vn',    '0901234567', '1985-05-15', N'Nam', N'Hoạt động'),
(2,  N'TS. Trần Thị Bích Vân', 'bichvan@university.edu.vn',  '0912345678', '1986-08-20', N'Nữ',  N'Hoạt động'),
(3,  N'TS. Lê Hoàng Nam',      'hoangnam@university.edu.vn', '0923456789', '1982-11-10', N'Nam', N'Hoạt động'),
(4,  N'ThS. Phạm Minh Tuấn',   'minhtuan@university.edu.vn', '0934567890', '1989-03-25', N'Nam', N'Hoạt động'),
(5,  N'TS. Nguyễn Thanh Tùng', 'thanhtung@university.edu.vn','0941234567', '1984-06-18', N'Nam', N'Hoạt động'),
(6,  N'ThS. Đỗ Thúy Hằng',     'thuyhang@university.edu.vn', '0951234567', '1991-09-12', N'Nữ',  N'Hoạt động'),
(7,  N'Nguyễn Văn An',         'sv.an@student.edu.vn',       '0961234567', '2005-01-12', N'Nam', N'Hoạt động'),
(8,  N'Trần Thị Bình',         'sv.binh@student.edu.vn',     '0971234567', '2005-04-18', N'Nữ',  N'Hoạt động'),
(9,  N'Lê Quốc Cường',         'sv.cuong@student.edu.vn',    '0981234567', '2005-07-22', N'Nam', N'Hoạt động'),
(10, N'Phạm Thị Dung',         'sv.dung@student.edu.vn',     '0991234567', '2005-09-30', N'Nữ',  N'Hoạt động'),
(11, N'Hoàng Văn Em',          'sv.em@student.edu.vn',       '0918765432', '2005-12-05', N'Nam', N'Hoạt động'),
(12, N'Vũ Thị Giang',          'sv.giang@student.edu.vn',    '0928765432', '2005-03-14', N'Nữ',  N'Hoạt động');
SET IDENTITY_INSERT NGUOIDUNG OFF;

-- 8. TÀI KHOẢN
SET IDENTITY_INSERT TAIKHOAN ON;
INSERT INTO TAIKHOAN (MaTK, MaNgDung, MaVaiTro, TenDangNhap, MatKhau, PBMatKhau, TrangThai) VALUES
(1,  1,  1, 'admin.demo',     '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, N'Hoạt động'),
(2,  2,  2, 'cbk.bichvan',    '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, N'Hoạt động'),
(3,  3,  3, 'gv.hoangnam',    '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, N'Hoạt động'),
(4,  4,  3, 'gv.minhtuan',    '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, N'Hoạt động'),
(5,  5,  3, 'gv.thanhtung',   '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, N'Hoạt động'),
(6,  6,  3, 'gv.thuyhang',    '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, N'Hoạt động'),
(7,  7,  4, 'sv.nguyenvanan', '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, N'Hoạt động'),
(8,  8,  4, 'sv.tranthibinh', '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, N'Hoạt động'),
(9,  9,  4, 'sv.lequoccuong', '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, N'Hoạt động'),
(10, 10, 4, 'sv.phamthidung', '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, N'Hoạt động'),
(11, 11, 4, 'sv.hoangvanem',  '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, N'Hoạt động'),
(12, 12, 4, 'sv.vuthigiang',  '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, N'Hoạt động');
SET IDENTITY_INSERT TAIKHOAN OFF;

-- 9. QUẢN TRỊ VIÊN
SET IDENTITY_INSERT QUANTRIVIEN ON;
INSERT INTO QUANTRIVIEN (MaQuanTri, MaNgDung, MoTa) VALUES
(1, 1, N'Quản trị viên hệ thống công tác học thuật toàn trường');
SET IDENTITY_INSERT QUANTRIVIEN OFF;

-- 10. CÁN BỘ KHOA
SET IDENTITY_INSERT CANBOKHOA ON;
INSERT INTO CANBOKHOA (MaCanBo, MaNgDung, MaKhoa, ChucVu) VALUES
(1, 2, 1, N'Phó Trưởng khoa phụ trách Công tác học thuật & NCKH Sinh viên');
SET IDENTITY_INSERT CANBOKHOA OFF;

-- 11. GIẢNG VIÊN
SET IDENTITY_INSERT GIANGVIEN ON;
INSERT INTO GIANGVIEN (MaGV, MaNgDung, HocVi, MaBM) VALUES
(1, 3, N'Tiến sĩ', 1),
(2, 4, N'Thạc sĩ', 2),
(3, 5, N'Tiến sĩ', 3),
(4, 6, N'Thạc sĩ', 4);
SET IDENTITY_INSERT GIANGVIEN OFF;

-- 12. SINH VIÊN
SET IDENTITY_INSERT SINHVIEN ON;
INSERT INTO SINHVIEN (MaSV, MaNgDung, MaLop, MSSV) VALUES
(1, 7,  1, '2001210001'),
(2, 8,  1, '2001210002'),
(3, 9,  2, '2001210003'),
(4, 10, 2, '2001210004'),
(5, 11, 3, '2001210005'),
(6, 12, 4, '2001210006');
SET IDENTITY_INSERT SINHVIEN OFF;

-- 13. KẾ HOẠCH HỌC THUẬT (HỌC KỲ 2 NĂM HỌC 2025-2026)
SET IDENTITY_INSERT KEHOACHHOCTHUAT ON;
INSERT INTO KEHOACHHOCTHUAT (
    MaKeHoach, TenKeHoach, NamHoc, HocKy, TrangThai, MaKhoa, NgPhuTrach,
    LoaiKeHoach, MaBM, NguoiDuyet, NgayDuyet, LichSuDuyet
) VALUES
(
    1,
    N'Kế hoạch Tổng thể Hoạt động Học thuật và NCKH Sinh viên Khoa CNTT - Học kỳ 2 Năm học 2025-2026',
    '2025-2026',
    N'Học kỳ 2',
    N'Đã duyệt',
    1,
    1,
    'KHOA',
    NULL,
    1,
    '2026-01-20 09:30:00 +07:00',
    N'[{"nguoi_duyet": "admin.demo", "thoi_gian": "2026-01-20T09:30:00+07:00", "trang_thai": "Đã duyệt", "noi_dung": "Ban Chủ nhiệm Khoa phê duyệt kế hoạch chung HK2 (2025-2026). Giao các Bộ môn phối hợp tổ chức đúng tiến độ."}]'
),
(
    2,
    N'Kế hoạch Tổ chức Cuộc thi Học thuật Lập trình và Ứng dụng Phần mềm HK2 (2025-2026)',
    '2025-2026',
    N'Học kỳ 2',
    N'Đã duyệt',
    1,
    1,
    'BO_MON',
    2,
    2,
    '2026-01-15 14:00:00 +07:00',
    N'[{"nguoi_duyet": "cbk.bichvan", "thoi_gian": "2026-01-15T14:00:00+07:00", "trang_thai": "Đã duyệt", "noi_dung": "Kế hoạch chi tiết, dự trù kinh phí hợp lý, duyệt tổ chức cuộc thi HUIT Code Challenge 2026."}]'
),
(
    3,
    N'Kế hoạch Tổ chức Chuỗi Seminar Chuyên đề Trí tuệ Nhân tạo & Định hướng Nghiên cứu HK2 (2025-2026)',
    '2025-2026',
    N'Học kỳ 2',
    N'Đã duyệt',
    1,
    1,
    'BO_MON',
    1,
    2,
    '2026-01-18 10:30:00 +07:00',
    N'[{"nguoi_duyet": "cbk.bichvan", "thoi_gian": "2026-01-18T10:30:00+07:00", "trang_thai": "Đã duyệt", "noi_dung": "Đồng ý hỗ trợ kinh phí mời chuyên gia doanh nghiệp báo cáo seminar GenAI."}]'
),
(
    4,
    N'Kế hoạch Phát động Nghiên cứu Ý tưởng Đổi mới Sáng tạo & Chuyển đổi số HK2 (2025-2026)',
    '2025-2026',
    N'Học kỳ 2',
    N'Chờ duyệt',
    1,
    1,
    'BO_MON',
    3,
    NULL,
    NULL,
    N'[]'
);
SET IDENTITY_INSERT KEHOACHHOCTHUAT OFF;

-- 14. HOẠT ĐỘNG HỌC THUẬT
SET IDENTITY_INSERT HOATDONGHOCTHUAT ON;
INSERT INTO HOATDONGHOCTHUAT (
    MaHD, MaKeHoach, MaKeHoachKhoa, TenHoatDong, MoTa,
    TgBatDau, TgKetThuc, HanDangKy, DiaDiem, SLToiDa, TrangThai,
    KinhPhiDuTru, NoiDungCongBo, NgayCongBo
) VALUES
(
    1,
    2,
    1,
    N'Cuộc thi Lập trình Olympic Tin học Sinh viên - HUIT Code Challenge 2026',
    N'Cuộc thi học thuật thường niên nhằm rèn luyện kỹ năng thuật toán, lập trình thi đấu và tuyển chọn sinh viên ưu tú tham gia đội tuyển Olympic Tin học toàn quốc.',
    '2026-03-22 08:00:00',
    '2026-03-22 17:30:00',
    '2026-03-15 23:59:59',
    N'Khu phòng máy C101 - C102, Nhà C, ĐH Công Thương TP.HCM',
    120,
    N'Đã kết thúc',
    18000000.00,
    N'Khoa CNTT thông báo phát động Cuộc thi HUIT Code Challenge 2026 dành cho toàn thể sinh viên. Đăng ký theo đội 2 người. Cơ cấu giải thưởng hấp dẫn và cộng điểm rèn luyện.',
    '2026-02-15 08:00:00 +07:00'
),
(
    2,
    3,
    1,
    N'Seminar Học thuật: GenAI, RAG và Cloud Computing trong Phát triển Phần mềm Doanh nghiệp',
    N'Tọa đàm chuyên sâu về mô hình ngôn ngữ lớn (LLM), kỹ thuật Retrieval-Augmented Generation (RAG) và kiến trúc Agentic AI kết hợp Cloud AWS/GCP trong doanh nghiệp thực tế.',
    '2026-04-12 08:30:00',
    '2026-04-12 11:30:00',
    '2026-04-09 23:59:59',
    N'Hội trường Lớn B201, Tòa nhà B',
    250,
    N'Đã kết thúc',
    6500000.00,
    N'Kính mời toàn thể cán bộ, giảng viên và sinh viên quan tâm tham dự buổi Seminar học thuật với sự tham gia của các chuyên gia công nghệ hàng đầu.',
    '2026-03-25 08:30:00 +07:00'
),
(
    3,
    1,
    1,
    N'Cuộc thi Sáng tạo Ý tưởng Công nghệ & Đổi mới Sáng tạo Sinh viên CNTT 2026',
    N'Khuyến khích sinh viên đề xuất giải pháp, đề tài công nghệ thực tiễn (IoT, AI, Mobile App, Web3) giải quyết các vấn đề đời sống và xã hội.',
    '2026-05-16 08:00:00',
    '2026-05-16 17:00:00',
    '2026-05-05 23:59:59',
    N'Hội trường A - Tầng 2, Nhà Hiệu Bộ',
    80,
    N'Đang diễn ra',
    22000000.00,
    N'Phát động cuộc thi Sáng tạo Ý tưởng Công nghệ HK2 (2025-2026). Các đội thi nộp đề cương ý tưởng và poster sản phẩm trước ngày 05/05/2026.',
    '2026-04-01 09:00:00 +07:00'
),
(
    4,
    1,
    1,
    N'Seminar: Kỹ năng Viết Báo cáo Khoa học & Phương pháp Thực hiện Khóa luận Tốt nghiệp CNTT',
    N'Hướng dẫn phương pháp nghiên cứu tài liệu, trích dẫn chuẩn IEEE, bố cục đề cương khóa luận và kỹ năng thuyết trình báo cáo trước hội đồng.',
    '2026-06-20 08:30:00',
    '2026-06-20 11:30:00',
    '2026-06-15 23:59:59',
    N'Phòng Hội thảo C305, Nhà C',
    150,
    N'Đã công bố',
    4500000.00,
    N'Buổi tập huấn cực kỳ bổ ích dành cho sinh viên năm 3 và năm cuối chuẩn bị làm khóa luận tốt nghiệp và đồ án chuyên ngành.',
    '2026-05-25 10:00:00 +07:00'
);
SET IDENTITY_INSERT HOATDONGHOCTHUAT OFF;

-- 15. CUỘC THI
SET IDENTITY_INSERT CUOCTHI ON;
INSERT INTO CUOCTHI (MaCThi, MaHD, TenCuocThi, CapToChuc, TheLe, TieuChiCham, SLSinhVien, HinhThucThi) VALUES
(
    1,
    1,
    N'Cuộc thi Lập trình Olympic Tin học Sinh viên - HUIT Code Challenge 2026',
    N'Cấp Khoa',
    N'Thi đấu lập trình giải thuật trên nền tảng Themis Online Judge. Đội gồm 2 sinh viên làm bài trong 4 giờ liên tục với 5 bài toán thuật toán.',
    N'Số lượng testcase vượt qua (70%), Tối ưu thời gian chạy và bộ nhớ (30%).',
    60,
    N'Theo đội'
),
(
    2,
    3,
    N'Cuộc thi Sáng tạo Ý tưởng Công nghệ & Đổi mới Sáng tạo Sinh viên CNTT 2026',
    N'Cấp Trường',
    N'Mỗi đội từ 2-4 thành viên, nộp báo cáo nghiên cứu khả thi, demo sản phẩm và thuyết trình Pitching 10 phút trước Hội đồng Ban Giám khảo.',
    N'Tính mới & sáng tạo (30%), Tính khả thi & công nghệ (40%), Khả năng thuyết trình & trả lời phản biện (30%).',
    40,
    N'Theo đội'
);
SET IDENTITY_INSERT CUOCTHI OFF;

-- 16. SEMINAR
SET IDENTITY_INSERT SEMINAR ON;
INSERT INTO SEMINAR (MaSeminar, MaHD, ChuDe, NoiDung, DoiTuongTG, ThoiLuong, DVChuTri, DVPhoiHop, DienGia) VALUES
(
    1,
    2,
    N'GenAI, RAG và Cloud Computing trong Phát triển Phần mềm Doanh nghiệp',
    N'1. Tổng quan Kiến trúc Transformers & LLMs. 2. Kỹ thuật RAG nâng cao với Vector DB. 3. Multi-Agent Systems trong phát triển phần mềm doanh nghiệp.',
    N'Giảng viên, học viên cao học và toàn thể sinh viên khối ngành Công nghệ thông tin',
    180,
    N'Bộ môn Khoa học Máy tính',
    N'Bộ môn Kỹ thuật Phần mềm',
    N'[
        {"ho_ten": "TS. Lê Hoàng Nam", "hoc_vi": "Tiến sĩ", "co_quan": "Trưởng Bộ môn KHMT", "chu_de": "Kiến trúc Agentic AI và ứng dụng thực tiễn trong kỹ nghệ phần mềm"},
        {"ho_ten": "ThS. Phạm Minh Tuấn", "hoc_vi": "Thạc sĩ", "co_quan": "Kỹ sư Cấp cao tại FPT Software", "chu_de": "Triển khai RAG Production-Ready trên nền tảng Cloud"}
    ]'
),
(
    2,
    4,
    N'Kỹ năng Viết Báo cáo Khoa học & Phương pháp Thực hiện Khóa luận Tốt nghiệp CNTT',
    N'1. Quy chuẩn trình bày khóa luận tốt nghiệp FIT-HUIT. 2. Công cụ quản lý tài liệu trích dẫn Zotero/Mendeley. 3. Kỹ năng thiết kế slide và trả lời phản biện trước hội đồng.',
    N'Sinh viên năm 3, năm cuối chuẩn bị làm khóa luận tốt nghiệp và đồ án môn học',
    180,
    N'Bộ môn Hệ thống Thông tin',
    N'Khoa Công nghệ Thông tin',
    N'[
        {"ho_ten": "TS. Nguyễn Thanh Tùng", "hoc_vi": "Tiến sĩ", "co_quan": "Trưởng Bộ môn HTTT", "chu_de": "Phương pháp luận nghiên cứu và trình bày khóa luận khoa học"}
    ]'
);
SET IDENTITY_INSERT SEMINAR OFF;

-- 17. BAN CUỘC THI
SET IDENTITY_INSERT BANCUOCTHI ON;
INSERT INTO BANCUOCTHI (MaBan, MaCThi, TenBanTC) VALUES
(1, 1, N'Ban Tổ chức & Điều hành Chung'),
(2, 1, N'Ban Ra đề thi & Hội đồng Giám khảo'),
(3, 1, N'Ban Thư ký & Hậu cần Kỹ thuật'),
(4, 2, N'Ban Tổ chức & Ban Giám khảo Cuộc thi Ý tưởng');
SET IDENTITY_INSERT BANCUOCTHI OFF;

-- 18. THÀNH VIÊN BAN TỔ CHỨC / PHÂN CÔNG GIẢNG VIÊN
INSERT INTO BANTOCHUC (MaBanTC, MaGV, ChucVu, NhiemVu) VALUES
(1, 1, N'Trưởng Ban Tổ chức',            N'["Chỉ đạo toàn diện công tác tổ chức cuộc thi", "Phê duyệt kế hoạch chi tiết và dự trù kinh phí", "Chủ trì lễ khai mạc và bế mạc trao giải"]'),
(1, 2, N'Phó Trưởng Ban Tổ chức',       N'["Điều phối các ban chuyên môn", "Phụ trách truyền thông và phối hợp Trung tâm CNTT mượn phòng máy"]'),
(2, 3, N'Trưởng Ban Ra đề & Giám khảo', N'["Biên soạn ngân hàng đề thi 5 câu thuật toán", "Bảo mật đề thi tuyệt đối trước giờ thi", "Cấu hình hệ thống chấm tự động Themis và giải quyết phúc khảo"]'),
(3, 4, N'Trưởng Ban Thư ký & Hậu cần',  N'["Điểm danh và kiểm tra thẻ sinh viên thí sinh", "Chuẩn bị chứng từ thanh toán, bằng khen và tiền thưởng", "Tổng hợp biên bản kết quả thi và bàn giao cho Khoa"]'),
(4, 1, N'Chủ tịch Hội đồng Giám khảo',  N'["Thẩm định hồ sơ đề tài sáng tạo công nghệ", "Chấm điểm trực tiếp phần thuyết trình Pitching của các đội thi"]');

-- 19. ĐỘI THI
SET IDENTITY_INSERT DOITHI ON;
INSERT INTO DOITHI (MaDoi, MaCThi, TenDoi) VALUES
(1, 1, N'ByteCrafters'),
(2, 1, N'DevTitans'),
(3, 2, N'EcoSmart AI'),
(4, 2, N'BusTracker HUIT');
SET IDENTITY_INSERT DOITHI OFF;

-- 20. THÀNH VIÊN ĐỘI
INSERT INTO THANHVIENDOI (MaDoi, MaSV, VaiTro) VALUES
(1, 1, N'Trưởng đội'),
(1, 2, N'Thành viên'),
(2, 3, N'Trưởng đội'),
(2, 4, N'Thành viên'),
(3, 5, N'Trưởng đội'),
(3, 1, N'Thành viên'),
(4, 6, N'Trưởng đội'),
(4, 3, N'Thành viên');

-- 21. ĐĂNG KÝ THAM GIA
SET IDENTITY_INSERT DKTHAMGIA ON;
INSERT INTO DKTHAMGIA (MaDK, MaHD, MaSV, NgayDK, HinhThuc, NguonDK, TrangThai) VALUES
(1,  1, 1, '2026-03-01 08:30:00', N'Dự thi',    N'Sinh viên', N'Đã xác nhận'),
(2,  1, 2, '2026-03-01 08:35:00', N'Dự thi',    N'Sinh viên', N'Đã xác nhận'),
(3,  1, 3, '2026-03-02 10:00:00', N'Dự thi',    N'Sinh viên', N'Đã xác nhận'),
(4,  1, 4, '2026-03-02 10:05:00', N'Dự thi',    N'Sinh viên', N'Đã xác nhận'),
(5,  1, 5, '2026-03-03 14:00:00', N'Hỗ trợ',    N'Sinh viên', N'Đã xác nhận'),
(6,  1, 6, '2026-03-04 15:20:00', N'Cổ vũ',     N'Sinh viên', N'Đã xác nhận'),
(7,  2, 1, '2026-04-01 09:00:00', N'Tham gia',  N'Sinh viên', N'Đã xác nhận'),
(8,  2, 2, '2026-04-01 09:15:00', N'Tham gia',  N'Sinh viên', N'Đã xác nhận'),
(9,  2, 6, '2026-04-02 11:30:00', N'Tham gia',  N'Sinh viên', N'Đã xác nhận'),
(10, 3, 5, '2026-04-15 10:00:00', N'Dự thi',    N'Sinh viên', N'Đã xác nhận'),
(11, 4, 1, '2026-05-28 09:00:00', N'Tham gia',  N'Sinh viên', N'Đã xác nhận'),
(12, 4, 3, '2026-05-28 09:30:00', N'Tham gia',  N'Sinh viên', N'Đã xác nhận');
SET IDENTITY_INSERT DKTHAMGIA OFF;

-- 22. PHÂN CÔNG CỔ VŨ
SET IDENTITY_INSERT PHANCONGCOVU ON;
INSERT INTO PHANCONGCOVU (MaCoVu, MaHD, MaLop, SoLuong, NhiemVu, TrangThai, LoaiPhanCong) VALUES
(1, 1, 1, 30, N'Tham gia cổ vũ khai mạc và lễ trao giải HUIT Code Challenge 2026', N'Đang thực hiện', N'Cổ vũ'),
(2, 1, 3, 15, N'Hỗ trợ điều phối thí sinh vào phòng máy và hỗ trợ kỹ thuật mạng nội bộ', N'Đang thực hiện', N'Hỗ trợ'),
(3, 2, 4, 20, N'Hỗ trợ đón tiếp đại biểu, phát tài liệu và micro hội thảo GenAI', N'Đang thực hiện', N'Hỗ trợ');
SET IDENTITY_INSERT PHANCONGCOVU OFF;

-- 23. ĐỀ TÀI
SET IDENTITY_INSERT DETAI ON;
INSERT INTO DETAI (MaDeTai, MaCThi, MaDoi, MaDK, TenDeTai, LinhVuc, MoTa, NgBatDau, NgKetThuc, TrangThai) VALUES
(
    1,
    2,
    3,
    NULL,
    N'Hệ thống Phân loại Rác thải Thông minh Sử dụng Edge AI và IoT',
    N'Trí tuệ nhân tạo & Smart City',
    N'Giải pháp thùng rác thông minh tự động nhận diện và phân loại rác thải tại nguồn qua camera AI gắn trên Raspberry Pi.',
    '2026-04-15',
    '2026-05-16',
    N'Đang thực hiện'
),
(
    2,
    2,
    4,
    NULL,
    N'Ứng dụng Di động Định vị và Tối ưu Lộ trình Xe buýt Sinh viên HUIT',
    N'Công nghệ Di động & GIS',
    N'Ứng dụng theo dõi xe buýt trường theo thời gian thực và ước tính thời gian đến trạm chính xác.',
    '2026-04-18',
    '2026-05-16',
    N'Đang thực hiện'
);
SET IDENTITY_INSERT DETAI OFF;

-- 24. MÃ QR
SET IDENTITY_INSERT MAQR ON;
INSERT INTO MAQR (MaQR, MaHD, MaQRCode, TGMo, TGHetHan, TrangThai) VALUES
(1, 1, 'QR_CODECHALLENGE_2026_CHECKIN', '2026-03-22 07:00:00 +07:00', '2026-03-22 18:00:00 +07:00', N'Hết hạn'),
(2, 2, 'QR_SEMINAR_GENAI_2026_CHECKIN',  '2026-04-12 07:30:00 +07:00', '2026-04-12 12:00:00 +07:00', N'Hết hạn'),
(3, 4, 'QR_SEMINAR_KHOALUAN_2026_CHECKIN','2026-06-20 07:30:00 +07:00', '2026-06-20 12:00:00 +07:00', N'Hoạt động');
SET IDENTITY_INSERT MAQR OFF;

-- 25. ĐIỂM DANH
SET IDENTITY_INSERT DIEMDANH ON;
INSERT INTO DIEMDANH (MaDD, MaQR, MaDK, BatDauLuc, KetThucLuc, TrangThai) VALUES
(1, 2, 7, '2026-04-12 08:15:00', '2026-04-12 11:30:00', N'Đã xác nhận'),
(2, 2, 8, '2026-04-12 08:20:00', '2026-04-12 11:28:00', N'Đã xác nhận'),
(3, 2, 9, '2026-04-12 08:22:00', '2026-04-12 11:30:00', N'Đã xác nhận');
SET IDENTITY_INSERT DIEMDANH OFF;

-- 26. GIẢI THƯỞNG
SET IDENTITY_INSERT GIAITHUONG ON;
INSERT INTO GIAITHUONG (MaGT, MaCThi, TenGT, CapGiai) VALUES
(1, 1, N'Giải Nhất HUIT Code Challenge 2026', N'Giải Nhất'),
(2, 1, N'Giải Nhì HUIT Code Challenge 2026',  N'Giải Nhì'),
(3, 1, N'Giải Ba HUIT Code Challenge 2026',   N'Giải Ba'),
(4, 1, N'Giải Khuyến khích HUIT Code Challenge 2026', N'Giải Khuyến khích'),
(5, 2, N'Giải Ý tưởng Đổi mới Sáng tạo Xuất sắc', N'Giải Đặc biệt');
SET IDENTITY_INSERT GIAITHUONG OFF;

-- 27. KẾT QUẢ HỌC THUẬT
SET IDENTITY_INSERT KETQUAHOCTHUAT ON;
INSERT INTO KETQUAHOCTHUAT (
    MaKQ, MaCThi, MaDoi, MaDK, MaGT, LoaiKQ, XepHang, Diem, GhiChu, TrangThai
) VALUES
(
    1,
    1,
    1,
    NULL,
    1,
    N'Giải Nhất',
    1,
    97.50,
    N'Đội ByteCrafters giải trọn vẹn 5/5 bài toán với thuật toán tối ưu thời gian thực thi tốt nhất.',
    N'Đã công bố'
),
(
    2,
    1,
    2,
    NULL,
    2,
    N'Giải Nhì',
    2,
    88.00,
    N'Đội DevTitans hoàn thành xuất sắc 4/5 bài toán thuật toán.',
    N'Đã công bố'
);
SET IDENTITY_INSERT KETQUAHOCTHUAT OFF;

-- 28. ĐIỂM RÈN LUYỆN
SET IDENTITY_INSERT DIEMRENLUYEN ON;
INSERT INTO DIEMRENLUYEN (
    MaDiem, MaSV, MaHD, HocKy, NamHoc, SoDiem, LyDo, TrangThai, NguoiGhi, GhiLuc
) VALUES
(1, 1, 1, N'Học kỳ 2', '2025-2026', 10.00, N'Đạt Giải Nhất cuộc thi Olympic Tin học - HUIT Code Challenge 2026 cấp Khoa', N'Đã xác nhận', 2, '2026-03-25 09:00:00 +07:00'),
(2, 2, 1, N'Học kỳ 2', '2025-2026', 10.00, N'Đạt Giải Nhất cuộc thi Olympic Tin học - HUIT Code Challenge 2026 cấp Khoa', N'Đã xác nhận', 2, '2026-03-25 09:00:00 +07:00'),
(3, 3, 1, N'Học kỳ 2', '2025-2026',  8.00, N'Đạt Giải Nhì cuộc thi Olympic Tin học - HUIT Code Challenge 2026 cấp Khoa',  N'Đã xác nhận', 2, '2026-03-25 09:00:00 +07:00'),
(4, 4, 1, N'Học kỳ 2', '2025-2026',  8.00, N'Đạt Giải Nhì cuộc thi Olympic Tin học - HUIT Code Challenge 2026 cấp Khoa',  N'Đã xác nhận', 2, '2026-03-25 09:00:00 +07:00'),
(5, 1, 2, N'Học kỳ 2', '2025-2026',  4.00, N'Tham dự và quét QR điểm danh đầy đủ buổi Seminar GenAI & Cloud Computing',    N'Đã xác nhận', 2, '2026-04-13 10:00:00 +07:00'),
(6, 2, 2, N'Học kỳ 2', '2025-2026',  4.00, N'Tham dự và quét QR điểm danh đầy đủ buổi Seminar GenAI & Cloud Computing',    N'Đã xác nhận', 2, '2026-04-13 10:00:00 +07:00'),
(7, 6, 2, N'Học kỳ 2', '2025-2026',  4.00, N'Tham dự và quét QR điểm danh đầy đủ buổi Seminar GenAI & Cloud Computing',    N'Đã xác nhận', 2, '2026-04-13 10:00:00 +07:00'),
(8, 5, 1, N'Học kỳ 2', '2025-2026',  5.00, N'Tham gia lực lượng cộng tác viên hỗ trợ kỹ thuật và tổ chức cuộc thi HUIT Code Challenge', N'Đã xác nhận', 2, '2026-03-25 09:30:00 +07:00'),
(9, 6, 1, N'Học kỳ 2', '2025-2026',  2.00, N'Tham gia cổ vũ sôi nổi tại vòng Chung kết Cuộc thi HUIT Code Challenge 2026', N'Đã xác nhận', 2, '2026-03-25 09:30:00 +07:00');
SET IDENTITY_INSERT DIEMRENLUYEN OFF;

-- 29. HỒ SƠ QUYẾT TOÁN
SET IDENTITY_INSERT HOSOQUYETTOAN ON;
INSERT INTO HOSOQUYETTOAN (MaHS, MaHD, NguoiLap, NguoiDuyet, TrangThai, NgayLap, NgayDuyet, GhiChu) VALUES
(
    1,
    1,
    2,
    1,
    N'Đã duyệt',
    '2026-03-28 08:30:00 +07:00',
    '2026-03-31 16:00:00 +07:00',
    N'Hồ sơ quyết toán Cuộc thi HUIT Code Challenge 2026 đầy đủ chứng từ hóa đơn đỏ, biên bản nghiệm thu và danh sách ký nhận tiền thưởng.'
),
(
    2,
    2,
    2,
    1,
    N'Đã duyệt',
    '2026-04-16 09:00:00 +07:00',
    '2026-04-18 15:30:00 +07:00',
    N'Quyết toán thù lao báo cáo viên và chi phí tiệc trà seminar GenAI.'
);
SET IDENTITY_INSERT HOSOQUYETTOAN OFF;

-- 30. CHI PHÍ THỰC TẾ
SET IDENTITY_INSERT CHIPHITHUCTE ON;
INSERT INTO CHIPHITHUCTE (MaCP, MaHD, MaHS, NoiDung, SoTien, NgChi, NguoiGhi, ChungTu) VALUES
(
    1,
    1,
    1,
    N'In ấn backdrop sân khấu, standee hội trường và phôi giấy khen giải thưởng',
    2800000.00,
    '2026-03-20',
    2,
    N'[{"so_hd": "HD00248", "ngay": "2026-03-20", "don_vi": "Công ty In ấn & Quảng cáo Sài Gòn", "so_tien": 2800000}]'
),
(
    2,
    1,
    1,
    N'Tiền thưởng giải thưởng Cuộc thi HUIT Code Challenge 2026 (Nhất, Nhì, Ba, Khuyến khích)',
    10500000.00,
    '2026-03-22',
    2,
    N'[{"so_ct": "PC00342", "ngay": "2026-03-22", "noi_dung": "Phiếu chi tiền mặt kèm danh sách ký nhận tiền giải thưởng của các đội thi"}]'
),
(
    3,
    1,
    1,
    N'Nước khoáng đóng chai và bánh ngọt giải lao cho thí sinh và Ban giám khảo',
    1650000.00,
    '2026-03-22',
    2,
    N'[{"so_hd": "HD7721", "ngay": "2026-03-22", "don_vi": "Siêu thị Co.opmart Thắng Lợi", "so_tien": 1650000}]'
),
(
    4,
    1,
    1,
    N'Văn phòng phẩm, thẻ đeo thí sinh và tài liệu thi',
    1200000.00,
    '2026-03-21',
    2,
    N'[{"so_hd": "HD3391", "ngay": "2026-03-21", "don_vi": "Nhà sách Fahasa", "so_tien": 1200000}]'
),
(
    5,
    2,
    2,
    N'Thù lao báo cáo viên chuyên gia Seminar GenAI & Cloud Computing',
    3500000.00,
    '2026-04-12',
    2,
    N'[{"so_ct": "PC00388", "ngay": "2026-04-12", "noi_dung": "Phiếu chi thù lao diễn giả kèm hợp đồng và biên bản báo cáo khoa học"}]'
),
(
    6,
    2,
    2,
    N'Tiệc trà teabreak giữa giờ cho đại biểu, giảng viên và sinh viên',
    1700000.00,
    '2026-04-12',
    2,
    N'[{"so_hd": "HD8890", "ngay": "2026-04-12", "don_vi": "Công ty TNHH Bánh Givral", "so_tien": 1700000}]'
);
SET IDENTITY_INSERT CHIPHITHUCTE OFF;

-- 31. PHIÊN ĐĂNG NHẬP
INSERT INTO PHIENDANGNHAP (MaPhien, MaBamToken, MaTK, PBMatKhau, TaoLuc, HetHanLuc) VALUES
(
    'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    1,
    0,
    SYSDATETIMEOFFSET(),
    DATEADD(HOUR, 8, SYSDATETIMEOFFSET())
);

COMMIT TRANSACTION;
GO

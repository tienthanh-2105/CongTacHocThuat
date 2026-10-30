IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'QL_CongTacHocThuat')
BEGIN
    CREATE DATABASE QL_CongTacHocThuat;
END
GO

USE QL_CongTacHocThuat;
GO

-- =============================================================================
-- XÓA RÀNG BUỘC VÀ BẢNG CŨ NẾU ĐÃ TỒN TẠI (ĐỂ CHẠY LẠI MỚI TỪ ĐẦU)
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
----- 1. KHOA
CREATE TABLE KHOA (
    MaKhoa INT IDENTITY(1,1) PRIMARY KEY,
    TenKhoa NVARCHAR(100) NOT NULL UNIQUE
)

----- 2. BỘ MÔN
CREATE TABLE BOMON (
    MaBM INT IDENTITY(1,1) PRIMARY KEY,
    MaKhoa INT NOT NULL,
    TenBM NVARCHAR(150) NOT NULL,

    CONSTRAINT FK_BOMON_KHOA FOREIGN KEY (MaKhoa) REFERENCES KHOA(MaKhoa) ON UPDATE CASCADE ON DELETE NO ACTION,
    CONSTRAINT UQ_BOMON_KHOA UNIQUE (MaKhoa, TenBM)
)

----- 3. LỚP
CREATE TABLE LOP (
    MaLop INT IDENTITY(1,1) PRIMARY KEY,
	MaKhoa INT NOT NULL,
    TenLop NVARCHAR(100) NOT NULL,
    KhoaHoc NVARCHAR(50),
    
    CONSTRAINT FK_LOP_KHOA FOREIGN KEY (MaKhoa) REFERENCES KHOA(MaKhoa) ON UPDATE CASCADE ON DELETE NO ACTION,
    CONSTRAINT UQ_LOP_KHOA UNIQUE (TenLop, MaKhoa)
)

----- 4. NGƯỜI DÙNG
CREATE TABLE NGUOIDUNG (
    MaNgDung INT IDENTITY(1,1) PRIMARY KEY,
    HoTen NVARCHAR(100) NOT NULL,
    Email VARCHAR(150) UNIQUE,
    SDT VARCHAR(11),
    NgaySinh DATE,
    GioiTinh NVARCHAR(5),
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Hoạt động',

    CONSTRAINT CK_NGDUNG_TRANGTHAI CHECK (TrangThai IN (N'Hoạt động', N'Khóa', N'Ngừng hoạt động'))
)

----- 5. VAI TRÒ
CREATE TABLE VAITRO (
    MaVaiTro INT IDENTITY(1,1) PRIMARY KEY,
    TenVaiTro NVARCHAR(100) NOT NULL UNIQUE
)

----- 6. TÀI KHOẢN
CREATE TABLE TAIKHOAN (
    MaTK INT IDENTITY(1,1) PRIMARY KEY,
    MaNgDung INT UNIQUE,
    MaVaiTro INT NOT NULL,
    TenDangNhap VARCHAR(100) NOT NULL UNIQUE,
    MatKhau VARCHAR(255) NOT NULL,
    PBMatKhau INT NOT NULL DEFAULT 0,
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Hoạt động',

    CONSTRAINT FK_TAIKHOAN_NGUOIDUNG FOREIGN KEY (MaNgDung) REFERENCES NGUOIDUNG(MaNgDung) ON UPDATE CASCADE ON DELETE NO ACTION,
    CONSTRAINT FK_TAIKHOAN_VAITRO FOREIGN KEY (MaVaiTro) REFERENCES VAITRO(MaVaiTro) ON UPDATE CASCADE ON DELETE NO ACTION,
    CONSTRAINT CK_TAIKHOAN_TRANGTHAI CHECK (TrangThai IN (N'Hoạt động', N'Khóa', N'Ngừng hoạt động'))
)


----- 7. PHÂN QUYỀN
CREATE TABLE PHANQUYEN (
    MaQuyen INT IDENTITY(1,1) PRIMARY KEY,
    TenQuyen NVARCHAR(100) NOT NULL UNIQUE,
    MoTa NVARCHAR(MAX)
)

----- 8. GÁN QUYỀN CHO VAI TRÒ
CREATE TABLE VAITRO_QUYEN (
    MaVT INT NOT NULL,
    MaQuyen INT NOT NULL,
    PRIMARY KEY (MaVT, MaQuyen),
    CONSTRAINT FK_VTQUYEN_VAITRO FOREIGN KEY (MaVT) REFERENCES VAITRO(MaVaiTro) ON DELETE CASCADE,
    CONSTRAINT FK_VTQUYEN_QUYEN FOREIGN KEY (MaQuyen) REFERENCES PHANQUYEN(MaQuyen) ON DELETE CASCADE
)

----- 9. SINH VIÊN
CREATE TABLE SINHVIEN (
    MaSV INT IDENTITY(1,1) PRIMARY KEY,
    MaNgDung INT UNIQUE,
    MaLop INT NOT NULL,
    MSSV VARCHAR(20) UNIQUE,
    CONSTRAINT FK_SINHVIEN_NGUOIDUNG FOREIGN KEY (MaNgDung) REFERENCES NGUOIDUNG(MaNgDung) ON UPDATE CASCADE ON DELETE NO ACTION,
    CONSTRAINT FK_SINHVIEN_LOP FOREIGN KEY (MaLop) REFERENCES LOP(MaLop) ON UPDATE CASCADE ON DELETE NO ACTION
)

----- 10. GIẢNG VIÊN
CREATE TABLE GIANGVIEN (
    MaGV INT IDENTITY(1,1) PRIMARY KEY,
    MaNgDung INT UNIQUE,
    HocVi NVARCHAR(100),
    MaBM INT,

    CONSTRAINT FK_GIANGVIEN_NGDUNG FOREIGN KEY (MaNgDung) REFERENCES NGUOIDUNG(MaNgDung) ON UPDATE CASCADE ON DELETE NO ACTION,
    CONSTRAINT FK_GIANGVIEN_BOMON FOREIGN KEY (MaBM) REFERENCES BOMON(MaBM) ON UPDATE CASCADE ON DELETE SET NULL
)

----- 11. CÁN BỘ KHOA
CREATE TABLE CANBOKHOA (
    MaCanBo INT IDENTITY(1,1) PRIMARY KEY,
    MaNgDung INT UNIQUE,
    MaKhoa INT NOT NULL,
    ChucVu NVARCHAR(150),

    CONSTRAINT FK_CANBO_NGDUNG FOREIGN KEY (MaNgDung) REFERENCES NGUOIDUNG(MaNgDung) ON UPDATE CASCADE ON DELETE NO ACTION,
    CONSTRAINT FK_CANBO_KHOA FOREIGN KEY (MaKhoa) REFERENCES KHOA(MaKhoa) ON UPDATE CASCADE ON DELETE NO ACTION
)

----- 12. QUẢN TRỊ VIÊN
CREATE TABLE QUANTRIVIEN (
    MaQuanTri INT IDENTITY(1,1) PRIMARY KEY,
    MaNgDung INT UNIQUE,
    MoTa NVARCHAR(MAX),

    CONSTRAINT FK_QUANTRI_NGDUNG FOREIGN KEY (MaNgDung) REFERENCES NGUOIDUNG(MaNgDung) ON UPDATE CASCADE ON DELETE NO ACTION
)

----- 13. KẾ HOẠCH HỌC THUẬT
CREATE TABLE KEHOACHHOCTHUAT (
    MaKeHoach INT IDENTITY(1,1) PRIMARY KEY,
	MaKhoa INT NOT NULL,
    SoKeHoach NVARCHAR(50) NOT NULL,
    TenKeHoach NVARCHAR(200) NOT NULL,
    NgayBanHanh DATE NULL,
	NamHoc VARCHAR(20) NULL,
    CanCu NVARCHAR(MAX) NULL,
    MucDich NVARCHAR(MAX) NULL,
    YeuCau NVARCHAR(MAX) NULL,
    NoiDung NVARCHAR(MAX) NULL,
    NgPhuTrach INT NULL,
    LoaiKeHoach NVARCHAR(20) NOT NULL DEFAULT 'Khoa',
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Dự thảo',
    NguoiDuyet INT NULL,
    NgayDuyet DATETIMEOFFSET NULL,
    LichSuDuyet NVARCHAR(MAX) NOT NULL DEFAULT N'[]',

    CONSTRAINT FK_KEHOACH_KHOA FOREIGN KEY (MaKhoa) REFERENCES KHOA(MaKhoa) ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT FK_KEHOACH_PHUTRACH FOREIGN KEY (NgPhuTrach) REFERENCES CANBOKHOA(MaCanBo) ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT FK_KEHOACH_NGUOIDUYET FOREIGN KEY (NguoiDuyet) REFERENCES TAIKHOAN(MaTK) ON UPDATE NO ACTION ON DELETE NO ACTION,

    CONSTRAINT CK_KEHOACH_TRANGTHAI CHECK (TrangThai IN (N'Dự thảo', N'Chờ duyệt', N'Đã duyệt')),
    CONSTRAINT CK_KEHOACH_LICHSU_JSON CHECK (ISJSON(LichSuDuyet) = 1)
)

----- 14. HOẠT ĐỘNG HỌC THUẬT
CREATE TABLE HOATDONGHOCTHUAT (
    MaHD INT IDENTITY(1,1) PRIMARY KEY,
    MaBM INT NULL,
    TenHoatDong NVARCHAR(250) NOT NULL,          
    LoaiHoatDong NVARCHAR(50) NOT NULL,          
    NoiDung NVARCHAR(MAX) NULL,                  
    TgDuKien DATE NULL,                          
    DiaDiem NVARCHAR(255) NULL,                 
    TienDoTH NVARCHAR(225) NULL,          
    DoiTuongThamDu NVARCHAR(MAX) NULL,          
    SLSVDuKien INT NULL DEFAULT 0,    
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Dự thảo',
    NguoiLap INT NULL,
    CONSTRAINT FK_HD_BOMON FOREIGN KEY (MaBM) REFERENCES BOMON(MaBM) ON DELETE SET NULL,
    CONSTRAINT FK_HD_NGUOILAP FOREIGN KEY (NguoiLap) REFERENCES TAIKHOAN(MaTK) ON DELETE SET NULL,
    CONSTRAINT CK_HD_LOAI CHECK (LoaiHoatDong IN (N'Cuộc thi', N'Seminar', N'Workshop', N'Tọa đàm'))
)

----- 15. BẢNG BAN CHỈ ĐẠO
CREATE TABLE BANCHIDAO (
    MaChiDao INT IDENTITY(1,1) PRIMARY KEY,
    MaHD INT NOT NULL,                          
    MaNgDung INT NULL,                          
    HoTen NVARCHAR(100) NOT NULL,               
    HocVi NVARCHAR(100) NULL,                   
    ChucDanh NVARCHAR(150) NULL,                
    ChucVu NVARCHAR(100) NULL,                  
    CONSTRAINT FK_BCD_HD FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE CASCADE,
    CONSTRAINT FK_BCD_NGDUNG FOREIGN KEY (MaNgDung) REFERENCES NGUOIDUNG(MaNgDung) ON DELETE SET NULL,
	CONSTRAINT CK_HV_CHIDAO CHECK (HocVi IN (N'Thạc sĩ', N'Tiến sĩ'))
)

----- 16. BAN TỔ CHỨC
CREATE TABLE BANTOCHUC (
    MaBanTC INT IDENTITY(1,1) PRIMARY KEY,
    MaHD INT NOT NULL,                          
    MaNgDung INT NULL,                          
    HoTen NVARCHAR(100) NOT NULL,               
    HocVi NVARCHAR(100) NULL,                   
    ChucDanh NVARCHAR(150) NULL,                
    ChucVu NVARCHAR(100) NULL,                  
    NhiemVu NVARCHAR(MAX) NULL,                 
    CONSTRAINT FK_BTC_HD FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE CASCADE,
    CONSTRAINT FK_BTC_NGDUNG FOREIGN KEY (MaNgDung) REFERENCES NGUOIDUNG(MaNgDung) ON DELETE SET NULL,
	CONSTRAINT CK_HV_TOCHUC CHECK (HocVi IN (N'Thạc sĩ', N'Tiến sĩ'))
)

----- 17. BAN HỖ TRỢ
CREATE TABLE BANHOTRO (
    MaBanHoTro INT IDENTITY(1,1) PRIMARY KEY,
    MaHD INT NOT NULL,                          
    MaNgDung INT NULL,                          
    HoTen NVARCHAR(100) NOT NULL,               
    HocVi NVARCHAR(100) NULL,                   
    ChucDanh NVARCHAR(150) NULL,                
    ChucVu NVARCHAR(100) NULL,                  
    CONSTRAINT FK_BHT_HD FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE CASCADE,
    CONSTRAINT FK_BHT_NGDUNG FOREIGN KEY (MaNgDung) REFERENCES NGUOIDUNG(MaNgDung) ON DELETE SET NULL,
	CONSTRAINT CK_HV_HOTRO CHECK (HocVi IN (N'Thạc sĩ', N'Tiến sĩ'))
)

----- 18. BẢNG SEMINAR
CREATE TABLE SEMINAR (
    MaSeminar INT IDENTITY(1,1) PRIMARY KEY,
	SoKeHoach NVARCHAR(50) NULL,
    MaHD INT UNIQUE NOT NULL,                   
    ChuDe NVARCHAR(250) NOT NULL,
	CanCu NVARCHAR(250) NOT NULL,
    MucDich NVARCHAR(MAX) NULL,                 
    YeuCau NVARCHAR(MAX) NULL,                  
    ThoiGian DATETIME2 NULL,
    DiaDiem NVARCHAR(255) NULL,   
	SLSVDuKien INT NULL,
    DSChiDao NVARCHAR(200) NULL,                
    DSToChuc NVARCHAR(200) NULL, 


    CONSTRAINT FK_SEMINAR_HOATDG FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON UPDATE CASCADE ON DELETE CASCADE
)

----- 19. BẢNG CHỦ ĐỀ BÁO CÁO TRONG SEMINAR
CREATE TABLE CHUDE (
    MaChuDe INT IDENTITY(1,1) PRIMARY KEY,
    MaSeminar INT NOT NULL,
    STT INT NULL,                               
    TenChuDe NVARCHAR(250) NOT NULL,            
    TgBatDau TIME NULL,
	TgKetThuc TIME NULL,
    DienGia NVARCHAR(150) NOT NULL,                                 
    NoiDungKhac NVARCHAR(MAX) NULL,     
	
    CONSTRAINT FK_CHUDE_SEMINAR FOREIGN KEY (MaSeminar) REFERENCES SEMINAR(MaSeminar) ON DELETE CASCADE,
	CONSTRAINT CK_TG_CHUDE CHECK (TgKetThuc > TgBatDau)
)

----- 20. BẢNG PHÂN CÔNG THỰC HIỆN CÔNG VIỆC TRONG SEMINAR
CREATE TABLE PHANCONGTHUCHIEN (
    MaPhanCong INT IDENTITY(1,1) PRIMARY KEY,
    MaSeminar INT NOT NULL,
    STT INT NULL,                               
    NoiDung NVARCHAR(MAX) NOT NULL,             
    ThoiGian DATE NULL,                
    MaNgDung INT NULL,                          
    HoTen NVARCHAR(150) NOT NULL,               

    CONSTRAINT FK_PHANCONG_SEMINAR FOREIGN KEY (MaSeminar) REFERENCES SEMINAR(MaSeminar) ON DELETE CASCADE,
    CONSTRAINT FK_PHANCONG_NGDUNG FOREIGN KEY (MaNgDung) REFERENCES NGUOIDUNG(MaNgDung) ON DELETE SET NULL
)

----- 21. CUỘC THI
CREATE TABLE CUOCTHI (
    MaCThi INT IDENTITY(1,1) PRIMARY KEY,
    MaHD INT NOT NULL,                          
    SoKeHoach NVARCHAR(50) NULL,                
    TenCuocThi NVARCHAR(250) NOT NULL,          
    VongThi NVARCHAR(50) NOT NULL DEFAULT N'Vòng sơ loại', 
    CanCu NVARCHAR(MAX) NULL,                   
    MucDich NVARCHAR(MAX) NULL,                 
    YeuCau NVARCHAR(MAX) NULL,                  
    ThoiGian DATETIME2 NULL,                
    DiaDiem NVARCHAR(255) NULL,                 
    DoiTuongTG NVARCHAR(MAX) NULL,         
    SLSVDuKien INT NULL DEFAULT 0,    
	
    CONSTRAINT FK_CUOCTHI_HD FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE CASCADE
)

----- 22. TẠO BẢNG BAN GIÁM KHẢO (CHUNG CỦA CUỘC THI)
CREATE TABLE BANGIAMKHAO (
    MaBGK INT IDENTITY(1,1) PRIMARY KEY,
    MaCThi INT NOT NULL,                        
    MaNgDung INT NULL,                          
    HoTen NVARCHAR(100) NOT NULL,               
    HocVi NVARCHAR(100) NULL,                   
    ChucDanh NVARCHAR(150) NULL,                
    ChucVu NVARCHAR(100) NULL,                  

    CONSTRAINT FK_BGK_CUOCTHI FOREIGN KEY (MaCThi) REFERENCES CUOCTHI(MaCThi) ON DELETE CASCADE,
    CONSTRAINT FK_BGK_NGDUNG FOREIGN KEY (MaNgDung) REFERENCES NGUOIDUNG(MaNgDung) ON DELETE SET NULL
)

----- 23. BẢNG TỔ CHỨC CUỘC THI
CREATE TABLE TOCHUCCUOCTHI (
    MaToChuc INT IDENTITY(1,1) PRIMARY KEY,
    MaCThi INT NOT NULL,                        
    STT INT NULL,                               
    NoiDung NVARCHAR(255) NOT NULL,             
    TGBatDau TIME NULL,           
    TGKetThuc TIME NULL,        
	NgThucHien NVARCHAR(150) NULL,           

    CONSTRAINT FK_TOCHUC_CUOCTHI FOREIGN KEY (MaCThi) REFERENCES CUOCTHI(MaCThi) ON DELETE CASCADE
)

----- 24. BẢNG TIỂU BAN CHẤM THI
CREATE TABLE TIEUBAN (
    MaTieuBan INT IDENTITY(1,1) PRIMARY KEY,
    MaCThi INT NOT NULL,                        
    TenTieuBan NVARCHAR(100) NOT NULL,          
    PhongCham NVARCHAR(100) NULL,               
    GhiChu NVARCHAR(MAX) NULL,

    CONSTRAINT FK_TIEUBAN_CUOCTHI FOREIGN KEY (MaCThi) REFERENCES CUOCTHI(MaCThi) ON DELETE CASCADE
)

----- 25. GIÁM KHẢO THUỘC TỪNG TIỂU BAN
CREATE TABLE GIAMKHAO_TIEUBAN (
    MaGK_TB INT IDENTITY(1,1) PRIMARY KEY,
    MaTieuBan INT NOT NULL,                     
    MaBGK INT NULL,                             
    HoTen NVARCHAR(100) NOT NULL,               
    HocVi NVARCHAR(100) NULL,                   
    ChucVu NVARCHAR(100) NULL,                 

    CONSTRAINT FK_GKTB_TIEUBAN FOREIGN KEY (MaTieuBan) REFERENCES TIEUBAN(MaTieuBan) ON DELETE CASCADE,
    CONSTRAINT FK_GKTB_BGK FOREIGN KEY (MaBGK) REFERENCES BANGIAMKHAO(MaBGK) ON DELETE NO ACTION
)

----- 26. BẢNG ĐỀ TÀI DỰ THI
CREATE TABLE DETAI (
    MaDeTai INT IDENTITY(1,1) PRIMARY KEY,
    MaTieuBan INT NOT NULL,                     
    STT INT NULL,                               
    TenDeTai NVARCHAR(300) NOT NULL,            
    GVHD NVARCHAR(150) NOT NULL,                
    MaGVHD INT NULL,        
    TrangThai NVARCHAR(50) DEFAULT N'Chờ chấm', 

    CONSTRAINT FK_DETAI_TIEUBAN FOREIGN KEY (MaTieuBan) REFERENCES TIEUBAN(MaTieuBan) ON DELETE CASCADE,
    CONSTRAINT FK_DETAI_GVHD FOREIGN KEY (MaGVHD) REFERENCES GIANGVIEN(MaGV) ON DELETE SET NULL
)

----- 27. ĐỘI THI THỰC HIỆN ĐỀ TÀI
CREATE TABLE DOITHI (
    MaDoi INT IDENTITY(1,1) PRIMARY KEY,
    MaCThi INT NOT NULL,                        
    MaDeTai INT NOT NULL UNIQUE,                
    TenDoi NVARCHAR(150) NULL,                  

    CONSTRAINT FK_DOITHI_CUOCTHI FOREIGN KEY (MaCThi) REFERENCES CUOCTHI(MaCThi) ON DELETE CASCADE,
    CONSTRAINT FK_DOITHI_DETAI FOREIGN KEY (MaDeTai) REFERENCES DETAI(MaDeTai) ON DELETE NO ACTION
)

----- 28. BẢNG THÀNH VIÊN ĐỘI THI
CREATE TABLE THANHVIENDOI (
    MaTV INT IDENTITY(1,1) PRIMARY KEY,
    MaDoi INT NOT NULL,                         
    MaSV INT NULL,                              
    HoTen NVARCHAR(100) NOT NULL,               
    VaiTro NVARCHAR(50) NOT NULL DEFAULT N'Thành viên', 

    CONSTRAINT FK_TV_DOITHI FOREIGN KEY (MaDoi) REFERENCES DOITHI(MaDoi) ON DELETE CASCADE,
    CONSTRAINT FK_TV_SINHVIEN FOREIGN KEY (MaSV) REFERENCES SINHVIEN(MaSV) ON DELETE SET NULL
)

----- 29. BẢNG DỰ TRÙ KINH PHÍ
CREATE TABLE DUTRUKINHPHI (
    MaDuTruKP INT IDENTITY(1,1) PRIMARY KEY,
    TenTieuDe NVARCHAR(250) NOT NULL,          
    NamHoc VARCHAR(20) NOT NULL,                
    TongKinhPhi DECIMAL(18,2) NOT NULL DEFAULT 0, 
    NguoiLap INT NOT NULL,
    NgayLap DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    NguoiDuyet INT NULL,
    NgayDuyet DATETIME2 NULL,
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Dự thảo', 

    CONSTRAINT FK_DUTRUKINHPHI_NGUOILAP FOREIGN KEY (NguoiLap) REFERENCES TAIKHOAN(MaTK),
    CONSTRAINT FK_DUTRUKINHPHI_NGUOIDUYET FOREIGN KEY (NguoiDuyet) REFERENCES TAIKHOAN(MaTK),
    CONSTRAINT CK_DUTRU_TRANGTHAI CHECK (TrangThai IN (N'Dự thảo', N'Chờ duyệt', N'Đã duyệt', N'Từ chối'))
)

----- 30. BẢNG CHI TIẾT KINH PHÍ TỪNG HOẠT ĐỘNG 
CREATE TABLE KINHPHIHOATDONG (
    MaKPHD INT IDENTITY(1,1) PRIMARY KEY,
    MaDuTruKP INT NOT NULL,
    MaHD INT NOT NULL,                                                   
    NoiDung NVARCHAR(MAX) NOT NULL,                  
    SoLuong DECIMAL(10,2) NULL,                 
    DonViTinh NVARCHAR(50) NULL,                
    DonGia DECIMAL(18,2) NULL, 
    SoTien DECIMAL(18,2) NOT NULL DEFAULT 0,    
	ThuyetMinh NVARCHAR(500) NULL,
    NguonKinhPhi NVARCHAR(100) NOT NULL DEFAULT N'Kinh phí học thuật', 
    GhiChu NVARCHAR(500) NULL,          
	
    CONSTRAINT FK_CHITIETKINHPHI_DUTRU FOREIGN KEY (MaDuTruKP) REFERENCES DUTRUKINHPHI(MaDuTruKP) ON DELETE CASCADE,
    CONSTRAINT FK_CHITIETKINHPHI_HOATDONG FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE NO ACTION,
    CONSTRAINT CK_CHITIETKINHPHI_SOTIEN CHECK (SoTien >= 0)
)

----- 31. BẢNG KINH PHÍ THỰC TẾ 
CREATE TABLE KINHPHITHUCTE (
    MaChiPhi INT IDENTITY(1,1) PRIMARY KEY,
    MaKPHD INT NOT NULL,      -- FK trỏ tới dòng dự trù tương ứng
    MaHD INT NOT NULL,                          
    NoiDungChi NVARCHAR(250) NOT NULL,          
    SoTienChi DECIMAL(18,2) NOT NULL,           
    NgayChi DATE NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
    NguoiChi INT NOT NULL,                      
    SoHoaDon NVARCHAR(100) NULL,                
    DVCungCap NVARCHAR(200) NULL,            
    GhiChu NVARCHAR(MAX) NULL,

    CONSTRAINT FK_CPTT_CHITIETDUTRU FOREIGN KEY (MaKPHD) REFERENCES KINHPHIHOATDONG(MaKPHD) ON DELETE CASCADE,
    CONSTRAINT FK_CPTT_HOATDONG FOREIGN KEY (MaHD) 
        REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE NO ACTION,
    CONSTRAINT FK_CPTT_NGUOICHI FOREIGN KEY (NguoiChi) 
        REFERENCES TAIKHOAN(MaTK) ON DELETE NO ACTION,
    CONSTRAINT CK_CPTT_SOTIEN CHECK (SoTienChi > 0)
)

GO

--=========== RÀNG BUỘC KINH PHÍ THỰC TẾ KHÔNG ĐƯỢC PHÉP VỰT KINH TẾ DỰ TRÙ  ============
CREATE OR ALTER TRIGGER trg_KiemTraVuotDuTru
ON KINHPHITHUCTE
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    -- Kiểm tra xem có mục chi nào bị vượt ngân sách dự trù không
    IF EXISTS (
        SELECT 1
        FROM (
            -- Tính tổng tiền thực chi cho từng mục (cộng dồn các lần chi)
            SELECT 
                kpt.MaKPHD,
                SUM(kpt.SoTienChi) AS TongThucChi
            FROM KINHPHITHUCTE kpt
            WHERE kpt.MaKPHD IN (SELECT DISTINCT MaKPHD FROM inserted)
            GROUP BY kpt.MaKPHD
        ) thuc_te
        JOIN KINHPHIHOATDONG  dt ON thuc_te.MaKPHD = dt.MaKPHD
        WHERE thuc_te.TongThucChi > dt.SoTien -- VƯỢT QUÁ DỰ TRÙ
    )
    BEGIN
        -- Hủy thao tác và báo lỗi
        ROLLBACK TRANSACTION;
        RAISERROR (N'GIAO DỊCH BỊ TỪ CHỐI: Tổng số tiền thực chi của mục này đã VƯỢT QUÁ số tiền dự trù được BGH duyệt!', 16, 1);
        RETURN;
    END
END;
GO

----- 32. ĐĂNG KÝ THAM GIA HOẠT ĐỘNG / CỔ VŨ
CREATE TABLE DKTHAMGIA (
    MaDK INT IDENTITY(1,1) PRIMARY KEY,
    MaHD INT NOT NULL,
    MaSV INT NOT NULL,
    NgayDK DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    HinhThuc NVARCHAR(30) NOT NULL,
    NguonDK NVARCHAR(30) NOT NULL DEFAULT N'Sinh viên',
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Đã đăng ký',
    DaNhacLuc DATETIMEOFFSET,	 --- "Đã nhắc lúc" thời điểm gửi thông báo nhắc lịch

    CONSTRAINT FK_DANGKY_HOATDG FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE NO ACTION,
    CONSTRAINT FK_DANGKY_SV FOREIGN KEY (MaSV) REFERENCES SINHVIEN(MaSV) ON DELETE NO ACTION,
    CONSTRAINT UQ_DK_SV_HOATDG UNIQUE (MaHD, MaSV),
    CONSTRAINT CK_DK_HINHTHUC CHECK (HinhThuc IN (N'Tham gia', N'Dự thi', N'Cổ vũ')),
    CONSTRAINT CK_DK_NGUON CHECK (NguonDK IN (N'Sinh viên', N'Giảng viên', N'Khoa')),
    CONSTRAINT CK_DK_TRANGTHAI CHECK (TrangThai IN (N'Đã đăng ký', N'Đã hủy'))
)

----- 33. PHÂN CÔNG CỔ VŨ 
CREATE TABLE PHANCONGCOVU (
    MaCoVu INT IDENTITY(1,1) PRIMARY KEY,
    MaHD INT NOT NULL,
    MaLop INT NOT NULL,
    SoLuong INT NOT NULL,
    NhiemVu NVARCHAR(MAX),
    NgayPhCong DATETIME2 DEFAULT SYSDATETIME(),
    LoaiPhanCong NVARCHAR(20) NOT NULL DEFAULT N'Cổ vũ',

    CONSTRAINT FK_COVU_HOATDG FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE NO ACTION,
    CONSTRAINT FK_COVU_LOP FOREIGN KEY (MaLop) REFERENCES LOP(MaLop) ON DELETE NO ACTION,
    CONSTRAINT UQ_COVU_HOATDG_LOP UNIQUE (MaHD, MaLop),
    CONSTRAINT CK_COVU_SL CHECK (SoLuong > 0)
)

----- 34. MÃ QR ĐIỂM DANH
CREATE TABLE MAQR (
    MaQR INT IDENTITY(1,1) PRIMARY KEY,
    MaHD INT NOT NULL,
    MaQRCode VARCHAR(255) NOT NULL UNIQUE,
	LoaiQR NVARCHAR(30) NOT NULL DEFAULT N'CheckIn', 
    ThoiGianMo DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    TGHetHan DATETIMEOFFSET NOT NULL,
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Hoạt động',

    CONSTRAINT FK_MAQR_HOATDONG FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE CASCADE,
    CONSTRAINT CK_MAQR_THOIGIAN CHECK (TGHetHan > ThoiGianMo),
    CONSTRAINT CK_MAQR_TRANGTHAI CHECK (TrangThai IN (N'Hoạt động', N'Hết hạn'))
)

----- 35. ĐIỂM DANH MOBILE
CREATE TABLE DIEMDANH (
    MaDD INT IDENTITY(1,1) PRIMARY KEY,
    MaQR INT NOT NULL,
    MaDK INT NOT NULL,
    BatDauLuc DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    KetThucLuc DATETIME2,
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Đã điểm danh',

    CONSTRAINT FK_DIEMDANH_QR FOREIGN KEY (MaQR) REFERENCES MAQR(MaQR) ON DELETE NO ACTION,
    CONSTRAINT FK_DIEMDANH_DANGKY FOREIGN KEY (MaDK) REFERENCES DKTHAMGIA(MaDK) ON DELETE NO ACTION,
    CONSTRAINT UQ_DIEMDANH_DANGKY UNIQUE (MaDK, MaQR),
    CONSTRAINT CK_DIEMDANH_TRANGTHAI CHECK (TrangThai IN (N'Đã điểm danh', N'Chưa điểm danh'))
)

----- 36. ĐIỂM RÈN LUYỆN
CREATE TABLE DIEMRENLUYEN (
    MaDRL INT IDENTITY(1,1) PRIMARY KEY,
    MaSV INT NOT NULL,
    MaHD INT NOT NULL,
    HocKy NVARCHAR(30) NOT NULL,
    NamHoc VARCHAR(20) NOT NULL,
    SoDiem INT NOT NULL,
    LyDo NVARCHAR(MAX),
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Chờ xác nhận',
    MaDiemGoc INT NULL,
	NgayGhi DATETIME2 NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT FK_DRL_SINHVIEN FOREIGN KEY (MaSV) REFERENCES SINHVIEN(MaSV) ON DELETE NO ACTION,
    CONSTRAINT FK_DRL_HOATDONG FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE NO ACTION,
    CONSTRAINT CK_DRL_SODIEM CHECK (SoDiem > 0),
    CONSTRAINT CK_DRL_TRANGTHAI CHECK (TrangThai IN (N'Chờ xác nhận', N'Đã xác nhận', N'Đã điều chỉnh', N'Từ chối'))
)

----- 37. GIẢI THƯỞNG CUỘC THI
CREATE TABLE GIAITHUONG (
    MaGT INT IDENTITY(1,1) PRIMARY KEY,
    MaCThi INT NOT NULL,
    TenGT NVARCHAR(150) NOT NULL,
	TienThuong DECIMAL(18,2) NOT NULL DEFAULT 0,
    SLGiai INT NOT NULL DEFAULT 1,

    CONSTRAINT FK_GIAITHUONG_CUOCTHI FOREIGN KEY (MaCThi) REFERENCES CUOCTHI(MaCThi) ON DELETE CASCADE
)

----- 38. KẾT QUẢ HỌC THUẬT
CREATE TABLE KETQUAHOCTHUAT (
    MaKQ INT IDENTITY(1,1) PRIMARY KEY,
    MaCThi INT NOT NULL,
    MaDoi INT NOT NULL,
    MaGT INT NULL,                              
    DiemSo NUMERIC(5,2) NULL,                   
    XepHang INT NULL,                           
    GhiChu NVARCHAR(MAX) NULL,

    CONSTRAINT FK_KQ_CUOCTHI FOREIGN KEY (MaCThi) REFERENCES CUOCTHI(MaCThi),
    CONSTRAINT FK_KQ_DOI FOREIGN KEY (MaDoi) REFERENCES DOITHI(MaDoi),
    CONSTRAINT FK_KQ_GT FOREIGN KEY (MaGT) REFERENCES GIAITHUONG(MaGT)
)

----- 39. HỒ SƠ QUYẾT TOÁN
CREATE TABLE HOSOQUYETTOAN (
    MaHS INT IDENTITY(1,1) PRIMARY KEY,
    MaHD INT NOT NULL,
    NguoiLap INT NOT NULL,
    NguoiDuyet INT NULL,
    TrangThai NVARCHAR(30) NOT NULL DEFAULT N'Dự thảo',
    NgayLap DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    NgayDuyet DATETIMEOFFSET NULL,
    GhiChu NVARCHAR(MAX),

    CONSTRAINT FK_HSQT_HOATDONG FOREIGN KEY (MaHD) REFERENCES HOATDONGHOCTHUAT(MaHD) ON DELETE NO ACTION,
    CONSTRAINT FK_HSQT_NGUOILAP FOREIGN KEY (NguoiLap) REFERENCES TAIKHOAN(MaTK) ON DELETE NO ACTION,
    CONSTRAINT FK_HSQT_NGUOIDUYET FOREIGN KEY (NguoiDuyet) REFERENCES TAIKHOAN(MaTK) ON DELETE NO ACTION,
    CONSTRAINT CK_HSQT_TRANGTHAI CHECK (TrangThai IN (N'Dự thảo', N'Chờ duyệt', N'Đã duyệt', N'Từ chối'))
)

----- 40. PHIÊN ĐĂNG NHẬP
CREATE TABLE PHIENDANGNHAP (
    MaPhien UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    MaBamToken CHAR(64) NOT NULL UNIQUE,
    MaTK INT NOT NULL,
    PBMatKhau INT NOT NULL,
    TaoLuc DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    HetHanLuc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_PHIEN_TAIKHOAN FOREIGN KEY (MaTK) REFERENCES TAIKHOAN(MaTK) ON DELETE CASCADE
)


-- =============================================================================
-- ================  RÀNG BUỘC MẬT KHẨU (>= 12 ký tự, có chữ cái và chữ số)  ===
-- Mật khẩu được băm trước khi lưu nên KHÔNG thể dùng CHECK trên cột MatKhau.
-- Việc kiểm tra thực hiện trên mật khẩu gốc, qua hàm và 2 thủ tục dưới đây.
-- Hãy tạo / đổi mật khẩu bằng sp_TaoTaiKhoan và sp_DoiMatKhau.
-- =============================================================================
GO
CREATE OR ALTER FUNCTION dbo.fn_KiemTraMatKhau (@MatKhau VARCHAR(100))
RETURNS BIT
AS
BEGIN
    DECLARE @HopLe BIT = 0;
    IF @MatKhau IS NOT NULL
       AND LEN(@MatKhau) >= 12                                              -- tối thiểu 12 ký tự
       AND PATINDEX('%[A-Za-z]%', @MatKhau COLLATE Latin1_General_BIN) > 0  -- có chữ cái
       AND PATINDEX('%[0-9]%',    @MatKhau COLLATE Latin1_General_BIN) > 0  -- có chữ số
        SET @HopLe = 1;
    RETURN @HopLe;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_TaoTaiKhoan
    @MaNgDung INT,
    @MaVaiTro INT,
    @TenDangNhap VARCHAR(100),
    @MatKhau VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.fn_KiemTraMatKhau(@MatKhau) = 0
        THROW 50001, N'Mật khẩu phải có ít nhất 12 ký tự, gồm cả chữ cái và chữ số.', 1;

    INSERT INTO TAIKHOAN (MaNgDung, MaVaiTro, TenDangNhap, MatKhau)
    VALUES (@MaNgDung, @MaVaiTro, @TenDangNhap, CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', @MatKhau), 2));

    SELECT SCOPE_IDENTITY() AS MaTK;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_DoiMatKhau
    @MaTK INT,
    @MatKhauMoi VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    IF dbo.fn_KiemTraMatKhau(@MatKhauMoi) = 0
        THROW 50001, N'Mật khẩu phải có ít nhất 12 ký tự, gồm cả chữ cái và chữ số.', 1;

    UPDATE TAIKHOAN
    SET MatKhau = CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', @MatKhauMoi), 2),
        PBMatKhau = PBMatKhau + 1      -- tăng phiên bản mật khẩu để vô hiệu các phiên cũ
    WHERE MaTK = @MaTK;

    IF @@ROWCOUNT = 0
        THROW 50002, N'Không tìm thấy tài khoản.', 1;
END
GO

-- =============================================================================
-- =====================  DỮ LIỆU MẪU (SAMPLE DATA)  ============================
-- Lưu ý: chạy trên database MỚI (chưa có dữ liệu) vì các khóa ngoại tham chiếu
-- theo giá trị IDENTITY bắt đầu từ 1. Thứ tự INSERT đã được sắp xếp đúng phụ thuộc.
-- Mật khẩu mẫu của mọi tài khoản: HocThuat@2026 (>= 12 ký tự, có chữ và số; lưu dạng SHA-256 hex)
-- =============================================================================
SET NOCOUNT ON;

----- 1. KHOA
INSERT INTO KHOA (TenKhoa) VALUES
(N'Công nghệ thông tin'),      -- 1
(N'Kinh tế'),                  -- 2
(N'Ngoại ngữ');                -- 3

----- 2. BỘ MÔN
INSERT INTO BOMON (MaKhoa, TenBM) VALUES
(1, N'Công nghệ phần mềm'),    -- 1
(1, N'Hệ thống thông tin'),    -- 2
(1, N'Mạng máy tính và An toàn thông tin'), -- 3
(2, N'Quản trị kinh doanh'),   -- 4
(2, N'Kế toán - Kiểm toán'),   -- 5
(3, N'Tiếng Anh thương mại');  -- 6

----- 3. LỚP
INSERT INTO LOP (MaKhoa, TenLop, KhoaHoc) VALUES
(1, N'DHKTPM22A', N'2022-2026'),  -- 1
(1, N'DHHTTT22B', N'2022-2026'),  -- 2
(1, N'DHKTPM23A', N'2023-2027'),  -- 3
(2, N'DHQTKD22A', N'2022-2026'),  -- 4
(2, N'DHKT23A',   N'2023-2027'),  -- 5
(3, N'DHNNA23A',  N'2023-2027');  -- 6

----- 4. NGƯỜI DÙNG (1: QTV | 2-4: Cán bộ khoa | 5-9: Giảng viên | 10-22: Sinh viên)
INSERT INTO NGUOIDUNG (HoTen, Email, SDT, NgaySinh, GioiTinh) VALUES
(N'Nguyễn Quản Trị',       'admin@truong.edu.vn',      '0901000001', '1985-03-12', N'Nam'),  -- 1
(N'Trần Thị Mai Hương',    'huong.ttm@truong.edu.vn',  '0901000002', '1980-07-21', N'Nữ'),   -- 2
(N'Lê Văn Hùng',           'hung.lv@truong.edu.vn',    '0901000003', '1978-11-02', N'Nam'),  -- 3
(N'Phạm Thu Hà',           'ha.pt@truong.edu.vn',      '0901000004', '1983-05-18', N'Nữ'),   -- 4
(N'Nguyễn Minh Tuấn',      'tuan.nm@truong.edu.vn',    '0902000001', '1979-01-15', N'Nam'),  -- 5
(N'Võ Thanh Hải',          'hai.vt@truong.edu.vn',     '0902000002', '1986-09-09', N'Nam'),  -- 6
(N'Đặng Quốc Bảo',         'bao.dq@truong.edu.vn',     '0902000003', '1981-04-30', N'Nam'),  -- 7
(N'Lý Ngọc Lan',           'lan.ln@truong.edu.vn',     '0902000004', '1977-12-25', N'Nữ'),   -- 8
(N'Hoàng Thị Thu',         'thu.ht@truong.edu.vn',     '0902000005', '1988-06-14', N'Nữ'),   -- 9
(N'Nguyễn Hoàng Nam',      'nam.nh@sv.truong.edu.vn',  '0903000001', '2004-02-10', N'Nam'),  -- 10
(N'Trần Thị Bích Ngọc',    'ngoc.ttb@sv.truong.edu.vn','0903000002', '2004-05-22', N'Nữ'),   -- 11
(N'Lê Quang Huy',          'huy.lq@sv.truong.edu.vn',  '0903000003', '2004-08-03', N'Nam'),  -- 12
(N'Phạm Minh Khôi',        'khoi.pm@sv.truong.edu.vn', '0903000004', '2004-11-19', N'Nam'),  -- 13
(N'Võ Thị Thanh Tâm',      'tam.vtt@sv.truong.edu.vn', '0903000005', '2004-01-27', N'Nữ'),   -- 14
(N'Đỗ Gia Bảo',            'bao.dg@sv.truong.edu.vn',  '0903000006', '2005-03-14', N'Nam'),  -- 15
(N'Bùi Ngọc Anh',          'anh.bn@sv.truong.edu.vn',  '0903000007', '2005-07-08', N'Nữ'),   -- 16
(N'Mai Xuân Trường',       'truong.mx@sv.truong.edu.vn','0903000008','2005-09-30', N'Nam'),  -- 17
(N'Huỳnh Thanh Phong',     'phong.ht@sv.truong.edu.vn','0903000009', '2004-04-05', N'Nam'),  -- 18
(N'Ngô Thị Kim Ngân',      'ngan.ntk@sv.truong.edu.vn','0903000010', '2004-12-12', N'Nữ'),   -- 19
(N'Dương Tuấn Kiệt',       'kiet.dt@sv.truong.edu.vn', '0903000011', '2005-06-21', N'Nam'),  -- 20
(N'Lâm Thảo Vy',           'vy.lt@sv.truong.edu.vn',   '0903000012', '2005-10-02', N'Nữ'),   -- 21
(N'Phan Đức Thịnh',        'thinh.pd@sv.truong.edu.vn','0903000013', '2005-02-17', N'Nam');  -- 22

----- 5. VAI TRÒ
INSERT INTO VAITRO (TenVaiTro) VALUES
(N'Quản trị viên'),   -- 1
(N'Cán bộ khoa'),     -- 2
(N'Giảng viên'),      -- 3
(N'Sinh viên');       -- 4

----- 6. TÀI KHOẢN (MaTK trùng với MaNgDung)
IF dbo.fn_KiemTraMatKhau('HocThuat@2026') = 0 THROW 50003, N'Mật khẩu mẫu không đạt ràng buộc.', 1;
INSERT INTO TAIKHOAN (MaNgDung, MaVaiTro, TenDangNhap, MatKhau) VALUES
(1, 1, 'admin',    CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(2, 2, 'cb.huong', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(3, 2, 'cb.hung',  CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(4, 2, 'cb.ha',    CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(5, 3, 'gv.tuan',  CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(6, 3, 'gv.hai',   CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(7, 3, 'gv.bao',   CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(8, 3, 'gv.lan',   CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(9, 3, 'gv.thu',   CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(10, 4, '22110001', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(11, 4, '22110002', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(12, 4, '22110003', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(13, 4, '22120004', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(14, 4, '22120005', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(15, 4, '23110006', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(16, 4, '23110007', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(17, 4, '23110008', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(18, 4, '22210009', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(19, 4, '22210010', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(20, 4, '23220011', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(21, 4, '23310012', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2)),
(22, 4, '23310013', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'HocThuat@2026'), 2));

----- 7. PHÂN QUYỀN
INSERT INTO PHANQUYEN (TenQuyen, MoTa) VALUES
(N'QUAN_LY_NGUOI_DUNG',   N'Quản lý người dùng, tài khoản và phân quyền'),          -- 1
(N'LAP_KE_HOACH',         N'Lập và chỉnh sửa kế hoạch học thuật'),                 -- 2
(N'DUYET_KE_HOACH',       N'Duyệt hoặc từ chối kế hoạch học thuật'),               -- 3
(N'QUAN_LY_HOAT_DONG',    N'Quản lý hoạt động, seminar, cuộc thi'),                -- 4
(N'LAP_KINH_PHI',         N'Lập dự trù và ghi nhận chi tiêu kinh phí'),            -- 5
(N'DUYET_KINH_PHI',       N'Duyệt dự trù kinh phí và hồ sơ quyết toán'),           -- 6
(N'DANG_KY_HOAT_DONG',    N'Đăng ký tham gia, dự thi, cổ vũ hoạt động'),           -- 7
(N'DIEM_DANH',            N'Quét mã QR điểm danh và xem lịch sử điểm danh'),       -- 8
(N'XEM_DIEM_REN_LUYEN',   N'Xem điểm rèn luyện cá nhân');                          -- 9

----- 8. GÁN QUYỀN CHO VAI TRÒ
INSERT INTO VAITRO_QUYEN (MaVT, MaQuyen) VALUES
(1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7),(1,8),(1,9),
(2,2),(2,4),(2,5),
(3,4),(3,7),
(4,7),(4,8),(4,9);

----- 9. SINH VIÊN (MaSV 1-13 ứng với MaNgDung 10-22)
INSERT INTO SINHVIEN (MaNgDung, MaLop, MSSV) VALUES
(10, 1, '22110001'),  -- 1
(11, 1, '22110002'),  -- 2
(12, 1, '22110003'),  -- 3
(13, 2, '22120004'),  -- 4
(14, 2, '22120005'),  -- 5
(15, 3, '23110006'),  -- 6
(16, 3, '23110007'),  -- 7
(17, 3, '23110008'),  -- 8
(18, 4, '22210009'),  -- 9
(19, 4, '22210010'),  -- 10
(20, 5, '23220011'),  -- 11
(21, 6, '23310012'),  -- 12
(22, 6, '23310013');  -- 13

----- 10. GIẢNG VIÊN (MaGV 1-5 ứng với MaNgDung 5-9)
INSERT INTO GIANGVIEN (MaNgDung, HocVi, MaBM) VALUES
(5, N'Tiến sĩ', 1),   -- 1
(6, N'Thạc sĩ', 2),   -- 2
(7, N'Tiến sĩ', 3),   -- 3
(8, N'Tiến sĩ', 4),   -- 4
(9, N'Thạc sĩ', 6);   -- 5

----- 11. CÁN BỘ KHOA
INSERT INTO CANBOKHOA (MaNgDung, MaKhoa, ChucVu) VALUES
(2, 1, N'Phó Trưởng khoa phụ trách học thuật'),  -- 1
(3, 2, N'Phó Trưởng khoa'),                       -- 2
(4, 3, N'Trợ lý khoa học');                       -- 3

----- 12. QUẢN TRỊ VIÊN
INSERT INTO QUANTRIVIEN (MaNgDung, MoTa) VALUES
(1, N'Quản trị hệ thống quản lý công tác học thuật toàn trường');

----- 13. KẾ HOẠCH HỌC THUẬT
INSERT INTO KEHOACHHOCTHUAT (MaKhoa, SoKeHoach, TenKeHoach, NgayBanHanh, NamHoc, CanCu, MucDich, YeuCau, NoiDung, NgPhuTrach, LoaiKeHoach, TrangThai, NguoiDuyet, NgayDuyet, LichSuDuyet) VALUES
(1, N'KH-CNTT-01/2025', N'Kế hoạch tổ chức hoạt động học thuật Khoa CNTT học kỳ 1 năm học 2025-2026', '2025-09-05', '2025-2026',
 N'Kế hoạch năm học 2025-2026 của Nhà trường; Kế hoạch công tác học thuật của Khoa.',
 N'Nâng cao chất lượng đào tạo, thúc đẩy phong trào nghiên cứu và học tập trong sinh viên.',
 N'Hoạt động thiết thực, đúng tiến độ, có sự tham gia đông đảo của sinh viên và giảng viên.',
 N'Tổ chức 01 cuộc thi lập trình, 01 seminar, 01 workshop và 01 tọa đàm trong học kỳ 1.',
 1, N'Khoa', N'Đã duyệt', 1, '2025-09-10T09:00:00+07:00',
 N'[{"nguoi":"Trần Thị Mai Hương","hanhDong":"Gửi duyệt","thoiGian":"2025-09-08T08:30:00+07:00"},{"nguoi":"Nguyễn Quản Trị","hanhDong":"Duyệt","thoiGian":"2025-09-10T09:00:00+07:00"}]'),  -- 1
(1, N'KH-CNTT-02/2026', N'Kế hoạch tổ chức hoạt động học thuật Khoa CNTT học kỳ 2 năm học 2025-2026', '2026-02-10', '2025-2026',
 N'Kế hoạch năm học 2025-2026 của Nhà trường; Báo cáo tổng kết học kỳ 1.',
 N'Duy trì phong trào nghiên cứu khoa học trong sinh viên.',
 N'Có sự phối hợp giữa các bộ môn trong Khoa.',
 N'Tổ chức cuộc thi Nghiên cứu khoa học sinh viên cấp Khoa.',
 1, N'Khoa', N'Chờ duyệt', NULL, NULL,
 N'[{"nguoi":"Trần Thị Mai Hương","hanhDong":"Gửi duyệt","thoiGian":"2026-02-12T10:00:00+07:00"}]'),  -- 2
(2, N'KH-KT-01/2025', N'Kế hoạch tổ chức hoạt động học thuật Khoa Kinh tế học kỳ 1 năm học 2025-2026', '2025-09-08', '2025-2026',
 N'Kế hoạch năm học 2025-2026 của Nhà trường.',
 N'Phát triển tư duy khởi nghiệp và kỹ năng thực tiễn cho sinh viên khối kinh tế.',
 N'Có sự tham gia của doanh nghiệp đối tác.',
 N'Tổ chức 01 cuộc thi ý tưởng khởi nghiệp và 01 seminar chuyển đổi số.',
 2, N'Khoa', N'Đã duyệt', 1, '2025-09-12T14:00:00+07:00',
 N'[{"nguoi":"Lê Văn Hùng","hanhDong":"Gửi duyệt","thoiGian":"2025-09-10T09:00:00+07:00"},{"nguoi":"Nguyễn Quản Trị","hanhDong":"Duyệt","thoiGian":"2025-09-12T14:00:00+07:00"}]'),  -- 3
(3, N'KH-NN-01/2025', N'Kế hoạch tổ chức hoạt động học thuật Khoa Ngoại ngữ năm học 2025-2026', NULL, '2025-2026',
 N'Kế hoạch năm học 2025-2026 của Nhà trường.',
 N'Nâng cao kỹ năng ngoại ngữ chuyên ngành cho sinh viên.',
 N'Đang xây dựng.',
 N'Dự kiến tổ chức 01 workshop tiếng Anh thương mại.',
 3, N'Khoa', N'Dự thảo', NULL, NULL, N'[]');  -- 4

----- 14. HOẠT ĐỘNG HỌC THUẬT
INSERT INTO HOATDONGHOCTHUAT (MaBM, TenHoatDong, LoaiHoatDong, NoiDung, TgDuKien, DiaDiem, TienDoTH, DoiTuongThamDu, SLSVDuKien, TrangThai) VALUES
(1, N'Cuộc thi Lập trình Sinh viên CNTT 2025', N'Cuộc thi', N'Cuộc thi lập trình theo đội, gồm phần thuật toán và phần ứng dụng.', '2025-12-06', N'Phòng máy khu A', N'Hoàn thành', N'Sinh viên Khoa CNTT', 60, N'Dự thảo'),         -- 1
(1, N'Seminar Trí tuệ nhân tạo trong phát triển phần mềm', N'Seminar', N'Báo cáo chuyên đề về ứng dụng AI trong quy trình phát triển phần mềm.', '2025-11-15', N'Hội trường A', N'Hoàn thành', N'Sinh viên và giảng viên Khoa CNTT', 150, N'Dự thảo'), -- 2
(1, N'Workshop Kỹ năng phỏng vấn ngành CNTT', N'Workshop', N'Thực hành phỏng vấn kỹ thuật cùng chuyên gia doanh nghiệp.', '2025-11-20', N'Phòng A405', N'Hoàn thành', N'Sinh viên năm 3, năm 4', 50, N'Dự thảo'),           -- 3
(3, N'Tọa đàm Định hướng nghề nghiệp ngành An toàn thông tin', N'Tọa đàm', N'Giao lưu với chuyên gia về cơ hội nghề nghiệp ngành ATTT.', '2025-12-10', N'Hội trường B', N'Hoàn thành', N'Sinh viên Khoa CNTT', 100, N'Dự thảo'),   -- 4
(7, N'Cuộc thi Ý tưởng khởi nghiệp sinh viên Kinh tế', N'Cuộc thi', N'Cuộc thi thuyết trình ý tưởng khởi nghiệp theo đội.', '2025-12-13', N'Hội trường B', N'Hoàn thành', N'Sinh viên các khoa', 80, N'Dự thảo'),            -- 5
(7, N'Seminar Chuyển đổi số trong doanh nghiệp', N'Seminar', N'Chia sẻ kinh nghiệm chuyển đổi số từ các doanh nghiệp.', '2025-11-28', N'Phòng hội thảo B201', N'Hoàn thành', N'Sinh viên Khoa Kinh tế', 60, N'Dự thảo'),     -- 6
(1, N'Cuộc thi Nghiên cứu khoa học sinh viên cấp Khoa', N'Cuộc thi', N'Cuộc thi báo cáo đề tài nghiên cứu khoa học sinh viên.', '2026-04-18', N'Hội trường A', N'Đang chuẩn bị', N'Sinh viên Khoa CNTT', 40, N'Dự thảo');       -- 7

----- 15. BAN CHỈ ĐẠO
INSERT INTO BANCHIDAO (MaHD, MaNgDung, HoTen, HocVi, ChucDanh, ChucVu) VALUES
(1, 2, N'Trần Thị Mai Hương', N'Tiến sĩ', N'Giảng viên chính', N'Phó Trưởng khoa'),
(1, 5, N'Nguyễn Minh Tuấn',   N'Tiến sĩ', N'Giảng viên chính', N'Trưởng bộ môn Công nghệ phần mềm'),
(2, 2, N'Trần Thị Mai Hương', N'Tiến sĩ', N'Giảng viên chính', N'Phó Trưởng khoa'),
(5, 3, N'Lê Văn Hùng',        N'Thạc sĩ', N'Giảng viên',       N'Phó Trưởng khoa'),
(5, 8, N'Lý Ngọc Lan',        N'Tiến sĩ', N'Giảng viên chính', N'Trưởng bộ môn Quản trị kinh doanh');

----- 16. BAN TỔ CHỨC
INSERT INTO BANTOCHUC (MaHD, MaNgDung, HoTen, HocVi, ChucDanh, ChucVu, NhiemVu) VALUES
(1, 6, N'Võ Thanh Hải',  N'Thạc sĩ', N'Giảng viên', N'Ủy viên', N'Phụ trách xây dựng đề thi và nội dung chuyên môn'),
(1, 7, N'Đặng Quốc Bảo', N'Tiến sĩ', N'Giảng viên', N'Ủy viên', N'Phụ trách hệ thống chấm bài tự động'),
(2, 6, N'Võ Thanh Hải',  N'Thạc sĩ', N'Giảng viên', N'Trưởng ban', N'Điều phối chương trình và liên hệ báo cáo viên'),
(5, 3, N'Lê Văn Hùng',   N'Thạc sĩ', N'Giảng viên', N'Trưởng ban', N'Chịu trách nhiệm chung về tổ chức cuộc thi'),
(6, 8, N'Lý Ngọc Lan',   N'Tiến sĩ', N'Giảng viên chính', N'Trưởng ban', N'Mời diễn giả doanh nghiệp và điều phối nội dung');

----- 17. BAN HỖ TRỢ
INSERT INTO BANHOTRO (MaHD, MaNgDung, HoTen, HocVi, ChucDanh, ChucVu) VALUES
(1, 18, N'Huỳnh Thanh Phong', NULL, N'Sinh viên', N'Thành viên hỗ trợ'),
(2, 19, N'Ngô Thị Kim Ngân',  NULL, N'Sinh viên', N'Thành viên hỗ trợ'),
(5, 13, N'Phạm Minh Khôi',    NULL, N'Sinh viên', N'Thành viên hỗ trợ'),
(6, 9,  N'Hoàng Thị Thu',     N'Thạc sĩ', N'Giảng viên', N'Thành viên hỗ trợ');

----- 18. SEMINAR (MaHD 2 và 6)
INSERT INTO SEMINAR (SoKeHoach, MaHD, ChuDe, CanCu, MucDich, YeuCau, ThoiGian, DiaDiem, SLSVDuKien, DSChiDao, DSToChuc) VALUES
(N'SEM-CNTT-01/2025', 2, N'Trí tuệ nhân tạo trong phát triển phần mềm',
 N'Kế hoạch KH-CNTT-01/2025 của Khoa Công nghệ thông tin',
 N'Cập nhật xu hướng ứng dụng AI vào quy trình phát triển phần mềm cho sinh viên.',
 N'Sinh viên tham dự đúng giờ, điểm danh bằng mã QR, trang phục lịch sự.',
 '2025-11-15 08:00:00', N'Hội trường A', 150,
 N'TS. Trần Thị Mai Hương; TS. Nguyễn Minh Tuấn', N'ThS. Võ Thanh Hải; Đoàn khoa CNTT'),   -- 1
(N'SEM-KT-01/2025', 6, N'Chuyển đổi số trong doanh nghiệp',
 N'Kế hoạch KH-KT-01/2025 của Khoa Kinh tế',
 N'Giúp sinh viên hiểu thực tiễn chuyển đổi số tại doanh nghiệp vừa và nhỏ.',
 N'Sinh viên đăng ký trước và điểm danh bằng mã QR.',
 '2025-11-28 14:00:00', N'Phòng hội thảo B201', 60,
 N'ThS. Lê Văn Hùng; TS. Lý Ngọc Lan', N'TS. Lý Ngọc Lan; CLB Khởi nghiệp');           -- 2

----- 19. CHỦ ĐỀ BÁO CÁO TRONG SEMINAR
INSERT INTO CHUDE (MaSeminar, STT, TenChuDe, TgBatDau, TgKetThuc, DienGia, NoiDungKhac) VALUES
(1, 1, N'Tổng quan về AI tạo sinh trong phát triển phần mềm', '08:15', '09:00', N'TS. Nguyễn Minh Tuấn', NULL),
(1, 2, N'Ứng dụng trợ lý lập trình AI vào kiểm thử phần mềm', '09:00', '09:45', N'ThS. Võ Thanh Hải', N'Có phần demo trực tiếp'),
(1, 3, N'Thảo luận và hỏi đáp', '09:45', '10:30', N'Ban tổ chức', NULL),
(2, 1, N'Lộ trình chuyển đổi số cho doanh nghiệp vừa và nhỏ', '14:15', '15:00', N'TS. Lý Ngọc Lan', NULL),
(2, 2, N'Kinh nghiệm triển khai ERP tại doanh nghiệp', '15:00', '15:45', N'Ông Trần Quốc Việt - Giám đốc Công ty Giải pháp ABC', N'Diễn giả khách mời');

----- 20. PHÂN CÔNG THỰC HIỆN TRONG SEMINAR
INSERT INTO PHANCONGTHUCHIEN (MaSeminar, STT, NoiDung, ThoiGian, MaNgDung, HoTen) VALUES
(1, 1, N'Liên hệ và mời báo cáo viên',                    '2025-11-01', 2,  N'Trần Thị Mai Hương'),
(1, 2, N'Thiết kế và phát hành poster truyền thông',       '2025-11-05', 18, N'Huỳnh Thanh Phong'),
(1, 3, N'Chuẩn bị hội trường, máy chiếu và âm thanh',      '2025-11-14', 6,  N'Võ Thanh Hải'),
(1, 4, N'Đón tiếp đại biểu và hướng dẫn điểm danh QR',     '2025-11-15', 19, N'Ngô Thị Kim Ngân'),
(2, 1, N'Mời diễn giả doanh nghiệp và thống nhất nội dung', '2025-11-10', 8, N'Lý Ngọc Lan'),
(2, 2, N'Chuẩn bị phòng hội thảo và tea break',            '2025-11-27', 9,  N'Hoàng Thị Thu');

----- 21. CUỘC THI (MaHD 1, 5, 7)
INSERT INTO CUOCTHI (MaHD, SoKeHoach, TenCuocThi, VongThi, CanCu, MucDich, YeuCau, ThoiGian, DiaDiem, DoiTuongTG, SLSVDuKien) VALUES
(1, N'CT-CNTT-01/2025', N'Cuộc thi Lập trình Sinh viên CNTT 2025', N'Vòng chung kết',
 N'Kế hoạch KH-CNTT-01/2025 của Khoa Công nghệ thông tin.',
 N'Phát hiện và bồi dưỡng sinh viên có năng lực lập trình xuất sắc.',
 N'Thi theo đội 2 sinh viên, tuân thủ thể lệ cuộc thi.',
 '2025-12-06 07:30:00', N'Phòng máy khu A', N'Sinh viên Khoa CNTT', 60),     -- 1
(5, N'CT-KT-01/2025', N'Cuộc thi Ý tưởng khởi nghiệp sinh viên Kinh tế', N'Vòng chung kết',
 N'Kế hoạch KH-KT-01/2025 của Khoa Kinh tế.',
 N'Khuyến khích tinh thần khởi nghiệp và sáng tạo trong sinh viên.',
 N'Mỗi đội 2 sinh viên, thuyết trình tối đa 10 phút.',
 '2025-12-13 08:00:00', N'Hội trường B', N'Sinh viên các khoa', 40),          -- 2
(7, N'CT-CNTT-02/2026', N'Cuộc thi Nghiên cứu khoa học sinh viên cấp Khoa', DEFAULT,
 N'Kế hoạch KH-CNTT-02/2026 của Khoa Công nghệ thông tin.',
 N'Thúc đẩy hoạt động nghiên cứu khoa học trong sinh viên.',
 N'Đề tài có giảng viên hướng dẫn.',
 '2026-04-18 08:00:00', N'Hội trường A', N'Sinh viên Khoa CNTT', 40);         -- 3

----- 22. BAN GIÁM KHẢO
INSERT INTO BANGIAMKHAO (MaCThi, MaNgDung, HoTen, HocVi, ChucDanh, ChucVu) VALUES
(1, 5, N'Nguyễn Minh Tuấn',   N'Tiến sĩ', N'Giảng viên chính', N'Trưởng ban giám khảo'),   -- 1
(1, 7, N'Đặng Quốc Bảo',      N'Tiến sĩ', N'Giảng viên',       N'Giám khảo'),              -- 2
(1, 6, N'Võ Thanh Hải',       N'Thạc sĩ', N'Giảng viên',       N'Giám khảo'),              -- 3
(2, 8, N'Lý Ngọc Lan',        N'Tiến sĩ', N'Giảng viên chính', N'Trưởng ban giám khảo'),   -- 4
(2, 3, N'Lê Văn Hùng',        N'Thạc sĩ', N'Giảng viên',       N'Giám khảo');              -- 5

----- 23. TỔ CHỨC CUỘC THI
INSERT INTO TOCHUCCUOCTHI (MaCThi, STT, NoiDung, TGBatDau, TGKetThuc, NgThucHien) VALUES
(1, 1, N'Đón tiếp, điểm danh thí sinh',           '07:30', '08:00', N'Ban tổ chức'),
(1, 2, N'Khai mạc cuộc thi',                      '08:00', '08:15', N'Phó Trưởng khoa'),
(1, 3, N'Thi phần thuật toán',                    '08:30', '11:00', N'Ban giám khảo'),
(1, 4, N'Thi phần ứng dụng và thuyết trình',      '13:30', '16:00', N'Ban giám khảo'),
(1, 5, N'Tổng kết và trao giải',                  '16:15', '17:00', N'Ban tổ chức'),
(2, 1, N'Đón tiếp, điểm danh các đội',            '07:30', '08:00', N'Ban tổ chức'),
(2, 2, N'Các đội thuyết trình ý tưởng',           '08:00', '11:30', N'Ban giám khảo'),
(2, 3, N'Tổng kết và trao giải',                  '14:00', '15:00', N'Ban tổ chức');

----- 24. TIỂU BAN CHẤM THI
INSERT INTO TIEUBAN (MaCThi, TenTieuBan, PhongCham, GhiChu) VALUES
(1, N'Tiểu ban Thuật toán',               N'A301', N'Chấm phần thi thuật toán'),                -- 1
(1, N'Tiểu ban Ứng dụng',                 N'A302', N'Chấm phần thi xây dựng ứng dụng'),         -- 2
(2, N'Tiểu ban Khởi nghiệp công nghệ',    N'B201', NULL);                                        -- 3

----- 25. GIÁM KHẢO THUỘC TỪNG TIỂU BAN
INSERT INTO GIAMKHAO_TIEUBAN (MaTieuBan, MaBGK, HoTen, HocVi, ChucVu) VALUES
(1, 1, N'Nguyễn Minh Tuấn', N'Tiến sĩ', N'Trưởng tiểu ban'),
(1, 2, N'Đặng Quốc Bảo',    N'Tiến sĩ', N'Thành viên'),
(2, 3, N'Võ Thanh Hải',     N'Thạc sĩ', N'Trưởng tiểu ban'),
(2, NULL, N'Ông Phạm Văn Long - Công ty Phần mềm XYZ', NULL, N'Giám khảo mời'),
(3, 4, N'Lý Ngọc Lan',      N'Tiến sĩ', N'Trưởng tiểu ban'),
(3, 5, N'Lê Văn Hùng',      N'Thạc sĩ', N'Thành viên');

----- 26. ĐỀ TÀI DỰ THI
INSERT INTO DETAI (MaTieuBan, STT, TenDeTai, GVHD, MaGVHD, TrangThai) VALUES
(1, 1, N'Hệ thống gợi ý lộ trình học tập bằng thuật toán đồ thị',    N'Nguyễn Minh Tuấn', 1, N'Đã chấm'),   -- 1
(1, 2, N'Tối ưu hóa lập lịch thi bằng thuật toán di truyền',         N'Võ Thanh Hải',     2, N'Đã chấm'),   -- 2
(2, 1, N'Ứng dụng quản lý chi tiêu cá nhân trên di động',            N'Đặng Quốc Bảo',    3, N'Đã chấm'),   -- 3
(2, 2, N'Website quản lý câu lạc bộ sinh viên',                      N'Nguyễn Minh Tuấn', 1, N'Đã chấm'),   -- 4
(3, 1, N'Nền tảng kết nối nông sản sạch đến người tiêu dùng',        N'Lý Ngọc Lan',      4, N'Đã chấm'),   -- 5
(3, 2, N'Dịch vụ giặt ủi thông minh dành cho sinh viên',             N'Lý Ngọc Lan',      4, N'Đã chấm');   -- 6

----- 27. ĐỘI THI
INSERT INTO DOITHI (MaCThi, MaDeTai, TenDoi) VALUES
(1, 1, N'Team Graph Masters'),   -- 1
(1, 2, N'Team Genetic Coders'),  -- 2
(1, 3, N'Team Mobile Wallet'),   -- 3
(1, 4, N'Team Club Hub'),        -- 4
(2, 5, N'Team Nông Sản Xanh'),   -- 5
(2, 6, N'Team Smart Laundry');   -- 6

----- 28. THÀNH VIÊN ĐỘI THI
INSERT INTO THANHVIENDOI (MaDoi, MaSV, HoTen, VaiTro) VALUES
(1, 1,  N'Nguyễn Hoàng Nam',    N'Trưởng nhóm'),
(1, 2,  N'Trần Thị Bích Ngọc',  N'Thành viên'),
(2, 3,  N'Lê Quang Huy',        N'Trưởng nhóm'),
(2, 4,  N'Phạm Minh Khôi',      N'Thành viên'),
(3, 5,  N'Võ Thị Thanh Tâm',    N'Trưởng nhóm'),
(3, 6,  N'Đỗ Gia Bảo',          N'Thành viên'),
(4, 7,  N'Bùi Ngọc Anh',        N'Trưởng nhóm'),
(4, 8,  N'Mai Xuân Trường',     N'Thành viên'),
(5, 9,  N'Huỳnh Thanh Phong',   N'Trưởng nhóm'),
(5, 10, N'Ngô Thị Kim Ngân',    N'Thành viên'),
(6, 11, N'Dương Tuấn Kiệt',     N'Trưởng nhóm'),
(6, 12, N'Lâm Thảo Vy',         N'Thành viên');

----- 29. DỰ TRÙ KINH PHÍ (MaTK người lập: 2,3 là cán bộ khoa; người duyệt: 1 là QTV)
INSERT INTO DUTRUKINHPHI (TenTieuDe, NamHoc, TongKinhPhi, NguoiLap, NgayLap, NguoiDuyet, NgayDuyet, TrangThai) VALUES
(N'Dự trù kinh phí hoạt động học thuật Khoa CNTT học kỳ 1 năm học 2025-2026', '2025-2026', 26200000, 2, '2025-09-12 08:00:00', 1, '2025-09-20 10:00:00', N'Đã duyệt'),  -- 1
(N'Dự trù kinh phí hoạt động học thuật Khoa Kinh tế học kỳ 1 năm học 2025-2026', '2025-2026', 14800000, 3, '2025-09-14 09:00:00', 1, '2025-09-22 10:00:00', N'Đã duyệt'), -- 2
(N'Dự trù kinh phí hoạt động học thuật Khoa CNTT học kỳ 2 năm học 2025-2026', '2025-2026', 11000000, 2, '2026-02-12 08:30:00', NULL, NULL, N'Chờ duyệt');                  -- 3

----- 30. CHI TIẾT KINH PHÍ TỪNG HOẠT ĐỘNG (SoTien = SoLuong x DonGia)
INSERT INTO KINHPHIHOATDONG (MaDuTruKP, MaHD, NoiDung, SoLuong, DonViTinh, DonGia, SoTien, ThuyetMinh, NguonKinhPhi, GhiChu) VALUES
(1, 1, N'Giải thưởng cuộc thi (1 giải Nhất, 1 giải Nhì, 2 giải Ba, 2 giải Khuyến khích)', 1, N'gói', 13000000, 13000000, N'Theo cơ cấu giải thưởng đã duyệt', DEFAULT, NULL),  -- 1
(1, 1, N'In giấy chứng nhận, tài liệu cuộc thi',        100, N'bộ',     15000,   1500000,  N'In màu khổ A4', DEFAULT, NULL),                    -- 2
(1, 1, N'Nước uống cho thí sinh và ban giám khảo',       80, N'phần',   25000,   2000000,  NULL, DEFAULT, NULL),                                -- 3
(1, 2, N'Thù lao báo cáo viên',                           3, N'người', 1500000,   4500000,  N'Theo quy chế chi tiêu nội bộ', DEFAULT, NULL),    -- 4
(1, 2, N'Backdrop, banner chương trình',                  1, N'bộ',    1200000,   1200000,  NULL, DEFAULT, NULL),                              -- 5
(1, 3, N'Thù lao diễn giả workshop',                      1, N'buổi',  3000000,   3000000,  NULL, N'Tài trợ doanh nghiệp', N'Doanh nghiệp đồng hành hỗ trợ'), -- 6
(1, 4, N'Quà tặng diễn giả tọa đàm',                      2, N'phần',   500000,   1000000,  NULL, DEFAULT, NULL),                              -- 7
(2, 5, N'Giải thưởng cuộc thi (giải Nhất, giải Nhì)',     1, N'gói',  6500000,   6500000,  NULL, DEFAULT, NULL),                              -- 8
(2, 5, N'Thuê âm thanh, ánh sáng',                        1, N'gói',  2500000,   2500000,  NULL, DEFAULT, NULL),                              -- 9
(2, 6, N'Thù lao diễn giả doanh nghiệp',                  2, N'người', 2000000,   4000000,  NULL, DEFAULT, NULL),                              -- 10
(2, 6, N'Tea break cho đại biểu và sinh viên',           60, N'phần',   30000,   1800000,  NULL, DEFAULT, NULL),                              -- 11
(3, 7, N'Giải thưởng cuộc thi nghiên cứu khoa học',       1, N'gói',  8000000,   8000000,  NULL, DEFAULT, NULL),                              -- 12
(3, 7, N'Thù lao hội đồng chấm',                          5, N'người',  600000,   3000000,  NULL, DEFAULT, NULL);                              -- 13

----- 31. KINH PHÍ THỰC TẾ (tổng chi mỗi mục không được vượt dự trù - có trigger kiểm tra)
INSERT INTO KINHPHITHUCTE (MaKPHD, MaHD, NoiDungChi, SoTienChi, NgayChi, NguoiChi, SoHoaDon, DVCungCap, GhiChu) VALUES
(1,  1, N'Chi trả tiền thưởng cho các đội đạt giải',       13000000, '2025-12-08', 2, NULL,         NULL, N'Có biên bản trao thưởng'),
(2,  1, N'In giấy chứng nhận và tài liệu cuộc thi',          1350000, '2025-12-02', 2, N'HD-0001245', N'Công ty In Phương Nam', NULL),
(3,  1, N'Mua nước uống cho cuộc thi',                       1900000, '2025-12-05', 2, N'HD-0003310', N'Cửa hàng Tạp hóa An Phát', NULL),
(4,  2, N'Chi thù lao báo cáo viên seminar AI',              4500000, '2025-11-17', 2, NULL,         NULL, NULL),
(5,  2, N'Làm backdrop seminar',                             1150000, '2025-11-12', 2, N'HD-0000987', N'Công ty Quảng cáo Sao Việt', NULL),
(6,  3, N'Chi thù lao diễn giả workshop',                    3000000, '2025-11-21', 2, NULL,         NULL, NULL),
(8,  5, N'Chi trả tiền thưởng cuộc thi khởi nghiệp',         6500000, '2025-12-15', 3, NULL,         NULL, NULL),
(9,  5, N'Thuê âm thanh, ánh sáng',                          2500000, '2025-12-10', 3, N'HD-0004521', N'Công ty Sự kiện Ánh Dương', NULL),
(10, 6, N'Thù lao diễn giả - đợt 1',                         2000000, '2025-11-28', 3, NULL,         NULL, NULL),
(10, 6, N'Thù lao diễn giả - đợt 2',                         2000000, '2025-11-30', 3, NULL,         NULL, NULL),
(11, 6, N'Tea break seminar chuyển đổi số',                  1750000, '2025-11-27', 3, N'HD-0002876', N'Tiệm bánh Hoa Nắng', NULL);

----- 32. ĐĂNG KÝ THAM GIA HOẠT ĐỘNG
INSERT INTO DKTHAMGIA (MaHD, MaSV, NgayDK, HinhThuc, NguonDK, TrangThai) VALUES
(1, 1,  '2025-11-20 09:00:00', N'Dự thi',   N'Sinh viên',  N'Đã đăng ký'),  -- 1
(1, 2,  '2025-11-20 09:05:00', N'Dự thi',   N'Sinh viên',  N'Đã đăng ký'),  -- 2
(1, 3,  '2025-11-20 10:00:00', N'Dự thi',   N'Sinh viên',  N'Đã đăng ký'),  -- 3
(1, 4,  '2025-11-20 10:10:00', N'Dự thi',   N'Sinh viên',  N'Đã đăng ký'),  -- 4
(1, 5,  '2025-11-21 08:30:00', N'Dự thi',   N'Giảng viên', N'Đã đăng ký'),  -- 5
(1, 6,  '2025-11-21 08:35:00', N'Dự thi',   N'Giảng viên', N'Đã đăng ký'),  -- 6
(1, 7,  '2025-11-21 14:00:00', N'Dự thi',   N'Sinh viên',  N'Đã đăng ký'),  -- 7
(1, 8,  '2025-11-21 14:05:00', N'Dự thi',   N'Sinh viên',  N'Đã đăng ký'),  -- 8
(2, 1,  '2025-11-05 08:00:00', N'Tham gia', N'Sinh viên',  N'Đã đăng ký'),  -- 9
(2, 2,  '2025-11-05 08:10:00', N'Tham gia', N'Sinh viên',  N'Đã đăng ký'),  -- 10
(2, 4,  '2025-11-06 09:00:00', N'Tham gia', N'Sinh viên',  N'Đã đăng ký'),  -- 11
(2, 5,  '2025-11-06 09:30:00', N'Tham gia', N'Sinh viên',  N'Đã đăng ký'),  -- 12
(2, 6,  '2025-11-07 11:00:00', N'Tham gia', N'Sinh viên',  N'Đã hủy'),      -- 13
(3, 3,  '2025-11-12 15:00:00', N'Tham gia', N'Sinh viên',  N'Đã đăng ký'),  -- 14
(3, 7,  '2025-11-12 15:20:00', N'Tham gia', N'Sinh viên',  N'Đã đăng ký'),  -- 15
(3, 8,  '2025-11-13 09:00:00', N'Tham gia', N'Sinh viên',  N'Đã đăng ký'),  -- 16
(5, 9,  '2025-11-25 08:00:00', N'Dự thi',   N'Sinh viên',  N'Đã đăng ký'),  -- 17
(5, 10, '2025-11-25 08:05:00', N'Dự thi',   N'Sinh viên',  N'Đã đăng ký'),  -- 18
(5, 11, '2025-11-26 10:00:00', N'Dự thi',   N'Sinh viên',  N'Đã đăng ký'),  -- 19
(5, 12, '2025-11-26 10:10:00', N'Dự thi',   N'Sinh viên',  N'Đã đăng ký'),  -- 20
(6, 9,  '2025-11-15 09:00:00', N'Tham gia', N'Sinh viên',  N'Đã đăng ký'),  -- 21
(6, 10, '2025-11-15 09:05:00', N'Tham gia', N'Sinh viên',  N'Đã đăng ký'),  -- 22
(6, 11, '2025-11-16 14:00:00', N'Tham gia', N'Sinh viên',  N'Đã đăng ký'),  -- 23
(6, 13, '2025-11-16 14:30:00', N'Tham gia', N'Khoa',       N'Đã đăng ký'),  -- 24
(1, 12, '2025-11-28 09:00:00', N'Cổ vũ',    N'Khoa',       N'Đã đăng ký'),  -- 25
(1, 13, '2025-11-28 09:05:00', N'Cổ vũ',    N'Khoa',       N'Đã đăng ký');  -- 26

----- 33. PHÂN CÔNG CỔ VŨ / HỖ TRỢ THEO LỚP
INSERT INTO PHANCONGCOVU (MaHD, MaLop, SoLuong, NhiemVu, LoaiPhanCong) VALUES
(1, 6, 40, N'Cổ vũ các đội thi tại hội trường chung kết', N'Cổ vũ'),
(5, 3, 30, N'Cổ vũ các đội thi khởi nghiệp',              N'Cổ vũ'),
(2, 2, 10, N'Hỗ trợ đón tiếp và hướng dẫn chỗ ngồi',       N'Hỗ trợ');

----- 34. MÃ QR ĐIỂM DANH
INSERT INTO MAQR (MaHD, MaQRCode, LoaiQR, ThoiGianMo, TGHetHan, TrangThai) VALUES
(1, 'QR-HD01-IN-7F3A9C21',  N'CheckIn',  '2025-12-06T07:30:00+07:00', '2025-12-06T08:30:00+07:00', N'Hết hạn'),  -- 1
(2, 'QR-HD02-IN-1B8D4E55',  N'CheckIn',  '2025-11-15T07:45:00+07:00', '2025-11-15T08:45:00+07:00', N'Hết hạn'),  -- 2
(3, 'QR-HD03-IN-9C2E7A10',  N'CheckIn',  '2025-11-20T13:30:00+07:00', '2025-11-20T14:30:00+07:00', N'Hết hạn'),  -- 3
(5, 'QR-HD05-IN-4D6F2B88',  N'CheckIn',  '2025-12-13T07:30:00+07:00', '2025-12-13T08:30:00+07:00', N'Hết hạn'),  -- 4
(6, 'QR-HD06-IN-5A1C9E37',  N'CheckIn',  '2025-11-28T13:45:00+07:00', '2025-11-28T14:45:00+07:00', N'Hết hạn'),  -- 5
(1, 'QR-HD01-OUT-3E7B6D42', N'CheckOut', '2025-12-06T16:15:00+07:00', '2025-12-06T17:15:00+07:00', N'Hết hạn');  -- 6

----- 35. ĐIỂM DANH
INSERT INTO DIEMDANH (MaQR, MaDK, BatDauLuc, KetThucLuc, TrangThai) VALUES
(1, 1,  '2025-12-06 07:35:00', '2025-12-06 16:30:00', N'Đã điểm danh'),
(1, 2,  '2025-12-06 07:36:00', '2025-12-06 16:31:00', N'Đã điểm danh'),
(1, 3,  '2025-12-06 07:40:00', '2025-12-06 16:35:00', N'Đã điểm danh'),
(1, 4,  '2025-12-06 07:42:00', '2025-12-06 16:36:00', N'Đã điểm danh'),
(1, 5,  '2025-12-06 07:45:00', NULL,                  N'Đã điểm danh'),
(1, 6,  '2025-12-06 07:46:00', NULL,                  N'Đã điểm danh'),
(1, 7,  '2025-12-06 07:50:00', NULL,                  N'Đã điểm danh'),
(1, 8,  '2025-12-06 07:30:00', NULL,                  N'Chưa điểm danh'),
(2, 9,  '2025-11-15 07:55:00', NULL,                  N'Đã điểm danh'),
(2, 10, '2025-11-15 07:57:00', NULL,                  N'Đã điểm danh'),
(2, 11, '2025-11-15 08:02:00', NULL,                  N'Đã điểm danh'),
(2, 12, '2025-11-15 08:05:00', NULL,                  N'Đã điểm danh'),
(3, 14, '2025-11-20 13:40:00', NULL,                  N'Đã điểm danh'),
(3, 15, '2025-11-20 13:42:00', NULL,                  N'Đã điểm danh'),
(3, 16, '2025-11-20 13:30:00', NULL,                  N'Chưa điểm danh'),
(4, 17, '2025-12-13 07:40:00', NULL,                  N'Đã điểm danh'),
(4, 18, '2025-12-13 07:41:00', NULL,                  N'Đã điểm danh'),
(4, 19, '2025-12-13 07:50:00', NULL,                  N'Đã điểm danh'),
(4, 20, '2025-12-13 07:52:00', NULL,                  N'Đã điểm danh'),
(5, 21, '2025-11-28 13:55:00', NULL,                  N'Đã điểm danh'),
(5, 22, '2025-11-28 13:56:00', NULL,                  N'Đã điểm danh'),
(5, 23, '2025-11-28 14:05:00', NULL,                  N'Đã điểm danh'),
(5, 24, '2025-11-28 13:45:00', NULL,                  N'Chưa điểm danh'),
(6, 1,  '2025-12-06 16:20:00', '2025-12-06 16:20:00', N'Đã điểm danh'),
(6, 2,  '2025-12-06 16:21:00', '2025-12-06 16:21:00', N'Đã điểm danh'),
(6, 3,  '2025-12-06 16:25:00', '2025-12-06 16:25:00', N'Đã điểm danh');

----- 36. ĐIỂM RÈN LUYỆN
INSERT INTO DIEMRENLUYEN (MaSV, MaHD, HocKy, NamHoc, SoDiem, LyDo, TrangThai, MaDiemGoc, NgayGhi) VALUES
(1,  1, N'Học kỳ 1', '2025-2026', 10, N'Tham gia cuộc thi học thuật cấp Khoa', N'Đã điều chỉnh', NULL, '2025-12-07 08:00:00'),  -- 1
(2,  1, N'Học kỳ 1', '2025-2026', 10, N'Tham gia cuộc thi học thuật cấp Khoa', N'Đã điều chỉnh', NULL, '2025-12-07 08:00:00'),  -- 2
(3,  1, N'Học kỳ 1', '2025-2026', 10, N'Tham gia cuộc thi học thuật cấp Khoa', N'Đã xác nhận',  NULL, '2025-12-07 08:00:00'),  -- 3
(4,  1, N'Học kỳ 1', '2025-2026', 10, N'Tham gia cuộc thi học thuật cấp Khoa', N'Đã xác nhận',  NULL, '2025-12-07 08:00:00'),  -- 4
(5,  1, N'Học kỳ 1', '2025-2026', 10, N'Tham gia cuộc thi học thuật cấp Khoa', N'Đã xác nhận',  NULL, '2025-12-07 08:00:00'),  -- 5
(6,  1, N'Học kỳ 1', '2025-2026', 10, N'Tham gia cuộc thi học thuật cấp Khoa', N'Đã xác nhận',  NULL, '2025-12-07 08:00:00'),  -- 6
(7,  1, N'Học kỳ 1', '2025-2026', 10, N'Tham gia cuộc thi học thuật cấp Khoa', N'Đã xác nhận',  NULL, '2025-12-07 08:00:00'),  -- 7
(8,  1, N'Học kỳ 1', '2025-2026', 10, N'Đăng ký dự thi nhưng không điểm danh', N'Từ chối',      NULL, '2025-12-07 08:00:00'),  -- 8
(1,  2, N'Học kỳ 1', '2025-2026', 5,  N'Tham dự seminar',                      N'Đã xác nhận',  NULL, '2025-11-16 08:00:00'),  -- 9
(2,  2, N'Học kỳ 1', '2025-2026', 5,  N'Tham dự seminar',                      N'Đã xác nhận',  NULL, '2025-11-16 08:00:00'),  -- 10
(4,  2, N'Học kỳ 1', '2025-2026', 5,  N'Tham dự seminar',                      N'Đã xác nhận',  NULL, '2025-11-16 08:00:00'),  -- 11
(5,  2, N'Học kỳ 1', '2025-2026', 5,  N'Tham dự seminar',                      N'Đã xác nhận',  NULL, '2025-11-16 08:00:00'),  -- 12
(3,  3, N'Học kỳ 1', '2025-2026', 5,  N'Tham dự workshop',                     N'Chờ xác nhận', NULL, '2025-11-21 08:00:00'),  -- 13
(7,  3, N'Học kỳ 1', '2025-2026', 5,  N'Tham dự workshop',                     N'Chờ xác nhận', NULL, '2025-11-21 08:00:00'),  -- 14
(9,  5, N'Học kỳ 1', '2025-2026', 10, N'Tham gia cuộc thi khởi nghiệp',        N'Đã xác nhận',  NULL, '2025-12-14 08:00:00'),  -- 15
(10, 5, N'Học kỳ 1', '2025-2026', 10, N'Tham gia cuộc thi khởi nghiệp',        N'Đã xác nhận',  NULL, '2025-12-14 08:00:00'),  -- 16
(11, 5, N'Học kỳ 1', '2025-2026', 10, N'Tham gia cuộc thi khởi nghiệp',        N'Đã xác nhận',  NULL, '2025-12-14 08:00:00'),  -- 17
(12, 5, N'Học kỳ 1', '2025-2026', 10, N'Tham gia cuộc thi khởi nghiệp',        N'Đã xác nhận',  NULL, '2025-12-14 08:00:00'),  -- 18
(9,  6, N'Học kỳ 1', '2025-2026', 5,  N'Tham dự seminar',                      N'Đã xác nhận',  NULL, '2025-11-29 08:00:00'),  -- 19
(10, 6, N'Học kỳ 1', '2025-2026', 5,  N'Tham dự seminar',                      N'Đã xác nhận',  NULL, '2025-11-29 08:00:00'),  -- 20
(11, 6, N'Học kỳ 1', '2025-2026', 5,  N'Tham dự seminar',                      N'Đã xác nhận',  NULL, '2025-11-29 08:00:00'),  -- 21
(1,  1, N'Học kỳ 1', '2025-2026', 15, N'Điều chỉnh tăng do đạt giải Nhất',     N'Đã xác nhận',  1,    '2025-12-10 09:00:00'),  -- 22
(2,  1, N'Học kỳ 1', '2025-2026', 15, N'Điều chỉnh tăng do đạt giải Nhất',     N'Đã xác nhận',  2,    '2025-12-10 09:00:00');  -- 23

----- 37. GIẢI THƯỞNG CUỘC THI
INSERT INTO GIAITHUONG (MaCThi, TenGT, TienThuong, SLGiai) VALUES
(1, N'Giải Nhất',        5000000, 1),  -- 1
(1, N'Giải Nhì',         3000000, 1),  -- 2
(1, N'Giải Ba',          2000000, 2),  -- 3
(1, N'Giải Khuyến khích', 500000, 2),  -- 4
(2, N'Giải Nhất',        4000000, 1),  -- 5
(2, N'Giải Nhì',         2500000, 1);  -- 6

----- 38. KẾT QUẢ HỌC THUẬT
INSERT INTO KETQUAHOCTHUAT (MaCThi, MaDoi, MaGT, DiemSo, XepHang, GhiChu) VALUES
(1, 1, 1, 92.50, 1, N'Xuất sắc ở cả hai phần thi'),
(1, 3, 2, 88.00, 2, NULL),
(1, 2, 3, 84.25, 3, NULL),
(1, 4, 3, 79.00, 4, NULL),
(2, 5, 5, 90.00, 1, N'Ý tưởng có tính khả thi cao'),
(2, 6, 6, 85.50, 2, NULL);

----- 39. HỒ SƠ QUYẾT TOÁN
INSERT INTO HOSOQUYETTOAN (MaHD, NguoiLap, NguoiDuyet, TrangThai, NgayLap, NgayDuyet, GhiChu) VALUES
(1, 2, 1,    N'Đã duyệt',  '2025-12-15T09:00:00+07:00', '2025-12-20T10:00:00+07:00', N'Hồ sơ đầy đủ chứng từ'),
(2, 2, 1,    N'Đã duyệt',  '2025-11-20T09:00:00+07:00', '2025-11-25T10:00:00+07:00', NULL),
(3, 2, 1,    N'Từ chối',   '2025-11-25T09:00:00+07:00', '2025-11-28T10:00:00+07:00', N'Thiếu biên bản nghiệm thu thù lao diễn giả'),
(5, 3, NULL, N'Chờ duyệt', '2025-12-18T09:00:00+07:00', NULL,                         NULL),
(6, 3, NULL, N'Dự thảo',   '2025-12-05T09:00:00+07:00', NULL,                         N'Đang bổ sung hóa đơn');

----- 40. PHIÊN ĐĂNG NHẬP
INSERT INTO PHIENDANGNHAP (MaBamToken, MaTK, PBMatKhau, TaoLuc, HetHanLuc) VALUES
(CONVERT(CHAR(64), HASHBYTES('SHA2_256', 'token-admin-001'), 2),    1,  0, SYSDATETIMEOFFSET(), DATEADD(HOUR, 8, SYSDATETIMEOFFSET())),
(CONVERT(CHAR(64), HASHBYTES('SHA2_256', 'token-cb-huong-001'), 2), 2,  0, SYSDATETIMEOFFSET(), DATEADD(HOUR, 8, SYSDATETIMEOFFSET())),
(CONVERT(CHAR(64), HASHBYTES('SHA2_256', 'token-sv-22110001'), 2),  10, 0, SYSDATETIMEOFFSET(), DATEADD(HOUR, 2, SYSDATETIMEOFFSET()));

PRINT N'Đã thêm dữ liệu mẫu thành công!';

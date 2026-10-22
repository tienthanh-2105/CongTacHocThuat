-- CẤU TRÚC 31 BẢNG: 23 BẢNG GỐC + 8 BẢNG BỔ SUNG
-- Chạy trong database QL_CongTacHocThuat chưa có bảng.
-- Đây là cấu trúc tối giản; API nghiệp vụ sẽ kiểm tra quan hệ xuyên bảng.
SET search_path TO public;
-- =========================================================
-- DATABASE: QUẢN LÝ CÔNG TÁC HỌC THUẬT
-- PostgreSQL
-- =========================================================

-- =========================================================
-- 1. KHOA
-- =========================================================

CREATE TABLE khoa (
    ma_khoa BIGSERIAL PRIMARY KEY,
    ten_khoa VARCHAR(150) NOT NULL UNIQUE
);


-- =========================================================
-- 2. LỚP
-- =========================================================

CREATE TABLE lop (
    ma_lop BIGSERIAL PRIMARY KEY,
    ten_lop VARCHAR(100) NOT NULL,
    khoa_hoc VARCHAR(50),
    ma_khoa BIGINT NOT NULL,

    CONSTRAINT fk_lop_khoa
        FOREIGN KEY (ma_khoa)
        REFERENCES khoa(ma_khoa)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_lop_khoa
        UNIQUE (ten_lop, ma_khoa)
);


-- =========================================================
-- 3. NGƯỜI DÙNG
-- =========================================================

CREATE TABLE nguoi_dung (
    ma_nguoi_dung BIGSERIAL PRIMARY KEY,
    ho_ten VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE,
    sdt VARCHAR(20),
    ngay_sinh DATE,
    gioi_tinh VARCHAR(20),
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'HOAT_DONG',

    CONSTRAINT ck_nguoi_dung_trang_thai
        CHECK (trang_thai IN ('HOAT_DONG', 'KHOA', 'NGUNG'))
);


-- =========================================================
-- 4. VAI TRÒ
-- =========================================================

CREATE TABLE vai_tro (
    ma_vai_tro BIGSERIAL PRIMARY KEY,
    ten_vai_tro VARCHAR(100) NOT NULL UNIQUE
);


-- =========================================================
-- 5. TÀI KHOẢN
-- =========================================================

CREATE TABLE tai_khoan (
    ma_tai_khoan BIGSERIAL PRIMARY KEY,
    ma_nguoi_dung BIGINT UNIQUE,
    ma_vai_tro BIGINT NOT NULL,
    ten_dang_nhap VARCHAR(100) NOT NULL UNIQUE,
    mat_khau VARCHAR(255) NOT NULL,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'HOAT_DONG',

    CONSTRAINT fk_tai_khoan_nguoi_dung
        FOREIGN KEY (ma_nguoi_dung)
        REFERENCES nguoi_dung(ma_nguoi_dung)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_tai_khoan_vai_tro
        FOREIGN KEY (ma_vai_tro)
        REFERENCES vai_tro(ma_vai_tro)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_tai_khoan_trang_thai
        CHECK (trang_thai IN ('HOAT_DONG', 'KHOA', 'NGUNG'))
);


-- =========================================================
-- 6. PHÂN QUYỀN
-- =========================================================

CREATE TABLE phan_quyen (
    ma_quyen BIGSERIAL PRIMARY KEY,
    ten_quyen VARCHAR(100) NOT NULL UNIQUE,
    mo_ta TEXT
);


CREATE TABLE vai_tro_phan_quyen (
    ma_vai_tro BIGINT NOT NULL,
    ma_quyen BIGINT NOT NULL,

    PRIMARY KEY (ma_vai_tro, ma_quyen),

    CONSTRAINT fk_vtpq_vai_tro
        FOREIGN KEY (ma_vai_tro)
        REFERENCES vai_tro(ma_vai_tro)
        ON DELETE CASCADE,

    CONSTRAINT fk_vtpq_quyen
        FOREIGN KEY (ma_quyen)
        REFERENCES phan_quyen(ma_quyen)
        ON DELETE CASCADE
);


-- =========================================================
-- 7. SINH VIÊN
-- =========================================================

CREATE TABLE sinh_vien (
    ma_sv BIGSERIAL PRIMARY KEY,
    ma_nguoi_dung BIGINT UNIQUE,
    ma_lop BIGINT NOT NULL,

    CONSTRAINT fk_sinh_vien_nguoi_dung
        FOREIGN KEY (ma_nguoi_dung)
        REFERENCES nguoi_dung(ma_nguoi_dung)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_sinh_vien_lop
        FOREIGN KEY (ma_lop)
        REFERENCES lop(ma_lop)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- 8. GIẢNG VIÊN
-- =========================================================

CREATE TABLE giang_vien (
    ma_giang_vien BIGSERIAL PRIMARY KEY,
    ma_nguoi_dung BIGINT UNIQUE,
    hoc_vi VARCHAR(100),

    CONSTRAINT fk_giang_vien_nguoi_dung
        FOREIGN KEY (ma_nguoi_dung)
        REFERENCES nguoi_dung(ma_nguoi_dung)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- 9. CÁN BỘ KHOA
-- =========================================================

CREATE TABLE can_bo_khoa (
    ma_can_bo BIGSERIAL PRIMARY KEY,
    ma_nguoi_dung BIGINT UNIQUE,
    ma_khoa BIGINT NOT NULL,
    chuc_vu VARCHAR(150),

    CONSTRAINT fk_can_bo_nguoi_dung
        FOREIGN KEY (ma_nguoi_dung)
        REFERENCES nguoi_dung(ma_nguoi_dung)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_can_bo_khoa
        FOREIGN KEY (ma_khoa)
        REFERENCES khoa(ma_khoa)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- 10. QUẢN TRỊ VIÊN
-- =========================================================

CREATE TABLE quan_tri_vien (
    ma_quan_tri BIGSERIAL PRIMARY KEY,
    ma_nguoi_dung BIGINT UNIQUE,

    CONSTRAINT fk_quan_tri_nguoi_dung
        FOREIGN KEY (ma_nguoi_dung)
        REFERENCES nguoi_dung(ma_nguoi_dung)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- 11. KẾ HOẠCH HỌC THUẬT
-- =========================================================

CREATE TABLE ke_hoach_hoc_thuat (
    ma_ke_hoach BIGSERIAL PRIMARY KEY,
    ten_ke_hoach VARCHAR(200) NOT NULL,
    nam_hoc VARCHAR(20) NOT NULL,
    hoc_ky VARCHAR(30),
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'DU_THAO',
    ma_khoa BIGINT NOT NULL,
    nguoi_phu_trach BIGINT,

    CONSTRAINT fk_ke_hoach_khoa
        FOREIGN KEY (ma_khoa)
        REFERENCES khoa(ma_khoa)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_ke_hoach_phu_trach
        FOREIGN KEY (nguoi_phu_trach)
        REFERENCES can_bo_khoa(ma_can_bo)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT ck_ke_hoach_trang_thai
        CHECK (
            trang_thai IN
            ('DU_THAO', 'CHO_DUYET', 'CAN_BO_SUNG', 'DA_DUYET', 'KHONG_DUYET')
        )
);


-- =========================================================
-- 12. HOẠT ĐỘNG HỌC THUẬT
-- =========================================================

CREATE TABLE hoat_dong_hoc_thuat (
    ma_hoat_dong BIGSERIAL PRIMARY KEY,
    ma_ke_hoach BIGINT,
    ten_hoat_dong VARCHAR(250) NOT NULL,
    mo_ta TEXT,
    tg_bat_dau TIMESTAMP NOT NULL,
    tg_ket_thuc TIMESTAMP NOT NULL,
    han_dang_ky TIMESTAMP,
    dia_diem VARCHAR(255),
    so_luong_toi_da INTEGER,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'DU_THAO',

    CONSTRAINT fk_hoat_dong_ke_hoach
        FOREIGN KEY (ma_ke_hoach)
        REFERENCES ke_hoach_hoc_thuat(ma_ke_hoach)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT ck_hoat_dong_thoi_gian
        CHECK (tg_ket_thuc > tg_bat_dau),

    CONSTRAINT ck_hoat_dong_so_luong
        CHECK (so_luong_toi_da IS NULL OR so_luong_toi_da > 0),

    CONSTRAINT ck_hoat_dong_trang_thai
        CHECK (
            trang_thai IN
            ('DU_THAO', 'CHO_DUYET', 'DA_CONG_BO',
             'DANG_DIEN_RA', 'DA_KET_THUC', 'DA_HUY')
        )
);


-- =========================================================
-- 13. CUỘC THI
-- =========================================================

CREATE TABLE cuoc_thi (
    ma_cuoc_thi BIGSERIAL PRIMARY KEY,
    ma_hoat_dong BIGINT UNIQUE NOT NULL,
    ten_cuoc_thi VARCHAR(250) NOT NULL,
    cap_to_chuc VARCHAR(100),
    the_le TEXT NOT NULL,
    tieu_chi_cham TEXT,
    so_luong_sv INTEGER,
    hinh_thuc_thi VARCHAR(30) DEFAULT 'CA_NHAN',

    CONSTRAINT fk_cuoc_thi_hoat_dong
        FOREIGN KEY (ma_hoat_dong)
        REFERENCES hoat_dong_hoc_thuat(ma_hoat_dong)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT ck_cuoc_thi_so_luong
        CHECK (so_luong_sv IS NULL OR so_luong_sv > 0),

    CONSTRAINT ck_cuoc_thi_hinh_thuc
        CHECK (hinh_thuc_thi IN ('CA_NHAN', 'THEO_DOI'))
);


-- =========================================================
-- 14. SEMINAR
-- =========================================================

CREATE TABLE seminar (
    ma_seminar BIGSERIAL PRIMARY KEY,
    ma_hoat_dong BIGINT UNIQUE NOT NULL,
    chu_de VARCHAR(250) NOT NULL,
    noi_dung TEXT,
    doi_tuong_tham_gia TEXT,
    thoi_luong INTEGER,
    don_vi_chu_tri VARCHAR(200),
    don_vi_phoi_hop VARCHAR(200),

    CONSTRAINT fk_seminar_hoat_dong
        FOREIGN KEY (ma_hoat_dong)
        REFERENCES hoat_dong_hoc_thuat(ma_hoat_dong)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT ck_seminar_thoi_luong
        CHECK (thoi_luong IS NULL OR thoi_luong > 0)
);


-- =========================================================
-- 15. ĐĂNG KÝ THAM GIA
-- =========================================================

CREATE TABLE dang_ky_tham_gia (
    ma_dang_ky BIGSERIAL PRIMARY KEY,
    ma_hoat_dong BIGINT NOT NULL,
    ma_sv BIGINT NOT NULL,
    ngay_dang_ky TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hinh_thuc VARCHAR(30) NOT NULL,
    nguon_dang_ky VARCHAR(30) NOT NULL DEFAULT 'SINH_VIEN',
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'DA_DANG_KY',

    CONSTRAINT fk_dang_ky_hoat_dong
        FOREIGN KEY (ma_hoat_dong)
        REFERENCES hoat_dong_hoc_thuat(ma_hoat_dong)
        ON DELETE RESTRICT,

    CONSTRAINT fk_dang_ky_sinh_vien
        FOREIGN KEY (ma_sv)
        REFERENCES sinh_vien(ma_sv)
        ON DELETE RESTRICT,

    CONSTRAINT uq_dang_ky_sv_hoat_dong
        UNIQUE (ma_hoat_dong, ma_sv),

    CONSTRAINT ck_dang_ky_hinh_thuc
        CHECK (hinh_thuc IN ('THAM_GIA', 'CO_VU')),

    CONSTRAINT ck_dang_ky_nguon
        CHECK (nguon_dang_ky IN ('SINH_VIEN', 'GIANG_VIEN', 'KHOA')),

    CONSTRAINT ck_dang_ky_trang_thai
        CHECK (
            trang_thai IN
            ('DA_DANG_KY', 'DA_XAC_NHAN', 'DA_HUY', 'TU_CHOI')
        )
);


-- =========================================================
-- 16. PHÂN CÔNG CỔ VŨ
-- =========================================================

CREATE TABLE phan_cong_co_vu (
    ma_co_vu BIGSERIAL PRIMARY KEY,
    ma_hoat_dong BIGINT NOT NULL,
    ma_lop BIGINT NOT NULL,
    so_luong INTEGER NOT NULL,
    nhiem_vu TEXT,
    ngay_phan_cong TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trang_thai VARCHAR(30) DEFAULT 'DANG_THUC_HIEN',

    CONSTRAINT fk_co_vu_hoat_dong
        FOREIGN KEY (ma_hoat_dong)
        REFERENCES hoat_dong_hoc_thuat(ma_hoat_dong)
        ON DELETE RESTRICT,

    CONSTRAINT fk_co_vu_lop
        FOREIGN KEY (ma_lop)
        REFERENCES lop(ma_lop)
        ON DELETE RESTRICT,

    CONSTRAINT uq_co_vu_hoat_dong_lop
        UNIQUE (ma_hoat_dong, ma_lop),

    CONSTRAINT ck_co_vu_so_luong
        CHECK (so_luong > 0)
);


-- =========================================================
-- 17. ĐỀ TÀI
-- =========================================================

CREATE TABLE de_tai (
    ma_de_tai BIGSERIAL PRIMARY KEY,
    ma_cuoc_thi BIGINT NOT NULL,
    ma_dang_ky BIGINT,
    ten_de_tai VARCHAR(250) NOT NULL,
    linh_vuc VARCHAR(200),
    mo_ta TEXT,
    ngay_bat_dau DATE,
    ngay_ket_thuc DATE,
    trang_thai VARCHAR(30) DEFAULT 'DANG_THUC_HIEN',

    CONSTRAINT fk_de_tai_cuoc_thi
        FOREIGN KEY (ma_cuoc_thi)
        REFERENCES cuoc_thi(ma_cuoc_thi)
        ON DELETE CASCADE,

    CONSTRAINT fk_de_tai_dang_ky
        FOREIGN KEY (ma_dang_ky)
        REFERENCES dang_ky_tham_gia(ma_dang_ky)
        ON DELETE SET NULL,

    CONSTRAINT ck_de_tai_thoi_gian
        CHECK (
            ngay_ket_thuc IS NULL
            OR ngay_bat_dau IS NULL
            OR ngay_ket_thuc >= ngay_bat_dau
        )
);


-- =========================================================
-- 18. MÃ QR
-- =========================================================

CREATE TABLE ma_qr (
    ma_qr BIGSERIAL PRIMARY KEY,
    ma_hoat_dong BIGINT NOT NULL,
    ma_qr_code VARCHAR(255) NOT NULL UNIQUE,
    tg_het_han TIMESTAMP NOT NULL,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'HOAT_DONG',

    CONSTRAINT fk_ma_qr_hoat_dong
        FOREIGN KEY (ma_hoat_dong)
        REFERENCES hoat_dong_hoc_thuat(ma_hoat_dong)
        ON DELETE CASCADE,

    CONSTRAINT ck_ma_qr_trang_thai
        CHECK (
            trang_thai IN ('HOAT_DONG', 'HET_HAN', 'THU_HOI')
        )
);


-- =========================================================
-- 19. ĐIỂM DANH
-- =========================================================

CREATE TABLE diem_danh (
    ma_diem_danh BIGSERIAL PRIMARY KEY,
    ma_qr BIGINT NOT NULL,
    ma_dang_ky BIGINT NOT NULL,
    bat_dau_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ket_thuc_luc TIMESTAMP,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'DA_DIEM_DANH',

    CONSTRAINT fk_diem_danh_qr
        FOREIGN KEY (ma_qr)
        REFERENCES ma_qr(ma_qr)
        ON DELETE RESTRICT,

    CONSTRAINT fk_diem_danh_dang_ky
        FOREIGN KEY (ma_dang_ky)
        REFERENCES dang_ky_tham_gia(ma_dang_ky)
        ON DELETE RESTRICT,

    CONSTRAINT uq_diem_danh_dang_ky
        UNIQUE (ma_dang_ky),

    CONSTRAINT ck_diem_danh_trang_thai
        CHECK (
            trang_thai IN
            ('DA_DIEM_DANH', 'DA_XAC_NHAN', 'TU_CHOI')
        )
);


-- =========================================================
-- 20. GIẢI THƯỞNG
-- =========================================================

CREATE TABLE giai_thuong (
    ma_giai_thuong BIGSERIAL PRIMARY KEY,
    ma_cuoc_thi BIGINT NOT NULL,
    ten_giai_thuong VARCHAR(150) NOT NULL,
    cap_giai VARCHAR(100),

    CONSTRAINT fk_giai_thuong_cuoc_thi
        FOREIGN KEY (ma_cuoc_thi)
        REFERENCES cuoc_thi(ma_cuoc_thi)
        ON DELETE CASCADE
);


-- =========================================================
-- 21. KẾT QUẢ HỌC THUẬT
-- =========================================================

CREATE TABLE ket_qua_hoc_thuat (
    ma_ket_qua BIGSERIAL PRIMARY KEY,
    ma_cuoc_thi BIGINT NOT NULL,
    ma_dang_ky BIGINT NOT NULL,
    ma_giai_thuong BIGINT,
    loai_ket_qua VARCHAR(50),
    xep_hang INTEGER,
    diem NUMERIC(5,2),
    ghi_chu TEXT,
    trang_thai VARCHAR(30) DEFAULT 'DU_THAO',

    CONSTRAINT fk_ket_qua_cuoc_thi
        FOREIGN KEY (ma_cuoc_thi)
        REFERENCES cuoc_thi(ma_cuoc_thi)
        ON DELETE CASCADE,

    CONSTRAINT fk_ket_qua_dang_ky
        FOREIGN KEY (ma_dang_ky)
        REFERENCES dang_ky_tham_gia(ma_dang_ky)
        ON DELETE RESTRICT,

    CONSTRAINT fk_ket_qua_giai_thuong
        FOREIGN KEY (ma_giai_thuong)
        REFERENCES giai_thuong(ma_giai_thuong)
        ON DELETE SET NULL,

    CONSTRAINT ck_ket_qua_diem
        CHECK (diem IS NULL OR (diem >= 0 AND diem <= 100)),

    CONSTRAINT ck_ket_qua_xep_hang
        CHECK (xep_hang IS NULL OR xep_hang > 0),

    CONSTRAINT ck_ket_qua_trang_thai
        CHECK (
            trang_thai IN
            ('DU_THAO', 'DA_XAC_NHAN', 'DA_CONG_BO')
        )
);


-- =========================================================
-- 22. ĐIỂM RÈN LUYỆN
-- =========================================================

CREATE TABLE diem_ren_luyen (
    ma_diem BIGSERIAL PRIMARY KEY,
    ma_sv BIGINT NOT NULL,
    ma_hoat_dong BIGINT NOT NULL,
    hoc_ky VARCHAR(30) NOT NULL,
    nam_hoc VARCHAR(20) NOT NULL,
    so_diem NUMERIC(5,2) NOT NULL,
    ly_do TEXT,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'CHO_XAC_NHAN',

    CONSTRAINT fk_drl_sinh_vien
        FOREIGN KEY (ma_sv)
        REFERENCES sinh_vien(ma_sv)
        ON DELETE RESTRICT,

    CONSTRAINT fk_drl_hoat_dong
        FOREIGN KEY (ma_hoat_dong)
        REFERENCES hoat_dong_hoc_thuat(ma_hoat_dong)
        ON DELETE RESTRICT,

    CONSTRAINT ck_drl_so_diem
        CHECK (so_diem >= 0),

    CONSTRAINT ck_drl_trang_thai
        CHECK (
            trang_thai IN
            ('CHO_XAC_NHAN', 'DA_XAC_NHAN', 'DA_DIEU_CHINH', 'TU_CHOI')
        )
);


-- =========================================================
-- 23. INDEX
-- =========================================================

CREATE INDEX idx_lop_khoa
    ON lop(ma_khoa);

CREATE INDEX idx_sv_lop
    ON sinh_vien(ma_lop);

CREATE INDEX idx_hoat_dong_ke_hoach
    ON hoat_dong_hoc_thuat(ma_ke_hoach);

CREATE INDEX idx_hoat_dong_thoi_gian
    ON hoat_dong_hoc_thuat(tg_bat_dau, tg_ket_thuc);

CREATE INDEX idx_dang_ky_hoat_dong
    ON dang_ky_tham_gia(ma_hoat_dong);

CREATE INDEX idx_dang_ky_sinh_vien
    ON dang_ky_tham_gia(ma_sv);

CREATE INDEX idx_diem_danh_dang_ky
    ON diem_danh(ma_dang_ky);

CREATE INDEX idx_drl_sinh_vien
    ON diem_ren_luyen(ma_sv);

CREATE INDEX idx_drl_hoat_dong
    ON diem_ren_luyen(ma_hoat_dong);

ALTER TABLE tai_khoan ADD COLUMN phien_ban_mat_khau INTEGER NOT NULL DEFAULT 0;
CREATE TABLE phien_dang_nhap (
 ma_phien UUID PRIMARY KEY, ma_bam_token CHAR(64) NOT NULL UNIQUE,
 ma_tai_khoan BIGINT NOT NULL REFERENCES tai_khoan ON DELETE CASCADE,
 phien_ban_mat_khau INTEGER NOT NULL, tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), het_han_luc TIMESTAMPTZ NOT NULL
);

CREATE TABLE bo_mon (
 ma_bo_mon BIGSERIAL PRIMARY KEY, ma_khoa BIGINT NOT NULL REFERENCES khoa,
 ten_bo_mon VARCHAR(150) NOT NULL, UNIQUE(ma_khoa,ten_bo_mon)
);

CREATE TABLE ban_cuoc_thi (
 ma_ban BIGSERIAL PRIMARY KEY, ma_cuoc_thi BIGINT NOT NULL REFERENCES cuoc_thi,
 ten_ban VARCHAR(150) NOT NULL, UNIQUE(ma_cuoc_thi,ten_ban)
);

CREATE TABLE thanh_vien_ban (
 ma_ban BIGINT REFERENCES ban_cuoc_thi, ma_giang_vien BIGINT REFERENCES giang_vien,
 chuc_vu VARCHAR(100), PRIMARY KEY(ma_ban,ma_giang_vien)
);

CREATE TABLE doi_thi (
 ma_doi BIGSERIAL PRIMARY KEY, ma_cuoc_thi BIGINT NOT NULL REFERENCES cuoc_thi,
 ten_doi VARCHAR(150) NOT NULL, UNIQUE(ma_cuoc_thi,ten_doi)
);

CREATE TABLE thanh_vien_doi (
 ma_doi BIGINT REFERENCES doi_thi, ma_sv BIGINT REFERENCES sinh_vien,
 vai_tro VARCHAR(30) NOT NULL DEFAULT 'THANH_VIEN' CHECK(vai_tro IN ('TRUONG_DOI','THANH_VIEN')),
 PRIMARY KEY(ma_doi,ma_sv)
);

CREATE TABLE ho_so_quyet_toan (
 ma_ho_so BIGSERIAL PRIMARY KEY, ma_hoat_dong BIGINT NOT NULL REFERENCES hoat_dong_hoc_thuat,
 nguoi_lap BIGINT NOT NULL REFERENCES tai_khoan, nguoi_duyet BIGINT REFERENCES tai_khoan,
 trang_thai VARCHAR(30) NOT NULL DEFAULT 'DU_THAO' CHECK(trang_thai IN ('DU_THAO','CHO_DUYET','DA_DUYET','CAN_BO_SUNG','TU_CHOI')),
 ngay_lap TIMESTAMPTZ NOT NULL DEFAULT now(), ngay_duyet TIMESTAMPTZ, ghi_chu TEXT
);

CREATE TABLE chi_phi_thuc_te (
 ma_chi_phi BIGSERIAL PRIMARY KEY, ma_hoat_dong BIGINT NOT NULL REFERENCES hoat_dong_hoc_thuat,
 noi_dung TEXT NOT NULL, so_tien NUMERIC(18,2) NOT NULL CHECK(so_tien>=0),
 ngay_chi DATE NOT NULL, nguoi_ghi BIGINT NOT NULL REFERENCES tai_khoan
);

CREATE INDEX idx_phien_tai_khoan ON phien_dang_nhap(ma_tai_khoan);
CREATE INDEX idx_phien_het_han ON phien_dang_nhap(het_han_luc);
CREATE UNIQUE INDEX idx_mot_truong_doi ON thanh_vien_doi(ma_doi) WHERE vai_tro='TRUONG_DOI';
ALTER TABLE giang_vien ADD COLUMN ma_bo_mon BIGINT REFERENCES bo_mon;
ALTER TABLE ke_hoach_hoc_thuat ADD COLUMN ma_bo_mon BIGINT REFERENCES bo_mon;
ALTER TABLE ke_hoach_hoc_thuat ADD COLUMN loai_ke_hoach VARCHAR(20) NOT NULL DEFAULT 'KHOA' CHECK(loai_ke_hoach IN ('KHOA','BO_MON'));
ALTER TABLE ke_hoach_hoc_thuat ADD CONSTRAINT ck_ke_hoach_bo_mon CHECK(loai_ke_hoach <> 'BO_MON' OR ma_bo_mon IS NOT NULL);
ALTER TABLE ke_hoach_hoc_thuat ADD COLUMN nguoi_duyet BIGINT REFERENCES tai_khoan;
ALTER TABLE ke_hoach_hoc_thuat ADD COLUMN ngay_duyet TIMESTAMPTZ;
ALTER TABLE ke_hoach_hoc_thuat ADD COLUMN lich_su_duyet JSONB NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(lich_su_duyet)='array');
ALTER TABLE hoat_dong_hoc_thuat ADD COLUMN ma_ke_hoach_khoa BIGINT REFERENCES ke_hoach_hoc_thuat;
ALTER TABLE hoat_dong_hoc_thuat ADD COLUMN kinh_phi_du_tru NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(kinh_phi_du_tru>=0);
ALTER TABLE hoat_dong_hoc_thuat ADD COLUMN noi_dung_cong_bo TEXT;
ALTER TABLE hoat_dong_hoc_thuat ADD COLUMN ngay_cong_bo TIMESTAMPTZ;
ALTER TABLE seminar ADD COLUMN dien_gia JSONB NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(dien_gia)='array');
ALTER TABLE thanh_vien_ban ADD COLUMN nhiem_vu JSONB NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(nhiem_vu)='array');
ALTER TABLE de_tai ADD COLUMN ma_doi BIGINT REFERENCES doi_thi;
ALTER TABLE de_tai ADD CONSTRAINT ck_de_tai_chu_so_huu CHECK(NOT(ma_doi IS NOT NULL AND ma_dang_ky IS NOT NULL));
ALTER TABLE ket_qua_hoc_thuat ADD COLUMN ma_doi BIGINT REFERENCES doi_thi;
ALTER TABLE ket_qua_hoc_thuat ALTER COLUMN ma_dang_ky DROP NOT NULL;
ALTER TABLE ket_qua_hoc_thuat ADD CONSTRAINT ck_doi_hoac_ca_nhan CHECK((ma_doi IS NOT NULL) <> (ma_dang_ky IS NOT NULL));
ALTER TABLE dang_ky_tham_gia DROP CONSTRAINT ck_dang_ky_hinh_thuc;
ALTER TABLE dang_ky_tham_gia ADD CONSTRAINT ck_dang_ky_hinh_thuc CHECK(hinh_thuc IN ('THAM_GIA','DU_THI','HO_TRO','CO_VU'));
ALTER TABLE dang_ky_tham_gia ADD COLUMN da_nhac_luc TIMESTAMPTZ;
ALTER TABLE phan_cong_co_vu ADD COLUMN loai_phan_cong VARCHAR(20) NOT NULL DEFAULT 'CO_VU' CHECK(loai_phan_cong IN ('CO_VU','HO_TRO'));
ALTER TABLE ma_qr ADD COLUMN tg_mo TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE ma_qr ADD CONSTRAINT ck_qr_thoi_gian CHECK(tg_het_han>tg_mo);
ALTER TABLE chi_phi_thuc_te ADD COLUMN ma_ho_so BIGINT REFERENCES ho_so_quyet_toan;
ALTER TABLE chi_phi_thuc_te ADD COLUMN chung_tu JSONB NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(chung_tu)='array');
ALTER TABLE diem_ren_luyen DROP CONSTRAINT ck_drl_so_diem;
ALTER TABLE diem_ren_luyen ADD CONSTRAINT ck_drl_so_diem CHECK(so_diem<>0);
ALTER TABLE diem_ren_luyen ADD COLUMN ma_diem_goc BIGINT REFERENCES diem_ren_luyen;
ALTER TABLE diem_ren_luyen ADD COLUMN nguoi_ghi BIGINT REFERENCES tai_khoan;
ALTER TABLE diem_ren_luyen ADD COLUMN ghi_luc TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE diem_ren_luyen ADD CONSTRAINT ck_diem_khong_tu_tham_chieu CHECK(ma_diem_goc IS NULL OR ma_diem_goc<>ma_diem);

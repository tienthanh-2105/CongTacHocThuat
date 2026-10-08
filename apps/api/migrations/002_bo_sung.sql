-- Bổ sung cho nguyên bản QL_CongTacHocThuat.sql, tên bảng/cột tiếng Việt không dấu.
ALTER TABLE tai_khoan ADD COLUMN phien_ban_mat_khau INTEGER NOT NULL DEFAULT 0;
CREATE TABLE phien_dang_nhap (
 ma_phien UUID PRIMARY KEY, ma_bam_token CHAR(64) NOT NULL UNIQUE,
 ma_tai_khoan BIGINT NOT NULL REFERENCES tai_khoan ON DELETE CASCADE,
 phien_ban_mat_khau INTEGER NOT NULL, tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), het_han_luc TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_phien_tai_khoan ON phien_dang_nhap(ma_tai_khoan);
CREATE INDEX idx_phien_het_han ON phien_dang_nhap(het_han_luc);
CREATE TABLE bo_mon (
 ma_bo_mon BIGSERIAL PRIMARY KEY, ma_khoa BIGINT NOT NULL REFERENCES khoa,
 ten_bo_mon VARCHAR(150) NOT NULL, UNIQUE(ma_khoa,ten_bo_mon)
);
ALTER TABLE giang_vien ADD COLUMN ma_bo_mon BIGINT REFERENCES bo_mon;
ALTER TABLE ke_hoach_hoc_thuat ADD COLUMN ma_bo_mon BIGINT REFERENCES bo_mon;
CREATE TABLE muc_ke_hoach (
 ma_muc BIGSERIAL PRIMARY KEY, ma_ke_hoach BIGINT NOT NULL REFERENCES ke_hoach_hoc_thuat,
 ten_cuoc_thi VARCHAR(250) NOT NULL, mo_ta TEXT, thoi_gian_du_kien DATE,
 kinh_phi_du_tru NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(kinh_phi_du_tru>=0)
);
CREATE TABLE tong_hop_ke_hoach (
 ma_ke_hoach_khoa BIGINT REFERENCES ke_hoach_hoc_thuat,
 ma_muc_bo_mon BIGINT REFERENCES muc_ke_hoach, PRIMARY KEY(ma_ke_hoach_khoa,ma_muc_bo_mon)
);
CREATE TABLE lich_su_duyet_ke_hoach (
 ma_lan_duyet BIGSERIAL PRIMARY KEY, ma_ke_hoach BIGINT NOT NULL REFERENCES ke_hoach_hoc_thuat,
 ma_tai_khoan BIGINT NOT NULL REFERENCES tai_khoan, ket_qua VARCHAR(30) NOT NULL,
 y_kien TEXT, thoi_gian TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE ban_cuoc_thi (
 ma_ban BIGSERIAL PRIMARY KEY, ma_cuoc_thi BIGINT NOT NULL REFERENCES cuoc_thi,
 ten_ban VARCHAR(150) NOT NULL, UNIQUE(ma_cuoc_thi,ten_ban)
);
CREATE TABLE thanh_vien_ban (
 ma_ban BIGINT REFERENCES ban_cuoc_thi, ma_giang_vien BIGINT REFERENCES giang_vien,
 chuc_vu VARCHAR(100), PRIMARY KEY(ma_ban,ma_giang_vien)
);
CREATE TABLE phan_cong_cong_viec (
 ma_cong_viec BIGSERIAL PRIMARY KEY, ma_ban BIGINT NOT NULL,
 ma_giang_vien BIGINT NOT NULL, noi_dung TEXT NOT NULL, han_hoan_thanh TIMESTAMPTZ,
 trang_thai VARCHAR(30) NOT NULL DEFAULT 'CHUA_THUC_HIEN',
 FOREIGN KEY(ma_ban,ma_giang_vien) REFERENCES thanh_vien_ban
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
CREATE UNIQUE INDEX idx_mot_truong_doi ON thanh_vien_doi(ma_doi) WHERE vai_tro='TRUONG_DOI';
ALTER TABLE de_tai ADD COLUMN ma_doi BIGINT REFERENCES doi_thi;
ALTER TABLE ket_qua_hoc_thuat ADD COLUMN ma_doi BIGINT REFERENCES doi_thi;
ALTER TABLE ket_qua_hoc_thuat ALTER COLUMN ma_dang_ky DROP NOT NULL;
ALTER TABLE ket_qua_hoc_thuat ADD CONSTRAINT ck_doi_hoac_ca_nhan CHECK((ma_doi IS NOT NULL) <> (ma_dang_ky IS NOT NULL));
CREATE TABLE chi_phi_thuc_te (
 ma_chi_phi BIGSERIAL PRIMARY KEY, ma_hoat_dong BIGINT NOT NULL REFERENCES hoat_dong_hoc_thuat,
 noi_dung TEXT NOT NULL, so_tien NUMERIC(18,2) NOT NULL CHECK(so_tien>=0),
 ngay_chi DATE NOT NULL, nguoi_ghi BIGINT NOT NULL REFERENCES tai_khoan
);
CREATE TABLE chung_tu_chi_phi (
 ma_chung_tu BIGSERIAL PRIMARY KEY, ma_chi_phi BIGINT NOT NULL REFERENCES chi_phi_thuc_te,
 so_chung_tu VARCHAR(100), ten_tep VARCHAR(255) NOT NULL, duong_dan TEXT NOT NULL
);
CREATE TABLE ho_so_quyet_toan (
 ma_ho_so BIGSERIAL PRIMARY KEY, ma_hoat_dong BIGINT NOT NULL REFERENCES hoat_dong_hoc_thuat,
 nguoi_lap BIGINT NOT NULL REFERENCES tai_khoan, nguoi_duyet BIGINT REFERENCES tai_khoan,
 trang_thai VARCHAR(30) NOT NULL DEFAULT 'DU_THAO' CHECK(trang_thai IN ('DU_THAO','CHO_DUYET','DA_DUYET','CAN_BO_SUNG','TU_CHOI')),
 ngay_lap TIMESTAMPTZ NOT NULL DEFAULT now(), ngay_duyet TIMESTAMPTZ, ghi_chu TEXT
);
CREATE TABLE chi_tiet_quyet_toan (
 ma_ho_so BIGINT REFERENCES ho_so_quyet_toan, ma_chi_phi BIGINT UNIQUE REFERENCES chi_phi_thuc_te,
 PRIMARY KEY(ma_ho_so,ma_chi_phi)
);
CREATE TABLE tin_tuc (
 ma_tin BIGSERIAL PRIMARY KEY, ma_hoat_dong BIGINT REFERENCES hoat_dong_hoc_thuat,
 tieu_de VARCHAR(250) NOT NULL, noi_dung TEXT NOT NULL, nguoi_viet BIGINT NOT NULL REFERENCES tai_khoan,
 trang_thai VARCHAR(30) NOT NULL DEFAULT 'DU_THAO', ngay_dang TIMESTAMPTZ
);
CREATE TABLE thong_bao (
 ma_thong_bao BIGSERIAL PRIMARY KEY, ma_tai_khoan BIGINT NOT NULL REFERENCES tai_khoan,
 ma_hoat_dong BIGINT REFERENCES hoat_dong_hoc_thuat, tieu_de VARCHAR(250) NOT NULL,
 noi_dung TEXT NOT NULL, tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), doc_luc TIMESTAMPTZ
);
CREATE TABLE thiet_bi_nhan_thong_bao (
 ma_thiet_bi BIGSERIAL PRIMARY KEY, ma_tai_khoan BIGINT NOT NULL REFERENCES tai_khoan,
 ma_nhan TEXT NOT NULL UNIQUE, nen_tang VARCHAR(30) NOT NULL, hoat_dong BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE lich_nhac_hoat_dong (
 ma_lich_nhac BIGSERIAL PRIMARY KEY, ma_dang_ky BIGINT NOT NULL REFERENCES dang_ky_tham_gia,
 nhac_luc TIMESTAMPTZ NOT NULL, gui_luc TIMESTAMPTZ, trang_thai VARCHAR(30) NOT NULL DEFAULT 'CHO_GUI',
 UNIQUE(ma_dang_ky,nhac_luc)
);
CREATE TABLE lich_su_dieu_chinh_diem (
 ma_dieu_chinh BIGSERIAL PRIMARY KEY, ma_diem BIGINT NOT NULL REFERENCES diem_ren_luyen,
 diem_truoc NUMERIC(5,2) NOT NULL, diem_sau NUMERIC(5,2) NOT NULL CHECK(diem_sau>=0),
 ly_do TEXT NOT NULL, nguoi_sua BIGINT NOT NULL REFERENCES tai_khoan,
 thoi_gian TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE nhat_ky_thao_tac (
 ma_nhat_ky BIGSERIAL PRIMARY KEY, ma_tai_khoan BIGINT REFERENCES tai_khoan,
 hanh_dong VARCHAR(100) NOT NULL, doi_tuong VARCHAR(100) NOT NULL, ma_doi_tuong TEXT,
 du_lieu_truoc JSONB, du_lieu_sau JSONB, thoi_gian TIMESTAMPTZ NOT NULL DEFAULT now()
);

const fs=require('node:fs');
const path=require('node:path');
const dir=path.join(__dirname,'../migrations');
const base=fs.readFileSync(path.join(dir,'000_cau_truc_goc.sql'),'utf8');
const extra=fs.readFileSync(path.join(dir,'002_bo_sung.sql'),'utf8');
const names=['phien_dang_nhap','bo_mon','ban_cuoc_thi','thanh_vien_ban','doi_thi','thanh_vien_doi','ho_so_quyet_toan','chi_phi_thuc_te'];
const tables=names.map(name=>{
 const match=extra.match(new RegExp('CREATE TABLE '+name+' \\([\\s\\S]*?\\n\\);'));
 if(!match) throw new Error('Missing '+name);
 return match[0];
});
const sql=`-- CẤU TRÚC 31 BẢNG: 23 BẢNG GỐC + 8 BẢNG BỔ SUNG
-- Chạy trong database QL_CongTacHocThuat chưa có bảng.
-- Đây là cấu trúc tối giản; API nghiệp vụ sẽ kiểm tra quan hệ xuyên bảng.
SET search_path TO public;
${base}

ALTER TABLE tai_khoan ADD COLUMN phien_ban_mat_khau INTEGER NOT NULL DEFAULT 0;
${tables.join('\n\n')}

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
`;
const count=[...sql.matchAll(/CREATE TABLE\s+(\w+)/g)].length;
if(count!==31)throw new Error('Expected 31 tables, got '+count);
fs.writeFileSync(path.join(dir,'003_cau_truc_31_bang.sql'),sql);
const reset=`-- XÓA TOÀN BỘ BẢNG PUBLIC VÀ DỮ LIỆU, TẠO LẠI 31 BẢNG.
-- Chỉ chạy khi đã sao lưu và muốn reset database đề tài.
BEGIN;
DO $$
DECLARE danh_sach TEXT;
BEGIN
 IF current_database()<>'QL_CongTacHocThuat' THEN RAISE EXCEPTION 'Sai database'; END IF;
 SELECT string_agg(format('%I.%I',schemaname,tablename),', ') INTO danh_sach FROM pg_tables WHERE schemaname='public';
 IF danh_sach IS NOT NULL THEN EXECUTE 'DROP TABLE ' || danh_sach || ' CASCADE'; END IF;
END $$;
${sql}
COMMIT;
`;
fs.writeFileSync(path.join(dir,'004_xoa_va_tao_lai_31_bang.sql'),reset);
console.log('Generated create and reset SQL scripts for 31 tables.');

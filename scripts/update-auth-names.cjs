const fs=require('node:fs');
const map={tai_khoan:'taikhoan',nguoi_dung:'nguoidung',vai_tro:'vaitro',phien_dang_nhap:'phiendangnhap',ma_tai_khoan:'matk',ma_nguoi_dung:'mangdung',ma_vai_tro:'mavaitro',ten_dang_nhap:'tendangnhap',mat_khau:'matkhau',phien_ban_mat_khau:'pbmatkhau',ho_ten:'hoten',ten_vai_tro:'tenvaitro',trang_thai:'trangthai',ma_phien:'maphien',ma_bam_token:'mabamtoken',het_han_luc:'hethanluc'};
for(const file of ['apps/api/src/data/repositories/auth/auth.repository.ts','apps/api/test/auth.e2e.test.ts','apps/api/scripts/database.cjs']){
 let s=fs.readFileSync(file,'utf8');s=s.replace(/\b[a-z_]+\b/g,w=>Object.hasOwn(map,w)?map[w]:w).replaceAll("'HOAT_DONG'","'Hoạt động'").replaceAll("'KHOA'","'Khóa'").replace('003_cau_truc_31_bang.sql','006_cau_truc_theo_ban_sql_cua_ban.sql');
 fs.writeFileSync(file,s);
}

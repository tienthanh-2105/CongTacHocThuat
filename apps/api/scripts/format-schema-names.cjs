const fs=require('node:fs');
const path=require('node:path');
const dir=path.join(__dirname,'../migrations');
const original=fs.readFileSync(path.join(dir,'003_cau_truc_31_bang.sql'),'utf8');
const maps={
 ma_qr:['MAQR',{ma_qr:'MaQR',ma_hoat_dong:'MaHD',ma_qr_code:'MaQRCode',tg_het_han:'TGHetHan',trang_thai:'TrangThai',tg_mo:'TGMo'}],
 diem_danh:['DIEMDANH',{ma_diem_danh:'MaDD',ma_qr:'MaQR',ma_dang_ky:'MaDK',bat_dau_luc:'BatDauLuc',ket_thuc_luc:'KetThucLuc',trang_thai:'TrangThai'}],
 giai_thuong:['GIAITHUONG',{ma_giai_thuong:'MaGT',ma_cuoc_thi:'MaCThi',ten_giai_thuong:'TenGT',cap_giai:'CapGiai'}],
 ket_qua_hoc_thuat:['KETQUAHOCTHUAT',{ma_ket_qua:'MaKQ',ma_cuoc_thi:'MaCThi',ma_dang_ky:'MaDK',ma_giai_thuong:'MaGT',loai_ket_qua:'LoaiKQ',xep_hang:'XepHang',diem:'Diem',ghi_chu:'GhiChu',trang_thai:'TrangThai',ma_doi:'MaDoi'}],
 diem_ren_luyen:['DIEMRENLUYEN',{ma_diem:'MaDiem',ma_sv:'MaSV',ma_hoat_dong:'MaHD',hoc_ky:'HocKy',nam_hoc:'NamHoc',so_diem:'SoDiem',ly_do:'LyDo',trang_thai:'TrangThai',ma_diem_goc:'MaDiemGoc',nguoi_ghi:'NguoiGhi',ghi_luc:'GhiLuc'}],
 phien_dang_nhap:['PHIENDANGNHAP',{ma_phien:'MaPhien',ma_bam_token:'MaBamToken',ma_tai_khoan:'MaTK',phien_ban_mat_khau:'PhienBanMatKhau',tao_luc:'TaoLuc',het_han_luc:'HetHanLuc'}],
 bo_mon:['BOMON',{ma_bo_mon:'MaBM',ma_khoa:'MaKhoa',ten_bo_mon:'TenBM'}],
 ban_cuoc_thi:['BANCUOCTHI',{ma_ban:'MaBan',ma_cuoc_thi:'MaCThi',ten_ban:'TenBan'}],
 thanh_vien_ban:['THANHVIENBAN',{ma_ban:'MaBan',ma_giang_vien:'MaGV',chuc_vu:'ChucVu',nhiem_vu:'NhiemVu'}],
 doi_thi:['DOITHI',{ma_doi:'MaDoi',ma_cuoc_thi:'MaCThi',ten_doi:'TenDoi'}],
 thanh_vien_doi:['THANHVIENDOI',{ma_doi:'MaDoi',ma_sv:'MaSV',vai_tro:'VaiTro'}],
 ho_so_quyet_toan:['HOSOQUYETTOAN',{ma_ho_so:'MaHS',ma_hoat_dong:'MaHD',nguoi_lap:'NguoiLap',nguoi_duyet:'NguoiDuyet',trang_thai:'TrangThai',ngay_lap:'NgLap',ngay_duyet:'NgDuyet',ghi_chu:'GhiChu'}],
 chi_phi_thuc_te:['CHIPHITHUCTE',{ma_chi_phi:'MaCP',ma_hoat_dong:'MaHD',noi_dung:'NoiDung',so_tien:'SoTien',ngay_chi:'NgChi',nguoi_ghi:'NguoiGhi',ma_ho_so:'MaHS',chung_tu:'ChungTu'}]
};
// Keep comments and string literals byte-for-byte. Rewrite only SQL identifiers.
const split=/('(?:''|[^'])*'|--[^\n]*|\/\*[\s\S]*?\*\/)/g;
function identifiers(text,map){return text.split(split).map((part,i)=>i%2?part:part.replace(/\b[a-zA-Z_][a-zA-Z_0-9]*\b/g,w=>map[w]??w)).join('');}
const sql=original.split(';').map(statement=>{
 const plain=statement.replace(/--[^\n]*/g,'');
 const owner=plain.match(/(?:CREATE TABLE|ALTER TABLE)\s+(\w+)/i)?.[1]??plain.match(/\bON\s+(\w+)\s*\(/i)?.[1];
 const refs=[];
 // Protect reference clauses so owner column renames never affect foreign columns.
 let text=statement.replace(/REFERENCES\s+(\w+)(?:\s*\(([^)]*)\))?/gi,(full,table,cols)=>{
  const m=maps[table];
  refs.push('REFERENCES '+(m?m[0]:table)+(cols!==undefined?'('+identifiers(cols,m?m[1]:{})+')':''));
  return '@@REFERENCE'+(refs.length-1)+'@@';
 });
 if(maps[owner]){
  text=identifiers(text,maps[owner][1]);
  // The QR table shares its old name with a column; replace the owner explicitly.
  text=text.replace(/((?:CREATE TABLE|ALTER TABLE|\bON)\s+)\w+/i,'$1'+maps[owner][0]);
  text=text.replace(/\b(CONSTRAINT|DROP CONSTRAINT)\s+([a-z_][a-z_0-9]*)/g,(_,prefix,name)=>prefix+' '+name.toUpperCase());
 }
 return text.replace(/@@REFERENCE(\d+)@@/g,(_,i)=>refs[Number(i)]);
}).join(';');
const out=path.join(dir,'005_cau_truc_31_bang_doi_ten.sql');
fs.writeFileSync(out,sql);
const literals=s=>[...s.matchAll(/'(?:''|[^'])*'/g)].map(m=>m[0]);
if(JSON.stringify(literals(original))!==JSON.stringify(literals(sql)))throw new Error('String values changed');
console.log(out);
console.log('Renamed tables:',Object.values(maps).map(x=>x[0]).join(', '));

-- Du lieu mau local: Admin / Admin123. Mat khau duoc luu bang bcrypt.
BEGIN;
INSERT INTO public.vaitro(tenvaitro) VALUES ('ADMIN') ON CONFLICT (tenvaitro) DO NOTHING;
INSERT INTO public.taikhoan(mavaitro,tendangnhap,matkhau,trangthai)
SELECT mavaitro,'Admin','$2b$12$8FHiSu.Mb1d/iO3Pxzym1uO5MIKsr6dATRYktFgN3moZkA9Ko.Ms2','Hoạt động' FROM public.vaitro WHERE tenvaitro='ADMIN'
ON CONFLICT (tendangnhap) DO UPDATE SET
 mavaitro=EXCLUDED.mavaitro,matkhau=EXCLUDED.matkhau,trangthai=EXCLUDED.trangthai,
 pbmatkhau=taikhoan.pbmatkhau+1;
UPDATE public.nguoidung SET trangthai='Hoạt động'
WHERE mangdung=(SELECT mangdung FROM public.taikhoan WHERE tendangnhap='Admin');
DELETE FROM public.phiendangnhap WHERE matk=(SELECT matk FROM public.taikhoan WHERE tendangnhap='Admin');
COMMIT;

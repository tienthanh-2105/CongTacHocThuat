const sql = require('mssql');
require('dotenv').config({ path: 'apps/api/.env' });

async function check() {
  const pool = await sql.connect({
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'sapassword',
    server: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '14333', 10),
    database: process.env.DB_NAME || 'QL_CongTacHocThuat',
    options: { encrypt: false, trustServerCertificate: true },
  });

  const users = await pool.request().query(`
    SELECT t.MaTK, t.TenDangNhap, t.MaNgDung, r.TenVaiTro, n.HoTen,
           gv.MaGV, gv.MaBM, bm.TenBM AS TenBM_GV,
           cb.MaCanBo, cb.ChucVu,
           (SELECT STRING_AGG(bm2.TenBM, N', ') WITHIN GROUP (ORDER BY bm2.MaBM)
            FROM GIANGVIEN_BOMON gb2 JOIN BOMON bm2 ON bm2.MaBM = gb2.MaBM
            WHERE gb2.MaGV = gv.MaGV) AS DanhSachTenBM,
           (SELECT STRING_AGG(CAST(gb2.MaBM AS NVARCHAR(10)), N',') WITHIN GROUP (ORDER BY gb2.MaBM)
            FROM GIANGVIEN_BOMON gb2
            WHERE gb2.MaGV = gv.MaGV) AS DanhSachMaBM
    FROM TAIKHOAN t
    JOIN VAITRO r ON r.MaVaiTro = t.MaVaiTro
    LEFT JOIN NGUOIDUNG n ON n.MaNgDung = t.MaNgDung
    LEFT JOIN GIANGVIEN gv ON gv.MaNgDung = n.MaNgDung
    LEFT JOIN BOMON bm ON bm.MaBM = gv.MaBM
    LEFT JOIN CANBOKHOA cb ON cb.MaNgDung = n.MaNgDung
    WHERE t.TenDangNhap = 'chauhuynh'
  `);
  console.table(users.recordset);

  const allAccounts = await pool.request().query(`
    SELECT TOP 10 t.MaTK, t.TenDangNhap, r.TenVaiTro, n.HoTen
    FROM TAIKHOAN t
    JOIN VAITRO r ON r.MaVaiTro = t.MaVaiTro
    LEFT JOIN NGUOIDUNG n ON n.MaNgDung = t.MaNgDung
  `);
  console.table(allAccounts.recordset);

  await pool.close();
}
check();

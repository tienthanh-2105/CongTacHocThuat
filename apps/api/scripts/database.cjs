const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const sql = require('mssql');
const { hash } = require('bcryptjs');

const port = process.env.DB_PORT;
const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: port ? Number(port) : 1433,
  database: process.env.DB_NAME || 'QL_CongTacHocThuat',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
  },
  connectionTimeout: 10000,
};

async function main() {
  const action = process.argv[2];
  const pool = await sql.connect(config);

  try {
    if (action === 'check') {
      const resDb = await pool.request().query('SELECT DB_NAME() AS [database], CURRENT_USER AS [username]');
      console.log(resDb.recordset[0]);
      const resTables = await pool.request().query(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' AND TABLE_NAME IN ('TAIKHOAN','NGUOIDUNG','VAITRO','PHIENDANGNHAP') ORDER BY TABLE_NAME",
      );
      console.log('Tables:', resTables.recordset.map((r) => r.TABLE_NAME).join(', '));
    } else if (action === 'seed') {
      const username = process.env.SEED_USERNAME;
      const password = process.env.SEED_PASSWORD;
      if (!username || !password || password.length < 12 || Buffer.byteLength(password) > 72) {
        throw new Error('Set SEED_USERNAME and SEED_PASSWORD (12 characters minimum, 72 UTF-8 bytes maximum)');
      }

      let roleRes = await pool.request().input('roleName', 'ADMIN').query('SELECT MaVaiTro FROM VAITRO WHERE TenVaiTro = @roleName');
      let roleId;
      if (roleRes.recordset.length === 0) {
        const insRole = await pool.request().input('roleName', 'ADMIN').query('INSERT INTO VAITRO(TenVaiTro) OUTPUT INSERTED.MaVaiTro VALUES(@roleName)');
        roleId = insRole.recordset[0].MaVaiTro;
      } else {
        roleId = roleRes.recordset[0].MaVaiTro;
      }

      const accRes = await pool.request().input('username', username).query('SELECT MaTK FROM TAIKHOAN WHERE TenDangNhap = @username');
      if (accRes.recordset.length === 0) {
        const passwordHash = await hash(password, 12);
        await pool
          .request()
          .input('roleId', roleId)
          .input('username', username)
          .input('password', passwordHash)
          .query('INSERT INTO TAIKHOAN(MaVaiTro, TenDangNhap, MatKhau) VALUES(@roleId, @username, @password)');
        console.log('Demo account created.');
      } else {
        console.log('Account already exists; password unchanged.');
      }
    } else {
      throw new Error('Use check or seed');
    }
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('Database operation failed:', err.message);
  process.exitCode = 1;
});

const path = require('node:path');
const fs = require('node:fs');
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
  requestTimeout: 30000,
};

const requiredTables = [
  'KHOA', 'BOMON', 'LOP', 'NGUOIDUNG', 'VAITRO', 'TAIKHOAN', 'PHANQUYEN',
  'VAITRO_QUYEN', 'SINHVIEN', 'GIANGVIEN', 'CANBOKHOA', 'QUANTRIVIEN',
  'KEHOACHHOCTHUAT', 'HOATDONGHOCTHUAT', 'CUOCTHI', 'SEMINAR', 'BANCUOCTHI',
  'BANTOCHUC', 'DOITHI', 'THANHVIENDOI', 'DKTHAMGIA', 'PHANCONGCOVU', 'DETAI',
  'MAQR', 'DIEMDANH', 'GIAITHUONG', 'KETQUAHOCTHUAT', 'DIEMRENLUYEN',
  'HOSOQUYETTOAN', 'CHIPHITHUCTE', 'PHIENDANGNHAP',
];

async function getApplicationTables(pool) {
  const result = await pool.request().query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = 'dbo' AND TABLE_TYPE = 'BASE TABLE'`,
  );
  const names = new Set(result.recordset.map(row => row.TABLE_NAME.toUpperCase()));
  return requiredTables.filter(name => names.has(name));
}

function reportMissing(found) {
  return requiredTables.filter(name => !found.includes(name));
}

async function check(pool) {
  const result = await pool.request().query(
    'SELECT DB_NAME() AS [database], CURRENT_USER AS [username], @@VERSION AS [version]',
  );
  console.log(result.recordset[0]);
  const found = await getApplicationTables(pool);
  const missing = reportMissing(found);
  console.log(`Application tables: ${found.length}/${requiredTables.length}`);
  if (missing.length) throw new Error(`Missing SQL Server tables: ${missing.join(', ')}. Run npm run db:migrate after verifying the target database.`);
  console.log('SQL Server schema is ready.');
}

async function migrate(pool) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await new sql.Request(transaction).query(
      `DECLARE @lockResult int;
       EXEC @lockResult = sys.sp_getapplock
         @Resource = N'CongTacHocThuat:InitialSchema',
         @LockMode = 'Exclusive',
         @LockOwner = 'Transaction',
         @LockTimeout = 60000;
       IF @lockResult < 0 THROW 51000, 'Could not acquire schema migration lock.', 1;`,
    );
    const found = await getApplicationTables(transaction);
    const missing = reportMissing(found);

    if (found.length === requiredTables.length) {
      await transaction.commit();
      console.log('SQL Server schema already contains all required tables; nothing changed.');
      return;
    }
    if (found.length > 0) {
      throw new Error(`Database has a partial application schema (${found.length}/${requiredTables.length}). No tables were changed. Missing: ${missing.join(', ')}`);
    }

    const file = path.resolve(__dirname, '../migrations/001_sqlserver_initial_schema.sql');
    const source = fs.readFileSync(file, 'utf8');
    const batches = source.split(/^\s*GO\s*;?\s*$/gim).map(batch => batch.trim()).filter(Boolean);
    for (const batch of batches) await new sql.Request(transaction).batch(batch);
    await transaction.commit();
    console.log(`Created ${requiredTables.length} SQL Server tables from ${path.basename(file)}.`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function seed(pool) {
  const username = process.env.SEED_USERNAME;
  const password = process.env.SEED_PASSWORD;
  if (!username || !password || password.length < 12 || Buffer.byteLength(password) > 72) {
    throw new Error('Set SEED_USERNAME and SEED_PASSWORD (12 characters minimum, 72 UTF-8 bytes maximum) in apps/api/.env');
  }

  const roleResult = await pool.request().input('roleName', sql.NVarChar(100), 'ADMIN')
    .query('SELECT MaVaiTro FROM VAITRO WHERE TenVaiTro = @roleName');
  const roleId = roleResult.recordset[0]?.MaVaiTro ?? (await pool.request()
    .input('roleName', sql.NVarChar(100), 'ADMIN')
    .query('INSERT INTO VAITRO(TenVaiTro) OUTPUT INSERTED.MaVaiTro VALUES(@roleName)')).recordset[0].MaVaiTro;

  const account = await pool.request().input('username', sql.NVarChar(100), username)
    .query('SELECT MaTK FROM TAIKHOAN WHERE TenDangNhap = @username');
  if (account.recordset.length) {
    console.log(`Account ${username} already exists; password was not changed.`);
    return;
  }

  const passwordHash = await hash(password, 12);
  await pool.request()
    .input('roleId', sql.BigInt, roleId)
    .input('username', sql.NVarChar(100), username)
    .input('password', sql.NVarChar(255), passwordHash)
    .query('INSERT INTO TAIKHOAN(MaVaiTro, TenDangNhap, MatKhau) VALUES(@roleId, @username, @password)');
  console.log(`Created administrator account ${username}.`);
}

async function main() {
  const action = process.argv[2];
  if (!['check', 'migrate', 'seed'].includes(action)) throw new Error('Use check, migrate, or seed.');
  const pool = await new sql.ConnectionPool(config).connect();
  try {
    if (action === 'check') await check(pool);
    if (action === 'migrate') await migrate(pool);
    if (action === 'seed') await seed(pool);
  } finally {
    await pool.close();
  }
}

main().catch(error => {
  console.error('Database operation failed:', error.message);
  process.exitCode = 1;
});

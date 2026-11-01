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
  'VAITRO_QUYEN', 'SINHVIEN', 'GIANGVIEN', 'CANBOKHOA',
  'KEHOACHHOCTHUAT', 'HOATDONGHOCTHUAT', 'CUOCTHI', 'SEMINAR', 'BANCUOCTHI',
  'BANTOCHUC', 'DOITHI', 'THANHVIENDOI', 'DKTHAMGIA', 'PHANCONGCOVU', 'DETAI',
  'MAQR', 'DIEMDANH', 'GIAITHUONG', 'KETQUAHOCTHUAT', 'DIEMRENLUYEN',
  'HOSOQUYETTOAN', 'CHIPHITHUCTE', 'PHIENDANGNHAP',
];
const workflowTables = ['SCHEMAMIGRATION', 'CHITIETKEHOACH', 'VONGTHI', 'BAITHI', 'CHAMDIEMVONG', 'HANGDOICHODANGKY', 'THONGBAO', 'TEPSEMINAR', 'GIANGVIEN_BOMON', 'DUTRUKINHPHI', 'KINHPHIHOATDONG', 'KEHOACHTOCHUC', 'PHANCONGVONGTHI', 'DETHIVONG', 'DANGKYVONGTHI'];

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
  if (missing.length) {
    const legacy = await isKnownLegacySchema(pool);
    if (legacy) throw new Error('Detected the provided legacy SQL schema. Run npm run db:migrate to add the API compatibility columns and workflow tables.');
    throw new Error(`Missing SQL Server tables: ${missing.join(', ')}. Run npm run db:migrate after verifying the target database.`);
  }
  const workflowResult = await pool.request().query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' AND TABLE_TYPE='BASE TABLE'`);
  const workflowFound = new Set(workflowResult.recordset.map(row => row.TABLE_NAME.toUpperCase()));
  const workflowMissing = workflowTables.filter(name => !workflowFound.has(name));
  if (workflowMissing.length) throw new Error(`Missing workflow tables: ${workflowMissing.join(', ')}. Run npm run db:migrate.`);
  const linkageResult = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='HOATDONGHOCTHUAT' AND COLUMN_NAME IN ('MaKeHoach','MaKeHoachKhoa')`);
  const linkageFound = new Set(linkageResult.recordset.map(row => row.COLUMN_NAME.toUpperCase()));
  const linkageMissing = ['MaKeHoach', 'MaKeHoachKhoa'].filter(name => !linkageFound.has(name.toUpperCase()));
  if (linkageMissing.length) throw new Error(`Missing activity-plan linkage columns: ${linkageMissing.map(name => `HOATDONGHOCTHUAT.${name}`).join(', ')}. Run npm run db:migrate.`);
  const scopeResult = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='HOATDONGHOCTHUAT' AND COLUMN_NAME='CapTC'`);
  if (!scopeResult.recordset.length) throw new Error('Missing HOATDONGHOCTHUAT.CapTC. Run npm run db:migrate.');
  console.log('SQL Server schema is ready.');
}

async function isKnownLegacySchema(pool) {
  const missing = reportMissing(await getApplicationTables(pool)).sort();
  if (missing.join(',') !== ['BANCUOCTHI', 'CHIPHITHUCTE'].sort().join(',')) return false;
  const result = await pool.request().query(`SELECT
    CASE WHEN OBJECT_ID(N'dbo.KINHPHITHUCTE',N'U') IS NOT NULL
      AND COL_LENGTH(N'dbo.HOATDONGHOCTHUAT',N'TgDuKien') IS NOT NULL
      AND COL_LENGTH(N'dbo.CUOCTHI',N'VongThi') IS NOT NULL THEN 1 ELSE 0 END AS IsLegacy`);
  return result.recordset[0]?.IsLegacy === 1;
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
    const legacy = found.length > 0 && found.length < requiredTables.length && await isKnownLegacySchema(transaction);

    if (found.length > 0 && found.length !== requiredTables.length && !legacy) {
      throw new Error(`Database has a partial application schema (${found.length}/${requiredTables.length}). No tables were changed. Missing: ${missing.join(', ')}`);
    }
    if (found.length === 0) {
      const file = path.resolve(__dirname, '../migrations/001_sqlserver_initial_schema.sql');
      const source = fs.readFileSync(file, 'utf8');
      const batches = source.split(/^\s*GO\s*;?\s*$/gim).map(batch => batch.trim()).filter(Boolean);
      for (const batch of batches) await new sql.Request(transaction).batch(batch);
      console.log(`Created ${requiredTables.length} SQL Server tables from ${path.basename(file)}.`);
    }
    await new sql.Request(transaction).query(`
      IF OBJECT_ID(N'dbo.SCHEMAMIGRATION', N'U') IS NULL
        CREATE TABLE dbo.SCHEMAMIGRATION (MaMigration NVARCHAR(100) NOT NULL PRIMARY KEY, ApDungLuc DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET());
    `);
    const migrations = legacy
      ? ['003_legacy_sqlserver_compat.sql', '002_workflow_extensions.sql', '004_workflow_roles_status.sql', '005_activity_owner.sql', '006_activity_semester_year.sql', '007_activity_status.sql', '008_activity_times.sql', '009_activity_time_only.sql', '010_activity_progress_max.sql', '011_activity_plan_compat.sql', '012_activity_pending_status.sql', '013_plan_approval_stages.sql', '014_lecturer_department_links.sql', '015_activity_budget_approval.sql', '016_activity_plan_legacy_link.sql', '017_detailed_activity_plans.sql', '018_competition_round_workflow.sql', '019_proposal_signatures.sql', '020_workflow_publication_status.sql', '021_budget_line_status.sql', '022_plan_faculty_budget_note.sql', '023_department_competition_plans.sql', '024_department_board_activity_link.sql', '025_budget_request_changes.sql', '026_activity_scope_default.sql', '027_drop_activity_scope.sql', '028_activity_scope_default_nullable.sql', '029_activity_schedule_and_capacity_text.sql', '030_activity_budget_round_totals.sql', '031_budget_line_request_changes.sql', '032_annual_budget_estimates.sql']
      : ['002_workflow_extensions.sql', '004_workflow_roles_status.sql', '005_activity_owner.sql', '006_activity_semester_year.sql', '007_activity_status.sql', '008_activity_times.sql', '009_activity_time_only.sql', '010_activity_progress_max.sql', '011_activity_plan_compat.sql', '012_activity_pending_status.sql', '013_plan_approval_stages.sql', '014_lecturer_department_links.sql', '004_allow_budget_detail_before_draft.sql', '015_activity_budget_approval.sql', '016_activity_plan_legacy_link.sql', '017_detailed_activity_plans.sql', '018_competition_round_workflow.sql', '019_proposal_signatures.sql', '020_workflow_publication_status.sql', '021_budget_line_status.sql', '022_plan_faculty_budget_note.sql', '023_department_competition_plans.sql', '024_department_board_activity_link.sql', '025_budget_request_changes.sql', '026_activity_scope_default.sql', '027_drop_activity_scope.sql', '028_activity_scope_default_nullable.sql', '029_activity_schedule_and_capacity_text.sql', '030_activity_budget_round_totals.sql', '031_budget_line_request_changes.sql', '032_annual_budget_estimates.sql'];
    for (const fileName of migrations) {
      const migration = path.resolve(__dirname, '../migrations', fileName);
      if (!fs.existsSync(migration)) continue;
      const migrationName = fileName.replace(/\.sql$/i, '');
      const applied = await new sql.Request(transaction).input('name', sql.NVarChar(100), migrationName)
        .query('SELECT 1 AS found FROM dbo.SCHEMAMIGRATION WHERE MaMigration = @name');
      if (applied.recordset.length) continue;
      const source = fs.readFileSync(migration, 'utf8');
      const batches = source.split(/^\s*GO\s*;?\s*$/gim).map(batch => batch.trim()).filter(Boolean);
      for (const batch of batches) await new sql.Request(transaction).batch(batch);
      await new sql.Request(transaction).input('name', sql.NVarChar(100), migrationName)
        .query('INSERT INTO dbo.SCHEMAMIGRATION(MaMigration) VALUES(@name)');
      console.log(`Applied ${fileName}.`);
    }
    await transaction.commit();
    if (found.length === requiredTables.length || legacy) console.log('SQL Server schema is ready.');
  } catch (error) {
    try { await transaction.rollback(); } catch { /* Keep the SQL Server error that caused the rollback. */ }
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

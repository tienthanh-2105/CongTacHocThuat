require('dotenv').config({quiet:true});
const { Pool }=require('pg');
const fs=require('node:fs');
const path=require('node:path');
const {hash}=require('bcryptjs');
const pool=new Pool({connectionTimeoutMillis:5000});
async function main() {
  const action=process.argv[2];
  if(action==='create') {
    const admin=new Pool({database:'postgres',connectionTimeoutMillis:5000});
    try {
      const name=process.env.PGDATABASE;
      if(!name) throw new Error('Missing PGDATABASE');
      const exists=await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[name]);
      if(!exists.rowCount) await admin.query('CREATE DATABASE "'+name.replaceAll('"','""')+'"');
      console.log(exists.rowCount ? 'Database already exists.' : 'Database created.');
    } finally { await admin.end(); }
  } else if(action==='check') {
    const result=await pool.query('SELECT current_database() AS database,current_user AS username');
    console.log(result.rows[0]);
    const tables=await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('taikhoan','nguoidung','vaitro','phiendangnhap') ORDER BY table_name");
    console.log('Tables:',tables.rows.map(r=>r.table_name).join(', '));
  } else if(action==='migrate') {
    const ready=await pool.query("SELECT to_regclass('public.phiendangnhap') AS table_name");
    if(ready.rows[0].table_name) { console.log('Schema already installed.'); return; }
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const base=await client.query("SELECT to_regclass('public.taikhoan') AS table_name");
      if(base.rows[0].table_name) throw new Error('Existing tables found; use reviewed reset script instead');
      await client.query(fs.readFileSync(path.join(__dirname,'../migrations/006_cau_truc_theo_ban_sql_cua_ban.sql'),'utf8'));
      await client.query('COMMIT');
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally {client.release();}
    console.log('Auth migration completed; existing business data preserved.');
  } else if(action==='seed') {
    const username=process.env.SEED_USERNAME; const password=process.env.SEED_PASSWORD;
    if(!username || !password || password.length<12 || Buffer.byteLength(password)>72) throw new Error('Set SEED_USERNAME and SEED_PASSWORD (12 characters minimum, 72 UTF-8 bytes maximum)');
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const role=await client.query("INSERT INTO public.vaitro(tenvaitro) VALUES('ADMIN') ON CONFLICT(tenvaitro) DO UPDATE SET tenvaitro=EXCLUDED.tenvaitro RETURNING mavaitro");
      const result=await client.query("INSERT INTO public.taikhoan(mavaitro,tendangnhap,matkhau) VALUES($1,$2,$3) ON CONFLICT(tendangnhap) DO NOTHING RETURNING matk",[role.rows[0].mavaitro,username,await hash(password,12)]);
      await client.query('COMMIT');
      console.log(result.rowCount ? 'Demo account created.' : 'Account already exists; password unchanged.');
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally {client.release();}
  } else throw new Error('Use check, migrate or seed');
}
main().catch(error=>{console.error('Database operation failed:',error.code ?? error.message);process.exitCode=1}).finally(()=>pool.end());



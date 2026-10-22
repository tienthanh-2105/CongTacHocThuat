require('dotenv').config({quiet:true});
const fs=require('node:fs');const path=require('node:path');const {Pool}=require('pg');const {spawnSync}=require('node:child_process');
async function main(){
 if(process.env.PGDATABASE!=='QL_CongTacHocThuat')throw new Error('Unexpected target');
 const root=path.resolve(__dirname,'../../..');
 let sql=fs.readFileSync(path.join(root,'docs/database/SQL_nguoi_dung_da_sua_index_alter.sql'),'utf8');
 sql=sql.replaceAll('NVARCHAR','VARCHAR').replace('CREATE TABLE ĐKTHAMGIA','CREATE TABLE DKTHAMGIA').replace('REFERENCES VAITRO(MaVT)','REFERENCES VAITRO(MaVaiTro)').replace("DEFAULT 'DU_THAO'","DEFAULT 'Dự thảo'").replaceAll('NhiẹmVu','NhiemVu').replaceAll("'Tham gia0'","'Tham gia'");
 fs.writeFileSync(path.join(__dirname,'../migrations/006_cau_truc_theo_ban_sql_cua_ban.sql'),sql);
 const prefix=fs.readFileSync(path.join(__dirname,'../migrations/004_xoa_va_tao_lai_31_bang.sql'),'utf8').split('-- CẤU TRÚC 31 BẢNG')[0];
 fs.writeFileSync(path.join(__dirname,'../migrations/007_xoa_va_tao_lai_theo_sql_moi.sql'),prefix+sql+'\nCOMMIT;\n');
 const pool=new Pool();const client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query('CREATE SCHEMA kiem_tra_sql_nguoi_dung');
  await client.query(sql.replace('SET search_path TO public;','SET search_path TO kiem_tra_sql_nguoi_dung;'));
  await client.query('ROLLBACK');
  const dir=path.join(root,'backups');fs.mkdirSync(dir,{recursive:true});const backup=path.join(dir,'truoc_khi_doi_ten_bang_'+Date.now()+'.dump');
  const dump=spawnSync('F:/PostgreSQL/bin/pg_dump.exe',['-Fc','-d',process.env.PGDATABASE,'-f',backup],{env:process.env,windowsHide:true});
  if(dump.status!==0)throw new Error('Backup failed');
  await client.query(fs.readFileSync(path.join(__dirname,'../migrations/007_xoa_va_tao_lai_theo_sql_moi.sql'),'utf8'));
  const r=await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  if(r.rowCount!==31)throw new Error('Unexpected count');
  console.log('Created 31 tables:',r.rows.map(x=>x.tablename).join(', '));console.log('Backup:',backup);
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();await pool.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});

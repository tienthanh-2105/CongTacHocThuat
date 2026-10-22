require('dotenv').config({quiet:true});
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {Pool}=require('pg');
async function main(){
 if(process.env.PGDATABASE!=='QL_CongTacHocThuat')throw new Error('Unexpected database');
 const dir=path.resolve(__dirname,'../../..','backups');fs.mkdirSync(dir,{recursive:true});
 const backup=path.join(dir,'truoc_khi_reset_31_bang_'+Date.now()+'.dump');
 const dump=spawnSync('F:/PostgreSQL/bin/pg_dump.exe',['-Fc','-d',process.env.PGDATABASE,'-f',backup],{env:process.env,windowsHide:true});
 if(dump.status!==0)throw new Error('Backup failed; no tables changed');
 const pool=new Pool();
 const client=await pool.connect();
 try{
  await client.query(fs.readFileSync(path.join(__dirname,'../migrations/004_xoa_va_tao_lai_31_bang.sql'),'utf8'));
  const r=await client.query("SELECT count(*)::int AS total FROM pg_tables WHERE schemaname='public'");
  if(r.rows[0].total!==31)throw new Error('Unexpected table count');
  console.log('Tables recreated:',r.rows[0].total);console.log('Backup:',backup);
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();await pool.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});

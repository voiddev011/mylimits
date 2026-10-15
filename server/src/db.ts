import pg from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
export const uuid=()=>randomUUID();
export const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const poolFor=(url:string)=>new pg.Pool({connectionString:url,max:8,connectionTimeoutMillis:5000,statement_timeout:15000});
export type DB=pg.Pool|pg.PoolClient;
export async function transaction<T>(pool:pg.Pool,fn:(db:pg.PoolClient)=>Promise<T>):Promise<T>{
 const db=await pool.connect();try{await db.query('BEGIN');const value=await fn(db);await db.query('COMMIT');return value}catch(e){await db.query('ROLLBACK');throw e}finally{db.release()}
}
export async function migrate(pool:pg.Pool){
 await transaction(pool,async db=>{
  await db.query("SELECT pg_advisory_xact_lock(7634921)");
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL)');
  const dir=new URL('../migrations/',import.meta.url);
  for(const name of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort()){
   const sql=await readFile(new URL(name,dir),'utf8'),checksum=hash(sql);
   const old=await db.query('SELECT checksum FROM schema_migrations WHERE name=$1',[name]);
   if(old.rows.length){if(old.rows[0].checksum!==checksum)throw new Error('Applied migration changed; restore it and add a new migration.');continue}
   await db.query(sql);await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);
  }
 });
}

import type pg from 'pg';import { transaction } from './db';import { pruneSnapshots,boundSnapshots } from './service';
export async function retentionPass(pool:pg.Pool){
 // Cursor across owners, one bounded transaction at a time. An hourly pass needs
 // no provider credentials and runs even with independent collectors disabled.
 let after='';let batches=0;
 while(batches++<100){const rows=(await pool.query('SELECT id FROM owners WHERE id>$1 ORDER BY id LIMIT 100',[after])).rows;if(!rows.length)break;
  for(const row of rows)await transaction(pool,async db=>{const owner=await db.query('SELECT id FROM owners WHERE id=$1 FOR UPDATE SKIP LOCKED',[row.id]);if(owner.rows.length){await pruneSnapshots(db,row.id);await boundSnapshots(db,row.id)}});
  after=rows.at(-1).id;
 }
}
export function startRetention(pool:pg.Pool){let running=false;const timer=setInterval(()=>{if(running)return;running=true;void retentionPass(pool).catch(()=>{}).finally(()=>{running=false})},3600000);timer.unref();return()=>clearInterval(timer)}

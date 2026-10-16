import { randomBytes,createCipheriv,createDecipheriv } from 'node:crypto';
import type pg from 'pg';
import { transaction,type DB } from './db';
import { ApiError } from './auth';
export interface Binding {owner:string;connectionId:string;generation:number;}
export interface Kms {
 wrapKey(key:Uint8Array,binding:Binding):Promise<{keyId:string;wrappedKey:string}>;
 unwrapKey(keyId:string,wrappedKey:string,binding:Binding):Promise<Uint8Array>;
}
export interface Envelope {keyId:string;wrappedKey:string;iv:string;tag:string;ciphertext:string;}
const aad=(b:Binding)=>Buffer.from(JSON.stringify([b.owner,b.connectionId,b.generation]));
export class CredentialStore {
 pool:pg.Pool;kms:Kms|undefined;
 constructor(pool:pg.Pool,kms?:Kms){this.pool=pool;this.kms=kms;}
 async seal(binding:Binding,plaintext:string):Promise<Envelope>{
  if(!this.kms)throw new ApiError(503,'credential_encryption_unconfigured');if(plaintext.length>16384)throw new ApiError(400,'credential_too_large');
  const key=randomBytes(32),iv=randomBytes(12);try{const wrapped=await this.kms.wrapKey(key,binding),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(aad(binding));const ciphertext=Buffer.concat([cipher.update(plaintext,'utf8'),cipher.final()]);return {...wrapped,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')}}finally{key.fill(0)}
 }
 async open(binding:Binding,envelope:Envelope):Promise<string>{
  if(!this.kms)throw new ApiError(503,'credential_encryption_unconfigured');
  const key=Buffer.from(await this.kms.unwrapKey(envelope.keyId,envelope.wrappedKey,binding));
  try{const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));cipher.setAAD(aad(binding));cipher.setAuthTag(Buffer.from(envelope.tag,'base64'));return Buffer.concat([cipher.update(Buffer.from(envelope.ciphertext,'base64')),cipher.final()]).toString('utf8')}catch{throw new ApiError(403,'credential_binding_rejected')}finally{key.fill(0)}
 }
 async read(binding:Binding){
  const r=await this.pool.query('SELECT revision,envelope FROM encrypted_credentials WHERE owner_id=$1 AND connection_id=$2 AND generation=$3',[binding.owner,binding.connectionId,binding.generation]);
  if(!r.rows.length)throw new ApiError(409,'credential_unavailable');return {revision:r.rows[0].revision,value:await this.open(binding,r.rows[0].envelope)};
 }
 async rotate(db:DB,binding:Binding,envelope:Envelope,expectedRevision:number,leaseToken?:string){
  const c=await db.query('SELECT generation,enabled FROM connections WHERE owner_id=$1 AND id=$2 FOR UPDATE',[binding.owner,binding.connectionId]);
  if(!c.rows.length||!c.rows[0].enabled||c.rows[0].generation!==binding.generation)throw new ApiError(409,'connection_changed');
  if(leaseToken){const job=await db.query("SELECT id FROM jobs WHERE owner_id=$1 AND connection_id=$2 AND generation=$3 AND lease_token=$4 AND status='running' AND lease_until>now() FOR UPDATE",[binding.owner,binding.connectionId,binding.generation,leaseToken]);if(!job.rows.length)throw new ApiError(409,'lease_lost')}
  if(expectedRevision===0){await db.query('INSERT INTO encrypted_credentials(owner_id,connection_id,generation,revision,envelope) VALUES($1,$2,$3,1,$4)',[binding.owner,binding.connectionId,binding.generation,JSON.stringify(envelope)]);return 1}
  const result=await db.query('UPDATE encrypted_credentials SET revision=revision+1,envelope=$4 WHERE owner_id=$1 AND connection_id=$2 AND generation=$3 AND revision=$5 RETURNING revision',[binding.owner,binding.connectionId,binding.generation,JSON.stringify(envelope),expectedRevision]);if(!result.rows.length)throw new ApiError(409,'credential_revision_conflict');return result.rows[0].revision as number;
 }
 async put(binding:Binding,value:string,expectedRevision=0){const envelope=await this.seal(binding,value);return transaction(this.pool,db=>this.rotate(db,binding,envelope,expectedRevision));}
}

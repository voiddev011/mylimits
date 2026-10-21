import { readFile,stat } from 'node:fs/promises';
import { z } from 'zod';
import { ApiError } from './auth';
import type { Binding,Kms } from './credentials';
// Vault transit keys must be derived=true, exportable=false, allow_plaintext_backup=false.
// The wrapping key stays in Vault. Owner/connection/generation are authenticated context.
export class TransitKms implements Kms {
 private endpoint:string;private keyName:string;private token:string;
 constructor(endpoint:string,keyName:string,token:string){
  const u=new URL(endpoint);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||!/^[-a-zA-Z0-9_]{1,80}$/.test(keyName)||!token.trim())throw new Error('Invalid transit configuration.');
  this.endpoint=u.origin;this.keyName=keyName;this.token=token.trim();
 }
 private context(b:Binding){return Buffer.from(JSON.stringify([b.owner,b.connectionId,b.generation])).toString('base64');}
 private async request(operation:'encrypt'|'decrypt',body:Record<string,string>){
  try{
   const response=await fetch(`${this.endpoint}/v1/transit/${operation}/${this.keyName}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{'content-type':'application/json','x-vault-token':this.token},body:JSON.stringify(body)});
   if(!response.ok)throw new Error();
   const reader=response.body?.getReader();if(!reader)throw new Error();let size=0;const chunks:Uint8Array[]=[];
   for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>65536){await reader.cancel();throw new Error();}chunks.push(r.value);}
   return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }catch{throw new ApiError(503,'credential_service_unavailable');}
 }
 async wrapKey(key:Uint8Array,b:Binding){
  const r=z.object({data:z.object({ciphertext:z.string().regex(/^vault:v[1-9][0-9]*:[A-Za-z0-9+/=]+$/)})}).parse(await this.request('encrypt',{plaintext:Buffer.from(key).toString('base64'),context:this.context(b)}));
  return {keyId:`vault-transit:${this.keyName}`,wrappedKey:r.data.ciphertext};
 }
 async unwrapKey(keyId:string,wrappedKey:string,b:Binding){
  if(keyId!==`vault-transit:${this.keyName}`)throw new ApiError(403,'credential_binding_rejected');
  const r=z.object({data:z.object({plaintext:z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/)})}).parse(await this.request('decrypt',{ciphertext:wrappedKey,context:this.context(b)}));
  const key=Buffer.from(r.data.plaintext,'base64');if(key.length!==32){key.fill(0);throw new ApiError(403,'credential_binding_rejected');}return key;
 }
}
export async function transitFromConfig(config:{endpoint:string;keyName:string;tokenFile:string}|undefined):Promise<Kms|undefined>{
 if(!config)return undefined;
 const info=await stat(config.tokenFile);if(!info.isFile()||info.size>8192||(process.platform!=='win32'&&(info.mode&0o077)!==0))throw new Error('Transit token file must be a small private file.');
 return new TransitKms(config.endpoint,config.keyName,await readFile(config.tokenFile,'utf8'));
}

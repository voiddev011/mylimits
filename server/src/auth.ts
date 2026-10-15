import { randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Config } from './config';
import { hash, type DB } from './db';
export interface Principal{owner:string;kind:'web'|'device';deviceId?:string;}
export type Verify=(token:string)=>Promise<{issuer:string;subject:string}>;
export const opaque=()=>randomBytes(32).toString('base64url');
export class ApiError extends Error {status:number;code:string;constructor(status:number,code:string){super(code);this.status=status;this.code=code}}
export function oidcVerifier(config:Config):Verify{
 const c=config.oidc;if(!c)return async()=>{throw new ApiError(503,'authentication_unconfigured')};
 const keys=createRemoteJWKSet(new URL(c.jwksUri));
 return async token=>{try{const {payload}=await jwtVerify(token,keys,{issuer:c.issuer,audience:c.audience,algorithms:['RS256','ES256'],requiredClaims:['sub','exp','iat']});if(!payload.sub)throw new Error();return {issuer:c.issuer,subject:payload.sub}}catch{throw new ApiError(401,'invalid_authentication')}};
}
export function ownerId(issuer:string,subject:string){return hash(`${issuer}\0${subject}`)}
export async function authenticate(db:DB,authorization:string|undefined,cookie:string|undefined,verify:Verify):Promise<Principal>{
 const bearer=authorization?.startsWith('Bearer ')?authorization.slice(7):null;
 if(bearer?.startsWith('ml_device_')){
  const found=await db.query('SELECT owner_id,id FROM devices WHERE token_hash=$1 AND revoked_at IS NULL',[hash(bearer)]);
  if(!found.rows.length)throw new ApiError(401,'device_revoked');return {owner:found.rows[0].owner_id,kind:'device',deviceId:found.rows[0].id};
 }
 if(bearer){const identity=await verify(bearer);const owner=ownerId(identity.issuer,identity.subject);await db.query('INSERT INTO owners(id) VALUES($1) ON CONFLICT DO NOTHING',[owner]);return {owner,kind:'web'}}
 const session=cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('mylimits_session='))?.slice(17);
 if(session){const found=await db.query('SELECT owner_id FROM sessions WHERE token_hash=$1 AND expires_at>now()',[hash(session)]);if(found.rows.length)return {owner:found.rows[0].owner_id,kind:'web'}}
 throw new ApiError(401,'authentication_required');
}
export function requireWeb(p:Principal){if(p.kind!=='web')throw new ApiError(403,'web_login_required')}

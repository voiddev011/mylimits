import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { createHash } from 'node:crypto';
import { createRemoteJWKSet,jwtVerify } from 'jose';
import { ApiError,opaque,ownerId } from './auth';
import { hash,transaction } from './db';
import type { Config } from './config';
export function authRoutes(app:FastifyInstance,pool:pg.Pool,config:Config){
 const cookie=(name:string,value:string,maxAge:number)=>`${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${config.origin.startsWith('https:')?'; Secure':''}`;
 app.get('/auth/config',async()=>({configured:!!config.oidc,mode:'snapshot-only'}));
 app.get('/auth/login',async(req,reply)=>{
  const c=config.oidc;if(!c)throw new ApiError(503,'authentication_unconfigured');
  const state=opaque(),binding=opaque(),verifier=opaque(),nonce=opaque();
  const pair=(req.query as {pair?:string}).pair,returnPath=pair&&/^[A-F0-9]{12}$/.test(pair)?`/?pair=${pair}`:'/';
  await pool.query('DELETE FROM auth_requests WHERE expires_at<now()');
  await pool.query("INSERT INTO auth_requests(state_hash,binding_hash,verifier,nonce,expires_at,return_path) VALUES($1,$2,$3,$4,now()+interval '10 minutes',$5)",[hash(state),hash(binding),verifier,nonce,returnPath]);
  const u=new URL(c.authorizationEndpoint);u.search=new URLSearchParams({client_id:c.clientId,redirect_uri:`${config.origin}/auth/callback`,response_type:'code',scope:'openid',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
  return reply.header('set-cookie',cookie('mylimits_auth',binding,600)).redirect(u.href);
 });
 app.get('/auth/callback',async(req,reply)=>{
  const c=config.oidc;if(!c)throw new ApiError(503,'authentication_unconfigured');
  const q=req.query as Record<string,string>,binding=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('mylimits_auth='))?.slice(14);
  if(!q.state||!q.code||!binding||q.error)throw new ApiError(400,'invalid_auth_callback');
  const a=await transaction(pool,async db=>{const r=await db.query('DELETE FROM auth_requests WHERE state_hash=$1 AND binding_hash=$2 AND expires_at>now() RETURNING verifier,nonce,return_path',[hash(q.state!),hash(binding)]);if(!r.rows.length)throw new ApiError(400,'invalid_auth_callback');return r.rows[0]});
  const body=new URLSearchParams({grant_type:'authorization_code',client_id:c.clientId,code:q.code,redirect_uri:`${config.origin}/auth/callback`,code_verifier:a.verifier});if(c.clientSecret)body.set('client_secret',c.clientSecret);
  let identity:{issuer:string;subject:string};
  try{
   const response=await fetch(c.tokenEndpoint,{method:'POST',body,redirect:'error',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error();const data=await response.json() as {id_token?:string};if(!data.id_token)throw new Error();
   const {payload}=await jwtVerify(data.id_token,createRemoteJWKSet(new URL(c.jwksUri)),{issuer:c.issuer,audience:c.clientId,algorithms:['RS256','ES256'],requiredClaims:['sub','exp','iat','nonce']});if(payload.nonce!==a.nonce||!payload.sub)throw new Error();identity={issuer:c.issuer,subject:payload.sub};
  }catch{throw new ApiError(401,'authentication_failed')}
  const owner=ownerId(identity.issuer,identity.subject),token=opaque();
  await transaction(pool,async db=>{await db.query('INSERT INTO owners(id) VALUES($1) ON CONFLICT DO NOTHING',[owner]);await db.query("INSERT INTO sessions(token_hash,owner_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",[hash(token),owner])});
  return reply.header('set-cookie',[cookie('mylimits_session',token,28800),cookie('mylimits_auth','',0)]).redirect(a.return_path);
 });
 app.post('/auth/logout',async(req,reply)=>{
  if(req.headers.origin!==config.origin||req.headers['x-mylimits-request']!=='1')throw new ApiError(403,'invalid_origin');
  const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('mylimits_session='))?.slice(17);if(token)await pool.query('DELETE FROM sessions WHERE token_hash=$1',[hash(token)]);
  return reply.header('set-cookie',cookie('mylimits_session','',0)).send({signedOut:true});
 });
}

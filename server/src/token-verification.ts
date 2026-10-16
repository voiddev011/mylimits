import { jwtVerify,type JWTVerifyGetKey } from 'jose';
// Shared validation exercised with real signatures and in-memory fixture JWKs.
export async function verifyToken(token:string,keys:JWTVerifyGetKey,options:{issuer:string;audience:string;nonce?:string}){
 const {payload}=await jwtVerify(token,keys,{issuer:options.issuer,audience:options.audience,algorithms:['RS256','ES256'],requiredClaims:['sub','exp','iat',...(options.nonce!==undefined?['nonce']:[])],maxTokenAge:'24h'});
 if(!payload.sub||payload.sub.length>1024)throw new Error('Invalid subject');
 if(options.nonce!==undefined&&(payload.nonce!==options.nonce||(Array.isArray(payload.aud)&&payload.aud.length>1||payload.azp!==undefined)&&payload.azp!==options.audience))throw new Error('Invalid identity binding');
 return {issuer:options.issuer,subject:payload.sub};
}

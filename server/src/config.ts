import { z } from 'zod';
const secure=z.string().url().refine(v=>new URL(v).protocol==='https:','HTTPS required');
export const ConfigSchema=z.object({
 environment:z.enum(['development','production','test']).default('development'),databaseUrl:z.string().min(1),
 host:z.string().default('127.0.0.1'),port:z.number().int().min(1).max(65535).default(8787),
 origin:z.string().url(),allowedOrigins:z.array(z.string()).default([]),
 transit:z.object({endpoint:secure,keyName:z.string().regex(/^[-a-zA-Z0-9_]{1,80}$/),tokenFile:z.string().min(1)}).optional(),
 oidc:z.object({issuer:secure,audience:z.string().min(1),jwksUri:secure,authorizationEndpoint:secure,tokenEndpoint:secure,clientId:z.string().min(1),clientSecret:z.string().min(1).optional()}).optional(),
}).superRefine((c,ctx)=>{
 const u=new URL(c.origin);if(c.environment==='production'&&u.protocol!=='https:')ctx.addIssue({code:'custom',message:'Production origin requires HTTPS'});
 if(c.environment!=='test'&&u.protocol!=='https:'&&!['127.0.0.1','localhost','[::1]'].includes(u.hostname))ctx.addIssue({code:'custom',message:'HTTP allowed only on loopback'});
});
export type Config=z.infer<typeof ConfigSchema>;
export function configFromEnv():Config{
 const e=process.env;let oidc:Config['oidc'];
 if(e.OIDC_ISSUER)oidc={issuer:e.OIDC_ISSUER,audience:e.OIDC_AUDIENCE??'',jwksUri:e.OIDC_JWKS_URI??'',authorizationEndpoint:e.OIDC_AUTHORIZATION_ENDPOINT??'',tokenEndpoint:e.OIDC_TOKEN_ENDPOINT??'',clientId:e.OIDC_CLIENT_ID??'',clientSecret:e.OIDC_CLIENT_SECRET};
 return ConfigSchema.parse({environment:e.NODE_ENV??'development',databaseUrl:e.DATABASE_URL,host:e.HOST,port:e.PORT?Number(e.PORT):undefined,origin:e.APP_ORIGIN??'http://127.0.0.1:8787',transit:e.VAULT_TRANSIT_ORIGIN?{endpoint:e.VAULT_TRANSIT_ORIGIN,keyName:e.VAULT_TRANSIT_KEY,tokenFile:e.VAULT_TOKEN_FILE}:undefined,allowedOrigins:(e.ALLOWED_ORIGINS??'').split(',').filter(Boolean),oidc});
}

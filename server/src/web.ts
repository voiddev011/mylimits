import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
export function webRoutes(app:FastifyInstance){
 const csp="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
 app.get('/',async(_req,reply)=>{reply.header('content-security-policy',csp);try{return reply.type('text/html; charset=utf-8').send(await readFile(new URL('../web-dist/index.html',import.meta.url)))}catch{return reply.code(503).type('text/plain').send('The optional dashboard is not built. Run npm run build:web --prefix server.')}});
 app.get('/assets/:file',async(req,reply)=>{
  const file=(req.params as {file:string}).file;if(!/^[a-zA-Z0-9_.-]+\.(js|css)$/.test(file))return reply.code(404).send();
  try{return reply.header('content-security-policy',csp).header('cache-control','public, max-age=31536000, immutable').type(file.endsWith('.js')?'application/javascript':'text/css').send(await readFile(new URL(`../web-dist/assets/${file}`,import.meta.url)))}catch{return reply.code(404).send()}
 });
}

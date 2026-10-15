import { createApp } from './app';
import { configFromEnv } from './config';
import { poolFor,migrate } from './db';
const config=configFromEnv(),pool=poolFor(config.databaseUrl);
await migrate(pool);const app=createApp({config,pool});
app.addHook('onClose',async()=>pool.end());
await app.listen({host:config.host,port:config.port});
console.log(`MyLimits snapshot-only API listening on ${config.host}:${config.port}; OIDC ${config.oidc?'configured':'not configured (authentication fails closed)'}.`);
for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>void app.close());

import { poolFor,migrate } from './db';
import { configFromEnv } from './config';
import { CredentialStore } from './credentials';
import { JobRunner,productionCollectors } from './jobs';
const config=configFromEnv(),pool=poolFor(config.databaseUrl);await migrate(pool);
const runner=new JobRunner({pool,credentials:new CredentialStore(pool),environment:config.environment});
let stopping=false;for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{stopping=true});
console.log(`MyLimits worker: ${productionCollectors.size} enabled provider collectors. Snapshot-only mode does not poll providers.`);
try{while(!stopping){await runner.runOne();await runner.cleanup();await new Promise(r=>setTimeout(r,1000))}}finally{await pool.end()}

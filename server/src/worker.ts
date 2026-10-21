import { poolFor,migrate } from './db';
import { configFromEnv } from './config';
import { HostedService,hostedDrivers } from './hosted';
import { HostedJobs } from './hosted-jobs';
import { transitFromConfig } from './transit-kms';
import { CredentialStore } from './credentials';
import { JobRunner,productionCollectors } from './jobs';
const config=configFromEnv(),pool=poolFor(config.databaseUrl);await migrate(pool);
const kms=await transitFromConfig(config.transit);
if(hostedDrivers.size&&(!kms||!config.oidc))throw new Error('Hosted providers require identity and protected credentials.');
const credentials=new CredentialStore(pool,kms),hosted=new HostedJobs(new HostedService(pool,credentials,config.environment));
const runner=new JobRunner({pool,credentials,environment:config.environment});
let stopping=false;for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{stopping=true});
console.log(`MyLimits worker: ${productionCollectors.size} enabled provider collectors. Snapshot-only mode does not poll providers.`);
let maintenanceAt=0;
try{while(!stopping){await hosted.schedule();await hosted.runOne();if(Date.now()-maintenanceAt>60000){await hosted.maintenance();maintenanceAt=Date.now();}await runner.runOne();await runner.cleanup();await new Promise(r=>setTimeout(r,1000))}}finally{await pool.end()}

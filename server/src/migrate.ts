import { poolFor,migrate } from './db';
import { configFromEnv } from './config';
const pool=poolFor(configFromEnv().databaseUrl);try{await migrate(pool);console.log('Database migrations applied.')}finally{await pool.end()}

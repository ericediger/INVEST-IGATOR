import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {Store} from '../server/store.js';
process.umask(0o077);
const data=resolve(process.env.RESEARCH_DATA_DIR||'runtime'),path=resolve(data,'research.sqlite');
if(!existsSync(path)) throw new Error('No existing database to back up');
const store=new Store(path,resolve(data,'backups')); try {console.log(await store.backup());} finally {store.close();}

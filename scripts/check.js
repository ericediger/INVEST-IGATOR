import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
for(const dir of ['server','public','scripts','tests']) for(const file of readdirSync(dir).filter(f=>f.endsWith('.js'))) {
  const r=spawnSync(process.execPath,['--check',`${dir}/${file}`],{stdio:'inherit'}); if(r.status) process.exit(r.status);
}
console.log('Production source syntax checks passed. Native ES modules require no bundler.');

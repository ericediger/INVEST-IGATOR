import Database from 'better-sqlite3';
import {mkdirSync,writeFileSync,renameSync,readdirSync,unlinkSync,statSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {id,seed,mutate,validateWorkspace,fail,now} from './model.js';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class Store {
  constructor(path,backupDir) {
    mkdirSync(dirname(path),{recursive:true,mode:0o700}); mkdirSync(backupDir,{recursive:true,mode:0o700});
    this.backupDir=backupDir; this.db=new Database(path); this.db.pragma('journal_mode = WAL'); this.db.pragma('synchronous = FULL');
    const version=this.db.pragma('user_version',{simple:true}); if(version>1) {this.db.close(); fail('Database schema is newer than this application',500);}
    this.db.exec('CREATE TABLE IF NOT EXISTS workspace (singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision TEXT NOT NULL, document TEXT NOT NULL); PRAGMA user_version=1;');
    this.db.transaction(()=>{if(!this.db.prepare('SELECT singleton FROM workspace').get()) this.db.prepare('INSERT INTO workspace VALUES (1,?,?)').run(id(),JSON.stringify(seed()));}).immediate();
    validateWorkspace(this.read().workspace);
  }
  read() {const r=this.db.prepare('SELECT revision, document FROM workspace WHERE singleton=1').get(); return {revision:r.revision,workspace:JSON.parse(r.document)};}
  update(revision,action,payload) {return this.db.transaction(()=>{
    const current=this.read(); if(revision!==current.revision) fail('This workspace changed in another session. Reload or review and reapply your draft.',409);
    const workspace=mutate(current.workspace,action,payload), next=id();
    if(Buffer.byteLength(JSON.stringify(workspace))>4*1024*1024) fail('Workspace exceeds the 4 MB household workspace limit. Export before making further changes.',413);
    this.db.prepare('UPDATE workspace SET revision=?,document=? WHERE singleton=1').run(next,JSON.stringify(workspace)); return {revision:next,workspace};
  }).immediate();}
  preview(envelope) {
    if(envelope?.format!=='investment-research' || envelope?.schemaVersion!==1) fail('Unsupported export format or schema version');
    if(!envelope.exportedAt || Number.isNaN(Date.parse(envelope.exportedAt))) fail('Invalid export timestamp');
    const workspace=validateWorkspace(envelope.workspace);
    if(Buffer.byteLength(JSON.stringify(workspace))>4*1024*1024) fail('Workspace exceeds the 4 MB household workspace limit',413);
    return {workspace,digest:digest(workspace),counts:Object.fromEntries(['companies','evidence','snapshots','scenarios','decisions'].map(k=>[k,workspace[k].length]))};
  }
  restore(revision,envelope,expectedDigest,confirmation) {
    const validated=this.preview(envelope); if(confirmation!=='REPLACE WORKSPACE') fail('Explicit replacement confirmation required');
    if(validated.digest!==expectedDigest) fail('The import differs from the preview. Preview it again.');
    return this.db.transaction(()=>{
      const current=this.read(); if(revision!==current.revision) fail('Workspace changed after preview. Preview again before replacement.',409);
      // SQLite serialize takes a consistent complete database image, including committed WAL pages.
      // Holding an immediate transaction excludes other writers between backup and replacement.
      const filename=`pre-restore-${now().replace(/[:.]/g,'-')}-${id()}.sqlite`;
      const path=join(this.backupDir,filename), temp=path+'.partial';
      writeFileSync(temp,this.db.serialize(),{mode:0o600,flag:'wx'});
      const check=new Database(temp,{readonly:true}); try {if(check.pragma('integrity_check',{simple:true})!=='ok') fail('Pre-restore backup verification failed',500);} finally {check.close();}
      renameSync(temp,path);
      const next=id(); this.db.prepare('UPDATE workspace SET revision=?,document=? WHERE singleton=1').run(next,JSON.stringify(validated.workspace));
      return {revision:next,workspace:validated.workspace,backup:filename};
    }).immediate();
  }
  export() {return {format:'investment-research',schemaVersion:1,exportedAt:now(),workspace:this.read().workspace};}
  async backup() {
    const filename=`backup-${now().replace(/[:.]/g,'-')}-${id()}.sqlite`, path=join(this.backupDir,filename), temp=path+'.partial';
    await this.db.backup(temp); const check=new Database(temp,{readonly:true}); try {if(check.pragma('integrity_check',{simple:true})!=='ok') fail('Backup integrity check failed',500);} finally {check.close();}
    renameSync(temp,path);
    const old=readdirSync(this.backupDir).filter(n=>/^backup-.*\.sqlite$/.test(n)).sort().reverse().slice(30); for(const name of old) unlinkSync(join(this.backupDir,name));
    return filename;
  }
  backupStatus() {return readdirSync(this.backupDir).filter(n=>n.endsWith('.sqlite')).map(name=>{const st=statSync(join(this.backupDir,name));return {name,bytes:st.size,createdAt:st.mtime.toISOString()};}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  close() {this.db.close();}
}

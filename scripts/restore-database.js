// Restore a SQLite backup into a NEW, DISPOSABLE directory; never overwrites a workspace.
import Database from 'better-sqlite3';
import {resolve,join} from 'node:path';
import {existsSync,mkdirSync} from 'node:fs';
import {validateWorkspace} from '../server/model.js';
const [source,target]=process.argv.slice(2);
if(!source||!target)throw new Error('Usage: node scripts/restore-database.js BACKUP.sqlite NEW_DIRECTORY');
const dest=resolve(target);if(existsSync(dest))throw new Error('Target already exists; use a new directory.');
const original=new Database(resolve(source),{readonly:true,fileMustExist:true});
try{
 if(original.pragma('integrity_check',{simple:true})!=='ok')throw new Error('Backup integrity check failed');
 if(original.pragma('user_version',{simple:true})!==1)throw new Error('Unsupported database schema');
 const expected=validateWorkspace(JSON.parse(original.prepare('SELECT document FROM workspace WHERE singleton=1').get().document));
 mkdirSync(dest,{recursive:true,mode:0o700});await original.backup(join(dest,'research.sqlite'));
 const restored=new Database(join(dest,'research.sqlite'),{readonly:true});
 try{const actual=validateWorkspace(JSON.parse(restored.prepare('SELECT document FROM workspace WHERE singleton=1').get().document));if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Roundtrip mismatch');if(restored.pragma('integrity_check',{simple:true})!=='ok')throw new Error('Restored integrity check failed');}finally{restored.close();}
 console.log('Verified restoration into',dest);
}finally{original.close();}

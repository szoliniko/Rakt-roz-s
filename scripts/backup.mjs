import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, copyFileSync, constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function backupDatabase(source,target){
  source=resolve(source);target=resolve(target);
  if(source===target||existsSync(target))throw new Error('A célfájl már létezik; mentés nem ír felül meglévő adatot.');
  if(!existsSync(source))throw new Error('A forrásadatbázis nem található.');
  mkdirSync(dirname(target),{recursive:true,mode:0o700});
  const db=new DatabaseSync(source,{readOnly:true});
  try{const result=db.prepare('PRAGMA quick_check').get();if(Object.values(result)[0]!=='ok')throw new Error('Az adatbázis ellenőrzése hibát talált.');db.prepare('VACUUM INTO ?').run(target);}finally{db.close();}
  return target;
}
export function restoreDatabase(source,target){
  source=resolve(source);target=resolve(target);
  if(source===target||existsSync(target))throw new Error('Visszaállítás csak új célfájlba történhet; a futó rendszert előbb állítsd le.');
  const verify=new DatabaseSync(source,{readOnly:true});
  try{if(Object.values(verify.prepare('PRAGMA quick_check').get())[0]!=='ok')throw new Error('A mentés sérült.');if(verify.prepare("SELECT value FROM metadata WHERE key='mode'").get()?.value!=='test')throw new Error('Ez nem a közös tesztrendszer mentése.');}finally{verify.close();}
  mkdirSync(dirname(target),{recursive:true,mode:0o700});copyFileSync(source,target,constants.COPYFILE_EXCL);return target;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [operation,source,target]=process.argv.slice(2);
  if(!['create','restore'].includes(operation)||!source||!target){process.stderr.write('Használat: node scripts/backup.mjs create|restore forrás.sqlite új-cél.sqlite\n');process.exit(1);}
  try{process.stdout.write((operation==='create'?backupDatabase(source,target):restoreDatabase(source,target))+'\n');}catch(error){process.stderr.write(error.message+'\n');process.exit(1);}
}

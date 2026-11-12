import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WarehouseStore} from '../src/application/store.mjs';
const TABLES=['metadata','app_state','commands','users','sessions','login_limits','drafts'];
export function restoreCloudflareBackup(backup,target){
  if(existsSync(target))throw new Error('Visszaállítás csak új célfájlba történhet.');
  const {payload,sha256}=backup;
  if(payload?.format!=='raktar-backup-v1'||createHash('sha256').update(JSON.stringify(payload)).digest('hex')!==sha256)throw new Error('Sérült vagy ismeretlen mentés.');
  if(!payload.tables?.metadata?.some(r=>r.key==='mode'&&r.value==='test')||TABLES.some(t=>!Array.isArray(payload.tables[t])))throw new Error('Hiányos tesztadat-mentés.');
  const store=new WarehouseStore({filename:target});
  try{
    store.transaction(()=>{
      for(const table of [...TABLES].reverse())store.db.exec(`DELETE FROM ${table}`);
      for(const table of TABLES){
        const columns=store.db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name);
        const insert=store.db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`);
        for(const row of payload.tables[table])insert.run(...columns.map(c=>row[c]));
      }
      if(Object.values(store.db.prepare('PRAGMA quick_check').get())[0]!=='ok')throw new Error('Az adattár ellenőrzése hibát talált.');
      if(store.db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Hibás kapcsolatok a mentésben.');
    });
  }finally{store.close();}
  return target;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [input,target]=process.argv.slice(2);
  if(!input||!target)throw new Error('Használat: node scripts/restore-cloudflare-backup.mjs mentés.json új-adatbázis.sqlite');
  console.log(restoreCloudflareBackup(JSON.parse(readFileSync(input,'utf8')),resolve(target)));
}

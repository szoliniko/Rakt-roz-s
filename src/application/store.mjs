import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { WarehouseStoreCore } from './store-core.mjs';
import { ensure } from './errors.mjs';
export { SESSION_MS, canonical } from './store-core.mjs';

export class WarehouseStore extends WarehouseStoreCore {
  constructor({filename,...options}={}) {
    ensure(filename,500,'DATABASE_REQUIRED','Adattároló szükséges.');
    const path=filename===':memory:'?filename:resolve(filename);
    if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});
    const db=new DatabaseSync(path);
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
    const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}};
    try{super({...options,db,transaction});}catch(error){db.close();throw error;}
    this.filename=path;
  }
}

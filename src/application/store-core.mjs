import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createState, transition, LOCATIONS } from '../domain/inventory.mjs';
import { AppError, ensure } from './errors.mjs';

const parse=JSON.parse;
const encode=JSON.stringify;
export const SESSION_MS=8*60*60*1000;
const LOCK_MS=5*60*1000;
const MAX_FAILURES=6;
export function canonical(value) {
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
const digest=value=>createHash('sha256').update(value).digest('hex');
const pinHash=(pin,salt)=>scryptSync(String(pin),salt,32).toString('hex');
function publicUser(u){return {id:u.id,name:u.name,role:u.role,location:u.location};}

/** Durable application state, commands and personal drafts. This is deliberately
 * a TEST workspace. It is never a StoreHouse inventory authority or live fallback.
 * KAP-01–04, SZER-02/05, MOZ-09/10: atomically persist the result before replying.
 */
export class WarehouseStoreCore {
  constructor({db,transaction,clock=()=>new Date(),initialState,mode='test'}={}) {
    ensure(mode==='test',503,'NOT_CONFIGURED','Az éles StoreHouse-kapcsolat még nincs beállítva; tesztkészletre nem váltunk át.');
    ensure(db&&transaction,500,'DATABASE_REQUIRED','Adattároló szükséges.');
    this.clock=clock;
    this.db=db;
    this.runTransaction=transaction;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS app_state(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,payload TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,fingerprint TEXT NOT NULL,action TEXT NOT NULL,result TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL,location TEXT NOT NULL,salt TEXT NOT NULL,pin_hash TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS login_limits(key TEXT PRIMARY KEY,failures INTEGER NOT NULL,first_at INTEGER NOT NULL,locked_until INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS drafts(user_id TEXT NOT NULL REFERENCES users(id),key TEXT NOT NULL,value TEXT NOT NULL,saved_at TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(user_id,key));
    `);
    this.transaction(()=>{
      const storedMode=this.db.prepare("SELECT value FROM metadata WHERE key='mode'").get();
      const schema=this.db.prepare("SELECT value FROM metadata WHERE key='schema'").get();
      ensure(!schema||['1','2'].includes(schema.value),503,'SCHEMA_UNSUPPORTED','Az adattár változatához külön ellenőrzött migráció szükséges.');
      ensure(!storedMode||storedMode.value==='test',503,'MODE_MISMATCH','Ez az adattár nem tesztadatbázis.');
      this.db.prepare('INSERT OR IGNORE INTO metadata(key,value) VALUES (?,?)').run('mode','test');
      if(!this.db.prepare('PRAGMA table_info(drafts)').all().some(c=>c.name==='revision'))this.db.exec('ALTER TABLE drafts ADD COLUMN revision INTEGER NOT NULL DEFAULT 1');
      this.db.prepare('INSERT OR REPLACE INTO metadata(key,value) VALUES (?,?)').run('schema','2');
      const maximumDraft=this.db.prepare('SELECT COALESCE(MAX(revision),0) AS revision FROM drafts').get().revision;
      this.db.prepare('INSERT OR IGNORE INTO metadata(key,value) VALUES (?,?)').run('draft_revision_sequence',String(maximumDraft));
      if(!this.db.prepare('SELECT 1 FROM app_state WHERE id=1').get()) {
        const state=initialState??createState({includeSourceCatalog:true,requireShift:true});
        this.db.prepare('INSERT INTO app_state VALUES(1,0,?,?)').run(encode(state),this.now());
      }
      if(!this.db.prepare('SELECT 1 FROM users LIMIT 1').get())this.seedTestUsers();
    });
  }
  now(){return new Date(this.clock()).toISOString();}
  transaction(fn){return this.runTransaction(fn);}
  seedTestUsers(){
    const insert=this.db.prepare('INSERT INTO users(id,name,role,location,salt,pin_hash) VALUES(?,?,?,?,?,?)');
    const users=[{id:'test-manager',name:'Teszt Raktárfelelős',role:'manager',location:'Fő raktár'}];
    LOCATIONS.forEach((location,index)=>{
      users.push({id:`test-receiver-${index}`,name:`Teszt átvevő · ${location}`,role:'receiver',location});
      users.push({id:`test-deputy-${index}`,name:`Teszt helyettes · ${location}`,role:'receiver',location});
    });
    for(const u of users){const salt=randomBytes(16).toString('hex');insert.run(u.id,u.name,u.role,u.location,salt,pinHash('1234',salt));}
  }
  listUsers(){return this.db.prepare('SELECT id,name,role,location FROM users WHERE active=1 ORDER BY role,location,id').all().map(publicUser);}
  user(id){const row=this.db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(id);return row?publicUser(row):null;}
  login(userId,pin){
    ensure(typeof userId==='string'&&userId.length<=100&&typeof pin==='string'&&/^\d{4,12}$/.test(pin),401,'INVALID_LOGIN','A név vagy a PIN-kód nem megfelelő.');
    const now=Date.parse(this.now());
    const key=digest(userId);
    let limit=this.db.prepare('SELECT * FROM login_limits WHERE key=?').get(key);
    ensure(!limit||limit.locked_until<=now,429,'LOGIN_LOCKED','Túl sok hibás PIN-kód. Próbáld újra öt perc múlva.');
    if(limit&&now-limit.first_at>=LOCK_MS){this.db.prepare('DELETE FROM login_limits WHERE key=?').run(key);limit=null;}
    const row=this.db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(userId);
    const actual=Buffer.from(pinHash(pin,row?.salt??'unknown-user-constant-salt'),'hex');
    const expected=Buffer.from(row?.pin_hash??'0'.repeat(64),'hex');
    if(!row||!timingSafeEqual(actual,expected)){
      const failures=(limit?.failures??0)+1;
      this.db.prepare('INSERT OR REPLACE INTO login_limits VALUES(?,?,?,?)').run(key,failures,limit?.first_at??now,failures>=MAX_FAILURES?now+LOCK_MS:0);
      throw new AppError(401,'INVALID_LOGIN','A név vagy a PIN-kód nem megfelelő.');
    }
    this.db.prepare('DELETE FROM login_limits WHERE key=?').run(key);
    this.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now);
    const token=randomBytes(32).toString('base64url');
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),row.id,now+SESSION_MS);
    return {token,actor:publicUser(row)};
  }
  authenticate(token){
    ensure(typeof token==='string'&&token.length>=32,401,'UNAUTHORIZED','Jelentkezz be a saját neveddel és PIN-kódoddal.');
    const row=this.db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>? AND active=1').get(digest(token),Date.parse(this.now()));
    ensure(row,401,'UNAUTHORIZED','A belépés lejárt. Jelentkezz be újra; a mentett munka megmaradt.');
    return publicUser(row);
  }
  logout(token){if(typeof token==='string')this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));}
  snapshot(actor){
    const row=this.db.prepare('SELECT * FROM app_state WHERE id=1').get();
    return {state:parse(row.payload),revision:row.revision,serverNow:this.now(),actor,
      connection:{mode:'test',status:'test',lastSuccessfulAt:row.updated_at,storeHouse:'not_configured',message:'Közös tesztadatbázis. Nincs élő r_keeper / StoreHouse-kapcsolat.'}};
  }
  normalizeAction(action,actor,state){
    const cleaned=structuredClone(action);
    if(!['SHIFT_OPEN','SHIFT_HANDOVER'].includes(action.type))return cleaned;
    const location=action.type==='SHIFT_HANDOVER'?state.shifts?.find(s=>s.id===action.id)?.location:action.location;
    if(action.type==='SHIFT_OPEN'&&!cleaned.assigneeId&&actor.role==='receiver')cleaned.assigneeId=actor.id;
    for(const [idKey,nameKey] of [['assigneeId','assigneeName'],['deputyId','deputyName']]){
      if(cleaned[idKey]){const u=this.user(cleaned[idKey]);ensure(u&&u.role==='receiver'&&u.location===location,422,'INVALID_ASSIGNEE','A kijelölt dolgozó legyen az érintett hely ismert átvevője.');cleaned[nameKey]=u.name;}
      else {delete cleaned[nameKey];}
    }
    return cleaned;
  }
  commandStatus(actor,id){
    const old=this.db.prepare('SELECT result FROM commands WHERE id=? AND actor_id=?').get(id,actor.id);
    ensure(old,404,'COMMAND_NOT_FOUND','A műveletet a központ még nem rögzítette ezen az azonosítón.');
    return {...this.snapshot(actor),commandId:id,replayed:true,originalResult:parse(old.result)};
  }
  command(actor,{id,expectedRevision,action}={}){
    ensure(typeof id==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(id),422,'INVALID_COMMAND_ID','Hiányzik a művelet egyedi azonosítója.');
    ensure(action&&typeof action==='object'&&!Array.isArray(action)&&typeof action.type==='string',422,'INVALID_ACTION','Hiányzik a rögzítendő művelet.');
    ensure(Number.isSafeInteger(expectedRevision)&&expectedRevision>=0,422,'INVALID_REVISION','Frissítsd a közös állapotot a beküldés előtt.');
    return this.transaction(()=>{
      const snapshot=this.snapshot(actor);
      action=this.normalizeAction(action,actor,snapshot.state);
      const fingerprint=digest(canonical(action));
      const old=this.db.prepare('SELECT * FROM commands WHERE id=?').get(id);
      if(old){
        ensure(old.actor_id===actor.id&&old.fingerprint===fingerprint,409,'COMMAND_ID_REUSED','Ez az azonosító már más tartalmú művelethez tartozik. Ellenőrizd az előzményeket.');
        return {...this.snapshot(actor),commandId:id,replayed:true,originalResult:parse(old.result)};
      }
      ensure(snapshot.revision===expectedRevision,409,'REVISION_CONFLICT','Közben másik dolgozó módosította a készletet vagy az ügyet. Az adatok frissültek; ellenőrizd újra a rögzítést.');
      let next;
      try{next=transition(snapshot.state,action,actor,snapshot.serverNow);}
      catch(error){throw new AppError(422,'INVALID_TRANSITION',error.message);}
      const changed=next!==snapshot.state;
      const revision=snapshot.revision+(changed?1:0);
      if(changed)this.db.prepare('UPDATE app_state SET payload=?,revision=?,updated_at=? WHERE id=1').run(encode(next),revision,snapshot.serverNow);
      const result={revision,eventId:next.history.at(-1)?.id??null,completedAt:snapshot.serverNow};
      this.db.prepare('INSERT INTO commands VALUES(?,?,?,?,?,?)').run(id,actor.id,fingerprint,encode(action),encode(result),snapshot.serverNow);
      return {...this.snapshot(actor),commandId:id,replayed:false,originalResult:result};
    });
  }
  draftKey(key){ensure(typeof key==='string'&&key.length>0&&key.length<=160&&!/[\u0000-\u001f]/.test(key),422,'INVALID_DRAFT_KEY','A piszkozat azonosítója nem megfelelő.');return key;}
  draft(actor,key){
    const row=this.db.prepare('SELECT key,value,saved_at,revision FROM drafts WHERE user_id=? AND key=?').get(actor.id,key);
    return row?{key:row.key,value:parse(row.value),savedAt:row.saved_at,ownerId:actor.id,revision:row.revision}:null;
  }
  drafts(actor){return this.db.prepare('SELECT key,value,saved_at,revision FROM drafts WHERE user_id=? ORDER BY saved_at DESC').all(actor.id).map(row=>({key:row.key,value:parse(row.value),savedAt:row.saved_at,ownerId:actor.id,revision:row.revision}));}
  draftConflict(current){const error=new AppError(409,'DRAFT_CONFLICT','Ezt a piszkozatot közben egy másik tableten módosították. A központi változatot nem írtuk felül; ellenőrizd a két változatot.');error.currentDraft=current;throw error;}
  saveDraft(actor,key,value,expectedRevision=0){
    this.draftKey(key);
    ensure(Number.isSafeInteger(expectedRevision)&&expectedRevision>=0,422,'INVALID_DRAFT_REVISION','A piszkozat korábbi mentési változata szükséges.');
    ensure(value&&typeof value==='object'&&!Array.isArray(value),422,'INVALID_DRAFT','A piszkozat tartalma nem megfelelő.');
    const data=encode(value);ensure(Buffer.byteLength(data)<=256000,413,'DRAFT_TOO_LARGE','A piszkozat túl nagy. Kevesebb sort adj meg egyszerre.');
    ensure(!/"(?:pin|password|token)"\s*:/i.test(data),422,'SECRET_IN_DRAFT','PIN-kódot vagy jelszót nem tárolunk piszkozatban.');
    return this.transaction(()=>{
      const current=this.draft(actor,key);
      if((current?.revision??0)!==expectedRevision)this.draftConflict(current);
      const savedAt=this.now();
      const revision=Number(this.db.prepare("SELECT value FROM metadata WHERE key='draft_revision_sequence'").get().value)+1;
      ensure(Number.isSafeInteger(revision),500,'DRAFT_SEQUENCE_INVALID','A piszkozat mentési azonosítója ellenőrzést igényel.');
      this.db.prepare("UPDATE metadata SET value=? WHERE key='draft_revision_sequence'").run(String(revision));
      this.db.prepare('INSERT OR REPLACE INTO drafts(user_id,key,value,saved_at,revision) VALUES(?,?,?,?,?)').run(actor.id,key,data,savedAt,revision);
      return {key,value:parse(data),savedAt,ownerId:actor.id,revision};
    });
  }
  deleteDraft(actor,key,expectedRevision){
    this.draftKey(key);
    return this.transaction(()=>{
      const current=this.draft(actor,key);if(!current)return;
      if(current.revision!==expectedRevision)this.draftConflict(current);
      this.db.prepare('DELETE FROM drafts WHERE user_id=? AND key=?').run(actor.id,key);
    });
  }
  close(){this.db.close();}
}

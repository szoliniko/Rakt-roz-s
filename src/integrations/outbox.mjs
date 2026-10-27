import { createHash } from 'node:crypto';
import { canonical } from '../application/store.mjs';
import { AppError, ensure } from '../application/errors.mjs';

const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
/** Durable, provider-independent write journal. No worker or HTTP route dispatches
 * this automatically. The test inventory service is separate from this live port.
 * Recovering 'sending' means inspect-only, never send again on startup.
 */
export class IntegrationOutbox {
  constructor(db,{clock=()=>new Date()}={}){
    this.db=db;this.clock=clock;
    db.exec(`
      CREATE TABLE IF NOT EXISTS integration_groups(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS integration_parts(id TEXT PRIMARY KEY,group_id TEXT NOT NULL REFERENCES integration_groups(id),payload TEXT NOT NULL,status TEXT NOT NULL,external_id TEXT,verification TEXT,updated_at TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS integration_events(id INTEGER PRIMARY KEY AUTOINCREMENT,part_id TEXT NOT NULL,at TEXT NOT NULL,status TEXT NOT NULL,detail TEXT NOT NULL);
    `);
    if(!db.prepare('PRAGMA table_info(integration_parts)').all().some(c=>c.name==='revision'))db.exec('ALTER TABLE integration_parts ADD COLUMN revision INTEGER NOT NULL DEFAULT 0');
  }
  now(){return new Date(this.clock()).toISOString();}
  event(id,status,detail){this.db.prepare('INSERT INTO integration_events(part_id,at,status,detail) VALUES(?,?,?,?)').run(id,this.now(),status,JSON.stringify(detail));}
  enqueue({id,children}){
    ensure(typeof id==='string'&&id.length>0&&Array.isArray(children)&&children.length>0,422,'INVALID_INTENT','Hiányzik az összetartozó könyvelési részek listája.');
    ensure(new Set(children.map(c=>c.id)).size===children.length,422,'DUPLICATE_PART','A könyvelési részazonosítók legyenek egyediek.');
    for(const c of children)ensure(typeof c.id==='string'&&c.id.length>0,422,'INVALID_PART','Minden résznek saját stabil azonosító kell.');
    const fingerprint=hash({id,children});
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const old=this.db.prepare('SELECT fingerprint FROM integration_groups WHERE id=?').get(id);
      if(old){ensure(old.fingerprint===fingerprint,409,'INTENT_ID_REUSED','A könyvelési azonosító már más tartalomhoz tartozik.');this.db.exec('COMMIT');return this.group(id);}
      this.db.prepare('INSERT INTO integration_groups VALUES(?,?,?)').run(id,fingerprint,this.now());
      for(const child of children){this.db.prepare('INSERT INTO integration_parts(id,group_id,payload,status,external_id,verification,updated_at) VALUES(?,?,?,\'queued\',NULL,NULL,?)').run(child.id,id,JSON.stringify(child),this.now());this.event(child.id,'queued',{reason:'Prepared, not sent.'});}
      this.db.exec('COMMIT');return this.group(id);
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  part(id){const row=this.db.prepare('SELECT * FROM integration_parts WHERE id=?').get(id);return row?{...row,payload:JSON.parse(row.payload),verification:row.verification?JSON.parse(row.verification):null}:null;}
  parts(id){return this.db.prepare('SELECT * FROM integration_parts WHERE group_id=? ORDER BY rowid').all(id).map(r=>({...r,payload:JSON.parse(r.payload),verification:r.verification?JSON.parse(r.verification):null}));}
  group(id){
    ensure(this.db.prepare('SELECT 1 FROM integration_groups WHERE id=?').get(id),404,'INTENT_NOT_FOUND','A könyvelési ügy nem található.');
    const children=this.parts(id);
    const statuses=children.map(p=>p.status);
    const status=statuses.every(s=>s==='confirmed')?'confirmed':statuses.some(s=>['sending','uncertain'].includes(s))?'uncertain':statuses.every(s=>s==='rejected')?'rejected':statuses.some(s=>s==='confirmed')?'partial':statuses.some(s=>s==='rejected')?'attention':'queued';
    return {id,status,children};
  }
  update(id,status,{externalId=null,verification=null,detail={},expectedRevision}={}){
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const current=this.part(id);
      const allowed={queued:['sending'],sending:['uncertain','confirmed','rejected'],uncertain:['uncertain','confirmed','rejected','queued'],confirmed:[],rejected:[]};
      if(!current||!allowed[current.status]?.includes(status)||(expectedRevision!==undefined&&current.revision!==expectedRevision)){this.db.exec('COMMIT');return false;}
      ensure(!externalId||!current.external_id||current.external_id===externalId,409,'EXTERNAL_ID_CHANGED','A visszaellenőrzés más bizonylatot jelzett. További ellenőrzés szükséges.');
      this.db.prepare('UPDATE integration_parts SET status=?,external_id=COALESCE(?,external_id),verification=?,updated_at=?,revision=revision+1 WHERE id=?').run(status,externalId,verification?JSON.stringify(verification):null,this.now(),id);
      this.event(id,status,detail);this.db.exec('COMMIT');return true;
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  persistReference(id,externalId){
    if(!externalId)return;
    ensure(typeof externalId==='string',502,'INVALID_EXTERNAL_ID','A szolgáltatói bizonylatazonosító nem értelmezhető.');
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const current=this.part(id);
      ensure(!current.external_id||current.external_id===externalId,409,'EXTERNAL_ID_CHANGED','Ugyanahhoz a művelethez eltérő külső bizonylatazonosító érkezett.');
      if(!current.external_id&&!['confirmed','rejected'].includes(current.status)){
        this.db.prepare('UPDATE integration_parts SET external_id=?,updated_at=?,revision=revision+1 WHERE id=?').run(externalId,this.now(),id);
        this.event(id,current.status,{reason:'Provider receipt reference persisted before read-back.',externalId});
      }
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  ready(adapter){ensure(adapter?.configured===true&&typeof adapter.submit==='function'&&typeof adapter.verify==='function',503,'NOT_CONFIGURED','A StoreHouse-kapcsolat nincs igazoltan beállítva. Nem történt küldés.');}
  async inspect(part,adapter){
    try{
      const result=await adapter.verify({...part.payload,externalId:part.external_id});
      ensure(['confirmed','rejected','unknown','absent'].includes(result?.status),502,'INVALID_VERIFICATION','A szolgáltatói ellenőrzés eredménye nem értelmezhető.');
      if(result.status==='confirmed'){
        ensure(typeof result.externalId==='string'&&result.externalId.length>0,502,'MISSING_EXTERNAL_ID','A visszaellenőrzött bizonylat azonosítója hiányzik.');
        this.update(part.id,'confirmed',{externalId:result.externalId,verification:result,expectedRevision:part.revision,detail:{reason:'Provider read-back confirmed.'}});
      }else if(result.status==='rejected')this.update(part.id,'rejected',{verification:result,expectedRevision:part.revision,detail:{reason:result.reason??'Provider rejected.'}});
      else this.update(part.id,'uncertain',{verification:result,expectedRevision:part.revision,detail:{reason:'Needs investigation; no automatic retry.'}});
    }catch(error){this.update(part.id,'uncertain',{expectedRevision:part.revision,detail:{reason:'Verification unavailable.',code:error.code??'VERIFY_ERROR'}});}
  }
  async dispatch(id,adapter){
    this.ready(adapter);
    for(const part of this.parts(id)){
      if(['sending','uncertain'].includes(part.status)){await this.inspect(part,adapter);continue;}
      if(part.status!=='queued')continue;
      // Claim atomically. A second dispatcher cannot send an already claimed part.
      this.db.exec('BEGIN IMMEDIATE');
      let claimed=false;
      try{claimed=this.db.prepare("UPDATE integration_parts SET status='sending',updated_at=?,revision=revision+1 WHERE id=? AND status='queued'").run(this.now(),part.id).changes===1;if(claimed)this.event(part.id,'sending',{reason:'Durably claimed before external call.'});this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}
      if(!claimed)continue;
      try{
        const result=await adapter.submit(part.payload);
        if(result?.status==='rejected'){this.update(part.id,'rejected',{detail:{reason:result.reason??'Provider rejected.'}});continue;}
        ensure(result?.status==='accepted',502,'INVALID_SUBMIT_RESULT','A küldés eredménye nem ellenőrzött.');
        this.persistReference(part.id,result.externalId);
        await this.inspect(this.part(part.id),adapter);
      }catch(error){this.update(part.id,'uncertain',{detail:{reason:'Send outcome unknown; inspect before retry.',code:error.code??'SEND_ERROR'}});}
    }
    return this.group(id);
  }
  async verify(id,adapter){this.ready(adapter);for(const part of this.parts(id))if(['sending','uncertain'].includes(part.status))await this.inspect(part,adapter);return this.group(id);}
  async allowVerifiedRetry(partId,adapter,{reason}={}){
    this.ready(adapter);ensure(typeof reason==='string'&&reason.trim().length>0,422,'REASON_REQUIRED','Az ellenőrzött újrapróbálás indokát add meg.');
    const row=this.db.prepare('SELECT * FROM integration_parts WHERE id=?').get(partId);
    ensure(row?.status==='uncertain',409,'NOT_UNCERTAIN','Csak ellenőrzésre váró művelet próbálható újra.');
    const result=await adapter.verify({...JSON.parse(row.payload),externalId:row.external_id});
    ensure(result?.status==='absent'&&result.authoritative===true,409,'OUTCOME_UNCERTAIN','Nem igazolt, hogy a művelet nem történt meg. Nem küldjük el újra.');
    const changed=this.update(partId,'queued',{verification:result,expectedRevision:row.revision,detail:{reason:reason.trim(),action:'Operator allowed retry after authoritative absence.'}});
    ensure(changed,409,'INTENT_CHANGED','A művelet állapota közben megváltozott. Nem engedélyeztünk újabb küldést.');
    return this.group(row.group_id);
  }
}

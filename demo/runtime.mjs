import { createState, transition, LOCATIONS } from '../src/domain/inventory.mjs';

// The served application only uses the authenticated server API. This explicit
// flag is injected by that server; a failed request NEVER selects a local ledger.
const SERVER = globalThis.__WAREHOUSE_SERVER__ === true;
const PREFIX = 'raktar-foundations-v6:';
const LOCAL_DB = 'raktar-preview-v6';
const clone = value => structuredClone(value);
const keyFor = (actorId, key) => `${actorId}:${key}`;
const makeId = () => globalThis.crypto?.randomUUID?.() || `preview-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const error = (code, message, extra = {}) => Object.assign(new Error(message), {isRuntimeError:true,code, ...extra});
function storageGet(store, key) { try { const raw=globalThis[store].getItem(PREFIX+key); return raw?JSON.parse(raw):null; } catch { return null; } }
function storageSet(store, key, value) { try { if(value===null)globalThis[store].removeItem(PREFIX+key); else globalThis[store].setItem(PREFIX+key,JSON.stringify(value)); return true; } catch { return false; } }
const users = [
  {id:'test-manager',name:'Teszt raktárfelelős',role:'manager',location:LOCATIONS[0]},
  ...LOCATIONS.flatMap((location,i)=>[
    {id:`test-receiver-${i}`,name:`${location} átvevő (teszt)`,role:'receiver',location},
    {id:`test-deputy-${i}`,name:`${location} helyettes (teszt)`,role:'receiver',location},
  ]),
];
function initialLocal() { return {state:createState({includeSourceCatalog:true,requireShift:true}),revision:0,commands:{},drafts:{},clockOffset:0}; }
function canonical(value) {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}

class PreviewStorage {
  constructor(){this.db=null;this.memory=null;this.persistent=false;}
  async open(){
    try {
      if(!globalThis.indexedDB)throw new Error('IndexedDB unavailable');
      this.db=await new Promise((resolve,reject)=>{
        const req=indexedDB.open(LOCAL_DB,1);
        req.onupgradeneeded=()=>req.result.createObjectStore('records');
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
        req.onblocked=()=>reject(new Error('A helyi tárolót egy másik megnyitott ablak foglalja.'));
      });
      this.persistent=true;
    } catch {
      this.memory=initialLocal();
    }
    // Reading errors after an opened DB are not silently replaced with seed data.
    await this.update(record=>({record:record||initialLocal()}));
  }
  async update(fn){
    if(!this.db){const result=fn(clone(this.memory));this.memory=result.record;return clone(result.value??result.record);}
    return new Promise((resolve,reject)=>{
      const tx=this.db.transaction('records','readwrite');
      const store=tx.objectStore('records');const req=store.get('ledger');let value;
      req.onsuccess=()=>{
        try {const result=fn(req.result);store.put(result.record,'ledger');value=result.value??result.record;}
        catch(e){reject(e);tx.abort();}
      };
      tx.oncomplete=()=>resolve(clone(value));tx.onerror=()=>reject(tx.error||error('STORAGE_ERROR','A helyi mentés nem sikerült.'));
      tx.onabort=()=>reject(tx.error||error('STORAGE_ERROR','A helyi mentés megszakadt.'));
    });
  }
  async read(){return this.update(record=>({record,value:record}));}
}

export function createRuntime(){
  const mode=SERVER?'server':'local';
  const preview=new PreviewStorage();
  let current=null, actor=null, boot=null, anchorTime=Date.now(), anchorTick=performance.now(), localPending=null;
  let queue=Promise.resolve();
  let sessionGeneration=0;
  const draftRevisions=new Map();
  const draftQueues=new Map();
  const draftJob=(owner,key,fn)=>{const id=keyFor(owner,key);const next=(draftQueues.get(id)||Promise.resolve()).catch(()=>{}).then(fn);draftQueues.set(id,next);return next;};
  const runSerial=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
  function apply(snapshot){
    if(!snapshot)return snapshot;
    if(actor && snapshot.actor?.id!==actor.id)throw error('SESSION_CHANGED','Másik dolgozó jelentkezett be ezen a böngészőn. Lépj be újra a saját neveddel.');
    current=snapshot;actor=snapshot.actor;
    anchorTime=Date.parse(snapshot.serverNow);anchorTick=performance.now();
    return clone(snapshot);
  }
  function now(){return new Date(anchorTime+Math.max(0,performance.now()-anchorTick));}
  function requireActor(){if(!actor)throw error('UNAUTHORIZED','Jelentkezz be a saját tesztfelhasználóddal.');}
  function localSnapshot(record,identity=actor){
    return {state:record.state,revision:record.revision,actor:identity,serverNow:new Date(Date.now()+record.clockOffset).toISOString(),
      connection:{mode:'test',status:'local_preview',demoClockOffsetMinutes:record.clockOffset/60000,lastSuccessfulAt:new Date(Date.now()+record.clockOffset).toISOString(),storeHouse:'not_configured'}};
  }
  async function request(path,options={}){
    const generation=sessionGeneration;
    const expectedActor=actor?.id;
    const publicRequest=path==='/api/bootstrap'||(path==='/api/session'&&options.method==='POST');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,
        headers:{'Content-Type':'application/json',...(!publicRequest&&expectedActor?{'X-Actor-Id':expectedActor}:{}),...(options.headers||{})},signal:controller.signal});
      const body=await response.json();
      if(generation!==sessionGeneration)throw error('SESSION_CHANGED','Közben másik bejelentkezés történt. A korábbi beküldést a saját felhasználójánál lehet ellenőrizni.');
      if(!response.ok){
        if(body.state&&body.actor)apply(body);
        throw error(body.error?.code||`HTTP_${response.status}`,body.error?.message||'A művelet nem sikerült.',{snapshot:body.state?body:null,httpStatus:response.status,draft:body.currentDraft||body.draft});
      }
      return body;
    }catch(e){
      if(e.isRuntimeError)throw e;
      throw error('NETWORK_ERROR','A kiszolgáló nem érhető el, vagy a válasza nem érkezett meg. A bevitel megmarad; a véglegesítés eredményét ellenőrizni kell.');
    }finally {clearTimeout(timer);}
  }
  function getPending(){
    if(!actor)return null;
    return clone(localPending?.actorId===actor.id?localPending:storageGet('localStorage',`pending:${actor.id}`)||storageGet('sessionStorage',`pending:${actor.id}`));
  }
  function writePending(value,ownerId=actor?.id){
    if(!ownerId)throw error('UNAUTHORIZED','A beküldéshez bejelentkezés szükséges.');
    const key=`pending:${ownerId}`;
    const savedLocal=storageSet('localStorage',key,value);
    const savedSession=storageSet('sessionStorage',key,value);
    if(SERVER&&value&&!savedLocal&&!savedSession)throw error('PERSISTENCE_UNAVAILABLE','A beküldés azonosítóját nem sikerült elmenteni ezen a készüléken. A véglegesítést nem küldtük el. Engedélyezd a böngésző helyi tárolását.');
    if(actor?.id===ownerId)localPending=value;
  }
  async function bootstrap(){
    if(SERVER){
      boot=await request('/api/bootstrap');
      try {apply(await request('/api/session'));}catch(e){if(e.code!=='UNAUTHORIZED'&&e.httpStatus!==401)throw e;}
      return {...boot,mode,authenticated:!!actor,snapshot:current?clone(current):null,storage:{persistent:true,label:'Közös tesztadatbázis a kiszolgálón'}};
    }
    await preview.open();
    boot={users:clone(users),testPin:'1234'};
    const remembered=storageGet('sessionStorage','preview-actor');
    actor=users.find(u=>u.id===remembered)||null;
    if(actor)apply(localSnapshot(await preview.read()));
    return {...boot,mode,authenticated:!!actor,snapshot:current?clone(current):null,
      storage:{persistent:preview.persistent,label:preview.persistent?'Előnézet: mentés ebben a böngészőben':'Előnézet: a böngésző tiltja a tartós mentést; újratöltéskor a munka elveszik'}};
  }
  async function login(userId,pin){
    sessionGeneration++;actor=null;current=null;localPending=null;draftRevisions.clear();
    if(SERVER)return apply(await request('/api/session',{method:'POST',body:JSON.stringify({userId,pin})}));
    const selected=users.find(u=>u.id===userId);
    if(!selected||String(pin)!=='1234')throw error('UNAUTHORIZED','Hibás tesztfelhasználó vagy PIN. A bemutató teszt-PIN-je: 1234.');
    actor=clone(selected);storageSet('sessionStorage','preview-actor',actor.id);localPending=null;
    return apply(localSnapshot(await preview.read()));
  }
  async function logout(){
    sessionGeneration++;
    if(SERVER)await request('/api/session',{method:'DELETE'});
    else storageSet('sessionStorage','preview-actor',null);
    actor=null;current=null;localPending=null;
  }
  async function refresh(){
    requireActor();
    return apply(SERVER?await request('/api/state'):localSnapshot(await preview.read()));
  }
  function canonicalizeLocalAction(action){
    const next=clone(action);
    if(['SHIFT_OPEN','SHIFT_HANDOVER'].includes(next.type)){
      for(const prefix of ['assignee','deputy']){
        const id=next[`${prefix}Id`];if(!id)continue;
        const person=users.find(u=>u.id===id&&u.role==='receiver');
        const place=next.location||current?.state.shifts.find(s=>s.id===next.id)?.location;
        if(!person||person.location!==place)throw error('FORBIDDEN','A kijelölt dolgozó nem ehhez a helyhez tartozik.');
        next[`${prefix}Name`]=person.name;
      }
    }
    return next;
  }
  async function send(envelope){
    const identity=clone(actor);
    if(!identity||identity.id!==envelope.actorId)throw error('SESSION_CHANGED','A beküldés másik dolgozóhoz tartozik.');
    if(SERVER)return apply(await request('/api/commands',{method:'POST',body:JSON.stringify({id:envelope.id,expectedRevision:envelope.expectedRevision,action:envelope.action,actorId:envelope.actorId})}));
    const result=await preview.update(record=>{
      const fingerprint=canonical({actorId:identity.id,action:envelope.action});
      const prior=record.commands[envelope.id];
      if(prior){if(prior.fingerprint!==fingerprint)throw error('IDEMPOTENCY_CONFLICT','Ezzel az azonosítóval már más művelet szerepel.');return {record,value:{...localSnapshot(record,identity),commandId:envelope.id,replayed:true}};}
      if(record.revision!==envelope.expectedRevision)throw error('REVISION_CONFLICT','Közben megváltoztak az adatok. A bevitel megmaradt; ellenőrizd a friss állapotot, majd küldd be újra.',{snapshot:localSnapshot(record,identity)});
      const nextAction=canonicalizeLocalAction(envelope.action);
      const at=new Date(Date.now()+record.clockOffset);
      const next=transition(record.state,nextAction,identity,at);
      record.state=next;record.revision++;
      record.commands[envelope.id]={fingerprint,actorId:identity.id,at:at.toISOString()};
      return {record,value:{...localSnapshot(record,identity),commandId:envelope.id,replayed:false}};
    });
    return apply(result);
  }
  async function execute(envelope){
    try {const result=await send(envelope);writePending(null,envelope.actorId);return result;}
    catch(e){
      if(e.snapshot)apply(e.snapshot);
      if(['NETWORK_ERROR','SESSION_CHANGED'].includes(e.code)||e.httpStatus>=500){e.pending=clone(envelope);}
      else writePending(null,envelope.actorId); // An explicit, received rejection is not an unknown write.
      throw e;
    }
  }
  async function command(action,options={}){
    return runSerial(async()=>{
      requireActor();
      const pending=getPending();
      if(pending)throw error('PENDING_COMMAND','Egy korábbi beküldés eredménye még nem ismert. Előbb ellenőrizd azt; új műveletet nem küldtünk el.',{pending});
      const envelope={id:options.id||makeId(),expectedRevision:options.expectedRevision??current.revision,action:clone(action),actorId:actor.id};
      writePending(envelope);
      return execute(envelope);
    });
  }
  async function reconcilePending(){
    requireActor();const pending=getPending();if(!pending)return {status:'none'};
    if(SERVER){
      try {const snapshot=apply(await request(`/api/commands/${encodeURIComponent(pending.id)}`));writePending(null);return {status:'confirmed',snapshot};}
      catch(e){if(e.httpStatus===404)return {status:'not_found'};throw e;}
    }
    const record=await preview.read();
    const found=record.commands[pending.id];
    if(found&&found.actorId===actor.id){writePending(null);return {status:'confirmed',snapshot:apply(localSnapshot(record))};}
    return {status:'not_found'};
  }
  async function retryPending(){
    return runSerial(async()=>{
      requireActor();const pending=getPending();if(!pending)throw error('NO_PENDING','Nincs ellenőrizendő beküldés.');
      const result=await reconcilePending();if(result.status==='confirmed')return result.snapshot;
      // Same identity and exact action; server deduplication wins over revision.
      return execute(pending);
    });
  }
  function offlineDrafts(){return actor?storageGet('localStorage',`drafts:${actor.id}`)||{}:{};}
  async function loadDrafts(){
    requireActor();const ownerId=actor.id;const generation=sessionGeneration;let list;
    if(SERVER){const response=await request('/api/drafts');list=response.drafts;}
    else {const record=await preview.read();list=Object.values(record.drafts).filter(d=>d.ownerId===ownerId);}
    if(actor?.id!==ownerId||generation!==sessionGeneration)throw error('SESSION_CHANGED','Közben másik dolgozó jelentkezett be.');
    const drafts={},saved={};
    for(const row of list){
      if(row.ownerId!==ownerId)throw error('SESSION_CHANGED','Másik dolgozó piszkozatát nem nyitjuk meg.');
      draftRevisions.set(keyFor(ownerId,row.key),row.revision||0);
      drafts[row.key]=row.value;saved[row.key]={savedAt:row.savedAt,source:SERVER?'server':preview.persistent?'device':'memory',revision:row.revision||0};
    }
    // A remaining device draft is unsent, irrespective of wall-clock ordering.
    // Preserve both versions on a conflict instead of silently discarding work.
    for(const [key,row] of Object.entries(offlineDrafts())){
      const serverValue=drafts[key];const revision=saved[key]?.revision||0;
      const conflict=SERVER&&(row.expectedRevision??0)!==revision;
      drafts[key]=row.value;saved[key]={savedAt:row.savedAt,source:'device',unsynced:true,conflict,serverValue,revision};
      if(SERVER)draftRevisions.set(keyFor(ownerId,key),row.expectedRevision??0);
    }
    return {drafts,saved};
  }
  async function saveDraft(key,value){
    requireActor();const ownerId=actor.id;
    const row={key,value:clone(value),ownerId,savedAt:now().toISOString(),expectedRevision:draftRevisions.get(keyFor(ownerId,key))||0};
    const local=offlineDrafts();local[key]=row;
    const onDevice=storageSet('localStorage',`drafts:${ownerId}`,local);
    return draftJob(ownerId,key,async()=>{
      if(actor?.id!==ownerId){
        if(onDevice)return {savedAt:row.savedAt,source:'device',unsynced:true};
        throw error('SESSION_CHANGED','Közben másik dolgozó jelentkezett be. Az előző dolgozó piszkozatát nem mentettük az új nevében.');
      }
      if(SERVER){
        try {
          const result=await request('/api/drafts',{method:'PUT',body:JSON.stringify({key,value:row.value,ownerId,expectedRevision:draftRevisions.get(keyFor(ownerId,key))||0})});
          draftRevisions.set(keyFor(ownerId,key),result.draft.revision);
          const latest=storageGet('localStorage',`drafts:${ownerId}`)||{};
          if(canonical(latest[key]?.value)===canonical(row.value))delete latest[key];
          else if(latest[key])latest[key].expectedRevision=result.draft.revision;
          storageSet('localStorage',`drafts:${ownerId}`,latest);
          return {savedAt:result.draft.savedAt,source:'server',revision:result.draft.revision};
        }catch(e){if(e.code==='NETWORK_ERROR'&&onDevice)return {savedAt:row.savedAt,source:'device',unsynced:true};throw e;}
      }
      await preview.update(record=>{record.drafts[keyFor(ownerId,key)]=row;return {record};});
      return {savedAt:row.savedAt,source:preview.persistent?'device':'memory'};
    });
  }
  async function deleteDraft(key){
    requireActor();const ownerId=actor.id;
    return draftJob(ownerId,key,async()=>{
      if(actor?.id!==ownerId)throw error('SESSION_CHANGED','A piszkozat másik dolgozóhoz tartozik.');
      if(SERVER)await request(`/api/drafts?key=${encodeURIComponent(key)}&ownerId=${encodeURIComponent(ownerId)}&expectedRevision=${draftRevisions.get(keyFor(ownerId,key))||0}`,{method:'DELETE'});
      else await preview.update(record=>{delete record.drafts[keyFor(ownerId,key)];return {record};});
      draftRevisions.delete(keyFor(ownerId,key));
      const local=storageGet('localStorage',`drafts:${ownerId}`)||{};delete local[key];storageSet('localStorage',`drafts:${ownerId}`,local);
    });
  }
  async function resolveDraftConflict(key,choice,reviewedRevision){
    requireActor();
    if(!SERVER||!['device','server'].includes(choice))throw error('INVALID_CHOICE','Válaszd ki a megtartandó piszkozatot.');
    const ownerId=actor.id;
    const response=await request('/api/drafts');
    const row=response.drafts.find(d=>d.key===key&&d.ownerId===ownerId);
    if((row?.revision||0)!==reviewedRevision)throw error('DRAFT_CONFLICT','A közös piszkozat ismét megváltozott. Ellenőrizd az újabb változatot.',{draft:row||{key,value:{},revision:0}});
    if(actor?.id!==ownerId)throw error('SESSION_CHANGED','Közben másik dolgozó jelentkezett be.');
    const local=offlineDrafts();
    draftRevisions.set(keyFor(ownerId,key),row?.revision||0);
    if(choice==='server'){
      delete local[key];storageSet('localStorage',`drafts:${ownerId}`,local);
    } else {
      if(!local[key])throw error('DRAFT_NOT_FOUND','A készüléken nem található saját piszkozat ehhez az ügyhöz.');
      local[key].expectedRevision=row?.revision||0;storageSet('localStorage',`drafts:${ownerId}`,local);
      await saveDraft(key,local[key].value);
    }
    return loadDrafts();
  }
  async function advanceClock(minutes){
    requireActor();if(SERVER)throw error('SERVER_CLOCK','A közös kiszolgáló óráját a tablet nem módosíthatja.');
    if(!Number.isFinite(minutes)||minutes<=0)throw error('INVALID_TIME','Pozitív percet adj meg.');
    const record=await preview.update(record=>{record.clockOffset+=minutes*60000;return {record};});
    return apply(localSnapshot(record));
  }
  async function reset(){
    requireActor();if(SERVER)throw error('RESET_DISABLED','A közös adatbázis innen nem törölhető.');
    const result=await preview.update(()=>({record:initialLocal()}));
    writePending(null);storageSet('localStorage',`drafts:${actor.id}`,null);
    return apply(localSnapshot(result));
  }
  return {mode,bootstrap,login,logout,refresh,command,now,loadDrafts,saveDraft,deleteDraft,getPending,reconcilePending,retryPending,resolveDraftConflict,advanceClock,reset,
    getSnapshot:()=>current?clone(current):null};
}

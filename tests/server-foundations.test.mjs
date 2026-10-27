import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createState } from '../src/domain/inventory.mjs';
import { WarehouseStore, SESSION_MS } from '../src/application/store.mjs';
import { createWarehouseServer } from '../server/server.mjs';
import { backupDatabase, restoreDatabase } from '../scripts/backup.mjs';

const instant='2026-10-27T10:00:00.000Z';
const issue={type:'MOVE_CREATE',kind:'issue',from:'Fő raktár',to:'Saloon',lines:[{productId:'water',quantity:7,unit:'db'}]};
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'warehouse-backend-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir;}
function store(t,{filename,clock=()=>new Date(instant)}={}){const dir=filename?null:fixture(t);const s=new WarehouseStore({filename:filename??join(dir,'db.sqlite'),clock,initialState:createState()});t.after(()=>{try{s.close();}catch{}});return s;}
function manager(s){return s.user('test-manager');}
async function httpFixture(t,{database,clock=()=>new Date(instant)}={}){
  const dir=database?null:fixture(t);const app=createWarehouseServer({database:database??join(dir,'db.sqlite'),clock,initialState:createState()});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{if(app.server.listening)await app.close();});
  const base=`http://127.0.0.1:${app.server.address().port}`;
  async function request(path,{method='GET',data,cookie,headers={}}={}){
    const response=await fetch(base+path,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(cookie?{'Cookie':cookie}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})});
    const text=await response.text();let body;try{body=JSON.parse(text);}catch{body=text;}
    return {status:response.status,body,headers:response.headers};
  }
  async function login(id='test-manager'){const result=await request('/api/session',{method:'POST',data:{userId:id,pin:'1234'}});assert.equal(result.status,200);return result.headers.get('set-cookie').split(';')[0];}
  return {app,request,login,base};
}

test('commands survive response loss/restart and replay exactly once before stale revision check',t=>{
  const dir=fixture(t),filename=join(dir,'db.sqlite');
  let s=store(t,{filename});const actor=manager(s),before=s.snapshot(actor);
  const command={id:'tablet-command-001',expectedRevision:0,action:issue};
  const first=s.command(actor,command);assert.equal(first.state.stocks['Fő raktár'].water,before.state.stocks['Fő raktár'].water-7);assert.equal(first.state.moves.length,1);
  s.close();s=store(t,{filename});const replay=s.command(actor,command);
  assert.equal(replay.replayed,true);assert.equal(replay.revision,1);assert.equal(replay.state.moves.length,1);assert.equal(replay.state.history.length,1);
  assert.deepEqual(s.commandStatus(actor,command.id).originalResult,first.originalResult);
  assert.throws(()=>s.command(actor,{...command,action:{...issue,to:'Grill terasz'}}),e=>e.code==='COMMAND_ID_REUSED');
  assert.throws(()=>s.commandStatus(s.user('test-receiver-6'),command.id),e=>e.status===404);
});

test('separate SQLite connections serialize stale snapshots instead of overwriting stock',t=>{
  const filename=join(fixture(t),'shared.sqlite'),a=store(t,{filename}),b=store(t,{filename});
  a.command(manager(a),{id:'first-tablet-001',expectedRevision:0,action:issue});
  assert.throws(()=>b.command(manager(b),{id:'second-tablet-001',expectedRevision:0,action:issue}),e=>e.code==='REVISION_CONFLICT');
  assert.equal(b.snapshot(manager(b)).state.moves.length,1);
  const corrected=b.command(manager(b),{id:'second-tablet-001',expectedRevision:1,action:{...issue,to:'Grill terasz'}});
  assert.equal(corrected.revision,2);assert.equal(corrected.state.moves.length,2);
});

test('drafts are durable and private to authenticated person, never stored as PINs',t=>{
  const filename=join(fixture(t),'drafts.sqlite');let s=store(t,{filename});const a=manager(s),b=s.user('test-receiver-6');
  const draft=s.saveDraft(a,'receipt-form',{supplier:'Próba',lines:[{quantity:'12'}]});
  assert.equal(draft.savedAt,instant);assert.equal(s.drafts(b).length,0);
  assert.throws(()=>s.saveDraft(a,'login',{pin:'1234'}),e=>e.code==='SECRET_IN_DRAFT');
  s.close();s=store(t,{filename});assert.deepEqual(s.drafts(a)[0].value,{supplier:'Próba',lines:[{quantity:'12'}]});
  s.deleteDraft(b,'receipt-form');assert.equal(s.drafts(a).length,1);
  s.deleteDraft(a,'receipt-form',1);assert.equal(s.drafts(a).length,0);
});

test('PINs are salted hashes; expiry and persistent failed-login limits reject access',t=>{
  let now=Date.parse(instant);const s=store(t,{clock:()=>new Date(now)});
  const row=s.db.prepare('SELECT salt,pin_hash FROM users WHERE id=?').get('test-manager');
  assert.equal(row.pin_hash.length,64);assert.notEqual(row.pin_hash,'1234');
  const session=s.login('test-manager','1234');assert.equal(s.authenticate(session.token).id,'test-manager');
  now+=SESSION_MS;assert.throws(()=>s.authenticate(session.token),e=>e.code==='UNAUTHORIZED');
  for(let i=0;i<6;i++)assert.throws(()=>s.login('test-manager','9999'),e=>e.status===401);
  assert.throws(()=>s.login('test-manager','1234'),e=>e.status===429);
  now+=5*60*1000;assert.equal(s.login('test-manager','1234').actor.role,'manager');
});

test('backup restore retains inventory, operation replay and personal drafts without overwrite',t=>{
  const dir=fixture(t),source=join(dir,'original.sqlite'),backup=join(dir,'backup.sqlite'),restored=join(dir,'restored.sqlite');
  const s=store(t,{filename:source});const a=manager(s),command={id:'backup-command-001',expectedRevision:0,action:issue};
  const result=s.command(a,command);s.saveDraft(a,'move-issue',{quantity:'17'});
  backupDatabase(source,backup);assert.throws(()=>backupDatabase(source,backup),/létezik/);
  restoreDatabase(backup,restored);assert.throws(()=>restoreDatabase(backup,restored),/új célfájl/);
  const recovered=store(t,{filename:restored});assert.deepEqual(recovered.snapshot(a).state,result.state);
  assert.equal(recovered.command(a,command).replayed,true);assert.equal(recovered.drafts(a)[0].value.quantity,'17');
});

test('HTTP identity cannot be forged; role/location checks and server timestamps survive client claims',async t=>{
  const h=await httpFixture(t);const managerCookie=await h.login(),receiverCookie=await h.login('test-receiver-6');
  assert.equal((await h.request('/api/state')).status,401);
  const switched=await h.request('/api/state',{cookie:receiverCookie,headers:{'X-Actor-Id':'test-manager'}});assert.equal(switched.status,403);assert.equal(switched.body.error.code,'SESSION_CHANGED');assert.equal(switched.body.state,undefined);
  const switchedCommand=await h.request('/api/commands',{method:'POST',cookie:managerCookie,data:{id:'switched-cookie-001',actorId:'test-receiver-6',expectedRevision:0,action:issue}});assert.equal(switchedCommand.status,403);
  const forged=await h.request('/api/commands',{method:'POST',cookie:receiverCookie,data:{id:'forged-command-001',expectedRevision:0,actor:{role:'manager'},action:issue}});
  assert.equal(forged.status,422);assert.equal(forged.body.error.code,'INVALID_TRANSITION');
  const create=await h.request('/api/commands',{method:'POST',cookie:managerCookie,data:{id:'manager-command-001',expectedRevision:0,action:{...issue,at:'1900-01-01T00:00:00Z'}}});
  assert.equal(create.status,200);assert.equal(create.body.state.history[0].at,instant);assert.equal(create.body.state.history[0].actor.id,'test-manager');
  const move=create.body.state.moves[0];
  const receive=await h.request('/api/commands',{method:'POST',cookie:receiverCookie,data:{id:'receiver-command-001',expectedRevision:1,action:{type:'MOVE_RECEIVE',id:move.id,received:[7]}}});
  assert.equal(receive.status,200);assert.equal(receive.body.state.moves[0].status,'done');
  assert.equal(receive.body.state.history.at(-1).actor.id,'test-receiver-6');
  assert.equal((await h.request('/api/commands/manager-command-001',{cookie:receiverCookie})).status,404);
  assert.equal((await h.request('/api/commands/manager-command-001',{cookie:managerCookie})).status,200);
});

test('concurrent HTTP commands reject stale second writer and duplicate command returns one result',async t=>{
  const h=await httpFixture(t),cookie=await h.login();
  const results=await Promise.all(['parallel-first-001','parallel-second-001'].map(id=>h.request('/api/commands',{method:'POST',cookie,data:{id,expectedRevision:0,action:issue}})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const stale=results.find(r=>r.status===409);assert.equal(stale.body.error.code,'REVISION_CONFLICT');assert.equal(stale.body.revision,1);
  const winner=results.find(r=>r.status===200).body.commandId;
  const replay=await h.request('/api/commands',{method:'POST',cookie,data:{id:winner,expectedRevision:0,action:issue}});
  assert.equal(replay.status,200);assert.equal(replay.body.replayed,true);assert.equal(replay.body.state.moves.length,1);
});

test('HTTP draft ownership, logout, origin/host/static limits and explicit test configuration',async t=>{
  const h=await httpFixture(t),cookie=await h.login(),receiver=await h.login('test-receiver-6');
  const bootstrap=await h.request('/api/bootstrap');assert.equal(bootstrap.body.mode,'test');assert.equal(bootstrap.body.users.length,17);
  assert.equal((await h.request('/api/drafts',{method:'PUT',cookie,data:{key:'receipt-form',value:{supplier:'Saved'},ownerId:'test-manager'}})).status,200);
  const switched=await h.request('/api/drafts',{method:'PUT',cookie:receiver,data:{key:'receipt-form',value:{supplier:'Old user'},ownerId:'test-manager'}});assert.equal(switched.status,403);assert.equal(switched.body.error.code,'SESSION_CHANGED');
  assert.equal((await h.request('/api/drafts',{cookie:receiver})).body.drafts.length,0);
  assert.equal((await h.request('/api/drafts',{cookie})).body.drafts[0].ownerId,'test-manager');
  assert.equal((await h.request('/api/commands',{method:'POST',cookie,data:{id:'csrf-command-001',expectedRevision:0,action:issue},headers:{Origin:'https://attacker.invalid'}})).status,403);
  const hostileStatus=await new Promise((resolve,reject)=>{const request=http.request(h.base+'/api/state',{headers:{Host:'attacker.invalid',Cookie:cookie}},response=>{response.resume();resolve(response.statusCode);});request.on('error',reject);request.end();});
  assert.equal(hostileStatus,403);
  assert.equal((await h.request('/.local/warehouse-test.sqlite')).status,404);
  assert.equal((await h.request('/src/application/store.mjs')).status,404);
  assert.equal((await h.request('/src/integrations/storehouse-port.mjs')).status,404);
  const page=await h.request('/');assert.equal(page.status,200);assert.match(page.body,/window\.__WAREHOUSE_SERVER__=true/);assert.match(page.body,/<base href="\/demo\/">/);
  assert.equal((await h.request('/api/session',{method:'DELETE',cookie})).status,200);
  assert.equal((await h.request('/api/state',{cookie})).status,401);
  assert.throws(()=>new WarehouseStore({filename:':memory:',mode:'live'}),e=>e.code==='NOT_CONFIGURED');
});

test('server assigns canonical known employee names and rejects cross-place shift assignments',t=>{
  const s=store(t),actor=manager(s);
  const result=s.command(actor,{id:'open-shift-test-001',expectedRevision:0,action:{type:'SHIFT_OPEN',location:'Saloon',assigneeId:'test-receiver-6',assigneeName:'Forged name',deputyId:'test-deputy-6'}});
  assert.equal(result.state.shifts[0].assigneeName,s.user('test-receiver-6').name);
  assert.throws(()=>s.command(actor,{id:'open-shift-test-002',expectedRevision:1,action:{type:'SHIFT_OPEN',location:'Grill terasz',assigneeId:'test-receiver-6'}}),e=>e.code==='INVALID_ASSIGNEE');
});


test('same employee on two tablets cannot overwrite or delete a newer personal draft',t=>{
  const filename=join(fixture(t),'draft-race.sqlite'),a=store(t,{filename}),b=store(t,{filename});
  const actor=manager(a);const first=a.saveDraft(actor,'receipt-form',{quantity:'12'},0);assert.equal(first.revision,1);
  assert.throws(()=>b.saveDraft(actor,'receipt-form',{quantity:'99'},0),e=>e.code==='DRAFT_CONFLICT'&&e.currentDraft.value.quantity==='12');
  const second=b.saveDraft(actor,'receipt-form',{quantity:'13'},1);assert.equal(second.revision,2);
  assert.throws(()=>a.deleteDraft(actor,'receipt-form',1),e=>e.code==='DRAFT_CONFLICT');
  assert.equal(a.drafts(actor)[0].value.quantity,'13');a.deleteDraft(actor,'receipt-form',2);assert.equal(a.drafts(actor).length,0);
});


test('deleting and recreating a draft never reuses a stale revision',t=>{
  const s=store(t),actor=manager(s);const old=s.saveDraft(actor,'move-issue',{quantity:'1'},0);
  s.deleteDraft(actor,'move-issue',old.revision);
  const fresh=s.saveDraft(actor,'move-issue',{quantity:'7'},0);assert.ok(fresh.revision>old.revision);
  assert.throws(()=>s.saveDraft(actor,'move-issue',{quantity:'99'},old.revision),e=>e.code==='DRAFT_CONFLICT');
  assert.throws(()=>s.deleteDraft(actor,'move-issue',old.revision),e=>e.code==='DRAFT_CONFLICT');
  assert.equal(s.drafts(actor)[0].value.quantity,'7');
});

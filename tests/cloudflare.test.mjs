import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {mkdtempSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {WarehouseStore} from '../src/application/store.mjs';
import {restoreCloudflareBackup} from '../scripts/restore-cloudflare-backup.mjs';

test('hosted runtime protects all routes and persists transactions, sessions, drafts and backup through restart',async t=>{
  const directory=mkdtempSync(resolve('.local/worker-test-'));
  const password=randomBytes(32).toString('base64url'),operations=randomBytes(32).toString('base64url');
  const origin='https://raktar.test';
  const options={name:'warehouse-test',modules:true,scriptPath:resolve('.local/worker.mjs'),compatibilityDate:'2026-11-12',compatibilityFlags:['nodejs_compat'],durableObjects:{WAREHOUSE:{className:'Warehouse',useSQLite:true}},resourcePersistencePath:join(directory,'storage'),bindings:{PUBLIC_ORIGIN:origin,GATE_PASSWORD:password,OPERATIONS_KEY:operations,ENABLE_RESTART_TEST:'true'}};
  let mf=new Miniflare(convertV4MiniflareOptions(options));
  t.after(async()=>{await mf.dispose();rmSync(directory,{recursive:true,force:true});});
  const authorization='Basic '+Buffer.from('raktar:'+password).toString('base64');
  async function request(path,{method='GET',data,cookie,gate=true,headers={}}={}){
    const response=await mf.dispatchFetch(origin+path,{method,redirect:'manual',headers:{...(gate?{Authorization:authorization}:{}),...(cookie?{Cookie:cookie}:{}),...(data?{'Content-Type':'application/json'}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})});
    const text=await response.text();let body;try{body=JSON.parse(text);}catch{body=text;}
    return {status:response.status,body,headers:response.headers};
  }
  for(const path of ['/api/bootstrap','/api/state','/demo/app.mjs','/src/domain/inventory.mjs','/data/test-catalog.mjs'])assert.equal((await request(path,{gate:false})).status,401,path);
  assert.equal((await request('/',{gate:false})).status,303);
  const accessForm=async(password,originHeader=origin)=>mf.dispatchFetch(origin+'/access',{method:'POST',redirect:'manual',headers:{Origin:originHeader,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password}).toString()});
  assert.equal((await accessForm('incorrect')).status,401);
  assert.equal((await accessForm(password,'https://foreign.invalid')).status,403);
  const access=await accessForm(password);assert.equal(access.status,303);
  assert.match(access.headers.get('set-cookie'),/^__Host-raktar_access=.*Secure; HttpOnly; SameSite=Strict/);
  const accessToken=access.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/bootstrap',{gate:false,cookie:accessToken})).status,200);
  assert.equal((await request('/api/bootstrap',{gate:false,cookie:accessToken+'tampered'})).status,401);
  assert.equal((await request('/api/state')).status,401);
  assert.match((await request('/')).body,/__WAREHOUSE_SERVER__=true/);
  assert.equal((await request('/demo/index.html')).status,404);
  const login=async(userId='test-manager')=>{const r=await request('/api/session',{method:'POST',data:{userId,pin:'1234'},headers:{Origin:origin}});assert.equal(r.status,200,JSON.stringify(r.body));assert.match(r.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Strict/);return r.headers.get('set-cookie').split(';')[0];};
  const cookie=await login(),second=await login(),receiver=await login('test-receiver-6');
  let before=(await request('/api/state',{cookie})).body;
  const command={id:'hosting-test-issue-001',actorId:'test-manager',expectedRevision:before.revision,action:{type:'MOVE_CREATE',kind:'issue',from:'Fő raktár',to:'Saloon',lines:[{productId:'water',quantity:2,unit:'db'}]}};
  const first=await request('/api/commands',{method:'POST',cookie,data:command,headers:{Origin:origin}});assert.equal(first.status,200,JSON.stringify(first.body));
  assert.equal(first.body.state.stocks['Fő raktár'].water,before.state.stocks['Fő raktár'].water-2);
  assert.deepEqual((await request('/api/state',{cookie:second})).body.state,first.body.state);
  const draft=await request('/api/drafts',{method:'PUT',cookie,data:{key:'hosting-verification',ownerId:'test-manager',value:{note:'Mentési és újraindítási próba'},expectedRevision:0}});assert.equal(draft.status,200);
  assert.equal((await request('/api/drafts',{cookie:receiver})).body.drafts.length,0);
  assert.equal((await request('/api/commands',{method:'POST',cookie,data:command,headers:{Origin:'https://foreign.invalid'}})).status,403);
  assert.equal((await request('/api/state',{cookie,headers:{'X-Actor-Id':'test-receiver-6'}})).status,403);
  assert.equal((await request('/api/commands',{method:'POST',cookie,data:{...command,id:'hosting-stale-002'}})).status,409);
  assert.equal((await request('/api/commands',{method:'POST',cookie,data:command})).body.replayed,true);
  const boot=(await request('/api/admin/status',{cookie})).body.bootId;
  await request('/api/admin/restart-test',{method:'POST',cookie,data:{},headers:{'X-Operations-Key':operations}});
  assert.notEqual((await request('/api/admin/status',{cookie})).body.bootId,boot);
  assert.deepEqual((await request('/api/state',{cookie})).body.state,first.body.state);
  assert.deepEqual((await request('/api/drafts',{cookie})).body.drafts,[draft.body.draft]);
  const backup=(await request('/api/admin/backup',{cookie})).body;
  const restored=restoreCloudflareBackup(backup,join(directory,'restored.sqlite'));
  const recovered=new WarehouseStore({filename:restored});
  try{const actor=recovered.user('test-manager');assert.deepEqual(recovered.snapshot(actor).state,first.body.state);assert.equal(recovered.command(actor,command).replayed,true);assert.deepEqual(recovered.drafts(actor),[draft.body.draft]);}finally{recovered.close();}
  assert.throws(()=>restoreCloudflareBackup(backup,restored),/új célfájl/);
  await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(options));
  const restarted=await request('/api/state',{cookie});
  assert.equal(restarted.status,200,JSON.stringify(restarted.body.error));
  assert.deepEqual(restarted.body.state,first.body.state);
  assert.deepEqual((await request('/api/drafts',{cookie})).body.drafts,[draft.body.draft]);
  const state=(await request('/api/state',{cookie})).body;
  const cancelled=await request('/api/commands',{method:'POST',cookie,data:{id:'hosting-cancel-001',expectedRevision:state.revision,action:{type:'MOVE_CANCEL',id:state.state.moves.at(-1).id,physicalStillAtSource:true,reason:'Hosztolási ellenőrzés lezárása'}}});
  assert.equal(cancelled.status,200);assert.deepEqual(cancelled.body.state.stocks,before.state.stocks);
});

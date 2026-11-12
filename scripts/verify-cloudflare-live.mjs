import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {restoreCloudflareBackup} from './restore-cloudflare-backup.mjs';
import {WarehouseStore} from '../src/application/store.mjs';

// Explicit operational check; never run against another Worker or a real inventory.
const origin='https://tordasi-raktar.tordasi-szoliniko.workers.dev';
const secrets=JSON.parse(readFileSync('.local/deployment-secrets.json','utf8'));
const authorization='Basic '+Buffer.from('raktar:'+secrets.GATE_PASSWORD).toString('base64');
const phase=process.argv[2],contextFile='.local/live-verification-context.json',proofFile='.local/live-verification-proof.json';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function request(path,{method='GET',data,cookie,gate=true,headers={}}={}){
  const response=await fetch(origin+path,{method,redirect:'manual',signal:AbortSignal.timeout(30000),headers:{...(gate?{Authorization:authorization}:{}),...(cookie?{Cookie:cookie}:{}),...(data?{'Content-Type':'application/json',Origin:origin}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})});
  const text=await response.text();let body;try{body=JSON.parse(text);}catch{body=text;}
  return {status:response.status,body,headers:response.headers};
}
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body?.error??r.body).slice(0,500));return r.body;};
async function login(){const r=await request('/api/session',{method:'POST',data:{userId:'test-manager',pin:'1234'}});ok(r);assert.match(r.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Strict/);return r.headers.get('set-cookie').split(';')[0];}
async function backup(cookie,label,expected,command,draft){
  const saved=ok(await request('/api/admin/backup',{cookie}));
  const path=resolve('.local',`live-backup-${label}.json`),target=resolve('.local',`live-restored-${label}.sqlite`);
  writeFileSync(path,JSON.stringify(saved));restoreCloudflareBackup(saved,target);
  const store=new WarehouseStore({filename:target});
  try{
    const actor=store.user('test-manager');assert.equal(digest(store.snapshot(actor).state),digest(expected));
    assert.equal(store.command(actor,command).replayed,true);
    if(draft)assert.equal(digest(store.drafts(actor).find(d=>d.key===draft.key)),digest(draft));
  }finally{store.close();}
  return {file:path,sha256:saved.sha256,createdAt:saved.payload.createdAt,tables:Object.fromEntries(Object.entries(saved.payload.tables).map(([k,v])=>[k,v.length]))};
}
if(phase==='start'){
  assert(!existsSync(contextFile),'An existing live check must be finished before starting another.');
  const anonymous={};for(const path of ['/api/bootstrap','/api/state','/demo/app.mjs','/src/domain/inventory.mjs','/data/test-catalog.mjs']){anonymous[path]=(await request(path,{gate:false})).status;assert.equal(anonymous[path],401);}
  assert.equal((await request('/',{gate:false})).status,303);
  assert.equal((await request('/api/state')).status,401);
  assert.match(ok(await request('/')),/__WAREHOUSE_SERVER__=true/);
  assert.equal((await request('/demo/index.html')).status,404);
  const cookie=await login(),second=await login(),before=ok(await request('/api/state',{cookie}));
  assert.equal(before.connection.mode,'test');
  const runId=randomUUID(),command={id:'hosting-'+runId,expectedRevision:before.revision,actorId:'test-manager',action:{type:'MOVE_CREATE',kind:'issue',from:'Fő raktár',to:'Saloon',lines:[{productId:'water',quantity:2,unit:'db'}]}};
  const first=ok(await request('/api/commands',{method:'POST',cookie,data:command}));
  const moveId=first.state.moves.at(-1).id;
  // Save recovery context immediately after the first successful mutation.
  const context={runId,cookie,command,moveId,beforeStocks:before.state.stocks,state:first.state,revision:first.revision};
  writeFileSync(contextFile,JSON.stringify(context));
  assert.equal(first.state.stocks['Fő raktár'].water,before.state.stocks['Fő raktár'].water-2);
  assert.equal(digest(ok(await request('/api/state',{cookie:second})).state),digest(first.state));
  assert.equal(ok(await request('/api/commands',{method:'POST',cookie,data:command})).replayed,true);
  assert.equal((await request('/api/commands',{method:'POST',cookie,data:{...command,id:command.id+'-stale'}})).status,409);
  assert.equal((await request('/api/state',{cookie,headers:{'X-Actor-Id':'test-receiver-6'}})).status,403);
  assert.equal((await request('/api/commands',{method:'POST',cookie,data:command,headers:{Origin:'https://foreign.invalid'}})).status,403);
  const draft=ok(await request('/api/drafts',{method:'PUT',cookie,data:{key:'hosting-'+runId,ownerId:'test-manager',value:{note:'2026-11-12 hosztolási mentési próba'},expectedRevision:0}})).draft;
  context.draft=draft;writeFileSync(contextFile,JSON.stringify(context));
  const beforeBoot=ok(await request('/api/admin/status',{cookie}));
  await request('/api/admin/restart-test',{method:'POST',cookie,data:{},headers:{'X-Operations-Key':secrets.OPERATIONS_KEY}});
  const afterBoot=ok(await request('/api/admin/status',{cookie}));assert.notEqual(beforeBoot.bootId,afterBoot.bootId);
  assert.equal(digest(ok(await request('/api/state',{cookie})).state),digest(first.state));
  assert.equal(digest(ok(await request('/api/drafts',{cookie})).drafts.find(d=>d.key===draft.key)),digest(draft));
  const saved=await backup(cookie,runId,first.state,command,draft);
  const proof={verifiedAt:new Date().toISOString(),origin,anonymous,moveId,revision:first.revision,beforeBoot,afterBoot,stateSha256:digest(first.state),backup:saved,checks:['HTTPS gate','all assets and API protected','Secure session cookie','server mode','two independent sessions see same state','correct stock decrement','duplicate command replay','stale revision rejected','wrong actor rejected','foreign Origin rejected','actual Durable Object restart','state/history/draft retained after restart','backup checksum and new SQLite restore','idempotency retained after restore']};
  writeFileSync(proofFile,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
}else if(phase==='finish'){
  const context=JSON.parse(readFileSync(contextFile,'utf8')),proof=JSON.parse(readFileSync(proofFile,'utf8'));
  const {cookie,command,draft,moveId,runId}=context;
  const status=ok(await request('/api/admin/status',{cookie}));assert.notEqual(status.buildId,proof.afterBoot.buildId);
  for(const asset of ['demo/app.mjs','demo/style.css','demo/model.mjs','demo/runtime.mjs','src/domain/inventory.mjs','data/test-catalog.mjs'])assert.equal(digest(ok(await request('/'+asset))),digest(readFileSync(asset,'utf8')),asset);
  const current=ok(await request('/api/state',{cookie}));assert.equal(digest(current.state),digest(context.state));
  assert.equal(digest(ok(await request('/api/drafts',{cookie})).drafts.find(d=>d.key===draft.key)),digest(draft));
  assert.equal((await request('/api/admin/restart-test',{method:'POST',cookie,data:{},headers:{'X-Operations-Key':secrets.OPERATIONS_KEY}})).status,404);
  const cancelled=ok(await request('/api/commands',{method:'POST',cookie,data:{id:command.id+'-cancel',expectedRevision:current.revision,actorId:'test-manager',action:{type:'MOVE_CANCEL',id:moveId,physicalStillAtSource:true,reason:'Hosztolási ellenőrzés lezárása; fizikai árumozgás nem történt.'}}}));
  assert.equal(digest(cancelled.state.stocks),digest(context.beforeStocks));
  ok(await request('/api/drafts?'+new URLSearchParams({key:draft.key,ownerId:'test-manager',expectedRevision:String(draft.revision)}),{method:'DELETE',cookie,headers:{Origin:origin}}));
  const finalBackup=await backup(cookie,runId+'-final',cancelled.state,command);
  Object.assign(proof,{completedAt:new Date().toISOString(),finalStatus:status,finalRevision:cancelled.revision,finalBackup,checks:[...proof.checks,'state/history/draft retained across deployment','restart endpoint disabled','test issue cancelled with audited workflow','initial stocks restored','test draft removed']});
  writeFileSync(proofFile,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
}else throw new Error('Explicit phase required: start or finish. Secrets must exist in the ignored .local directory.');

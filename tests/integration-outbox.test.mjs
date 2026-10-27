import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IntegrationOutbox } from '../src/integrations/outbox.mjs';
import { UnconfiguredStoreHouseAdapter } from '../src/integrations/storehouse-port.mjs';
const clock=()=>new Date('2026-10-27T10:00:00Z');
const intent={id:'receipt-group-001',children:[{id:'receipt-kitchen-001',kind:'receipt',externalLocationId:'verified-kitchen-id',lines:[{externalProductId:'verified-product-id',quantity:2,unitId:'verified-unit-id'}]}]};
function memory(t){const db=new DatabaseSync(':memory:');t.after(()=>db.close());return new IntegrationOutbox(db,{clock});}

test('unconfigured StoreHouse never dispatches or silently substitutes test inventory',async t=>{
  const box=memory(t),adapter=new UnconfiguredStoreHouseAdapter();box.enqueue(intent);
  await assert.rejects(()=>box.dispatch(intent.id,adapter),e=>e.code==='NOT_CONFIGURED');
  assert.equal(box.group(intent.id).status,'queued');
  await assert.rejects(()=>adapter.readInventory(),e=>e.code==='NOT_CONFIGURED');
});

test('lost write response becomes uncertain and restart verifies it without a second submit',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'warehouse-outbox-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const filename=join(dir,'outbox.sqlite');
  let db=new DatabaseSync(filename),box=new IntegrationOutbox(db,{clock});box.enqueue(intent);
  let submissions=0;const committed=new Map();
  const adapter={configured:true,async submit(part){submissions++;committed.set(part.id,'remote-doc-9');throw new Error('Connection closed after commit');},async verify(part){return committed.has(part.id)?{status:'confirmed',externalId:committed.get(part.id)}:{status:'unknown'};}};
  assert.equal((await box.dispatch(intent.id,adapter)).status,'uncertain');db.close();
  db=new DatabaseSync(filename);box=new IntegrationOutbox(db,{clock});
  assert.equal((await box.dispatch(intent.id,adapter)).status,'confirmed');assert.equal(submissions,1);db.close();
});

test('multi-destination receipt reports partial completion rather than overall success',async t=>{
  const box=memory(t),second={...intent.children[0],id:'receipt-warehouse-002',externalLocationId:'verified-warehouse-id'};
  box.enqueue({...intent,children:[...intent.children,second]});
  const adapter={configured:true,async submit(p){return p.id===second.id?{status:'rejected',reason:'Supplier mapping missing'}:{status:'accepted',externalId:'remote-ok'};},async verify(){return {status:'confirmed',externalId:'remote-ok'};}};
  const result=await box.dispatch(intent.id,adapter);assert.equal(result.status,'partial');assert.deepEqual(result.children.map(c=>c.status),['confirmed','rejected']);
});

test('unknown execution cannot be resent; only explicit authoritative absence permits a retry',async t=>{
  const box=memory(t);box.enqueue(intent);let calls=0,absent=false;
  const adapter={configured:true,async submit(){calls++;throw new Error('Timeout');},async verify(){return absent?{status:'absent',authoritative:true}:{status:'unknown'};}};
  await box.dispatch(intent.id,adapter);await box.dispatch(intent.id,adapter);assert.equal(calls,1);
  await assert.rejects(()=>box.allowVerifiedRetry(intent.children[0].id,adapter,{reason:'Checked'}),e=>e.code==='OUTCOME_UNCERTAIN');assert.equal(calls,1);
  absent=true;await box.allowVerifiedRetry(intent.children[0].id,adapter,{reason:'Provider conclusively proved no write happened.'});assert.equal(calls,1);assert.equal(box.group(intent.id).status,'queued');
  await box.dispatch(intent.id,adapter);assert.equal(calls,2);
});

test('intent identity cannot be reused with different target or quantity',t=>{
  const box=memory(t);box.enqueue(intent);assert.deepEqual(box.enqueue(intent),box.group(intent.id));
  assert.throws(()=>box.enqueue({...intent,children:[{...intent.children[0],externalLocationId:'wrong-target'}]}),e=>e.code==='INTENT_ID_REUSED');
});

test('two dispatchers claim the same queued operation only once',async t=>{
  const box=memory(t);box.enqueue(intent);let calls=0;let committed=false;let release;const waiting=new Promise(resolve=>release=resolve);
  const adapter={configured:true,async submit(){calls++;await waiting;committed=true;return {status:'accepted',externalId:'remote-once'};},async verify(){return committed?{status:'confirmed',externalId:'remote-once'}:{status:'unknown'};}};
  const first=box.dispatch(intent.id,adapter),second=box.dispatch(intent.id,adapter);release();await Promise.all([first,second]);assert.equal(calls,1);assert.equal(box.group(intent.id).status,'confirmed');
});


test('concurrent verification cannot requeue a confirmed operation after an earlier absence lookup',async t=>{
  const box=memory(t);box.enqueue(intent);
  await box.dispatch(intent.id,{configured:true,async submit(){throw new Error('lost');},async verify(){return {status:'unknown'};}});
  let release;const delayed=new Promise(resolve=>release=resolve);
  const retry=box.allowVerifiedRetry(intent.children[0].id,{configured:true,async submit(){throw new Error('must not submit');},async verify(){await delayed;return {status:'absent',authoritative:true};}},{reason:'Operator checked'});
  await box.verify(intent.id,{configured:true,async submit(){throw new Error('must not submit');},async verify(){return {status:'confirmed',externalId:'remote-confirmed'};}});
  release();await assert.rejects(()=>retry,e=>e.code==='INTENT_CHANGED');assert.equal(box.group(intent.id).status,'confirmed');
  let calls=0;await box.dispatch(intent.id,{configured:true,async submit(){calls++;},async verify(){return {status:'unknown'};}});assert.equal(calls,0);
});

test('returned provider reference survives failed verification and restart',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'warehouse-receipt-ref-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const filename=join(dir,'box.sqlite');
  let db=new DatabaseSync(filename),box=new IntegrationOutbox(db,{clock});box.enqueue(intent);
  let calls=0;await box.dispatch(intent.id,{configured:true,async submit(){calls++;return {status:'accepted',externalId:'receipt-before-timeout'};},async verify(){throw new Error('Read-back timed out');}});
  assert.equal(box.group(intent.id).children[0].external_id,'receipt-before-timeout');db.close();
  db=new DatabaseSync(filename);box=new IntegrationOutbox(db,{clock});
  await box.dispatch(intent.id,{configured:true,async submit(){calls++;throw new Error('must not send');},async verify(part){assert.equal(part.externalId,'receipt-before-timeout');return {status:'confirmed',externalId:part.externalId};}});
  assert.equal(calls,1);assert.equal(box.group(intent.id).status,'confirmed');db.close();
});

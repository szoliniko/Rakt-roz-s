/** Browser-runtime boundary regressions. Fetch/storage are controlled mocks;
 * inventory changes still execute the canonical domain transition. These tests
 * do not prove StoreHouse I/O or replace HTTP/browser integration checks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, transition } from '../src/domain/inventory.mjs';

globalThis.__WAREHOUSE_SERVER__ = true;
const { createRuntime } = await import('../demo/runtime.mjs');
const PREFIX = 'raktar-foundations-v6:';
const NOW = '2026-10-27T10:00:00.000Z';
const A = { id: 'test-manager', name: 'Teszt raktáros', role: 'manager', location: 'Fő raktár' };
const B = { id: 'test-receiver-6', name: 'Teszt Saloon átvevő', role: 'receiver', location: 'Saloon' };
const issue = { type: 'MOVE_CREATE', kind: 'issue', from: 'Fő raktár', to: 'Saloon', lines: [{ productId: 'water', quantity: 4, unit: 'db' }] };
const waste = { type: 'WASTE_REPORT', location: 'Saloon', productId: 'wine', quantity: 0.1, unit: 'l', reason: 'Teszt kiömlés.' };
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => structuredClone(body) });
const snapshot = (state, actor = A, revision = 0, serverNow = NOW) => ({ state, actor, revision, serverNow,
  connection: { mode: 'test', status: 'test', storeHouse: 'not_configured' } });
const gate = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function storage() {
  const values = new Map();
  return { getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}
function environment(t, fetcher) {
  const local = storage(), session = storage();
  for (const [key, value] of [['localStorage', local], ['sessionStorage', session]]) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
  }
  t.mock.method(globalThis, 'fetch', fetcher);
  return { local, session };
}
function loggedInResponse(url, options, state, actor = A, revision = 0) {
  if (url === '/api/session' && options.method === 'POST') return response(snapshot(state, actor, revision));
  throw new Error(`Unexpected request ${options.method || 'GET'} ${url}`);
}

test('headers without a response body time out, keep the command identity, and reconcile without a second stock mutation', async t => {
  let state = createState(), posts = 0, lookup = 0;
  const id = 'runtime-timeout-001';
  const realTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (fn, delay, ...args) => realTimeout(fn, delay === 15000 ? 20 : delay, ...args));
  environment(t, async (url, options) => {
    if (url === '/api/commands' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.actorId, A.id);
      assert.equal(options.headers['X-Actor-Id'], A.id);
      assert.equal(body.id, id);
      posts++;
      state = transition(state, body.action, A, NOW);
      // The server committed, returned headers, then the body connection stalled.
      return { ok: true, status: 200, json: () => new Promise((resolve, reject) => {
        const aborted = () => reject(new DOMException('Response body aborted', 'AbortError'));
        if (options.signal.aborted) aborted();
        else options.signal.addEventListener('abort', aborted, { once: true });
      }) };
    }
    if (url === `/api/commands/${id}`) {
      lookup++;
      return response({ ...snapshot(state, A, 1), commandId: id, replayed: true });
    }
    return loggedInResponse(url, options, state);
  });
  const runtime = createRuntime();
  await runtime.login(A.id, '1234');
  await assert.rejects(runtime.command(issue, { id }), e => e.code === 'NETWORK_ERROR');
  assert.equal(runtime.getPending().id, id);
  assert.equal(state.moves.length, 1);
  const resolved = await runtime.retryPending();
  assert.equal(resolved.commandId, id);
  assert.equal(runtime.getPending(), null);
  assert.equal(posts, 1);
  assert.equal(lookup, 1);
  assert.equal(state.stocks['Fő raktár'].water, createState().stocks['Fő raktár'].water - 4);
});

test('a newer unsent draft survives reload even when an earlier server save has a later timestamp', async t => {
  const startedA = gate(), releaseA = gate();
  let serverDraft = null, puts = 0, tick = 0;
  t.mock.method(performance, 'now', () => tick);
  const { local } = environment(t, async (url, options) => {
    if (url === '/api/drafts' && options.method === 'PUT') {
      const body = JSON.parse(options.body);
      assert.equal(body.ownerId, A.id);
      assert.equal(options.headers['X-Actor-Id'], A.id);
      puts++;
      if (puts === 1) {
        startedA.resolve();
        await releaseA.promise;
        serverDraft = { key: body.key, value: body.value, ownerId: A.id, revision: 1, savedAt: '2026-10-27T10:02:00.000Z' };
        return response({ draft: serverDraft });
      }
      assert.equal(body.expectedRevision, 1, 'Queued edits follow the acknowledged base revision.');
      throw new TypeError('Disconnected before draft B reached the server');
    }
    if (url === '/api/drafts') return response({ drafts: serverDraft ? [serverDraft] : [] });
    return loggedInResponse(url, options, createState());
  });
  const runtime = createRuntime();
  await runtime.login(A.id, '1234');
  const first = runtime.saveDraft('receipt-form', { quantity: '1' });
  await startedA.promise;
  tick = 60000;
  const second = runtime.saveDraft('receipt-form', { quantity: '2' });
  releaseA.resolve();
  await first;
  const offline = await second;
  assert.equal(offline.unsynced, true);
  const localRow = JSON.parse(local.getItem(PREFIX + `drafts:${A.id}`))['receipt-form'];
  assert.ok(Date.parse(localRow.savedAt) < Date.parse(serverDraft.savedAt));
  assert.equal(localRow.value.quantity, '2');
  const reloaded = createRuntime();
  await reloaded.login(A.id, '1234');
  const restored = await reloaded.loadDrafts();
  assert.equal(restored.drafts['receipt-form'].quantity, '2');
  assert.equal(restored.saved['receipt-form'].unsynced, true);
  assert.equal(restored.saved['receipt-form'].serverValue.quantity, '1');
});

test('a cookie changed by another tab cannot execute an old screen command as the new employee', async t => {
  let cookieActor = A, state = createState(), domainCalls = 0;
  environment(t, async (url, options) => {
    if (url === '/api/session' && options.method === 'POST') return response(snapshot(state, cookieActor));
    if (url === '/api/commands') {
      const payload = JSON.parse(options.body);
      assert.equal(payload.actorId, A.id);
      assert.equal(options.headers['X-Actor-Id'], A.id);
      if (payload.actorId !== cookieActor.id || options.headers['X-Actor-Id'] !== cookieActor.id) {
        return response({ error: { code: 'SESSION_CHANGED', message: 'Másik dolgozó jelentkezett be.' } }, 403);
      }
      domainCalls++;
      state = transition(state, payload.action, cookieActor, NOW);
      return response(snapshot(state, cookieActor, 1));
    }
    throw new Error(`Unexpected request ${url}`);
  });
  const runtime = createRuntime();
  await runtime.login(A.id, '1234');
  cookieActor = B; // A separate tab changed the shared browser cookie.
  await assert.rejects(runtime.command(issue, { id: 'runtime-identity-001' }), e => e.code === 'SESSION_CHANGED');
  assert.equal(domainCalls, 0);
  assert.equal(state.history.length, 0);
  assert.equal(runtime.getSnapshot().actor.id, A.id);
  assert.equal(runtime.getPending().actorId, A.id);
});

test('an old command response cannot replace a new login or clear either employee pending identity', async t => {
  const oldStarted = gate(), oldResponse = gate();
  const oldId = 'runtime-old-user-001', newId = 'runtime-new-user-001';
  let state = createState(), revision = 0, cookieActor = A;
  const { local } = environment(t, async (url, options) => {
    if (url === '/api/session' && options.method === 'POST') {
      cookieActor = JSON.parse(options.body).userId === A.id ? A : B;
      return response(snapshot(state, cookieActor, revision));
    }
    if (url === '/api/commands') {
      const body = JSON.parse(options.body);
      assert.equal(body.actorId, cookieActor.id);
      state = transition(state, body.action, cookieActor, NOW);
      revision++;
      if (body.id === oldId) {
        const captured = snapshot(state, A, revision);
        oldStarted.resolve();
        await oldResponse.promise;
        return response({ ...captured, commandId: oldId });
      }
      assert.equal(body.id, newId);
      throw new TypeError('New employee reply lost after commit');
    }
    throw new Error(`Unexpected request ${url}`);
  });
  const runtime = createRuntime();
  await runtime.login(A.id, '1234');
  const oldResult = runtime.command(issue, { id: oldId }).then(value => ({ value }), failure => ({ failure }));
  await oldStarted.promise;
  await runtime.login(B.id, '1234');
  const secondTab = createRuntime();
  await secondTab.login(B.id, '1234');
  await assert.rejects(secondTab.command(waste, { id: newId }), e => e.code === 'NETWORK_ERROR');
  assert.equal(runtime.getPending().id, newId);
  oldResponse.resolve();
  const result = await oldResult;
  assert.equal(result.failure?.code, 'SESSION_CHANGED');
  assert.equal(runtime.getSnapshot().actor.id, B.id);
  assert.equal(runtime.getPending().id, newId);
  assert.equal(JSON.parse(local.getItem(PREFIX + `pending:${A.id}`)).id, oldId);
  assert.equal(JSON.parse(local.getItem(PREFIX + `pending:${B.id}`)).id, newId);
  assert.equal(state.moves.length, 1);
  assert.equal(state.waste.length, 1);
});

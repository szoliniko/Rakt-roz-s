import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, transition, stockAt, activeShift, transferTiming, convertQuantity } from '../src/domain/inventory.mjs';
import { createState as compatibilityState } from '../demo/model.mjs';
import { SOURCE_PRODUCTS } from '../data/test-catalog.mjs';

const at = '2026-10-27T10:00:00.000Z';
const manager = { id: 'manager', name: 'Teszt Raktáros', role: 'manager', location: 'Fő raktár' };
const saloon = { id: 'saloon-a', name: 'Teszt Átvevő', role: 'receiver', location: 'Saloon' };
const deputy = { id: 'saloon-b', name: 'Teszt Helyettes', role: 'receiver', location: 'Saloon' };
const other = { id: 'saloon-c', name: 'Másik dolgozó', role: 'receiver', location: 'Saloon' };
const run = (state, type, payload = {}, actor = manager, now = at) => transition(state, { type, ...payload }, actor, now);
const line = (quantity = 4, productId = 'water', unit = 'db') => ({ productId, quantity, unit });
const issue = (quantity = 4, from = 'Fő raktár', to = 'Saloon') => ({ kind: 'issue', from, to, lines: [line(quantity)] });
const open = (state, actor = saloon) => run(state, 'SHIFT_OPEN', { location: actor.location,
  assigneeId: actor.id, assigneeName: actor.name, deputyId: deputy.id, deputyName: deputy.name }, manager);
const beginCount = (state, actor = saloon) => run(state, 'COUNT_START', { location: actor.location, kind: 'shift', paused: true }, actor);
const acknowledge = (state, quantity = 4, actor = saloon) => run(state, 'MOVE_RECEIVE', { id: state.moves.at(-1).id, received: [quantity] }, actor);
function reject(state, type, payload, actor = manager, pattern) {
  const original = structuredClone(state);
  assert.throws(() => run(state, type, payload, actor), pattern);
  assert.deepEqual(state, original, 'A failed workflow must be atomic.');
}

test('canonical domain stays independent of UI and uses explicit test seed/catalog policy', () => {
  assert.equal(compatibilityState, createState);
  const minimal = createState();
  assert.equal(minimal.products.length, 6);
  assert.equal(minimal.policy.requireShift, false);
  const state = createState({ includeSourceCatalog: true, requireShift: true });
  assert.equal(state.seed.kind, 'synthetic-test');
  assert.equal(state.policy.requireShift, true);
  assert.equal(state.products.length, 6 + SOURCE_PRODUCTS.filter((p) => p.provenance.verified).length);
  for (const p of state.products.filter((p) => p.provenance)) {
    assert.equal(p.externalId, null, 'Printed source codes are not invented API IDs.');
    assert.equal(stockAt(state, 'Saloon', p.id), 0);
    assert.equal(stockAt(state, 'Fő raktár', p.id), { db: 60, kg: 10, l: 20, adag: 10, zacskó: 10 }[p.baseUnit]);
    assert.equal(convertQuantity(p, 1, p.baseUnit), 1);
    assert.throws(() => convertQuantity(p, 1, 'kitalált karton'));
  }
  const basil = state.products.filter((p) => p.sourceCode === '134' || p.sourceCode === '187');
  assert.equal(basil.length, 2);
  assert.notEqual(basil[0].id, basil[1].id);
  assert.notEqual(basil[0].category, basil[1].category);
});

test('product identity uses distinct codes; line name, unit and conversion are frozen snapshots', () => {
  let state = createState();
  const fields = { name: 'Kóla', baseUnit: 'db', packUnit: 'karton', packSize: 24, sourceCode: 'TEST-100', category: 'Teszt ital' };
  state = run(state, 'ADD_PRODUCT', fields);
  const added = state.products.at(-1);
  assert.equal(added.sourceCode, 'TEST-100');
  reject(state, 'ADD_PRODUCT', { ...fields, name: 'Más termék' }, manager, /termékkód/);
  state = run(state, 'RECEIPT', { supplier: 'Teszt beszállító', document: 'SNAPSHOT-1', lines: [{ productId: added.id, quantity: 2, unit: 'karton', destination: 'Fő raktár', checked: true }] });
  state = run(state, 'MOVE_CREATE', { kind: 'issue', from: 'Fő raktár', to: 'Saloon', lines: [{ productId: added.id, quantity: 1, unit: 'karton' }] });
  const recorded = structuredClone(state.moves.at(-1).lines[0]);
  assert.equal(recorded.baseQuantity, 24);
  assert.equal(recorded.productSnapshot.name, 'Kóla');
  assert.equal(recorded.productSnapshot.sourceCode, 'TEST-100');
  assert.deepEqual(recorded.conversion, { unit: 'karton', factor: 24, baseUnit: 'db' });
  // Simulate a later adapter catalog refresh; old documents are untouched.
  state.products.find((p) => p.id === added.id).name = 'Új törzsnév';
  state.products.find((p) => p.id === added.id).units.karton = 12;
  assert.deepEqual(state.moves.at(-1).lines[0], recorded);
  state = run(state, 'MOVE_RECEIVE', { id: state.moves.at(-1).id, received: [24] }, saloon);
  assert.equal(stockAt(state, 'Saloon', added.id), 24);
  assert.deepEqual(state.receipts.at(-1).lines[0].conversion, { unit: 'karton', factor: 24, baseUnit: 'db' });
});

test('cancel only unconfirmed physically unshipped moves, restoring stock once and retaining history', () => {
  const initial = createState();
  let state = run(initial, 'MOVE_CREATE', issue());
  const id = state.moves.at(-1).id;
  reject(state, 'MOVE_CANCEL', { id, reason: 'Téves pult.' }, manager, /ellenőrizd/);
  reject(state, 'MOVE_CANCEL', { id, reason: 'Téves pult.', physicalStillAtSource: true }, saloon, /raktárfelelős/);
  reject(state, 'MOVE_CANCEL', { id, reason: '', physicalStillAtSource: true }, manager, /indoka/);
  state = run(state, 'MOVE_CANCEL', { id, reason: 'Az összes víz a Fő raktárban maradt.', physicalStillAtSource: true }, manager, '2026-10-27T10:32:00Z');
  assert.deepEqual(state.stocks, initial.stocks);
  assert.equal(state.moves[0].status, 'cancelled');
  assert.equal(state.moves[0].lines[0].quantity, 4);
  assert.equal(state.moves[0].lines[0].pending, 0);
  assert.equal(state.moves[0].lines[0].cancelledQuantity, 4);
  assert.equal(state.moves[0].receivedAt, null);
  assert.equal(state.history.at(-1).moveId, id);
  assert.equal(state.history.at(-1).actor.id, manager.id);
  assert.equal(transferTiming(state.moves[0], '2026-11-01T10:00:00Z').overdue, false);
  assert.equal(transferTiming(state.moves[0], '2026-11-01T10:00:00Z').waitingMinutes, 32);
  reject(state, 'MOVE_CANCEL', { id, reason: 'Ismétlés', physicalStillAtSource: true });
  reject(state, 'MOVE_RECEIVE', { id, received: [4] }, saloon);
});

test('closed transfer correction is a linked physical move, bounded by original uncorrected receipt', () => {
  let state = acknowledge(run(createState(), 'MOVE_CREATE', issue()));
  const original = structuredClone(state.moves[0]);
  const before = structuredClone(state.stocks);
  const fields = { ...issue(3, 'Saloon', 'Grill terasz'), correctsMoveId: original.id, reason: 'A Grill teraszra kellett kerülnie.' };
  reject(state, 'MOVE_CANCEL', { id: original.id, reason: 'Téves cél', physicalStillAtSource: true });
  reject(state, 'MOVE_CREATE', { ...fields, from: 'Fő raktár' }, manager, /fogadó helyéről/);
  reject(state, 'MOVE_CREATE', { ...fields, reason: '' }, manager, /indoka/);
  reject(state, 'MOVE_CREATE', { ...fields, lines: [line(1, 'beer')] }, manager, /igazolt mennyiség/);
  reject(state, 'MOVE_CREATE', { ...fields, lines: [line(5)] }, manager, /igazolt mennyiség/);
  state = run(state, 'MOVE_CREATE', fields);
  assert.equal(stockAt(state, 'Saloon', 'water'), before.Saloon.water - 3);
  assert.deepEqual(state.moves[0], original);
  assert.equal(state.moves[1].correctsMoveId, original.id);
  assert.equal(state.history.at(-1).correctsMoveId, original.id);
  reject(state, 'MOVE_CREATE', { ...fields, lines: [line(2)] }, manager, /igazolt mennyiség/);
  state = acknowledge(state, 2, { ...saloon, location: 'Grill terasz' });
  state = run(state, 'MOVE_RESOLVE', { id: state.moves[1].id, resolution: 'source', reason: 'Egy a Saloonban maradt.' });
  // Only two moved physically; the returned remainder can be corrected later.
  state = run(state, 'MOVE_CREATE', { ...fields, lines: [line(2)] });
  assert.deepEqual(state.moves[0], original);
  reject(state, 'MOVE_CREATE', { ...fields, lines: [line(1)] }, manager, /igazolt mennyiség/);
});

test('strict shift policy makes missing closing visible and limits receipt/report/count to named assignee or deputy', () => {
  let state = createState({ requireShift: true });
  assert.equal(activeShift(state, 'Saloon'), null);
  state = run(state, 'MOVE_CREATE', issue());
  reject(state, 'MOVE_RECEIVE', { id: state.moves[0].id, received: [4] }, saloon, /műszakot/);
  reject(state, 'COUNT_START', { kind: 'shift', location: 'Saloon', paused: true }, saloon, /műszakot/);
  reject(state, 'SHIFT_OPEN', { location: 'Konyha', assigneeId: saloon.id, assigneeName: saloon.name }, manager, /pultnál/);
  reject(state, 'SHIFT_OPEN', { location: 'Grill terasz', assigneeId: saloon.id, assigneeName: saloon.name }, saloon, /Grill/);
  reject(state, 'SHIFT_OPEN', { location: 'Saloon' }, manager, /átvevő azonosítója/);
  reject(state, 'SHIFT_OPEN', { location: 'Saloon', assigneeId: manager.id, assigneeName: manager.name }, manager, /helyi átvevőt/);
  state = open(state);
  assert.equal(activeShift(state, 'Saloon').status, 'open');
  assert.equal(activeShift(state, 'Saloon').countId, null, 'An open shift without counting is a missing closing task.');
  reject(state, 'SHIFT_OPEN', { location: 'Saloon', assigneeId: saloon.id, assigneeName: saloon.name }, manager, /már van/);
  reject(state, 'MOVE_RECEIVE', { id: state.moves[0].id, received: [4] }, other, /kijelölt/);
  reject(state, 'WASTE_REPORT', { location: 'Saloon', ...line(1), reason: 'Sérült.' }, other, /kijelölt/);
  state = acknowledge(state, 4, deputy);
  assert.equal(state.moves[0].status, 'done');
  reject(state, 'COUNT_START', { kind: 'shift', location: 'Saloon', paused: true }, other, /kijelölt/);
  state = beginCount(state, deputy);
  assert.equal(activeShift(state, 'Saloon').status, 'counting');
});

test('handover preserves pending transfers/count snapshot and removes previous assignee permission', () => {
  let state = open(createState({ requireShift: true }));
  state = run(state, 'MOVE_CREATE', issue());
  state = beginCount(state);
  const snapshot = structuredClone(state.counts[0].expected);
  const outgoing = structuredClone(state.moves[0]);
  const shiftId = state.shifts[0].id;
  reject(state, 'SHIFT_HANDOVER', { id: shiftId, assigneeId: other.id, assigneeName: other.name, reason: 'Váltás.' }, other, /kijelölt/);
  state = run(state, 'SHIFT_HANDOVER', { id: shiftId, assigneeId: other.id, assigneeName: other.name, reason: 'A következő átvevő folytatja a számolást.' }, saloon);
  assert.deepEqual(state.moves[0], outgoing);
  assert.deepEqual(state.counts[0].expected, snapshot);
  assert.equal(state.shifts[0].handoverHistory[0].previous.assigneeId, saloon.id);
  assert.equal(state.history.at(-1).actor.id, saloon.id);
  reject(state, 'COUNT_SUBMIT', { id: state.counts[0].id, actual: snapshot }, saloon, /kijelölt/);
  state = run(state, 'COUNT_SUBMIT', { id: state.counts[0].id, actual: snapshot }, other);
  assert.equal(state.shifts[0].status, 'submitted');
  assert.equal(state.counts[0].submittedBy.id, other.id);
  reject(state, 'SHIFT_HANDOVER', { id: shiftId, assigneeId: saloon.id, assigneeName: saloon.name, reason: 'Vissza.' }, manager, /nyitott/);
});

test('count cancellation releases only its location without adjusting stock; shift can resume and next shift opens after submission', () => {
  let state = open(createState({ requireShift: true }));
  state = beginCount(state);
  const cancelledId = state.counts[0].id;
  const stock = structuredClone(state.stocks);
  reject(state, 'MOVE_CREATE', issue(), manager, /számolás/);
  reject(state, 'COUNT_CANCEL', { id: cancelledId, reason: 'Tovább kell dolgozni.' }, saloon, /raktárfelelős/);
  state = run(state, 'COUNT_CANCEL', { id: cancelledId, reason: 'Rossz időpontban indult; később újraszámoljuk.' });
  assert.deepEqual(state.stocks, stock);
  assert.equal(state.counts[0].status, 'cancelled');
  assert.equal(state.counts[0].paused, false);
  assert.equal(activeShift(state, 'Saloon').status, 'open');
  reject(state, 'COUNT_CANCEL', { id: cancelledId, reason: 'Még egyszer.' });
  state = run(state, 'MOVE_CREATE', issue());
  state = acknowledge(state);
  state = beginCount(state);
  const count = state.counts.at(-1);
  state = run(state, 'COUNT_SUBMIT', { id: count.id, actual: { ...count.expected } }, saloon);
  assert.equal(state.shifts[0].status, 'submitted');
  state = open(state);
  assert.equal(state.shifts.length, 2, 'A pending manager review does not hide or block the next shift.');
  state = run(state, 'COUNT_APPROVE', { id: count.id, adjustment: 'none', reason: 'Mennyiségek rendben.' });
  assert.equal(state.shifts[0].status, 'closed');
  assert.equal(state.shifts[1].status, 'open');
});

test('warehouse receiver does not need a bar shift; cancelled transfer cannot hold later count approval', () => {
  let state = createState({ requireShift: true });
  state = run(state, 'MOVE_CREATE', issue(4, 'Fő raktár', 'Italraktár'));
  state = acknowledge(state, 4, { ...saloon, location: 'Italraktár' });
  state = run(state, 'MOVE_CREATE', issue(4, 'Fő raktár', 'Italraktár'));
  state = run(state, 'MOVE_CANCEL', { id: state.moves.at(-1).id, reason: 'Nem vittük el.', physicalStillAtSource: true });
  state = run(state, 'COUNT_START', { location: 'Italraktár', kind: 'partial', productIds: ['water'], paused: true });
  const count = state.counts.at(-1);
  assert.deepEqual(count.unresolvedAtStart, []);
  state = run(state, 'COUNT_SUBMIT', { id: count.id, actual: count.expected });
  state = run(state, 'COUNT_APPROVE', { id: count.id, adjustment: 'none', reason: 'Egyezik.' });
  assert.equal(state.counts.at(-1).status, 'done');
  assert.equal(state.shifts.length, 0);
});

test('bar count uses the known drink assortment, retains used zero stock, and excludes never-stocked goods and cleaners', () => {
  let state = open(createState({ requireShift: true, includeSourceCatalog: true }));
  state = run(state, 'ADD_PRODUCT', { name: 'Teszt kimért kávéalap', sourceCode: 'TEST-COFFEE', category: 'Ital / Kávé', baseUnit: 'kg', packUnit: 'zsák', packSize: 1, countInShift: true });
  const coffeeId = state.products.at(-1).id;
  state = run(state, 'ADD_PRODUCT', { name: 'Teszt takarítószer', sourceCode: 'TEST-CLEANER', category: 'Tisztító szerek', baseUnit: 'db', packUnit: 'karton', packSize: 1 });
  const cleanerId = state.products.at(-1).id;
  state = run(state, 'RECEIPT', { supplier: 'Teszt', document: 'ASSORTMENT-1', lines: [
    { productId: coffeeId, quantity: 2, unit: 'kg', destination: 'Saloon', checked: true },
    { productId: cleanerId, quantity: 3, unit: 'db', destination: 'Saloon', checked: true },
  ] });
  state = run(state, 'MOVE_CREATE', { kind: 'return', from: 'Saloon', to: 'Fő raktár', lines: [{ productId: coffeeId, quantity: 2, unit: 'kg' }] });
  state = run(state, 'MOVE_RECEIVE', { id: state.moves.at(-1).id, received: [2] }, saloon);
  assert.equal(stockAt(state, 'Saloon', coffeeId), 0);
  state = beginCount(state);
  const count = state.counts.at(-1);
  assert.ok(Object.hasOwn(count.expected, coffeeId), 'An exhausted previously stocked drink ingredient is still counted.');
  assert.equal(count.expected[coffeeId], 0);
  assert.equal(Object.hasOwn(count.expected, cleanerId), false, 'Receiving a cleaner does not make it a mandatory bar drink count.');
  assert.equal(Object.keys(count.expected).length, 6, 'Never-stocked PDF products do not flood the shift count.');
});

test('additional physically found goods can be counted even at zero expected stock without overwriting the snapshot', () => {
  let state = beginCount(open(createState({ requireShift: true })));
  const id = state.counts.at(-1).id;
  const stock = structuredClone(state.stocks);
  reject(state, 'COUNT_INCLUDE_PRODUCTS', { id, productIds: ['meat'] }, other, /kijelölt/);
  reject(state, 'COUNT_INCLUDE_PRODUCTS', { id, productIds: ['meat', 'water'] }, saloon, /már szerepel/);
  state = run(state, 'COUNT_INCLUDE_PRODUCTS', { id, productIds: ['meat'] }, saloon);
  assert.deepEqual(state.stocks, stock);
  assert.equal(state.counts.at(-1).expected.meat, 0);
  assert.equal(state.counts.at(-1).productSnapshots.meat.baseUnit, 'kg');
  assert.equal(state.history.at(-1).countId, id);
  reject(state, 'COUNT_INCLUDE_PRODUCTS', { id, productIds: ['meat'] }, saloon, /már szerepel/);
  state = run(state, 'COUNT_SUBMIT', { id, actual: { ...state.counts.at(-1).expected, meat: 0.5 } }, saloon);
  assert.equal(state.counts.at(-1).differences.meat, 0.5);
  assert.deepEqual(state.stocks, stock, 'Finding extra stock only reports a difference pending manager review.');
  reject(state, 'COUNT_INCLUDE_PRODUCTS', { id, productIds: ['meat'] }, saloon, /lépés/);
});

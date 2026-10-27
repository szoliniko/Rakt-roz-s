import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCATIONS, WAREHOUSES, PRODUCTS, createState, transition,
  stockAt, convertQuantity, measuredVolumeLiters, transferTiming,
} from '../demo/model.mjs';

const manager = { role: 'manager', location: 'Fő raktár' };
const receiver = (location = 'Csárda pult') => ({ role: 'receiver', location });
const TEST_TIME = '2026-10-27T10:00:00.000Z';
const clockAt = (minutes) => new Date(Date.parse(TEST_TIME) + minutes * 60_000);
const run = (state, type, fields = {}, actor = manager, now = TEST_TIME) => transition(state, { type, ...fields }, actor, now);
const product = (id) => PRODUCTS.find((item) => item.id === id);
const line = (productId, quantity, unit = product(productId).baseUnit) => ({ productId, quantity, unit });
const receipt = (lines, document = 'MINTA-001') => ({
  supplier: 'Kitalált mintabeszállító', document,
  lines: lines.map((item) => ({ destination: 'Italraktár', checked: true, ...item })),
});
const issue = (lines = [line('water', 12)], from = 'Italraktár', to = 'Csárda pult') => ({ kind: 'issue', from, to, lines });
const countStart = (location = 'Csárda pult', kind = 'shift', productIds) => ({ location, kind, productIds, paused: true });
const round = (value) => Math.round(value * 1e6) / 1e6;
const total = (state, id) => round(LOCATIONS.reduce((sum, location) => sum + stockAt(state, location, id), 0)
  + state.moves.flatMap((move) => move.lines).filter((item) => item.productId === id).reduce((sum, item) => sum + item.pending, 0));

function unchangedOnError(state, type, fields, actor = manager, pattern) {
  const before = structuredClone(state);
  assert.throws(() => run(state, type, fields, actor), pattern);
  assert.deepEqual(state, before, 'a rejected action must not change any part of its input');
}

function receiveAll(state, actor = receiver()) {
  const move = state.moves.at(-1);
  return run(state, 'MOVE_RECEIVE', { id: move.id, received: move.lines.map((item) => item.pending) }, actor);
}

function submitCount(state, changes = {}, actor = receiver()) {
  const count = state.counts.at(-1);
  return run(state, 'COUNT_SUBMIT', { id: count.id, actual: { ...count.expected, ...changes } }, actor);
}

test('every workflow shares stock: receipt → arbitrary multi-item issue → partial receipt → return → waste → count', () => {
  const initial = createState();
  let state = run(initial, 'RECEIPT', receipt([
    { ...line('water', 4, 'karton'), destination: 'Fő raktár' },
    { ...line('meat', 2, 'láda'), destination: 'Konyha' },
  ]));
  assert.equal(stockAt(state, 'Fő raktár', 'water'), stockAt(initial, 'Fő raktár', 'water') + 24);
  assert.equal(stockAt(state, 'Konyha', 'meat'), stockAt(initial, 'Konyha', 'meat') + 10);
  const waterAfterReceipt = total(state, 'water');
  const beerBefore = total(state, 'beer');
  state = run(state, 'MOVE_CREATE', issue([line('water', 3, 'karton'), line('beer', 7)], 'Fő raktár'));
  const outgoing = state.moves.at(-1).id;
  assert.equal(stockAt(state, 'Fő raktár', 'water'), stockAt(initial, 'Fő raktár', 'water') + 6);
  assert.equal(total(state, 'water'), waterAfterReceipt);
  state = run(state, 'MOVE_RECEIVE', { id: outgoing, received: [15, 7] }, receiver());
  assert.equal(state.moves.at(-1).status, 'discrepancy');
  assert.equal(state.moves.at(-1).lines[0].pending, 3);
  assert.equal(stockAt(state, 'Csárda pult', 'water'), stockAt(initial, 'Csárda pult', 'water') + 15);
  assert.equal(state.waste.length, 0, 'a discrepancy is never automatic waste');
  assert.equal(total(state, 'water'), waterAfterReceipt);
  assert.equal(total(state, 'beer'), beerBefore);
  state = run(state, 'MOVE_RESOLVE', { id: outgoing, resolution: 'source', reason: 'Három palack a kiadó helyen maradt.' });
  assert.equal(total(state, 'water'), waterAfterReceipt);
  assert.equal(state.moves.at(-1).status, 'done');
  assert.equal(state.moves.at(-1).lines[0].pending, 0);

  const wineBefore = total(state, 'wine');
  state = run(state, 'MOVE_CREATE', { kind: 'return', from: 'Csárda pult', to: 'Italraktár',
    lines: [line('water', 7), line('wine', 1, 'üveg'), line('wine', 0.35)] });
  state = receiveAll(state);
  assert.equal(state.moves.at(-1).status, 'done');
  assert.equal(state.moves.at(-1).lines.length, 3, 'unopened bottles and open liquid stay distinct rows');
  assert.equal(total(state, 'water'), waterAfterReceipt);
  assert.equal(total(state, 'wine'), wineBefore);
  assert.equal(stockAt(state, 'Italraktár', 'wine'), stockAt(initial, 'Italraktár', 'wine') + 1.1);

  const beforeWaste = stockAt(state, 'Csárda pult', 'water');
  state = run(state, 'WASTE_REPORT', { location: 'Csárda pult', ...line('water', 2), reason: 'Sérült palackok.' }, receiver());
  assert.equal(stockAt(state, 'Csárda pult', 'water'), beforeWaste);
  state = run(state, 'WASTE_APPROVE', { id: state.waste.at(-1).id });
  assert.equal(stockAt(state, 'Csárda pult', 'water'), beforeWaste - 2);
  assert.equal(total(state, 'water'), waterAfterReceipt - 2);

  state = run(state, 'COUNT_START', countStart(), receiver());
  const countId = state.counts.at(-1).id;
  const expected = state.counts.at(-1).expected.water;
  assert.equal(expected, stockAt(initial, 'Csárda pult', 'water') + 15 - 7 - 2);
  state = submitCount(state, { water: expected - 2 });
  assert.equal(stockAt(state, 'Csárda pult', 'water'), expected, 'submission changes no stock');
  state = run(state, 'RECEIPT', receipt([{ ...line('water', 9), destination: 'Csárda pult' }], 'MINTA-002'));
  state = run(state, 'COUNT_APPROVE', { id: countId, adjustment: 'apply', reason: 'Újraszámolva; két palack igazolt eltérés.' });
  assert.equal(stockAt(state, 'Csárda pult', 'water'), expected - 2 + 9, 'later legitimate stock movement is preserved');
  assert.equal(state.counts.at(-1).correctionApplied, true);
  assert.deepEqual(initial, createState(), 'successful transitions leave the original state untouched');
  assert.equal(state.history.at(-1).changes.find((change) => change.productId === 'water').before, expected + 9);
  unchangedOnError(state, 'COUNT_APPROVE', { id: countId, adjustment: 'apply', reason: 'Ismétlés.' });
});

test('different arbitrary products, amounts and destinations conserve stock plus transit stock', () => {
  for (const [id, quantity, unit, from, to] of [
    ['beer', 2, 'karton', 'Fő raktár', 'Saloon'],
    ['spirit', 3, 'üveg', 'Italraktár', 'Grill terasz'],
    ['meat', 1.25, 'kg', 'Fő raktár', 'Konyha'],
    ['wine', 17, 'dl', 'Italraktár', 'Nádfedeles terasz'],
  ]) {
    const initial = createState();
    const beforeTotal = total(initial, id);
    const sent = run(initial, 'MOVE_CREATE', issue([line(id, quantity, unit)], from, to));
    assert.equal(total(sent, id), beforeTotal);
    const received = receiveAll(sent, receiver(to));
    assert.equal(total(received, id), beforeTotal);
    assert.equal(stockAt(received, to, id), round(stockAt(initial, to, id) + convertQuantity(product(id), quantity, unit)));
  }
});

test('source and destination discrepancy resolutions conserve inventory without automatic waste', () => {
  for (const resolution of ['source', 'destination']) {
    const initial = createState();
    let state = run(initial, 'MOVE_CREATE', issue([line('wine', 2, 'üveg'), line('beer', 9)]));
    const id = state.moves.at(-1).id;
    state = run(state, 'MOVE_RECEIVE', { id, received: [0.75, 0] }, receiver());
    assert.deepEqual(state.moves.at(-1).lines.map((item) => item.pending), [0.75, 9]);
    unchangedOnError(state, 'MOVE_RESOLVE', { id, resolution, reason: 'Ellenőrizve.' }, receiver());
    unchangedOnError(state, 'MOVE_RESOLVE', { id, resolution, reason: '  ' });
    unchangedOnError(state, 'MOVE_RESOLVE', { id, resolution: 'waste', reason: 'Ellenőrizve.' });
    state = run(state, 'MOVE_RESOLVE', { id, resolution, reason: 'Az átvevővel tisztázva.' });
    for (const productId of ['wine', 'beer']) assert.equal(total(state, productId), total(initial, productId));
    assert.equal(state.waste.length, 0);
    assert.equal(state.moves.at(-1).status, 'done');
    unchangedOnError(state, 'MOVE_RESOLVE', { id, resolution, reason: 'Ismétlés.' });
    unchangedOnError(state, 'MOVE_RECEIVE', { id, received: [0.75, 9] }, receiver());
  }
});

test('manager starts moves; assigned local receiver confirms issue, return and Kitchen dispatch', () => {
  unchangedOnError(createState(), 'MOVE_CREATE', issue(), receiver(), /raktárfelelős/);
  for (const [fields, assigned] of [
    [issue(), 'Csárda pult'],
    [{ ...issue([line('water', 9)], 'Csárda pult', 'Italraktár'), kind: 'return' }, 'Csárda pult'],
    [issue([line('meat', 3)], 'Konyha', 'Fő raktár'), 'Konyha'],
  ]) {
    const state = run(createState(), 'MOVE_CREATE', fields);
    const id = state.moves.at(-1).id;
    const received = state.moves.at(-1).lines.map((item) => item.pending);
    unchangedOnError(state, 'MOVE_RECEIVE', { id, received }, manager, /átvevő/);
    unchangedOnError(state, 'MOVE_RECEIVE', { id, received }, receiver('Saloon'), /kijelölt/);
    const done = run(state, 'MOVE_RECEIVE', { id, received }, receiver(assigned));
    assert.equal(done.moves.at(-1).status, 'done');
  }
});

test('duplicate move rows accumulate availability and history contains one total change per product and location', () => {
  const initial = createState();
  const quantity = stockAt(initial, 'Csárda pult', 'wine');
  unchangedOnError(initial, 'MOVE_CREATE', issue([line('wine', quantity), line('wine', 0.1)], 'Csárda pult', 'Italraktár'), manager, /nincs elegendő/);
  const sent = run(initial, 'MOVE_CREATE', issue([line('wine', 2, 'üveg'), line('wine', 3, 'dl')]));
  assert.equal(sent.moves.at(-1).lines.length, 2);
  assert.deepEqual(sent.history.at(-1).changes, [{ location: 'Italraktár', productId: 'wine', before: 45, after: 43.2 }]);
  const done = receiveAll(sent);
  assert.deepEqual(done.history.at(-1).changes, [{ location: 'Csárda pult', productId: 'wine', before: 9.75, after: 11.55 }]);
});

test('receipt requires checks, manager and valid destination, converts every line and rejects the same document twice', () => {
  const initial = createState();
  const fields = receipt([line('water', 3, 'karton'), line('water', 7)]);
  unchangedOnError(initial, 'RECEIPT', fields, receiver(), /raktárfelelős/);
  unchangedOnError(initial, 'RECEIPT', { ...fields, lines: [{ ...fields.lines[0], checked: false }] }, manager, /ellenőrizted/);
  unchangedOnError(initial, 'RECEIPT', { ...fields, lines: [{ ...fields.lines[0], destination: 'Ismeretlen' }] });
  unchangedOnError(initial, 'RECEIPT', { ...fields, document: ' ' });
  unchangedOnError(initial, 'RECEIPT', { ...fields, supplier: '' });
  unchangedOnError(initial, 'RECEIPT', { ...fields, lines: [] });
  const received = run(initial, 'RECEIPT', fields);
  assert.equal(stockAt(received, 'Italraktár', 'water'), stockAt(initial, 'Italraktár', 'water') + 25);
  assert.equal(received.history.at(-1).changes.length, 1);
  assert.equal(received.receipts.at(-1).status, 'done');
  assert.deepEqual(received.receipts.at(-1).lines.map((item) => item.baseQuantity), [18, 7]);
  unchangedOnError(received, 'RECEIPT', { ...fields, document: ' minta-001 ', supplier: fields.supplier.toUpperCase() }, manager, /már bevételezted/);
  const anotherSupplier = run(received, 'RECEIPT', { ...fields, supplier: 'Másik mintabeszállító' });
  assert.equal(anotherSupplier.receipts.length, 2);
});

test('new products start at zero everywhere and flow through the same receipt and move model', () => {
  const initial = createState();
  const fields = { name: 'Citromlé', baseUnit: 'l', packUnit: 'doboz', packSize: 2.5 };
  unchangedOnError(initial, 'ADD_PRODUCT', fields, receiver());
  unchangedOnError(initial, 'ADD_PRODUCT', { ...fields, name: '  KOLA  ' }, manager, /Már van/);
  for (const invalid of [{ packSize: 0 }, { packSize: NaN }, { packSize: 1e-10 }, { baseUnit: 'g' }, { packUnit: 'L' }]) {
    unchangedOnError(initial, 'ADD_PRODUCT', { ...fields, ...invalid });
  }
  let state = run(initial, 'ADD_PRODUCT', fields);
  const added = state.products.at(-1);
  assert.equal(convertQuantity(added, 3, 'doboz'), 7.5);
  for (const location of LOCATIONS) assert.equal(stockAt(state, location, added.id), 0);
  state = run(state, 'RECEIPT', receipt([{ productId: added.id, quantity: 3, unit: 'doboz' }]));
  state = run(state, 'MOVE_CREATE', issue([{ productId: added.id, quantity: 2, unit: 'l' }]));
  state = receiveAll(state);
  assert.equal(stockAt(state, 'Csárda pult', added.id), 2);
  assert.equal(total(state, added.id), 7.5);
  assert.equal(initial.products.length, PRODUCTS.length);
});

test('declared package conversions and bottle references are product-specific and reject invented factors', () => {
  assert.equal(convertQuantity(product('cola'), 2, 'karton'), 24);
  assert.equal(convertQuantity(product('water'), 2, 'karton'), 12);
  assert.equal(convertQuantity(product('beer'), 2, 'karton'), 48);
  assert.equal(convertQuantity(product('wine'), 8, 'üveg'), 6);
  assert.equal(convertQuantity(product('spirit'), 2, 'üveg'), 1.4);
  assert.equal(convertQuantity(product('wine'), 3, 'dl'), 0.3);
  assert.equal(convertQuantity(product('meat'), 2, 'láda'), 10);
  for (const unit of ['liter', 'toString', '__proto__', 'constructor']) assert.throws(() => convertQuantity(product('water'), 2, unit));
  for (const amount of [-1, NaN, Infinity, '2', 1e15, 1e-10]) assert.throws(() => convertQuantity(product('wine'), amount, 'l'));
  for (const amount of [0.5, 1.00000001]) assert.throws(() => convertQuantity(product('cola'), amount, 'db'), /egész/);
  assert.throws(() => convertQuantity({ ...product('cola'), units: { db: 2 } }, 1, 'db'));
  assert.throws(() => convertQuantity({ ...product('cola'), units: { db: 1, karton: undefined } }, 1, 'karton'));

  for (const id of ['wine', 'spirit']) {
    const reference = product(id).bottleReference;
    assert.equal(measuredVolumeLiters(reference.emptyGrams, reference), 0);
    assert.equal(measuredVolumeLiters(reference.fullGrams, reference), reference.volumeMl / 1000);
    assert.equal(measuredVolumeLiters((reference.emptyGrams + reference.fullGrams) / 2, reference), reference.volumeMl / 2000);
    for (const weight of [reference.emptyGrams - 1, reference.fullGrams + 1, NaN, Infinity, '750']) {
      assert.throws(() => measuredVolumeLiters(weight, reference));
    }
  }
  assert.equal(measuredVolumeLiters(750, product('wine').bottleReference), 0.375);
  assert.throws(() => measuredVolumeLiters(750, null), /palackadatok/);
  assert.throws(() => measuredVolumeLiters(750, { emptyGrams: 750, fullGrams: 750, volumeMl: 750 }), /nagyobb/);
});

test('invalid move input and excessive receipt are atomic and terminal acknowledgment cannot repeat', () => {
  const initial = createState();
  for (const bad of [
    { lines: [] }, { from: 'Ismeretlen' }, { to: 'Italraktár' }, { kind: 'waste' },
    { lines: [line('water', 0)] }, { lines: [line('water', -1)] }, { lines: [line('water', 0.5)] },
    { lines: [line('water', 1, 'l')] }, { lines: [line('water', 100000)] },
    { lines: [{ productId: 'unknown', quantity: 1, unit: 'db' }] },
  ]) unchangedOnError(initial, 'MOVE_CREATE', { ...issue(), ...bad });
  const sent = run(initial, 'MOVE_CREATE', issue([line('water', 9), line('beer', 7)]));
  const id = sent.moves.at(-1).id;
  for (const received of [[9], [9, 7, 1], [10, 7], [9, 8], [9, -1], [9, NaN], [9, 0.2], ['9', 7]]) {
    unchangedOnError(sent, 'MOVE_RECEIVE', { id, received }, receiver());
  }
  const done = receiveAll(sent);
  unchangedOnError(done, 'MOVE_RECEIVE', { id, received: [9, 7] }, receiver());
  unchangedOnError(sent, 'MOVE_RESOLVE', { id, resolution: 'source', reason: 'Nincs még eltérés.' });
});

test('waste can only be reported locally, must have a reason and subtracts exactly once at manager approval', () => {
  const initial = createState();
  const fields = { location: 'Csárda pult', ...line('wine', 2, 'dl'), reason: 'Kiömlött.' };
  unchangedOnError(initial, 'WASTE_REPORT', fields, receiver('Saloon'));
  unchangedOnError(initial, 'WASTE_REPORT', fields, manager);
  unchangedOnError(initial, 'WASTE_REPORT', { ...fields, reason: ' ' }, receiver());
  unchangedOnError(initial, 'WASTE_REPORT', { ...fields, quantity: 0 }, receiver());
  unchangedOnError(initial, 'WASTE_REPORT', { ...fields, quantity: 1000 }, receiver());
  const reported = run(initial, 'WASTE_REPORT', fields, receiver());
  const id = reported.waste.at(-1).id;
  assert.deepEqual(reported.stocks, initial.stocks);
  unchangedOnError(reported, 'WASTE_APPROVE', { id }, receiver());
  const approved = run(reported, 'WASTE_APPROVE', { id });
  assert.equal(stockAt(approved, fields.location, 'wine'), round(stockAt(initial, fields.location, 'wine') - 0.2));
  unchangedOnError(approved, 'WASTE_APPROVE', { id });
  unchangedOnError(reported, 'WASTE_REPORT', { ...fields, quantity: stockAt(reported, fields.location, 'wine') * 10 }, receiver());
});

test('waste approval rechecks availability after other legitimate movements', () => {
  const initial = createState();
  let state = run(initial, 'WASTE_REPORT', { location: 'Csárda pult', ...line('water', 2), reason: 'Ellenőrzendő.' }, receiver());
  const wasteId = state.waste.at(-1).id;
  state = run(state, 'MOVE_CREATE', { kind: 'return', from: 'Csárda pult', to: 'Italraktár', lines: [line('water', stockAt(state, 'Csárda pult', 'water'))] });
  unchangedOnError(state, 'WASTE_APPROVE', { id: wasteId }, manager, /nincs elegendő/);
});

test('shift, full and partial counts enforce correct location, roles, scope and confirmed pause', () => {
  const initial = createState();
  unchangedOnError(initial, 'COUNT_START', countStart(), manager);
  unchangedOnError(initial, 'COUNT_START', countStart(), receiver('Saloon'));
  unchangedOnError(initial, 'COUNT_START', countStart('Konyha'), receiver('Konyha'));
  unchangedOnError(initial, 'COUNT_START', countStart('Csárda pult', 'full'), manager);
  unchangedOnError(initial, 'COUNT_START', countStart('Konyha', 'full'), receiver('Konyha'));
  unchangedOnError(initial, 'COUNT_START', { ...countStart(), paused: false }, receiver());
  unchangedOnError(initial, 'COUNT_START', countStart('Konyha', 'partial', []));
  unchangedOnError(initial, 'COUNT_START', countStart('Konyha', 'partial', ['meat', 'meat']));
  unchangedOnError(initial, 'COUNT_START', countStart('Konyha', 'partial', ['unknown']));
  const shift = run(initial, 'COUNT_START', countStart(), receiver());
  assert.deepEqual(Object.keys(shift.counts.at(-1).expected), initial.products.filter((item) => item.baseUnit !== 'kg').map((item) => item.id));
  for (const location of WAREHOUSES) {
    const full = run(initial, 'COUNT_START', countStart(location, 'full'));
    assert.deepEqual(full.counts.at(-1).expected, initial.stocks[location], 'full count includes zero-stock products');
  }
  const partial = run(initial, 'COUNT_START', countStart('Konyha', 'partial', ['meat']));
  assert.deepEqual(partial.counts.at(-1).expected, { meat: 80 });
});

test('staff can submit despite pending moves and waste; manager clears them before choosing count adjustment', () => {
  let state = run(createState(), 'MOVE_CREATE', issue());
  const moveId = state.moves.at(-1).id;
  state = run(state, 'WASTE_REPORT', { location: 'Csárda pult', ...line('cola', 1), reason: 'Törött.' }, receiver());
  const wasteId = state.waste.at(-1).id;
  const historyStart = state.history.length;
  state = run(state, 'COUNT_START', countStart(), receiver());
  const countId = state.counts.at(-1).id;
  const unresolved = [...state.counts.at(-1).unresolvedAtStart];
  assert.equal(state.counts.at(-1).historyStart, historyStart);
  assert.equal(unresolved.length, 2);
  assert.ok(unresolved.some((item) => item.includes(moveId)));
  assert.ok(unresolved.some((item) => item.includes(wasteId)));
  unchangedOnError(state, 'MOVE_RECEIVE', { id: moveId, received: [11] }, receiver(), /számolás folyik/);
  unchangedOnError(state, 'WASTE_APPROVE', { id: wasteId }, manager, /számolás folyik/);
  state = submitCount(state, { water: state.counts.at(-1).expected.water + 11, cola: 35 });
  assert.equal(state.counts.at(-1).status, 'pending');
  for (const adjustment of ['apply', 'none']) {
    unchangedOnError(state, 'COUNT_APPROVE', { id: countId, adjustment, reason: 'Még vannak függő tételek.' }, manager, /függő átadás/);
  }
  state = run(state, 'MOVE_RECEIVE', { id: moveId, received: [11] }, receiver());
  unchangedOnError(state, 'COUNT_APPROVE', { id: countId, adjustment: 'none', reason: 'Eltérés még nincs rendezve.' }, manager, /függő átadás/);
  state = run(state, 'MOVE_RESOLVE', { id: moveId, resolution: 'source', reason: 'Egy palack a kiadónál maradt.' });
  for (const adjustment of ['apply', 'none']) {
    unchangedOnError(state, 'COUNT_APPROVE', { id: countId, adjustment, reason: 'Selejt még nincs ellenőrizve.' }, manager, /függő selejt/);
  }
  state = run(state, 'WASTE_APPROVE', { id: wasteId });
  const reconciledStock = structuredClone(state.stocks);
  state = run(state, 'COUNT_APPROVE', { id: countId, adjustment: 'none', reason: 'Az átadás és a selejt rendezése megmagyarázza az eltérést.' });
  assert.equal(state.counts.at(-1).status, 'done');
  assert.equal(state.counts.at(-1).correctionApplied, false);
  assert.deepEqual(state.stocks, reconciledStock);
  assert.deepEqual(state.counts.at(-1).unresolvedAtStart, unresolved, 'original provisional flags remain available for review');
  assert.equal(state.counts.at(-1).expected.water, 48);
  assert.equal(stockAt(state, 'Csárda pult', 'water'), 59);
  assert.equal(stockAt(state, 'Csárda pult', 'cola'), 35);
});

test('pending counts allow the next shift to submit, while approvals respect count order', () => {
  let state = run(createState(), 'COUNT_START', countStart(), receiver());
  unchangedOnError(state, 'COUNT_START', countStart(), receiver(), /már van/);
  const firstId = state.counts.at(-1).id;
  state = submitCount(state, { cola: 35 });
  state = run(state, 'COUNT_START', countStart(), receiver());
  const secondId = state.counts.at(-1).id;
  assert.equal(state.counts.at(-1).unresolvedAtStart.length, 1);
  assert.ok(state.counts.at(-1).unresolvedAtStart[0].includes(firstId));
  unchangedOnError(state, 'COUNT_APPROVE', { id: firstId, adjustment: 'apply', reason: 'A későbbi aktív számolás még tart.' }, manager, /számolás folyik/);
  unchangedOnError(state, 'COUNT_START', countStart(), receiver(), /már van/);
  state = submitCount(state, { cola: 35 });
  for (const adjustment of ['apply', 'none']) {
    unchangedOnError(state, 'COUNT_APPROVE', { id: secondId, adjustment, reason: 'A korábbi számolás még nyitott.' }, manager, /korábbi/);
  }
  state = run(state, 'COUNT_APPROVE', { id: firstId, adjustment: 'apply', reason: 'Az első számoláskor már fennálló eltérés igazolt.' });
  assert.equal(stockAt(state, 'Csárda pult', 'cola'), 35);
  state = run(state, 'COUNT_APPROVE', { id: secondId, adjustment: 'none', reason: 'Ugyanezt az eltérést a korábbi számolás rendezte.' });
  assert.equal(stockAt(state, 'Csárda pult', 'cola'), 35);
  assert.deepEqual(state.counts.map((count) => count.status), ['done', 'done']);
  assert.deepEqual(state.history.at(-1).changes, []);
});

test('counting freezes every affected stock input/output while unrelated locations continue', () => {
  const state = run(createState(), 'COUNT_START', countStart(), receiver());
  unchangedOnError(state, 'RECEIPT', receipt([{ ...line('water', 1), destination: 'Csárda pult' }]), manager, /számolás folyik/);
  unchangedOnError(state, 'MOVE_CREATE', issue(), manager, /számolás folyik/);
  unchangedOnError(state, 'MOVE_CREATE', { ...issue([line('water', 2)], 'Csárda pult', 'Italraktár'), kind: 'return' }, manager, /számolás folyik/);
  unchangedOnError(state, 'WASTE_REPORT', { location: 'Csárda pult', ...line('water', 1), reason: 'Minta.' }, receiver(), /számolás folyik/);
  unchangedOnError(state, 'DEMO_SALES', { batchId: 'demo-sales-1' }, manager, /számolás folyik/);
  const otherMove = run(state, 'MOVE_CREATE', issue([line('water', 12)], 'Fő raktár', 'Saloon'));
  assert.equal(receiveAll(otherMove, receiver('Saloon')).moves.at(-1).status, 'done');
  const otherReceipt = run(state, 'RECEIPT', receipt([line('water', 5)]));
  assert.equal(stockAt(otherReceipt, 'Italraktár', 'water'), stockAt(state, 'Italraktár', 'water') + 5);
  const submitted = submitCount(state);
  assert.equal(run(submitted, 'MOVE_CREATE', issue()).moves.at(-1).status, 'pending');
});

test('counts submit exact nonnegative base quantities, change no stock and require the correct owner', () => {
  const state = run(createState(), 'COUNT_START', countStart(), receiver());
  const count = state.counts.at(-1);
  for (const actual of [{}, { ...count.expected, meat: 0 }, { ...count.expected, water: -1 }, { ...count.expected, water: 0.5 }, { ...count.expected, water: NaN }]) {
    unchangedOnError(state, 'COUNT_SUBMIT', { id: count.id, actual }, receiver());
  }
  unchangedOnError(state, 'COUNT_SUBMIT', { id: count.id, actual: count.expected }, receiver('Saloon'));
  unchangedOnError(state, 'COUNT_SUBMIT', { id: count.id, actual: count.expected }, manager);
  const submitted = submitCount(state, { water: 0, wine: measuredVolumeLiters(750, product('wine').bottleReference) });
  assert.deepEqual(submitted.stocks, state.stocks);
  assert.equal(submitted.counts.at(-1).actual.water, 0);
  assert.equal(submitted.counts.at(-1).actual.wine, 0.375);
  assert.equal(submitted.counts.at(-1).status, 'pending');
  assert.equal(submitted.counts.at(-1).paused, false);
  unchangedOnError(submitted, 'COUNT_SUBMIT', { id: count.id, actual: count.expected }, receiver());
  unchangedOnError(submitted, 'COUNT_APPROVE', { id: count.id, adjustment: 'apply', reason: 'Ellenőrizve.' }, receiver());
  unchangedOnError(submitted, 'COUNT_APPROVE', { id: count.id, adjustment: 'apply', reason: ' ' });
});

test('count snapshot survives a new product and later receipt and dispatch without overwriting them', () => {
  let state = run(createState(), 'COUNT_START', countStart('Konyha', 'partial', ['meat']));
  const id = state.counts.at(-1).id;
  state = run(state, 'ADD_PRODUCT', { name: 'Liszt', baseUnit: 'kg', packUnit: 'zsák', packSize: 10 });
  state = submitCount(state, { meat: 78.5 }, manager);
  state = run(state, 'RECEIPT', receipt([{ ...line('meat', 2, 'láda'), destination: 'Konyha' }]));
  state = run(state, 'MOVE_CREATE', issue([line('meat', 2.25)], 'Konyha', 'Fő raktár'));
  state = receiveAll(state, receiver('Konyha'));
  state = run(state, 'COUNT_APPROVE', { id, adjustment: 'apply', reason: 'A számoláskor rögzített eltérés ellenőrizve.' });
  assert.equal(stockAt(state, 'Konyha', 'meat'), 78.5 + 10 - 2.25);
  assert.equal(state.counts.at(-1).differences.meat, -1.5);
  assert.equal(stockAt(state, 'Konyha', state.products.at(-1).id), 0);
  assert.equal(run(state, 'COUNT_START', countStart('Konyha', 'partial', ['meat'])).counts.length, 2);
});

test('an already explained discrepancy closes without a second deduction only after an explicit manager decision', () => {
  let state = run(createState(), 'COUNT_START', countStart(), receiver());
  const countId = state.counts.at(-1).id;
  assert.equal(state.counts.at(-1).expected.cola, 36);
  state = submitCount(state, { cola: 35 });
  state = run(state, 'WASTE_REPORT', { location: 'Csárda pult', ...line('cola', 1), reason: 'A számolás előtt eltört palack utólag jelentve.' }, receiver());
  state = run(state, 'WASTE_APPROVE', { id: state.waste.at(-1).id });
  assert.equal(stockAt(state, 'Csárda pult', 'cola'), 35);
  unchangedOnError(state, 'COUNT_APPROVE', { id: countId, reason: 'Nincs kimondott korrekciós döntés.' }, manager, /Döntsd el/);
  unchangedOnError(state, 'COUNT_APPROVE', { id: countId, adjustment: 'automatic', reason: 'Érvénytelen döntés.' }, manager, /Döntsd el/);
  unchangedOnError(state, 'COUNT_APPROVE', { id: countId, adjustment: 'none', reason: '' }, manager, /indoka/);
  unchangedOnError(state, 'COUNT_APPROVE', { id: countId, adjustment: 'none', reason: 'A selejt rendezte.' }, receiver(), /raktárfelelős/);
  const before = structuredClone(state.stocks);
  state = run(state, 'COUNT_APPROVE', { id: countId, adjustment: 'none', reason: 'A jóváhagyott selejt már rendezte ezt az egy palackot.' });
  assert.deepEqual(state.stocks, before);
  assert.equal(stockAt(state, 'Csárda pult', 'cola'), 35);
  assert.equal(state.counts.at(-1).adjustment, 'none');
  assert.equal(state.counts.at(-1).correctionApplied, false);
  assert.equal(state.history.at(-1).adjustment, 'none');
  assert.deepEqual(state.history.at(-1).changes, []);
  unchangedOnError(state, 'COUNT_APPROVE', { id: countId, adjustment: 'apply', reason: 'Második rendezés.' });
});

test('count approval atomically rejects a negative correction after intervening output', () => {
  let state = run(createState(), 'COUNT_START', countStart('Konyha', 'partial', ['meat', 'wine']));
  const id = state.counts.at(-1).id;
  state = submitCount(state, { meat: 79, wine: 0 }, manager);
  state = run(state, 'MOVE_CREATE', issue([line('meat', 80), line('wine', 3)], 'Konyha', 'Fő raktár'));
  state = receiveAll(state, receiver('Konyha'));
  unchangedOnError(state, 'COUNT_APPROVE', { id, adjustment: 'apply', reason: 'Ez negatív készletet okozna.' }, manager, /nincs elegendő/);
  assert.equal(state.counts.at(-1).status, 'pending');
});

test('fixed synthetic sales use three clear source examples, correct locations and one application only', () => {
  const initial = createState();
  const action = { batchId: 'demo-sales-1' };
  unchangedOnError(initial, 'DEMO_SALES', action, receiver());
  unchangedOnError(initial, 'DEMO_SALES', { batchId: 'arbitrary-pos-entry' });
  const state = run(initial, 'DEMO_SALES', action);
  assert.equal(stockAt(state, 'Csárda pult', 'cola'), stockAt(initial, 'Csárda pult', 'cola') - 2);
  assert.equal(stockAt(state, 'Csárda pult', 'water'), stockAt(initial, 'Csárda pult', 'water') - 3);
  assert.equal(stockAt(state, 'Konyha', 'meat'), round(stockAt(initial, 'Konyha', 'meat') - 0.36));
  assert.deepEqual(state.appliedSales, ['demo-sales-1']);
  assert.equal(state.history.at(-1).sources.length, 3);
  assert.ok(state.history.at(-1).sources.every((source) => source.description.length > 0));
  assert.equal(state.history.at(-1).changes.length, 3);
  assert.strictEqual(run(state, 'DEMO_SALES', action), state, 'duplicate batch returns the identical state');
  let empty = run(initial, 'MOVE_CREATE', issue([line('meat', 80)], 'Konyha', 'Fő raktár'));
  empty = receiveAll(empty, receiver('Konyha'));
  unchangedOnError(empty, 'DEMO_SALES', action, manager, /nincs elegendő/);
});

test('history is immutable with an injectable real timestamp, retains demo actors and replays all shared stock changes', () => {
  let state = createState();
  state = run(state, 'RECEIPT', receipt([line('water', 3, 'karton')]));
  state = run(state, 'MOVE_CREATE', issue([line('water', 12)]));
  state = receiveAll(state);
  state = run(state, 'DEMO_SALES', { batchId: 'demo-sales-1' });
  const replay = structuredClone(createState().stocks);
  const ids = state.history.map((event) => event.id);
  assert.equal(new Set(ids).size, ids.length);
  state.history.forEach((event, index) => {
    assert.deepEqual(event.actor, index === 2 ? receiver() : manager);
    assert.equal(event.at, TEST_TIME);
    assert.equal(typeof event.summary, 'string');
    event.changes.forEach((change) => {
      assert.equal(replay[change.location][change.productId], change.before);
      replay[change.location][change.productId] = change.after;
    });
  });
  assert.deepEqual(replay, state.stocks);
  const fresh = createState();
  assert.deepEqual(run(fresh, 'RECEIPT', receipt([line('water', 3, 'karton')])),
    run(fresh, 'RECEIPT', receipt([line('water', 3, 'karton')])));
  assert.throws(() => transition(fresh, { type: 'DEMO_SALES', batchId: 'demo-sales-1' }, 'manager'));
  assert.throws(() => transition(fresh, { type: 'DEMO_SALES', batchId: 'demo-sales-1' }, { role: 'manager', location: 'Unknown' }));
  unchangedOnError(fresh, 'UNKNOWN', {});
});

test('independent transfers to the same place keep their own fixed 30-minute deadline', () => {
  const initial = createState();
  let state = run(initial, 'MOVE_CREATE', { ...issue([line('water', 12)]), dueAt: '2100-01-01T00:00:00Z' });
  state = run(state, 'MOVE_CREATE', issue([line('water', 15)]), manager, clockAt(10));
  const [first, second] = state.moves;
  assert.notEqual(first.id, second.id);
  assert.equal(first.createdAt, TEST_TIME);
  assert.equal(first.dueAt, clockAt(30).toISOString(), 'deadline cannot be overridden by action fields');
  assert.equal(second.createdAt, clockAt(10).toISOString());
  assert.equal(second.dueAt, clockAt(40).toISOString());
  assert.deepEqual([first.receivedAt, first.resolvedAt, first.closedAt], [null, null, null]);
  assert.equal(total(state, 'water'), total(initial, 'water'));
  assert.deepEqual(transferTiming(first, clockAt(30 - 1 / 60_000)), { overdue: false, waitingMinutes: 29, lateMinutes: 0 });
  assert.deepEqual(transferTiming(first, clockAt(30)), { overdue: true, waitingMinutes: 30, lateMinutes: 0 });
  assert.deepEqual(transferTiming(second, clockAt(30)), { overdue: false, waitingMinutes: 20, lateMinutes: 0 });
  assert.deepEqual(transferTiming(first, clockAt(31)), { overdue: true, waitingMinutes: 31, lateMinutes: 1 });
  assert.deepEqual(transferTiming(second, clockAt(40)), { overdue: true, waitingMinutes: 30, lateMinutes: 0 });
  assert.deepEqual(transferTiming(second, clockAt(5)), { overdue: false, waitingMinutes: 0, lateMinutes: 0 });
  assert.deepEqual(state.history.map((event) => event.at), [TEST_TIME, clockAt(10).toISOString()]);
  const before = structuredClone(state);
  transferTiming(first, clockAt(100));
  assert.deepEqual(state, before, 'reading overdue information never updates records or stocks');
});

test('full receipt closes the move and stops its receiver waiting clock', () => {
  let state = run(createState(), 'MOVE_CREATE', issue());
  const id = state.moves.at(-1).id;
  state = run(state, 'MOVE_RECEIVE', { id, received: [12] }, receiver(), clockAt(12));
  const move = state.moves.at(-1);
  assert.equal(move.status, 'done');
  assert.equal(move.receivedAt, clockAt(12).toISOString());
  assert.equal(move.closedAt, move.receivedAt);
  assert.equal(move.resolvedAt, null);
  assert.equal(move.dueAt, clockAt(30).toISOString());
  assert.deepEqual(transferTiming(move, clockAt(12)), { overdue: false, waitingMinutes: 12, lateMinutes: 0 });
  assert.deepEqual(transferTiming(move, clockAt(120)), { overdue: false, waitingMinutes: 12, lateMinutes: 0 });
  assert.equal(state.history.at(-1).at, move.receivedAt);
});

test('partial acknowledgment ends receiver overdue status; later manager resolution keeps acknowledgment timing', () => {
  let state = run(createState(), 'MOVE_CREATE', issue());
  const id = state.moves.at(-1).id;
  assert.equal(transferTiming(state.moves.at(-1), clockAt(35)).overdue, true);
  state = run(state, 'MOVE_RECEIVE', { id, received: [11] }, receiver(), clockAt(35));
  const partial = state.moves.at(-1);
  assert.equal(partial.status, 'discrepancy');
  assert.equal(partial.receivedAt, clockAt(35).toISOString());
  assert.equal(partial.closedAt, null);
  assert.equal(partial.resolvedAt, null);
  assert.equal(partial.lines[0].pending, 1);
  assert.deepEqual(transferTiming(partial, clockAt(100)), { overdue: false, waitingMinutes: 35, lateMinutes: 5 });
  state = run(state, 'MOVE_RESOLVE', { id, resolution: 'source', reason: 'Egy palack a kiadónál maradt.' }, manager, clockAt(55));
  const closed = state.moves.at(-1);
  assert.equal(closed.status, 'done');
  assert.equal(closed.receivedAt, partial.receivedAt);
  assert.equal(closed.resolvedAt, clockAt(55).toISOString());
  assert.equal(closed.closedAt, closed.resolvedAt);
  assert.equal(closed.dueAt, partial.dueAt);
  assert.deepEqual(transferTiming(closed, clockAt(200)), { overdue: false, waitingMinutes: 35, lateMinutes: 5 });
  assert.equal(state.history.at(-1).at, closed.resolvedAt);
});

test('injected clocks reject invalid or backward actions atomically and accept simultaneous events', () => {
  const initial = createState();
  const action = { type: 'MOVE_CREATE', ...issue() };
  for (const now of [new Date(NaN), NaN, Infinity, null, true, {}, [], '', 'not-a-date',
    '2026-10-27', '2026-10-27T10:00:00', '2026-02-30T10:00:00Z', '2026-13-01T10:00:00Z',
    '2026-10-27T24:00:00Z', '2026-10-27T10:60:00Z', 1.5]) {
    assert.throws(() => transition(initial, action, manager, now));
    assert.deepEqual(initial, createState());
  }
  const state = transition(initial, action, manager, clockAt(10));
  const before = structuredClone(state);
  assert.throws(() => transition(state, { type: 'MOVE_RECEIVE', id: state.moves[0].id, received: [12] }, receiver(), clockAt(9)), /nem lehet korábbi/);
  assert.throws(() => transition(state, action, manager, clockAt(0)), /nem lehet korábbi/);
  assert.deepEqual(state, before);
  const simultaneous = transition(state, { type: 'MOVE_RECEIVE', id: state.moves[0].id, received: [12] }, receiver(), clockAt(10));
  assert.equal(simultaneous.moves[0].closedAt, clockAt(10).toISOString());
  assert.equal(simultaneous.history[0].at, simultaneous.history[1].at);
  assert.equal(transition(initial, action, manager, '2026-10-27T12:00:00+02:00').history[0].at, TEST_TIME);
  assert.equal(transition(initial, action, manager, Date.parse(TEST_TIME)).history[0].at, TEST_TIME);
  assert.throws(() => transition(initial, action, manager, new Date(8_640_000_000_000_000)), /határidő/);
  assert.deepEqual(initial, createState(), 'an unrepresentable deadline also leaves the state untouched');
  for (const now of [new Date(NaN), null, '2026-10-27']) assert.throws(() => transferTiming(state.moves[0], now));
});

test('default clock records the current instant while duplicate sales never rewrite time or history', () => {
  const before = Date.now();
  const current = transition(createState(), { type: 'MOVE_CREATE', ...issue() }, manager);
  const after = Date.now();
  assert.ok(Date.parse(current.history[0].at) >= before && Date.parse(current.history[0].at) <= after);
  assert.equal(current.moves[0].createdAt, current.history[0].at);
  assert.equal(Date.parse(current.moves[0].dueAt) - Date.parse(current.moves[0].createdAt), 30 * 60_000);
  const action = { type: 'DEMO_SALES', batchId: 'demo-sales-1' };
  const applied = transition(createState(), action, manager, clockAt(10));
  const snapshot = structuredClone(applied);
  assert.strictEqual(transition(applied, action, manager, clockAt(20)), applied);
  assert.strictEqual(transition(applied, action, manager, clockAt(0)), applied, 'a duplicate appends no event, so an older clock cannot backdate history');
  assert.throws(() => transition(applied, action, manager, new Date(NaN)));
  assert.deepEqual(applied, snapshot);
});

test('timestamps and deadlines cannot bypass the existing manager and assigned receiver guards', () => {
  const initial = createState();
  assert.throws(() => transition(initial, { type: 'MOVE_CREATE', ...issue() }, receiver(), clockAt(0)), /raktárfelelős/);
  const state = run(initial, 'MOVE_CREATE', issue());
  const action = { type: 'MOVE_RECEIVE', id: state.moves[0].id, received: [12] };
  const before = structuredClone(state);
  for (const actor of [manager, receiver('Saloon')]) assert.throws(() => transition(state, action, actor, clockAt(45)), /átvevő/);
  assert.deepEqual(state, before);
  assert.equal(state.moves[0].receivedAt, null);
  assert.deepEqual(transferTiming(state.moves[0], clockAt(45)), { overdue: true, waitingMinutes: 45, lateMinutes: 15 });
});

test('same-route same-time transfers retain separate history links after full and zero-quantity acknowledgment', () => {
  let state = run(createState(), 'MOVE_CREATE', issue([line('water', 12)]));
  const firstId = state.moves.at(-1).id;
  state = run(state, 'MOVE_CREATE', issue([line('water', 9)]));
  const secondId = state.moves.at(-1).id;
  state = run(state, 'MOVE_RECEIVE', { id: firstId, received: [12] }, receiver());
  state = run(state, 'MOVE_RECEIVE', { id: secondId, received: [0] }, receiver());
  const zeroAcknowledgment = state.history.at(-1);
  assert.equal(zeroAcknowledgment.moveId, secondId);
  assert.deepEqual(zeroAcknowledgment.changes, []);
  assert.equal(state.moves.at(-1).status, 'discrepancy');
  state = run(state, 'MOVE_RESOLVE', { id: secondId, resolution: 'source', reason: 'Az egész tétel a kiadónál maradt.' });
  assert.deepEqual(state.moves.map((move) => move.status), ['done', 'done']);
  assert.deepEqual(state.history.filter((event) => event.moveId === firstId).map((event) => event.kind), ['MOVE_CREATE', 'MOVE_RECEIVE']);
  assert.deepEqual(state.history.filter((event) => event.moveId === secondId).map((event) => event.kind), ['MOVE_CREATE', 'MOVE_RECEIVE', 'MOVE_RESOLVE']);
  assert.equal(state.history.filter((event) => event.moveId === firstId || event.moveId === secondId).length, state.history.length);
  assert.ok(state.history.every((event) => event.at === TEST_TIME), 'linking events never changes their recorded instant');
  assert.ok(state.moves.every((move) => move.createdAt === TEST_TIME && move.receivedAt === TEST_TIME && move.closedAt === TEST_TIME));
});

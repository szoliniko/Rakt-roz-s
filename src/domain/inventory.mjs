// Pure inventory workflow rules. Persistence, identity verification and external
// StoreHouse/r_keeper I/O belong to application/adapters, never to this module.
// createState() seeds an explicitly synthetic test inventory, not live stock.
import { SOURCE_PRODUCTS } from '../../data/test-catalog.mjs';
// Related: TORZS-04–06, BEV-02–07, MOZ-02–07, VISSZA-02–04,
// FOGY-02–05, SEL-01–02, LELT-01–10, MER-01–03. Local tests are not live proof.

export const LOCATIONS = Object.freeze([
  'Fő raktár', 'Italraktár', 'Konyha', 'Csárda pult', 'Grill terasz',
  'Nádfedeles terasz', 'Saloon', 'westfood',
]);
export const WAREHOUSES = Object.freeze(['Fő raktár', 'Italraktár', 'Konyha']);
const BASE_UNITS = ['db', 'kg', 'l', 'adag', 'zacskó'];
const isDiscrete = (product) => product.discrete ?? ['db', 'adag', 'zacskó'].includes(product.baseUnit);
const isOpenMove = (move) => ['pending', 'discrepancy'].includes(move.status);
const PRECISION = 1_000_000;
const round = (value) => Math.round(value * PRECISION) / PRECISION;
const TRANSFER_CONFIRMATION_MS = 30 * 60_000;

export const PRODUCTS = Object.freeze([
  { id: 'cola', name: 'Kóla', baseUnit: 'db', units: { db: 1, karton: 12 } },
  { id: 'water', name: 'Ásványvíz', baseUnit: 'db', units: { db: 1, karton: 6 } },
  { id: 'beer', name: 'Palackos sör', baseUnit: 'db', units: { db: 1, karton: 24 } },
  { id: 'wine', name: 'Bor', baseUnit: 'l', units: { l: 1, üveg: 0.75, dl: 0.1 },
    bottleReference: { emptyGrams: 420, fullGrams: 1080, volumeMl: 750 } },
  { id: 'spirit', name: 'Tömény ital', baseUnit: 'l', units: { l: 1, üveg: 0.7, dl: 0.1 },
    bottleReference: { emptyGrams: 380, fullGrams: 1020, volumeMl: 700 } },
  { id: 'meat', name: 'Hús', baseUnit: 'kg', units: { kg: 1, láda: 5 } },
].map((product) => Object.freeze({
  ...product, discrete: isDiscrete(product), countInShift: product.id !== 'meat', sourceCode: null, externalId: null, category: 'Bemutatótermékek',
  units: Object.freeze(product.units),
  ...(product.bottleReference ? { bottleReference: Object.freeze(product.bottleReference) } : {}),
})));

// Rows follow LOCATIONS; columns follow PRODUCTS. Every value is synthetic.
const INITIAL_STOCK = [
  [240, 360, 120, 24, 14, 50],
  [360, 480, 240, 45, 21, 0],
  [24, 48, 0, 3, 0.7, 80],
  [36, 48, 30, 9.75, 4.2, 0],
  [24, 36, 24, 6, 2.8, 0],
  [18, 24, 18, 4.5, 2.1, 0],
  [30, 36, 36, 7.5, 4.9, 0],
  [24, 30, 12, 1.5, 0.7, 0],
];

export function createState({ includeSourceCatalog = false, requireShift = false } = {}) {
  const sourceProducts = includeSourceCatalog ? SOURCE_PRODUCTS.filter((product) => product.provenance?.verified === true) : [];
  const products = structuredClone([...PRODUCTS, ...sourceProducts]);
  ensure(new Set(products.map((product) => product.id)).size === products.length, 'A teszttermékek azonosítója nem egyedi.');
  const sourceAmounts = { db: 60, kg: 10, l: 20, adag: 10, zacskó: 10 };
  const stocks = Object.fromEntries(LOCATIONS.map((location, row) => [location,
    Object.fromEntries(products.map((product, column) => [product.id, column < PRODUCTS.length
      ? INITIAL_STOCK[row][column] : row === 0 ? (sourceAmounts[product.baseUnit] ?? 10) : 0])),
  ]));
  return {
    schemaVersion: 2, policy: { requireShift },
    seed: { kind: 'synthetic-test', sourceCatalogIncluded: includeSourceCatalog,
      note: 'A mennyiségek kitalált tesztadatok; a PDF régi kézi készletét nem vettük át.' },
    products, stocks, shifts: [],
    receipts: [], moves: [], waste: [], counts: [], history: [], appliedSales: [], nextId: 1,
  };
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

// Explicit UTC/offset instants avoid interpreting local date strings differently
// on different tablets. The clock is injectable; this is not a trusted audit clock.
function isoInstant(value, label = 'Időpont') {
  let milliseconds;
  if (value instanceof Date) milliseconds = value.getTime();
  else if (typeof value === 'number' && Number.isSafeInteger(value)) milliseconds = value;
  else if (typeof value === 'string') {
    const parts = value.match(/^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/);
    ensure(parts, `${label}: teljes ISO időpontot adj meg időzónával.`);
    const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    ensure(month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
      && hour < 24 && minute < 60 && second < 60, `${label}: érvénytelen naptári időpont.`);
    milliseconds = Date.parse(value);
  }
  ensure(Number.isFinite(milliseconds) && Math.abs(milliseconds) <= 8_640_000_000_000_000, `${label}: érvényes időpont szükséges.`);
  return new Date(milliseconds).toISOString();
}

/** Receiver waiting ends at acknowledgment, even if a discrepancy stays open.
 * Historical waiting/late minutes stay fixed at receivedAt; only pending moves
 * are currently overdue. A read before creation clamps waiting to zero.
 */
export function transferTiming(move, now = new Date()) {
  ensure(move && ['pending', 'discrepancy', 'done', 'cancelled'].includes(move.status), 'Hiányzik az átadás érvényes állapota.');
  const current = Date.parse(isoInstant(now));
  const created = Date.parse(isoInstant(move.createdAt, 'Átadás indítása'));
  const due = Date.parse(isoInstant(move.dueAt, 'Visszaigazolási határidő'));
  ensure(due > created, 'A visszaigazolási határidő legyen későbbi az indításnál.');
  const end = move.status === 'pending' ? current : Date.parse(isoInstant(move.status === 'cancelled' ? move.cancelledAt : move.receivedAt, 'Visszaigazolás / visszavonás időpontja'));
  ensure(move.status === 'pending' || end >= created, 'A visszaigazolás nem előzheti meg az átadás indítását.');
  return {
    overdue: move.status === 'pending' && current >= due,
    waitingMinutes: Math.floor(Math.max(0, end - created) / 60_000),
    lateMinutes: Math.floor(Math.max(0, end - due) / 60_000),
  };
}

function quantity(value, label, { integer = false, positive = false } = {}) {
  ensure(typeof value === 'number' && Number.isFinite(value), `${label}: adj meg érvényes számot.`);
  ensure(positive ? value > 0 : value >= 0, `${label}: ${positive ? 'nullánál nagyobb' : 'nem negatív'} mennyiség szükséges.`);
  ensure(value <= Number.MAX_SAFE_INTEGER / PRECISION, `${label}: túl nagy mennyiség.`);
  if (integer) ensure(Number.isSafeInteger(value), `${label}: egész darabszámot adj meg.`);
  return value;
}

function nonempty(value, label, limit = 240) {
  ensure(typeof value === 'string' && value.trim().length > 0, `${label}: töltsd ki a mezőt.`);
  const cleaned = value.trim();
  ensure(cleaned.length <= limit, `${label}: legfeljebb ${limit} karaktert adj meg.`);
  return cleaned;
}

function normalized(value) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('hu').replace(/\s+/g, ' ').trim();
}

function requireLocation(location) {
  ensure(LOCATIONS.includes(location), 'Válassz ismert készlethelyet.');
}

function findProduct(state, productId) {
  const product = state.products.find((item) => item.id === productId);
  ensure(product, 'Válassz ismert mintaterméket.');
  return product;
}

function requireManager(actor) {
  ensure(actor.role === 'manager', 'Ezt a műveletet a raktárfelelős végzi.');
}

function requireReceiver(actor, location) {
  ensure(actor.role === 'receiver', 'Ezt a lépést a kijelölt helyi átvevő igazolja.');
  ensure(actor.location === location, `Ehhez a művelethez a(z) ${location} kijelölt átvevője szükséges.`);
}

// An HTTP adapter validates identities against its roster. The domain enforces
// the assignment stored with the shift and never trusts a client role override.
export function activeShift(state, location) {
  return state.shifts?.find((shift) => shift.location === location && ['open', 'counting'].includes(shift.status)) ?? null;
}
function requireAssigned(actor, shift) {
  ensure(actor.id && [shift.assigneeId, shift.deputyId].includes(actor.id), 'Ezt a műszak kijelölt átvevője vagy helyettese végezheti.');
}
function requireShiftAssignee(state, actor, location) {
  if (!state.policy?.requireShift || WAREHOUSES.includes(location)) return;
  const shift = activeShift(state, location);
  ensure(shift, 'Ezen a pulton előbb indíts műszakot a kijelölt átvevővel.');
  requireAssigned(actor, shift);
}

// A bar count follows the known drinks assortment, not every never-stocked
// item in a supplier/PDF catalog. Once seen at this location, zero remains in
// scope; physically discovered extra goods can be included explicitly.
function shiftProductIds(state, location) {
  const known = new Set(state.products.filter((product) => stockAt(state, location, product.id) > 0).map((product) => product.id));
  for (const move of state.moves.filter((item) => item.status !== 'cancelled' && [item.from, item.to].includes(location))) for (const line of move.lines) known.add(line.productId);
  for (const receipt of state.receipts) for (const line of receipt.lines) if (line.destination === location) known.add(line.productId);
  for (const waste of state.waste.filter((item) => item.location === location)) known.add(waste.productId);
  for (const count of state.counts.filter((item) => item.location === location)) for (const id of Object.keys(count.expected)) known.add(id);
  return state.products.filter((product) => product.countInShift === true && known.has(product.id)).map((product) => product.id);
}

function requireStatus(record, status) {
  ensure(record && record.status === status, 'Ez a lépés már megtörtént, vagy még nem következik.');
}

function requireMoving(state, locations) {
  for (const location of new Set(locations)) {
    requireLocation(location);
    ensure(!state.counts.some((count) => count.location === location && count.status === 'counting'),
      `${location}: számolás folyik, az árumozgás a beküldésig szünetel.`);
  }
}

export function stockAt(state, location, productId) {
  requireLocation(location);
  findProduct(state, productId);
  const value = state.stocks[location]?.[productId];
  return quantity(value, 'Készlet');
}

export function convertQuantity(product, amount, unit) {
  quantity(amount, 'Mennyiség');
  ensure(product && typeof product.baseUnit === 'string' && product.baseUnit.trim().length > 0 && product.units && Object.hasOwn(product.units, product.baseUnit), 'A termék ellenőrzött alapegysége hiányzik.');
  ensure(product.units && Object.hasOwn(product.units, unit), 'Válassz a termékhez megadott, ellenőrzött mértékegységet.');
  const factor = quantity(product.units[unit], 'Ellenőrzött kiszerelési szorzó', { positive: true });
  ensure(unit !== product.baseUnit || factor === 1, 'Az alapegység szorzója csak 1 lehet.');
  const raw = quantity(amount * factor, 'Átváltott mennyiség', { integer: isDiscrete(product) });
  const converted = round(raw);
  ensure(amount === 0 || converted > 0, 'A megadott mennyiség túl kicsi; legalább 0,000001 alapegységet adj meg.');
  return quantity(converted, 'Átváltott mennyiség', { integer: isDiscrete(product) });
}

export function measuredVolumeLiters(weight, reference) {
  ensure(reference && typeof reference === 'object', 'Hiányoznak az ellenőrzött palackadatok; a térfogat nem számítható ki.');
  const empty = quantity(reference.emptyGrams, 'Üres palack tömege');
  const full = quantity(reference.fullGrams, 'Teli palack tömege', { positive: true });
  const volume = quantity(reference.volumeMl, 'Teli palack térfogata', { positive: true });
  quantity(weight, 'Mért tömeg');
  ensure(full > empty, 'A teli palack tömege legyen nagyobb az üres palackénál.');
  ensure(weight >= empty && weight <= full, 'A mért tömeg nincs az üres és teli mintapalack tömege között.');
  return round(((weight - empty) / (full - empty)) * (volume / 1000));
}

function lineFor(state, line) {
  ensure(line && typeof line === 'object', 'Hiányzik a tétel.');
  const product = findProduct(state, line.productId);
  quantity(line.quantity, 'Tétel mennyisége', { positive: true });
  return { productId: product.id, quantity: line.quantity, unit: line.unit,
    baseQuantity: convertQuantity(product, line.quantity, line.unit),
    productSnapshot: { id: product.id, name: product.name, sourceCode: product.sourceCode ?? null,
      externalId: product.externalId ?? null, category: product.category ?? '', baseUnit: product.baseUnit, discrete: isDiscrete(product) },
    conversion: { unit: line.unit, factor: product.units[line.unit], baseUnit: product.baseUnit } };
}

function requireLines(lines) {
  ensure(Array.isArray(lines) && lines.length > 0, 'Legalább egy tételt adj meg.');
}

// Accumulate before checking stock: repeated lines never bypass availability.
// Changes describe the whole action's before/after values, not intermediate rows.
function applyChanges(state, deltas) {
  const totals = new Map();
  for (const { location, productId, delta } of deltas) {
    requireLocation(location);
    findProduct(state, productId);
    ensure(typeof delta === 'number' && Number.isFinite(delta), 'Érvénytelen készletváltozás.');
    const key = `${location}\0${productId}`;
    const entry = totals.get(key) || { location, productId, delta: 0 };
    entry.delta = round(entry.delta + delta);
    ensure(Number.isFinite(entry.delta), 'Túl nagy készletváltozás.');
    totals.set(key, entry);
  }
  const changes = [...totals.values()].map(({ location, productId, delta }) => {
    const before = stockAt(state, location, productId);
    const after = round(before + delta);
    ensure(after >= 0, `${location}: nincs elegendő ${findProduct(state, productId).name} a művelethez.`);
    quantity(after, 'Eredménykészlet', { integer: isDiscrete(findProduct(state, productId)) });
    return { location, productId, before, after };
  }).filter(({ before, after }) => before !== after);
  for (const change of changes) state.stocks[change.location][change.productId] = change.after;
  return changes;
}

function newId(state, kind) {
  return `demo-${kind}-${state.nextId++}`;
}

function recordHistory(state, actor, kind, at, summary, changes = [], location, extra = {}) {
  const previous = state.history.at(-1);
  ensure(!previous || Date.parse(at) >= Date.parse(isoInstant(previous.at, 'Előző művelet időpontja')),
    'A művelet időpontja nem lehet korábbi az előző rögzített műveletnél. Ellenőrizd az eszköz óráját.');
  state.history.push({ id: newId(state, 'event'), kind, actor: { ...actor },
    ...(location ? { location } : {}), summary, changes,
    at, ...extra });
}

export function transition(state, action, actor, now = new Date()) {
  ensure(actor && ['manager', 'receiver'].includes(actor.role), 'Válassz raktárfelelősi vagy kijelölt átvevői mintaszerepet.');
  requireLocation(actor.location);
  ensure(action && typeof action.type === 'string', 'Hiányzik a bemutató művelete.');
  const at = isoInstant(now);
  const next = structuredClone(state);

  switch (action.type) {
    case 'SHIFT_OPEN': {
      requireLocation(action.location);
      ensure(!WAREHOUSES.includes(action.location), 'Műszakot a pultnál indíts; a raktárban szükség szerinti leltár készül.');
      if (actor.role !== 'manager') requireReceiver(actor, action.location);
      ensure(!activeShift(next, action.location), 'Ezen a pulton már van nyitott műszak. Előbb add le a számolást, vagy add át a felelősséget.');
      ensure(!next.counts.some((count) => count.location === action.location && count.status === 'counting'), 'Előbb folytasd vagy indokkal szakítsd meg a folyamatban lévő számolást.');
      if (actor.role === 'manager') {
        nonempty(action.assigneeId, 'Kijelölt átvevő azonosítója', 100);
        nonempty(action.assigneeName, 'Kijelölt átvevő neve', 100);
        ensure(action.assigneeId !== actor.id, 'A pult műszakjához helyi átvevőt jelölj ki, ne a raktárfelelőst.');
      }
      const assigneeId = nonempty(action.assigneeId ?? actor.id, 'Kijelölt átvevő azonosítója', 100);
      const assigneeName = nonempty(action.assigneeName ?? actor.name, 'Kijelölt átvevő neve', 100);
      if (actor.role === 'receiver') ensure(assigneeId === actor.id, 'Saját műszakot a saját neveddel indíthatsz.');
      const deputyId = action.deputyId ? nonempty(action.deputyId, 'Helyettes azonosítója', 100) : null;
      const deputyName = deputyId ? nonempty(action.deputyName, 'Helyettes neve', 100) : null;
      ensure(!deputyId || deputyId !== assigneeId, 'Az átvevő és a helyettese külön dolgozó legyen.');
      const shift = { id: newId(next, 'shift'), location: action.location, status: 'open', assigneeId, assigneeName,
        deputyId, deputyName, openedAt: at, openedBy: { ...actor }, handoverHistory: [], countId: null,
        submittedAt: null, closedAt: null };
      next.shifts ??= [];
      next.shifts.push(shift);
      recordHistory(next, actor, action.type, at, `Műszak indítva: ${action.location}; felelős: ${assigneeName}${deputyName ? `, helyettes: ${deputyName}` : ''}.`, [], action.location, { shiftId: shift.id });
      break;
    }
    case 'SHIFT_HANDOVER': {
      const shift = next.shifts?.find((item) => item.id === action.id);
      ensure(shift && ['open', 'counting'].includes(shift.status), 'Csak nyitott műszak felelőssége adható át.');
      if (actor.role !== 'manager') {
        requireReceiver(actor, shift.location);
        requireAssigned(actor, shift);
      }
      const assigneeId = nonempty(action.assigneeId, 'Új átvevő azonosítója', 100);
      const assigneeName = nonempty(action.assigneeName, 'Új átvevő neve', 100);
      const deputyId = action.deputyId ? nonempty(action.deputyId, 'Helyettes azonosítója', 100) : null;
      const deputyName = deputyId ? nonempty(action.deputyName, 'Helyettes neve', 100) : null;
      ensure(!deputyId || deputyId !== assigneeId, 'Az átvevő és a helyettese külön dolgozó legyen.');
      const reason = nonempty(action.reason, 'Műszakátadás indoka');
      const previous = { assigneeId: shift.assigneeId, assigneeName: shift.assigneeName, deputyId: shift.deputyId, deputyName: shift.deputyName };
      shift.handoverHistory.push({ at, actor: { ...actor }, previous, assigneeId, assigneeName, deputyId, deputyName, reason });
      Object.assign(shift, { assigneeId, assigneeName, deputyId, deputyName });
      recordHistory(next, actor, action.type, at, `Műszakfelelősség átadva: ${previous.assigneeName} → ${assigneeName}. ${reason}`, [], shift.location, { shiftId: shift.id, previous });
      break;
    }
    case 'MOVE_CANCEL': {
      requireManager(actor);
      const move = next.moves.find((item) => item.id === action.id);
      requireStatus(move, 'pending');
      ensure(action.physicalStillAtSource === true, 'A visszavonás előtt ellenőrizd, hogy az összes áru a kiadó helyen maradt. Ha már elvitték, igazolást vagy helyesbítő mozgást használj.');
      const reason = nonempty(action.reason, 'Visszavonás indoka');
      requireMoving(next, [move.from, move.to]);
      const changes = applyChanges(next, move.lines.map((line) => ({ location: move.from, productId: line.productId, delta: line.pending })));
      for (const line of move.lines) { line.cancelledQuantity = line.pending; line.pending = 0; }
      Object.assign(move, { status: 'cancelled', cancelledAt: at, closedAt: at, cancellationReason: reason, cancelledBy: { ...actor } });
      recordHistory(next, actor, action.type, at, `Átadás visszavonva; az áru a kiadó helyen maradt: ${reason}`, changes, move.from, { moveId: move.id, reason });
      break;
    }
    case 'COUNT_CANCEL': {
      requireManager(actor);
      const count = next.counts.find((item) => item.id === action.id);
      requireStatus(count, 'counting');
      const reason = nonempty(action.reason, 'Számolás megszakításának indoka');
      Object.assign(count, { status: 'cancelled', paused: false, cancelledAt: at, cancelledBy: { ...actor }, cancellationReason: reason });
      const shift = next.shifts?.find((item) => item.id === count.shiftId);
      if (shift) { shift.status = 'open'; shift.countId = null; }
      recordHistory(next, actor, action.type, at, `Számolás indokkal megszakítva; nincs készletkorrekció: ${reason}`, [], count.location, { countId: count.id, shiftId: count.shiftId, reason });
      break;
    }
    case 'RECEIPT': {
      requireManager(actor);
      const supplier = nonempty(action.supplier, 'Beszállító', 100);
      const document = nonempty(action.document, 'Szállítólevél száma', 100);
      ensure(!next.receipts.some((receipt) => normalized(receipt.supplier) === normalized(supplier)
        && normalized(receipt.document) === normalized(document)), 'Ezt a szállítólevelet ennél a beszállítónál már bevételezted a bemutatóban.');
      requireLines(action.lines);
      const lines = action.lines.map((line) => {
        const converted = lineFor(next, line);
        requireLocation(line.destination);
        ensure(line.checked === true, 'Minden sornál jelöld, hogy a terméket és a tényleges mennyiséget ellenőrizted.');
        return { ...converted, destination: line.destination, checked: true };
      });
      requireMoving(next, lines.map((line) => line.destination));
      const changes = applyChanges(next, lines.map((line) => ({ location: line.destination, productId: line.productId, delta: line.baseQuantity })));
      const receipt = { id: newId(next, 'receipt'), status: 'done', supplier, document, lines, createdAt: at, createdBy: { ...actor } };
      next.receipts.push(receipt);
      recordHistory(next, actor, action.type, at, `Bevételezés: ${supplier}, ${document}.`, changes);
      break;
    }
    case 'ADD_PRODUCT': {
      requireManager(actor);
      const name = nonempty(action.name, 'Terméknév', 80);
      const sourceCode = action.sourceCode == null || String(action.sourceCode).trim() === '' ? null : nonempty(String(action.sourceCode), 'Termékkód', 60);
      ensure(!sourceCode || !next.products.some((product) => product.sourceCode === sourceCode), 'Már van ilyen termékkód. Válaszd a meglévő terméket.');
      ensure(sourceCode || !next.products.some((product) => normalized(product.name) === normalized(name)), 'Már van ilyen nevű termék. Ellenőrizd a kódját, egységét és csoportját; új külön termékhez adj meg külön termékkódot.');
      ensure([...BASE_UNITS, ...next.products.map((product) => product.baseUnit)].includes(action.baseUnit), 'Válassz a nyilvántartásból ismert alapegységet.');
      const packUnit = nonempty(action.packUnit, 'Kiszerelés neve', 30);
      ensure(normalized(packUnit) !== normalized(action.baseUnit), 'A kiszerelés neve különbözzön az alapegységtől.');
      const packSize = quantity(action.packSize, 'Kiszerelési szorzó', { positive: true, integer: ['db', 'adag', 'zacskó'].includes(action.baseUnit) });
      const product = { id: newId(next, 'product'), name, baseUnit: action.baseUnit, sourceCode,
        externalId: null, category: typeof action.category === 'string' ? action.category.trim().slice(0, 100) : 'Új termékek',
        discrete: ['db', 'adag', 'zacskó'].includes(action.baseUnit), countInShift: action.countInShift === true,
        units: { [action.baseUnit]: 1, [packUnit]: packSize } };
      convertQuantity(product, 1, packUnit);
      next.products.push(product);
      for (const location of LOCATIONS) next.stocks[location][product.id] = 0;
      recordHistory(next, actor, action.type, at, `Új mintatermék: ${name}.`);
      break;
    }
    case 'MOVE_CREATE': {
      requireManager(actor);
      let correctionReason = null;
      if (action.correctsMoveId != null) {
        const original = next.moves.find((move) => move.id === action.correctsMoveId);
        requireStatus(original, 'done');
        correctionReason = nonempty(action.reason, 'Helyesbítés indoka');
        ensure(action.from === original.to, 'A helyesbítő mozgás az eredeti átadás fogadó helyéről induljon; a tényleges helyet ellenőrizd.');
      }
      ensure(['issue', 'return'].includes(action.kind), 'Válassz kiadást vagy visszavétet.');
      requireLocation(action.from);
      requireLocation(action.to);
      ensure(action.from !== action.to, 'A kiadó és fogadó hely különbözzön.');
      requireMoving(next, [action.from, action.to]);
      requireLines(action.lines);
      const lines = action.lines.map((line) => {
        const converted = lineFor(next, line);
        return { ...converted, received: 0, pending: converted.baseQuantity };
      });
      if (action.correctsMoveId) {
        const original = next.moves.find((move) => move.id === action.correctsMoveId);
        const available = new Map();
        for (const line of original.lines) available.set(line.productId, round((available.get(line.productId) ?? 0) + line.received));
        for (const previous of next.moves.filter((move) => move.correctsMoveId === original.id && move.status !== 'cancelled')) {
          for (const line of previous.lines) available.set(line.productId, round((available.get(line.productId) ?? 0) - line.received - line.pending));
        }
        for (const line of lines) {
          const remaining = round((available.get(line.productId) ?? 0) - line.baseQuantity);
          ensure(remaining >= 0, 'A helyesbítés csak az eredeti átadás még nem helyesbített, igazolt mennyiségét mozgathatja.');
          available.set(line.productId, remaining);
        }
      }
      const changes = applyChanges(next, lines.map((line) => ({ location: action.from, productId: line.productId, delta: -line.baseQuantity })));
      const move = { id: newId(next, 'move'), kind: action.kind, from: action.from, to: action.to,
        status: 'pending', lines, reason: '', createdAt: at,
        dueAt: isoInstant(Date.parse(at) + TRANSFER_CONFIRMATION_MS, 'Visszaigazolási határidő'),
        receivedAt: null, resolvedAt: null, closedAt: null, cancelledAt: null,
        correctsMoveId: action.correctsMoveId ?? null, correctionReason };
      next.moves.push(move);
      recordHistory(next, actor, action.type, at, `${action.kind === 'return' ? 'Visszavét' : 'Kiadás'} elindítva: ${action.from} → ${action.to}.`, changes, undefined, { moveId: move.id, ...(move.correctsMoveId ? { correctsMoveId: move.correctsMoveId, reason: correctionReason } : {}) });
      break;
    }
    case 'MOVE_RECEIVE': {
      const move = next.moves.find((item) => item.id === action.id);
      requireStatus(move, 'pending');
      const sourceConfirms = move.kind === 'return' || (move.from === 'Konyha' && WAREHOUSES.includes(move.to));
      requireReceiver(actor, sourceConfirms ? move.from : move.to);
      requireShiftAssignee(next, actor, sourceConfirms ? move.from : move.to);
      requireMoving(next, [move.from, move.to]);
      ensure(Array.isArray(action.received) && action.received.length === move.lines.length, 'Minden átadott sor tényleges mennyiségét add meg alapegységben.');
      const received = move.lines.map((line, index) => {
        const product = findProduct(next, line.productId);
        const amount = convertQuantity(product, action.received[index], product.baseUnit);
        ensure(amount <= line.pending, 'Az igazolt mennyiség nem lehet több az átadott mennyiségnél.');
        return amount;
      });
      const changes = applyChanges(next, move.lines.map((line, index) => ({ location: move.to, productId: line.productId, delta: received[index] })));
      move.lines.forEach((line, index) => {
        line.received = received[index];
        line.pending = round(line.baseQuantity - received[index]);
      });
      move.status = move.lines.some((line) => line.pending > 0) ? 'discrepancy' : 'done';
      move.receivedAt = at;
      if (move.status === 'done') move.closedAt = at;
      recordHistory(next, actor, action.type, at, `Mennyiség igazolva: ${move.from} → ${move.to}${move.status === 'discrepancy' ? '; eltérés tisztázásra vár' : ''}.`, changes, undefined, { moveId: move.id });
      break;
    }
    case 'MOVE_RESOLVE': {
      requireManager(actor);
      const move = next.moves.find((item) => item.id === action.id);
      requireStatus(move, 'discrepancy');
      ensure(['source', 'destination'].includes(action.resolution), 'Jelöld, hogy a különbözet a kiadó vagy a fogadó helyen van.');
      const reason = nonempty(action.reason, 'Rendezés indoka');
      requireMoving(next, [move.from, move.to]);
      const destination = action.resolution === 'source' ? move.from : move.to;
      const changes = applyChanges(next, move.lines.map((line) => ({ location: destination, productId: line.productId, delta: line.pending })));
      for (const line of move.lines) {
        if (action.resolution === 'destination') line.received = round(line.received + line.pending);
        line.pending = 0;
      }
      Object.assign(move, { status: 'done', reason, resolution: action.resolution, resolvedAt: at, closedAt: at });
      recordHistory(next, actor, action.type, at, `Átadási eltérés rendezve: ${reason}`, changes, destination, { moveId: move.id });
      break;
    }
    case 'WASTE_REPORT': {
      requireLocation(action.location);
      requireReceiver(actor, action.location);
      requireShiftAssignee(next, actor, action.location);
      requireMoving(next, [action.location]);
      const line = lineFor(next, action);
      const reason = nonempty(action.reason, 'Selejt indoka');
      const alreadyPending = next.waste.filter((item) => item.status === 'pending' && item.location === action.location && item.productId === line.productId)
        .reduce((total, item) => round(total + item.baseQuantity), 0);
      ensure(round(line.baseQuantity + alreadyPending) <= stockAt(next, action.location, line.productId), 'A jelentett és függő selejt együtt több a hely készleténél.');
      next.waste.push({ id: newId(next, 'waste'), status: 'pending', location: action.location, ...line, reason, createdAt: at, createdBy: { ...actor } });
      recordHistory(next, actor, action.type, at, `Selejt jelentve, ellenőrzésre vár: ${reason}`, [], action.location);
      break;
    }
    case 'WASTE_APPROVE': {
      requireManager(actor);
      const waste = next.waste.find((item) => item.id === action.id);
      requireStatus(waste, 'pending');
      requireMoving(next, [waste.location]);
      const changes = applyChanges(next, [{ location: waste.location, productId: waste.productId, delta: -waste.baseQuantity }]);
      waste.status = 'done';
      waste.approvedAt = at;
      recordHistory(next, actor, action.type, at, `Selejt véglegesítve: ${waste.reason}`, changes, waste.location);
      break;
    }
    case 'COUNT_START': {
      ensure(['shift', 'full', 'partial'].includes(action.kind), 'Válassz műszakzárást, teljes vagy részleges leltárt.');
      requireLocation(action.location);
      let shift = null;
      if (action.kind === 'shift') {
        requireReceiver(actor, action.location);
        shift = activeShift(next, action.location);
        if (next.policy?.requireShift) ensure(shift && shift.status === 'open', 'Előbb indíts műszakot ezen a pulton.');
        if (shift) { requireStatus(shift, 'open'); requireAssigned(actor, shift); }
        ensure(!WAREHOUSES.includes(action.location), 'Műszakzárást pultnál indíts; a raktárban teljes vagy részleges leltár készül.');
      } else {
        requireManager(actor);
        ensure(WAREHOUSES.includes(action.location), 'Raktári leltárhoz válassz raktárt vagy Konyhát.');
      }
      ensure(action.paused === true, 'A számoláshoz előbb állítsd meg az érintett hely kiadását és árumozgását.');
      ensure(!next.counts.some((count) => count.location === action.location && count.status === 'counting'), 'Ezen a helyen már van folyamatban lévő számolás.');
      // Local staff can finish their count before the manager clears open items.
      // Keep these flags with the snapshot: its expected quantities are provisional.
      const unresolvedAtStart = [
        ...next.moves.filter((move) => isOpenMove(move) && [move.from, move.to].includes(action.location))
          .map((move) => `Függő ${move.kind === 'return' ? 'visszavét' : 'átadás'} (${move.id}): ${move.from} → ${move.to}`),
        ...next.waste.filter((waste) => waste.location === action.location && waste.status === 'pending')
          .map((waste) => `Függő selejtjelentés (${waste.id}): ${findProduct(next, waste.productId).name}`),
        ...next.counts.filter((count) => count.location === action.location && count.status === 'pending')
          .map((count) => `Korábbi, ellenőrzésre váró számolás (${count.id})`),
      ];
      const ids = action.kind === 'partial' ? action.productIds : action.kind === 'shift'
        ? shiftProductIds(next, action.location) : next.products.map((product) => product.id);
      ensure(Array.isArray(ids) && ids.length > 0 && new Set(ids).size === ids.length, 'Válassz legalább egy különböző terméket a részleges leltárhoz.');
      const expected = Object.fromEntries(ids.map((id) => [findProduct(next, id).id, stockAt(next, action.location, id)]));
      const count = { id: newId(next, 'count'), status: 'counting', location: action.location,
        kind: action.kind, expected, actual: {}, reason: '', paused: true, correctionApplied: false,
        unresolvedAtStart, historyStart: next.history.length, shiftId: shift?.id ?? null,
        createdAt: at, createdBy: { ...actor },
        productSnapshots: Object.fromEntries(ids.map((id) => { const product = findProduct(next, id); return [id, { name: product.name, sourceCode: product.sourceCode ?? null, baseUnit: product.baseUnit, category: product.category ?? '' }]; })) };
      next.counts.push(count);
      if (shift) { shift.status = 'counting'; shift.countId = count.id; }
      recordHistory(next, actor, action.type, at, `${action.kind === 'shift' ? 'Műszakzáró számolás' : 'Leltár'} elkezdve; az érintett hely árumozgása szünetel.`, [], action.location);
      break;
    }
    case 'COUNT_INCLUDE_PRODUCTS': {
      const count = next.counts.find((item) => item.id === action.id);
      requireStatus(count, 'counting');
      if (count.kind === 'shift') {
        requireReceiver(actor, count.location);
        const shift = next.shifts?.find((item) => item.id === count.shiftId);
        if (shift) requireAssigned(actor, shift);
      } else requireManager(actor);
      ensure(Array.isArray(action.productIds) && action.productIds.length > 0 && new Set(action.productIds).size === action.productIds.length, 'Válassz legalább egy külön terméket.');
      for (const id of action.productIds) {
        ensure(!Object.hasOwn(count.expected, id), 'Ez a termék már szerepel a számolásban; az eredeti várható mennyiséget nem írjuk felül.');
        const product = findProduct(next, id);
        count.expected[id] = stockAt(next, count.location, id);
        count.productSnapshots[id] = { name: product.name, sourceCode: product.sourceCode ?? null, baseUnit: product.baseUnit, category: product.category ?? '' };
      }
      recordHistory(next, actor, action.type, at, 'A helyen talált további termékek bekerültek a számolásba; a készlet nem változott.', [], count.location, { countId: count.id, productIds: [...action.productIds] });
      break;
    }
    case 'COUNT_SUBMIT': {
      const count = next.counts.find((item) => item.id === action.id);
      requireStatus(count, 'counting');
      if (count.kind === 'shift') {
        requireReceiver(actor, count.location);
        const shift = next.shifts?.find((item) => item.id === count.shiftId);
        if (shift) requireAssigned(actor, shift);
      } else requireManager(actor);
      ensure(action.actual && typeof action.actual === 'object' && !Array.isArray(action.actual), 'Add meg az összes megszámolt mennyiséget.');
      const ids = Object.keys(count.expected);
      ensure(Object.keys(action.actual).length === ids.length && ids.every((id) => Object.hasOwn(action.actual, id)), 'Pontosan a számolásban szereplő termékek mennyiségét add meg.');
      count.actual = Object.fromEntries(ids.map((id) => {
        const product = findProduct(next, id);
        return [id, convertQuantity(product, action.actual[id], product.baseUnit)];
      }));
      count.differences = Object.fromEntries(ids.map((id) => [id, round(count.actual[id] - count.expected[id])]));
      Object.assign(count, { status: 'pending', paused: false, submittedAt: at, submittedBy: { ...actor } });
      const shift = next.shifts?.find((item) => item.id === count.shiftId);
      if (shift) { shift.status = 'submitted'; shift.submittedAt = at; }
      recordHistory(next, actor, action.type, at, 'Számolás beküldve ellenőrzésre; a készlet még nem változott, az árumozgás folytatható.', [], count.location);
      break;
    }
    case 'COUNT_APPROVE': {
      requireManager(actor);
      const count = next.counts.find((item) => item.id === action.id);
      requireStatus(count, 'pending');
      ensure(['apply', 'none'].includes(action.adjustment), 'Döntsd el, szükséges-e külön készletkorrekció, vagy további korrekció nélkül zárod a számolást.');
      const reason = nonempty(action.reason, 'Ellenőrzés és rendezés indoka');
      ensure(!next.moves.some((move) => isOpenMove(move) && [move.from, move.to].includes(count.location)), 'Előbb igazold vagy rendezd a hely függő átadásait.');
      ensure(!next.waste.some((waste) => waste.location === count.location && waste.status === 'pending'), 'Előbb ellenőrizd a hely függő selejtjelentéseit.');
      const earlierCounts = next.counts.slice(0, next.counts.indexOf(count));
      ensure(!earlierCounts.some((earlier) => earlier.location === count.location && earlier.status === 'pending'), 'Előbb zárd le a hely korábbi, ellenőrzésre váró számolását.');
      requireMoving(next, [count.location]);
      // The manager explicitly decides after reviewing later movements whether the
      // snapshot difference still calls for correction. Never infer that decision.
      const changes = action.adjustment === 'none' ? [] : applyChanges(next, Object.keys(count.expected).map((productId) => ({
        location: count.location, productId, delta: round(count.actual[productId] - count.expected[productId]),
      })));
      Object.assign(count, { status: 'done', reason, adjustment: action.adjustment, correctionApplied: action.adjustment === 'apply', closedAt: at });
      const shift = next.shifts?.find((item) => item.id === count.shiftId);
      if (shift) { shift.status = 'closed'; shift.closedAt = at; }
      const summary = action.adjustment === 'none'
        ? `Számolás lezárva további készletkorrekció nélkül: ${reason}`
        : `Számolás ellenőrizve, indokolt eltérés rendezve: ${reason}`;
      recordHistory(next, actor, action.type, at, summary, changes, count.location, { adjustment: action.adjustment });
      break;
    }
    case 'DEMO_SALES': {
      requireManager(actor);
      ensure(action.batchId === 'demo-sales-1', 'Csak a megadott, egyértelműen jelölt kasszaminta használható.');
      if (state.appliedSales.includes(action.batchId)) return state;
      const sources = [
        { location: 'Csárda pult', productId: 'cola', quantity: 2, description: 'Normál áras ital: 2 db kóla.' },
        { location: 'Csárda pult', productId: 'water', quantity: 3, description: 'Italcsomagban kiadva: 3 db ásványvíz; a csomagár nem változtatja meg a fogyást.' },
        { location: 'Konyha', productId: 'meat', quantity: 0.36, description: 'Receptpélda: 2 adag × 0,18 kg hús = 0,36 kg.' },
      ];
      requireMoving(next, sources.map((line) => line.location));
      const changes = applyChanges(next, sources.map((line) => ({ ...line, delta: -line.quantity })));
      next.appliedSales.push(action.batchId);
      recordHistory(next, actor, action.type, at, 'Egy szimulált kasszaelszámolás: 2 kóla, 3 csomagos víz és 0,36 kg recept szerinti húsfogyás.', changes, undefined,
        { batchId: action.batchId, sources });
      break;
    }
    default:
      throw new Error('Ismeretlen bemutató művelet.');
  }
  return next;
}

import { LOCATIONS, WAREHOUSES, createState, stockAt, convertQuantity, measuredVolumeLiters, transferTiming } from './model.mjs';
import { createRuntime } from './runtime.mjs';

// All writes pass through the runtime; the server supplies identity, revision and clock.
const app = document.querySelector('#app');
const feedback = document.querySelector('#feedback');
const runtime = createRuntime();
let session = { authenticated:false, users:[], mode:'local', storage:{persistent:false,label:'Betöltés…'} };
let revision = 0;
let connection = {};
let savedDrafts = {};
let busy = false;
let review = null;
let loginSuggestion = '';
let resumeAfterLogin = null;
let connectionError = '';
let draftMessage = '';
let draftError = false;
const draftTimers = new Map();
let stockSearch = '';
let stockCategory = '';
let historyFilters = { search:'', location:'', status:'', date:'' };
let state = createState();
let actor = { id:'', name:'Nincs bejelentkezve', role: 'manager', location: 'Csárda pult' };
let view = 'home';
let selectedId = null;
let stockLocation = 'Italraktár';
let drafts = {};
let transferFilter = 'all';
let demoClockOffset = 0;
const lineCounts = { receipt: 1, issue: 1, return: 1 };
const formTitles = { receipt: 'Áru átvétele a beszállítótól', issue: 'Áru kiadása', return: 'Visszahozott áru átvétele' };

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmt(n) { return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 3 }).format(n); }
function product(id) { return state.products.find(p => p.id === id); }
function unitLabel(unit) { return ({db:'darab',kg:'kg',l:'liter',dl:'dl'})[unit] || unit; }
function amount(id, n) { return `${fmt(n)} ${unitLabel(product(id)?.baseUnit || '')}`; }
function appNow() { return new Date(new Date(runtime.now()).getTime()+demoClockOffset); }
function timeLabel(value,short=false) { return new Intl.DateTimeFormat('hu-HU',{timeZone:'Europe/Budapest',year:short?undefined:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:short?undefined:'2-digit'}).format(new Date(value)); }
function timeTag(value,short=false) { return `<time datetime="${esc(value)}">${esc(timeLabel(value,short))}</time>`; }
function moveReference(m) { return `${m.kind==='return'?'V':'Á'}-${String(m.id.split('-').at(-1)).padStart(4,'0')}`; }
function elapsed(minutes) { return minutes<1?'kevesebb mint 1 perc':minutes<60?`${minutes} perc`:`${Math.floor(minutes/60)} óra${minutes%60?` ${minutes%60} perc`:''}`; }
function option(value, text, current) { return `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(text)}</option>`; }
function button(text, attrs='', style='primary') { return `<button type="button" class="button ${style}" ${attrs}>${esc(text)}</button>`; }
function submit(text) { return `<button type="submit" class="button primary">${esc(text)}</button>`; }
function val(form, name, fallback='') { return drafts[form]?.[name] ?? fallback; }
function field(label,name,value='',attrs='') { return `<div class="field"><label for="f-${esc(name)}">${esc(label)}</label><input id="f-${esc(name)}" name="${esc(name)}" value="${esc(value)}" ${attrs}></div>`; }
function select(label,name,items,current,attrs='') { return `<div class="field"><label for="f-${esc(name)}">${esc(label)}</label><select id="f-${esc(name)}" name="${esc(name)}" ${attrs}>${items.map(i => Array.isArray(i) ? option(i[0],i[1],current) : option(i,i,current)).join('')}</select></div>`; }
function check(name,text,required=true,isChecked=false) { return `<label class="check"><input type="checkbox" name="${esc(name)}"${required?' required':''}${isChecked?' checked':''}>${esc(text)}</label>`; }
function reason(form,label='Mit ellenőriztél, és mi indokolja a javítást?') { return `<div class="field"><label for="reason">${esc(label)}</label><textarea id="reason" name="reason" required maxlength="240">${esc(val(form,'reason'))}</textarea></div>`; }
function heading(title,lead='') { return `${view !== 'home' ? '<button type="button" class="back" data-view="home">Vissza az áttekintéshez</button>':''}<header class="page-head"><h1 id="screen-title" tabindex="-1">${esc(title)}</h1>${lead?`<p class="lead">${esc(lead)}</p>`:''}</header>`; }
function empty(title,detail) { return `<div class="empty"><strong>${esc(title)}</strong><p>${esc(detail)}</p></div>`; }
function stateLabel(status) { return ({pending:'Visszaigazolásra vár',discrepancy:'Eltérés tisztázásra vár',done:'Lezárva',cancelled:'Visszavonva',counting:'Számolás folyamatban'})[status] || status; }
function changeList(changes) { return changes.length ? `<ul class="history-changes">${changes.map(c=>`<li>${esc(c.location)} · ${esc(product(c.productId)?.name || c.productId)}: <strong>${amount(c.productId,c.before)} → ${amount(c.productId,c.after)}</strong></li>`).join('')}</ul>` : ''; }
function notify(message,error=false,changes=[]) { feedback.innerHTML=`<p>${esc(message)}</p>${changeList(changes)}`; feedback.classList.toggle('error',error); feedback.setAttribute('role',error?'alert':'status'); }
function guard(role) { return actor.role===role ? '' : `<div class="notice"><p>Ezt a feladatot a ${role==='manager'?'raktárfelelős':'kijelölt helyi átvevő'} végzi.</p>${role==='manager'?button('Raktárfelelős belépése','data-open-manager','secondary'):button('Helyi átvevő belépése',`data-open-tablet="${esc(actor.location)}"`,'secondary')}</div>`; }
function confirmationLocation(m) { return m.kind==='return' || (m.from==='Konyha' && WAREHOUSES.includes(m.to)) ? m.from : m.to; }
function visibleMove(m) { return actor.role==='manager' || m.from===actor.location || m.to===actor.location; }
function openMoves() { return state.moves.filter(m=>!['done','cancelled'].includes(m.status)&&visibleMove(m)); }
function otherTasks() {
  return [...state.waste.filter(w=>w.status!=='done'&&(actor.role==='manager'||w.location===actor.location)),
    ...state.counts.filter(c=>!['done','cancelled'].includes(c.status)&&(actor.role==='manager'||c.location===actor.location))];
}
function transferTimeContent(m,detail=false) {
  const timing=transferTiming(m,appNow());
  const status=m.status==='pending'?(timing.overdue?'Késik a visszaigazolás':'Visszaigazolásra vár'):stateLabel(m.status);
  const wait=m.status==='pending'?`Várakozás: ${elapsed(timing.waitingMinutes)}`:m.receivedAt?`Visszaigazolva: ${timeLabel(m.receivedAt,true)}`:'';
  let out=`${detail?'':`<span class="badge ${timing.overdue?'overdue':m.status==='done'?'':'pending'}">${esc(status)}</span>`}<span>${esc(wait)}</span>`;
  if(m.status==='pending'&&timing.overdue)out+=`<strong class="late-text">${timing.lateMinutes<1?'Most járt le a 30 perc':`${elapsed(timing.lateMinutes)} késés`}</strong>`;
  out+=`<span>Rögzítve: ${timeTag(m.createdAt,!detail)}</span>`;
  if(m.status==='pending')out+=`<span>Igazolás határideje: ${timeTag(m.dueAt,!detail)}</span>`;
  if(detail&&m.receivedAt)out+=`<span>Igazolás időpontja: ${timeTag(m.receivedAt)}</span>`;
  if(detail&&m.resolvedAt)out+=`<span>Eltérés rendezve: ${timeTag(m.resolvedAt)}</span>`;
  if(detail&&m.closedAt)out+=`<span>Lezárva: ${timeTag(m.closedAt)}</span>`;
  if(m.receivedAt&&new Date(m.receivedAt)>=new Date(m.dueAt))out+=`<span>Az igazolás a 30 perces határidő után érkezett.</span>`;
  return out;
}
function nextStep(m) {
  if(m.status==='discrepancy')return 'Következő lépés: a raktárfelelős tisztázza a különbözetet az átvevővel.';
  const place=confirmationLocation(m);
  const shift=activeShift(place);
  return `Következő lépés: ${shift?.assigneeName||`${place} kijelölt átvevője`} ${m.kind==='return'?'igazolja a visszaadott mennyiséget':'ellenőrzi és igazolja a mennyiséget'}.`;
}
function transferRow(m) {
  const timing=transferTiming(m,appNow());
  const canConfirm=actor.role==='receiver'&&actor.location===confirmationLocation(m)&&m.status==='pending';
  const action=canConfirm?'Ellenőrzöm és igazolom':m.status==='discrepancy'&&actor.role==='manager'?'Eltérés tisztázása':'Átadás megnyitása';
  return `<li class="transfer-row${timing.overdue?' is-overdue':''}" data-transfer-id="${m.id}"><div class="transfer-content"><h3>${esc(moveReference(m))} · ${m.kind==='return'?'Visszavét':'Kiadás'}</h3><p class="transfer-route">${esc(m.from)} → ${esc(m.to)}</p><p class="transfer-items">${m.lines.map(l=>`${esc(lineName(l))}: ${fmt(l.quantity)} ${esc(unitLabel(l.unit))}${m.status==='discrepancy'?` (tisztázandó: ${lineAmount(l,l.pending)})`:''}`).join(' · ')}</p><div class="transfer-time" data-transfer-timing="${m.id}">${transferTimeContent(m)}</div><p class="next-step">${esc(nextStep(m))}</p></div>${button(action,`data-move-id="${m.id}"`,canConfirm?'primary':'secondary')}</li>`;
}
function transferGroups() {
  const all=openMoves();
  const moves=all.filter(m=>transferFilter==='all'||(transferFilter==='overdue'?transferTiming(m,appNow()).overdue:m.status==='discrepancy'));
  if(!moves.length)return empty(all.length?'Ebben a szűrésben nincs átadás.':'Nincs nyitott átadás.',all.length?'Az összes nyitott ügyhöz válaszd a „Minden nyitott” szűrőt.':actor.role==='manager'?'Indíts kiadást a jobb oldali feladatokból. Az ügy itt marad, amíg az átvételt igazolják és az esetleges eltérést rendezitek.':'Az ide tartozó új átadások itt jelennek meg. Minden szállítmányt külön tudsz majd ellenőrizni.');
  const groups=new Map();
  for(const m of moves){const place=confirmationLocation(m);if(!groups.has(place))groups.set(place,[]);groups.get(place).push(m);}
  const sorted=[...groups].map(([place,rows])=>[place,rows.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt))]);
  sorted.sort((a,b)=>Number(b[1].some(m=>transferTiming(m,appNow()).overdue))-Number(a[1].some(m=>transferTiming(m,appNow()).overdue))||new Date(a[1][0].createdAt)-new Date(b[1][0].createdAt));
  return sorted.map(([place,rows])=>`<section class="transfer-group" data-place="${esc(place)}"><header><h3>${esc(place)}</h3><span>${rows.length} nyitott ügy${transferFilter==='all'?'':' a szűrésben'} · legrégebbi elöl</span></header><ul>${rows.map(transferRow).join('')}</ul></section>`).join('');
}
function pendingTasks() {
  const rows=[];
  for(const w of state.waste.filter(w=>w.status!=='done'&&(actor.role==='manager'||w.location===actor.location))) rows.push(`<li><strong>Selejtjelentés · ${esc(w.location)}</strong><p>${esc(productLabel(product(w.productId)))} · ${amount(w.productId,w.baseQuantity)} · raktárfelelősi ellenőrzésre vár</p>${button('Megnyitom',`data-waste-id="${w.id}"`,'secondary')}</li>`);
  for(const c of state.counts.filter(c=>!['done','cancelled'].includes(c.status)&&(actor.role==='manager'||c.location===actor.location))) rows.push(`<li><strong>${c.kind==='shift'?'Műszakzárás':'Leltár'} · ${esc(c.location)}</strong><p>${c.status==='counting'?'A számolást még nem adták le. Itt az árumozgás szünetel.':'A számolás raktárfelelősi ellenőrzésre vár.'}</p>${button('Megnyitom',`data-count-id="${c.id}"`,'secondary')}</li>`);
  return rows.length?`<ul class="record-list">${rows.join('')}</ul>`:empty('Nincs további folyamatban lévő ügy.','A bejelentett selejt és az elkezdett számolás itt lesz visszanyitható.');
}
function dashboardValues() {
  const moves=openMoves();
  return {pending:moves.filter(m=>m.status==='pending').length,overdue:moves.filter(m=>transferTiming(m,appNow()).overdue).length,discrepancy:moves.filter(m=>m.status==='discrepancy').length,other:otherTasks().length};
}
function draftSummary() {
  const saved=Object.entries(drafts).filter(([key,value])=>value._view&&Object.hasOwn(screens,value._view)&&!['login','review'].includes(value._view));
  if(!saved.length)return '';
  return `<details class="draft-list"><summary>Saját piszkozatok (${saved.length})</summary><p>A piszkozat még nem véglegesített készletművelet.</p><ul class="record-list">${saved.map(([key,d])=>`<li><strong>${esc(({receipt:'Bevételezés',issue:'Kiadás',return:'Visszavét',move:'Átadás igazolása vagy rendezése',count:'Leltár indítása',countDetail:'Számolás',waste:'Selejtjelentés',shifts:'Műszak indítása',shiftDetail:'Műszak átadása'})[d._view]||'Folyamatban lévő bevitel')}</strong>${savedDrafts[key]?.savedAt?`<p class="small muted">Mentve: ${timeTag(savedDrafts[key].savedAt,true)}</p>`:''}${button('Folytatom',`data-draft-key="${esc(key)}"`,'secondary')}</li>`).join('')}</ul></details>`;
}
function homeView() {
  const items=actor.role==='manager' ? [
    ['receipt','Áru érkezett a beszállítótól','Ellenőrzöm és rögzítem, mit vettünk át, hová kerül.'],
    ['issue','Árut adok ki','Megadom, honnan, hová és mennyi árut adok át.'],
    ['return','Visszahozott árut veszek át','Rögzítem a visszakerülő bontatlan és bontott mennyiséget.'],
    ['count','Raktári leltárt indítok','Kiválasztom a helyet és a megszámolandó termékeket.'],
    ['shifts','Műszakok és átvevők','Megadom, melyik pult működik és ki felel érte.'],
  ] : [
    ...(!WAREHOUSES.includes(actor.location)?[['shifts','Műszak indítása vagy átadása','Saját névvel átveszem a pult folyamatban lévő ügyeit.'],['count','Lezárom a műszakot','Megszámolom a maradékot, és leadom az elszámolást.']]:[]),
    ['waste','Selejtet jelzek','Feljegyzem, mi tört el, ömlött ki vagy vált használhatatlanná.'],
  ];
  const values=dashboardValues();
  return heading(actor.role==='manager'?'Napi áttekintés':`${actor.location} áttekintése`,actor.role==='manager'?'Lásd, hol várnak visszaigazolásra, és melyik ügyben kell továbblépni.':'A helyedhez tartozó átadások, ellenőrzések és napi feladatok.')+draftSummary()+`<div id="dashboard-metrics" class="dashboard-metrics" aria-label="Nyitott ügyek összesítése">${[['pending','Igazolásra vár','átadás'],['overdue','Ebből késik','30 percen túl'],['discrepancy','Eltérés tisztázandó','raktárfelelősi feladat'],['other','További ügy','selejt vagy számolás']].map(([key,label,hint])=>`<div class="metric ${key==='overdue'&&values[key]?'has-overdue':''}" data-metric="${key}" data-value="${values[key]}"><span>${label}</span><strong>${values[key]}</strong><small>${hint}</small></div>`).join('')}</div><div class="dashboard-layout"><section class="dashboard-work"><div class="section-heading"><h2>Nyitott átadások</h2><span>Helyenként, külön bizonylatokkal</span></div><div class="transfer-filters" role="group" aria-label="Átadások szűrése">${[['all','Minden nyitott'],['overdue','Késő igazolások'],['discrepancy','Eltérések']].map(([key,label])=>button(label,`data-transfer-filter="${key}" aria-pressed="${transferFilter===key}"`,'filter')).join('')}</div><p class="muted small queue-explanation">Minden kiadást külön kell igazolni. A piros jelzés 30 perc után jelenik meg; az áru ettől még nem lesz átvettnek jelölve.</p><div id="transfer-groups">${transferGroups()}</div><section class="other-tasks"><h2>Műszakok elszámolása</h2>${shiftSummary()}</section><section class="other-tasks"><h2>Selejt és számolás</h2>${pendingTasks()}</section></section><aside class="dashboard-actions" aria-label="Napi feladatok"><h2>Új feladat</h2><ul class="task-list">${items.map(([target,title,desc])=>`<li><button type="button" class="task-button" data-view="${target}"><strong>${title}</strong><span>${desc}</span></button></li>`).join('')}</ul><div class="dashboard-guide"><h3>Ki következik?</h3><p>Az átadásoknál látod, melyik helynek kell igazolnia. Ha kevesebb áru érkezett, a raktárfelelős tisztázza a különbözetet.</p><p>A késő ügy marad a listán akkor is, ha közben újabb kiadást indítasz ugyanoda.</p></div></aside></div>`;
}
function moveBacklog(from,to,kind) {
  const place=confirmationLocation({from,to,kind});
  const moves=state.moves.filter(m=>!['done','cancelled'].includes(m.status)&&confirmationLocation(m)===place);
  if(!moves.length)return '';
  const overdue=moves.filter(m=>transferTiming(m,appNow()).overdue).length;
  const pending=moves.filter(m=>m.status==='pending').length;
  return `<div class="notice ${overdue?'danger':'warning'}"><p><strong>${esc(place)}: már ${moves.length} nyitott átadás tartozik ide.</strong> ${pending} vár igazolásra${overdue?`, ebből ${overdue} késik`:''}${moves.length-pending?`; ${moves.length-pending} eltérést a raktárfelelősnek kell tisztáznia`:''}.</p><p class="small">Nyitott ügyek: ${moves.map(m=>esc(moveReference(m))).join(', ')}.</p><p>Ellenőrizd, hogy valóban újabb szállítmányt rögzítesz. Az új kiadás külön ügy lesz; a korábbiakat továbbra is igazolni vagy rendezni kell.</p></div>`;
}
function normalized(text) { return String(text||'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('hu'); }
function productLabel(p) { return p?`${p.name}${p.sourceCode?` · ${p.sourceCode}`:' · mintatermék'} · ${unitLabel(p.baseUnit)}${p.category?` · ${p.category}`:''}`:''; }
function lineName(line) { const p=line.productSnapshot||product(line.productId);return productLabel(p); }
function lineAmount(line,n) { return `${fmt(n)} ${unitLabel(line.productSnapshot?.baseUnit||product(line.productId)?.baseUnit||'')}`; }
function countAmount(count,id,n) { return `${fmt(n)} ${unitLabel(count.productSnapshots?.[id]?.baseUnit||product(id)?.baseUnit||'')}`; }
function matchingProducts(search='',category='',selected='') {
  const terms=normalized(search).split(/\s+/).filter(Boolean);
  const matches=state.products.filter(p=>(!category||p.category===category)&&terms.every(t=>normalized(productLabel(p)).includes(t)));
  const limited=matches.slice(0,60);
  const current=product(selected);
  if(current&&!limited.some(p=>p.id===current.id))limited.unshift(current);
  return limited;
}
function productSearchControls(key,index,selected,target=`product-${index}`) {
  const categories=[...new Set(state.products.map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'hu'));
  return `<div class="product-search form-grid">${field('Keresés név vagy termékkód alapján',`search-${index}`,val(key,`search-${index}`),`type="search" data-product-search="${esc(target)}" data-product-index="${esc(index)}" autocomplete="off" placeholder="Például Pepsi vagy 521"`)}${select('Termékcsoport',`category-${index}`,[['','Minden csoport'],...categories],val(key,`category-${index}`),`data-product-category="${esc(target)}" data-product-index="${esc(index)}"`)}</div><p class="small muted">A választó legfeljebb 60 találatot mutat. Névvel, kóddal vagy csoporttal szűkítheted.</p>`;
}
function refreshProductOptions(control) {
  const form=control.closest('form');
  const name=control.dataset.productSearch||control.dataset.productCategory;
  const index=control.dataset.productIndex||name.split('-').at(-1);
  const target=form.elements.namedItem(name);
  const current=target.value;
  const search=form.elements.namedItem(`search-${index}`)?.value||'';
  const category=form.elements.namedItem(`category-${index}`)?.value||'';
  target.innerHTML=option('','Válassz terméket',current)+matchingProducts(search,category,current).map(p=>option(p.id,productLabel(p),current)).join('');
}
function activeShift(location=actor.location) { return (state.shifts||[]).find(s=>s.location===location&&['open','counting'].includes(s.status)); }
function shiftSummary() {
  const shifts=(state.shifts||[]).filter(s=>s.status!=='closed'&&(actor.role==='manager'||s.location===actor.location));
  if(!shifts.length)return empty('Nincs megnyitott műszak.', 'A dolgozó a műszak kezdetén jelzi, melyik pult működik. Ezután követhető az elszámolás is.')+button('Műszak indítása','data-view="shifts"','secondary');
  return `<ul class="record-list">${shifts.map(s=>`<li><strong>${esc(s.location)}</strong><p>${esc(s.assigneeName||s.assigneeId||'Nincs kijelölt átvevő')}${s.deputyName?` · helyettes: ${esc(s.deputyName)}`:''}</p><p><span class="badge ${s.status==='open'?'pending':''}">${({open:'Működő pult · elszámolás még nincs',counting:'Számolás folyamatban · árumozgás szünetel',submitted:'Elszámolás leadva · ellenőrzésre vár'})[s.status]||esc(s.status)}</span></p><p class="small muted">Műszak kezdete: ${timeTag(s.openedAt,true)}</p>${button('Műszak megnyitása',`data-shift-id="${s.id}"`,'secondary')}</li>`).join('')}</ul>`;
}
function eligibleUsers(location) { return session.users.filter(u=>u.role==='receiver'&&u.location===location); }
function shiftsView() {
  const manager=actor.role==='manager';
  if(!manager&&WAREHOUSES.includes(actor.location))return heading('Ezen a helyen nincs pultműszak')+empty('Raktári leltárt a raktárfelelős indít.','A pultműszakok a működő vendégtéri helyek elszámolását követik.');
  const places=LOCATIONS.filter(l=>!WAREHOUSES.includes(l));
  const location=manager?val('shift-open-form','location',places[0]):actor.location;
  const current=activeShift(location);
  const users=eligibleUsers(location);
  let out=heading('Műszakok és átvevők','A műszak kezdetén jelöld a működő pultot és azt, aki az árut ellenőrzi. A nyitott ügyek műszakátadáskor is megmaradnak.');
  if(current)return out+`<section class="panel"><h2>${esc(location)} műszakja már nyitva van</h2><p>Átvevő: ${esc(current.assigneeName||current.assigneeId)}</p>${button('Megnyitom a műszakot',`data-shift-id="${current.id}"`)}</section>`+(manager?shiftOpenForm(location,places,users,true):'')+shiftSummary();
  return out+shiftOpenForm(location,places,users,manager)+shiftSummary();
}
function shiftOpenForm(location,places,users,manager) {
  return `<section class="panel"><h2>Műszak indítása</h2><form id="shift-open-form">${manager?select('Melyik pult működik?','location',places,location):`<p><strong>${esc(location)}</strong></p><input type="hidden" name="location" value="${esc(location)}">`}${manager?select('Kijelölt átvevő','assigneeId',users.map(u=>[u.id,u.name]),val('shift-open-form','assigneeId',users[0]?.id||''),'required'):`<input type="hidden" name="assigneeId" value="${esc(actor.id)}"><p>Kijelölt átvevő: <strong>${esc(actor.name)}</strong></p>`}${select('Helyettes, ha van','deputyId',[['','Nincs megadva'],...users.filter(u=>manager||u.id!==actor.id).map(u=>[u.id,u.name])],val('shift-open-form','deputyId'))}${submit('Műszak indítása')}</form></section>`;
}
function shiftDetailView() {
  const s=(state.shifts||[]).find(x=>x.id===selectedId);
  if(!s)return heading('A műszak nem található');
  const canManage=actor.role==='manager'||(actor.location===s.location&&[s.assigneeId,s.deputyId].includes(actor.id));
  const users=eligibleUsers(s.location);
  let out=heading(`${s.location} műszakja`,`Kezdete: ${timeLabel(s.openedAt)}`)+`<section class="panel"><h2>Kijelölt átvevő: ${esc(s.assigneeName||s.assigneeId)}</h2><p>Helyettes: ${esc(s.deputyName||'Nincs megadva')}</p><p>${({open:'Az elszámolást még nem kezdték el.',counting:'A számolás folyamatban van.',submitted:'Az elszámolást leadták, ellenőrzésre vár.',closed:'A műszak elszámolását ellenőrizték.'})[s.status]}</p>${s.countId?button('Elszámolás megnyitása',`data-count-id="${s.countId}"`,'secondary'):canManage&&actor.role==='receiver'?button('Megkezdem a műszakzáró számolást','data-view="count"'):''}</section>`;
  if(canManage&&['open','counting'].includes(s.status))out+=`<details open><summary>Műszak átadása másik dolgozónak</summary><p>Az átadások és a félbehagyott számolás megmaradnak. A következő dolgozó a saját nevével lép be.</p><form id="shift-handover-form">${select('Új kijelölt átvevő','assigneeId',users.map(u=>[u.id,u.name]),val(`handover-${s.id}`,'assigneeId',s.assigneeId),'required')}${select('Helyettes','deputyId',[['','Nincs megadva'],...users.map(u=>[u.id,u.name])],val(`handover-${s.id}`,'deputyId',s.deputyId||''))}${reason(`handover-${s.id}`,'Miért és kinek adod át a műszakot?')}${submit('Műszakátadás ellenőrzése')}</form></details>`;
  if(s.handoverHistory?.length)out+=`<details><summary>Korábbi műszakátadások</summary><ul class="record-list">${s.handoverHistory.map(h=>`<li>${esc(h.reason||'Műszakátadás')}${h.at?` · ${timeTag(h.at)}`:''}</li>`).join('')}</ul></details>`;
  return out;
}
function loginView() {
  const users=session.users;
  return heading('Ki használja a tabletet?','Válaszd ki a saját nevedet, majd add meg a személyes PIN-kódodat.')+`<section class="panel login-panel"><form id="login-form">${select('Dolgozó','userId',[['','Válassz dolgozót'],...users.map(u=>[u.id,`${u.name} · ${u.role==='manager'?'Raktárfelelős':u.location}`])],loginSuggestion,'required')}${field('Személyes PIN-kód','pin','','type="password" inputmode="numeric" autocomplete="off" minlength="4" maxlength="12" required')}${submit('Belépek')}</form><p class="small muted login-test-note">Tesztfelhasználók. A kipróbáláshoz használható PIN: <strong>${esc(session.testPin||'1234')}</strong>. Ezek nem a kollégák valódi belépési adatai.</p></section>`;
}
function countReviewTable(count,actual,onlyDifferences=false) {
  const rows=Object.entries(count.expected).filter(([id,n])=>!onlyDifferences||Math.abs(actual[id]-n)>=1e-6);
  if(!rows.length)return '<p>A megszámolt mennyiségek egyeznek a számolás kezdeti nyilvántartásával. Nincs átvezetendő mennyiségi eltérés.</p>';
  return `<div class="table-wrap"><table id="count-review-table"><caption>${onlyDifferences?'Ellenőrzött mennyiségi eltérések':'Leadandó megszámolt mennyiségek'}</caption><thead><tr><th>Termék</th><th>Nyilvántartás a számoláskor</th><th>Megszámolt</th><th>Eltérés</th></tr></thead><tbody>${rows.map(([id,n])=>{const delta=actual[id]-n;const p={...product(id),...(count.productSnapshots?.[id]||{})};return `<tr data-product-id="${esc(id)}"><th scope="row">${esc(productLabel(p))}</th><td>${countAmount(count,id,n)}</td><td>${countAmount(count,id,actual[id])}</td><td>${Math.abs(delta)<1e-6?'Egyezik':`${delta>0?'+':''}${countAmount(count,id,delta)}`}</td></tr>`;}).join('')}</tbody></table></div>`;
}
function actionSummary(action) {
  let text=`<p><strong>Rögzíti:</strong> ${esc(actor.name)} · ${esc(actor.role==='manager'?'Raktárfelelős':actor.location)}</p>`;
  if(action.from)text+=`<p><strong>Áru útja:</strong> ${esc(action.from)} → ${esc(action.to)}</p>`;
  if(action.supplier)text+=`<p><strong>Beszállító:</strong> ${esc(action.supplier)} · ${esc(action.document)}</p>`;
  if(action.lines)text+=`<ul class="review-lines">${action.lines.map(l=>`<li><strong>${esc(productLabel(product(l.productId)))}</strong><span>${fmt(l.quantity)} ${esc(unitLabel(l.unit))} = ${amount(l.productId,convertQuantity(product(l.productId),l.quantity,l.unit))}${l.destination?` → ${esc(l.destination)}`:''}</span></li>`).join('')}</ul>`;
  if(action.received){const m=state.moves.find(x=>x.id===action.id);text+=`<p><strong>Ügy:</strong> ${m?esc(moveReference(m)):esc(action.id)}</p><ul class="review-lines">${action.received.map((n,i)=>`<li>${esc(lineName(m.lines[i]))}: <strong>${amount(m.lines[i].productId,n)}</strong></li>`).join('')}</ul>`;}
  if(action.productId)text+=`<p><strong>Termék:</strong> ${esc(productLabel(product(action.productId)))} · ${fmt(action.quantity)} ${esc(unitLabel(action.unit))}</p>`;
  if(action.type==='WASTE_APPROVE'){const w=state.waste.find(x=>x.id===action.id);text+=`<p>${esc(w.location)} · ${esc(productLabel(product(w.productId)))} · ${amount(w.productId,w.baseQuantity)}</p><p>${esc(w.reason)}</p>`;}
  if(action.type==='COUNT_APPROVE'||action.type==='COUNT_SUBMIT') {
    const count=state.counts.find(c=>c.id===action.id);
    const isApproval=action.type==='COUNT_APPROVE';
    text+=`<p><strong>A számolás helye:</strong> ${esc(count.location)}</p>`;
    text+=isApproval?`<p><strong>Döntés:</strong> ${action.adjustment==='apply'?'Az alábbi kimutatott eltéréseket átvezetem a jelenlegi készlethez képest.':'További készletváltoztatás nélkül zárom le; az alábbi eltéréseket nem könyvelem újra.'}</p>`:`<p>${Object.keys(action.actual).length} termék megszámolt mennyiségét adod le. A készletet ez még nem javítja.</p>`;
    text+=countReviewTable(count,isApproval?count.actual:action.actual,isApproval);
  }
  if(action.type==='ADD_PRODUCT')text+=`<p><strong>${esc(action.name)}</strong> · ${esc(action.sourceCode||'Új teszttermék')} · ${esc(unitLabel(action.baseUnit))}</p><p>1 ${esc(action.packUnit)} = ${fmt(action.packSize)} ${esc(unitLabel(action.baseUnit))}</p>`;
  if(action.type==='COUNT_INCLUDE_PRODUCTS')text+=`<p>A számolásba felveszed: ${action.productIds.map(id=>esc(productLabel(product(id)))).join(', ')}. A nyilvántartott mennyiség külön megmarad.</p>`;
  if(action.type==='MOVE_RESOLVE'){const m=state.moves.find(x=>x.id===action.id);text+=`<p>${esc(moveReference(m))}: a fennmaradó áru helye <strong>${esc(action.resolution==='source'?m.from:m.to)}</strong>.</p>`;}
  if(action.location)text+=`<p><strong>Hely:</strong> ${esc(action.location)}</p>`;
  if(action.assigneeId)text+=`<p><strong>Átvevő:</strong> ${esc(session.users.find(u=>u.id===action.assigneeId)?.name||action.assigneeId)}</p>`;
  if(action.deputyId)text+=`<p><strong>Helyettes:</strong> ${esc(session.users.find(u=>u.id===action.deputyId)?.name||action.deputyId)}</p>`;
  if(action.reason)text+=`<p><strong>Indok:</strong> ${esc(action.reason)}</p>`;
  if(action.type==='MOVE_CANCEL')text+='<p>Az áru még a kiadó helyen van. Visszavonáskor ott ismét elérhető lesz; a korábbi bejegyzés megmarad.</p>';
  if(action.type==='COUNT_CANCEL')text+='<p>A számolást megszakítod. A készlet nem változik, az árumozgás újra engedélyezett lesz.</p>';
  return text;
}
function reviewView() {
  if(!review)return heading('Nincs ellenőrzendő művelet')+button('Vissza az áttekintéshez','data-view="home"');
  return heading('Ellenőrzés rögzítés előtt','Még nem történt készletmódosítás. Nézd át a helyeket, a termékeket és a mennyiségeket.')+`<section id="review-panel" class="panel">${actionSummary(review.action)}<div class="actions">${button('Ellenőriztem, rögzítem','data-action="confirm-review"')}${button('Vissza a javításhoz','data-action="edit-review"','secondary')}</div></section>`;
}
function lineEditor(kind,index) {
  const form=kind==='receipt'?'receipt-form':`move-${kind}`;
  const id=val(form,`product-${index}`);
  const p=product(id);
  const units=p?Object.keys(p.units):[];
  const currentUnit=val(form,`unit-${index}`,p?.baseUnit||'');
  const qty=val(form,`quantity-${index}`);
  return `<div class="line-item" data-line="${index}"><h3>${index+1}. termék</h3>${productSearchControls(form,index,id)}<div class="line-grid">${select('Termék',`product-${index}`,[['','Válassz terméket'],...matchingProducts(val(form,`search-${index}`),val(form,`category-${index}`),id).map(p=>[p.id,productLabel(p)])],id,'required')}${field('Mennyiség',`quantity-${index}`,qty,'type="number" min="0.000001" step="any" required')}${select('Mértékegység',`unit-${index}`,units.length?units.map(u=>[u,unitLabel(u)]):[['','Előbb válassz terméket']],currentUnit,'required')}</div><p class="line-summary" data-line-summary>Válaszd ki az árut és a mennyiséget.</p>${kind==='receipt'?`<div class="line-destination">${select('Ebbe a raktárba kerül',`destination-${index}`,LOCATIONS,val(form,`destination-${index}`,'Italraktár'))}</div>${check(`checked-${index}`,'A terméket és az átvett mennyiséget ellenőriztem.',true,Boolean(val(form,`checked-${index}`)))}`:''}</div>`;
}
function receiptView() {
  let out=heading('Áru átvétele a beszállítótól','A raktárfelelős ellenőrzi az árut és a szállítólevelet, majd megadja a tényleges célraktárt.');
  if(actor.role!=='manager')return out+guard('manager');
  out+=`<div class="notice"><p>Ebben a bemutatóban kézzel adod meg a szállítólevél tételeit. A tervezett fotózás és gépi kiolvasás még nem működik.</p></div><section class="panel"><form id="receipt-form"><div class="form-grid">${field('Beszállító','supplier',val('receipt-form','supplier'),'required maxlength="80" placeholder="Beszállító neve"')}${field('Szállítólevél száma','document',val('receipt-form','document'),'required maxlength="80" placeholder="A papíron szereplő szám"')}</div><p class="muted">A konyhai lerakodás helyett a soroknál azt válaszd ki, ahol az áru készleten lesz.</p>${Array.from({length:lineCounts.receipt},(_,i)=>lineEditor('receipt',i)).join('')}<div class="actions">${button('Másik termék hozzáadása','data-action="add-line"','secondary')}${lineCounts.receipt>1?button('Utolsó sor törlése','data-action="remove-line"','secondary'):''}</div><div class="actions">${submit('Bevételezés ellenőrzése')}</div></form></section><details><summary>Nem találom a terméket a listában</summary><p>Előbb ellenőrizd, nincs-e más néven. Itt új terméket vehetsz fel a bemutató közös listájába.</p><form id="product-form"><div class="form-grid">${field('Termék neve','name',val('product-form','name'),'required maxlength="80"')}${field('Termékkód, ha ismert','sourceCode',val('product-form','sourceCode'),'maxlength="60"')}${field('Termékcsoport','category',val('product-form','category'),'maxlength="80"')}${select('Alapegység','baseUnit',[['db','darab'],['kg','kg'],['l','liter'],['adag','adag'],['zacskó','zacskó']],val('product-form','baseUnit','db'))}${field('Kiszerelés neve','packUnit',val('product-form','packUnit'),'required maxlength="30" placeholder="Például karton"')}${field('Ennyi alapegység van egy kiszerelésben','packSize',val('product-form','packSize'),'type="number" min="0.000001" step="any" required')}</div>${check('countInShift','Pultelszámolásban szereplő ital vagy italalapanyag.',false,Boolean(val('product-form','countInShift')))}${submit('Új termék felvétele')}</form></details>`;
  return out;
}
function moveCreateView() {
  const kind=view==='return'?'return':'issue';
  const key=`move-${kind}`;
  const from=val(key,'from',kind==='return'?'Csárda pult':'Fő raktár');
  const to=val(key,'to',kind==='return'?'Italraktár':'Csárda pult');
  let out=heading(formTitles[kind],kind==='return'?'A raktárfelelős átveszi a maradékot. A visszaadó hely felelőse ezután igazolja a mennyiséget.':'A raktárfelelős elindítja az átadást. Az átvevő helyen tényleges számolás után igazolják az árut.');
  if(actor.role!=='manager')return out+guard('manager');
  return out+`<section class="panel"><form id="move-form" data-kind="${kind}">${val(key,'correctsMoveId')?`<input type="hidden" name="correctsMoveId" value="${esc(val(key,'correctsMoveId'))}"><div class="notice warning"><p>Korábbi átadás helyesbítése. Az eredeti ügy megmarad; most a ténylegesen szükséges vissza- vagy továbbmozgatást rögzíted.</p></div>${reason(key,'Miért szükséges a helyesbítés?')}`:''}<div class="form-grid">${select(kind==='return'?'Honnan hozták vissza?':'Melyik helyről adod ki?','from',LOCATIONS,from)}${select(kind==='return'?'Hová veszed vissza?':'Melyik hely kapja?','to',LOCATIONS,to)}</div><div id="move-backlog">${moveBacklog(from,to,kind)}</div>${Array.from({length:lineCounts[kind]},(_,i)=>lineEditor(kind,i)).join('')}${kind==='return'?'<p class="muted">A bontatlan palackot és a bontott maradékot külön sorba írd: például üvegben, illetve literben vagy deciliterben.</p>':''}<div class="actions">${button('Másik termék hozzáadása','data-action="add-line"','secondary')}${lineCounts[kind]>1?button('Utolsó sor törlése','data-action="remove-line"','secondary'):''}</div><div class="actions">${submit('Tételek ellenőrzése rögzítés előtt')}</div></form></section>`;
}
function record(list) { return list.find(r=>String(r.id)===String(selectedId)); }
function moveDetailView() {
  const m=record(state.moves);
  if(!m)return heading('Az átadás nem található')+button('Vissza a feladatokhoz','data-view="home"');
  const place=confirmationLocation(m);
  const mayConfirm=actor.role==='receiver'&&actor.location===place;
  let out=heading(m.kind==='return'?'Visszavét igazolása':'Áru átvételének igazolása',`${m.from} → ${m.to}`)+`<div class="status-line"><span id="move-status" data-move-id="${m.id}" data-status="${m.status}" class="badge ${m.status==='done'?'':'pending'}">${esc(stateLabel(m.status))}</span><span>${m.kind==='return'?'Visszavét':'Átadás'} ${esc(moveReference(m))}</span></div><div id="move-timing" class="transfer-time detail-time" data-transfer-timing="${m.id}" data-detail="true">${transferTimeContent(m,true)}</div><p class="next-step">${['done','cancelled'].includes(m.status)?'Az ügy lezárult, nincs további igazolási feladat.':esc(nextStep(m))}</p>`;
  if(m.correctsMoveId){const original=state.moves.find(x=>x.id===m.correctsMoveId);out+=`<p class="notice warning">Helyesbítő mozgás: ${original?esc(moveReference(original)):esc(m.correctsMoveId)}. Az eredeti ügy változatlanul megmaradt.</p>`;}
  out+=`<div class="table-wrap"><table><caption>Az átadás tételei</caption><thead><tr><th>Termék</th><th>Rögzített mennyiség</th><th>Igazolt</th><th>Még nyitott</th></tr></thead><tbody>${m.lines.map(l=>`<tr><td>${esc(lineName(l))}</td><td>${fmt(l.quantity)} ${esc(unitLabel(l.unit))}</td><td>${lineAmount(l,l.received)}</td><td>${lineAmount(l,l.pending)}</td></tr>`).join('')}</tbody></table></div>`;
  if(m.status==='pending') {
    if(mayConfirm&&!WAREHOUSES.includes(actor.location)&&!activeShift())out+=`<div class="notice warning"><p>Az átvétel előtt indítsd el a pult műszakját a saját neveddel.</p>${button('Műszak indítása','data-view="shifts"','secondary')}</div>`;
    if(!mayConfirm)out+=`<section class="panel"><h2>${esc(place)} visszaigazolására vár</h2><p>A raktárfelelős már rögzítette az árut. Most a ${esc(place)} kijelölt felelőse ellenőrzi a mennyiséget.</p><p class="muted small">A kipróbáláshoz beléphetsz az átvevő saját tesztfiókjával:</p>${button(`${place} átvevőjének belépése`,`data-open-tablet="${esc(place)}"`)}</section>`;
    else out+=`<section class="panel"><h2>${m.kind==='return'?'Mennyit adtatok vissza?':place===m.from?'Mennyit adtatok át?':'Mennyit kaptatok meg?'}</h2><p>A ténylegesen ellenőrzött mennyiséget írd be. Ha kevesebb, a különbözetet a raktárfelelőssel kell tisztázni.</p><form id="move-receive-form">${m.lines.map((l,i)=>field(`${i+1}. ${lineName(l)} — rögzítve: ${fmt(l.quantity)} ${unitLabel(l.unit)}; igazolt mennyiség (${unitLabel(l.productSnapshot?.baseUnit||product(l.productId).baseUnit)})`,`received-${i}`,val(`receive-${m.id}`,`received-${i}`),`type="number" min="0" max="${l.baseQuantity}" step="${product(l.productId).baseUnit==='db'?'1':'any'}" required`)).join('')}${submit(m.kind==='return'?'Visszaadott mennyiség igazolása':'Átvett mennyiség igazolása')}</form></section>`;
  } else if(m.status==='discrepancy') {
    out+=`<div class="notice warning"><p>Az igazolt áru már átkerült a fogadó hely készletéhez. A nyitott különbözet nem lett selejt; tisztázni kell, hol van.</p></div>`;
    if(actor.role!=='manager')out+=guard('manager');
    else out+=`<section class="panel"><h2>Egyeztetés az átvevővel</h2><form id="move-resolve-form">${select('Hol van a fennmaradó áru?','resolution',[['source',`A kiadó helyen: ${m.from}`],['destination',`Az átvevő is igazolta: ${m.to}`]],val(`resolve-${m.id}`,'resolution','source'))}${reason(`resolve-${m.id}`,'Mit egyeztettetek, mi derült ki?')}${submit('Eltérés rendezése')}</form></section>`;
  } else if(m.status==='cancelled')out+=`<section class="panel"><h2>A kiadást visszavonták.</h2><p>Az el nem vitt áru visszakerült a kiadó hely elérhető készletébe.</p><p>${esc(m.cancellationReason)}</p></section>`;
  else out+=`<section class="panel"><h2>${m.kind==='return'?'A visszavét lezárult.':'Az átadás lezárult.'}</h2><p>A kiadott és igazolt mennyiségek szerepelnek a közös készletben.</p>${m.reason?`<p><strong>Egyeztetés:</strong> ${esc(m.reason)}</p>`:''}<div class="actions">${button('Megnézem a készletet','data-view="stock"')}${button('Vissza a feladataimhoz','data-view="home"','secondary')}</div></section>`;
  if(m.status==='pending'&&actor.role==='manager')out+=`<details><summary>Téves kiadás, az áru még a kiadó helyen van</summary><p>Csak akkor vond vissza, ha az áru ténylegesen nem indult el. Az eredeti bejegyzés és az indok megmarad.</p><form id="move-cancel-form">${reason(`cancel-${m.id}`,'Miért vonod vissza?')}${check('physicalStillAtSource','Ellenőriztem: az összes áru még a kiadó helyen van.')}${submit('Visszavonás ellenőrzése')}</form></details>`;
  if(m.status==='done'&&actor.role==='manager')out+=`<details><summary>Lezárt átadás helyesbítése</summary><p>Ha az árut vissza kell vinni vagy másik helyre kell mozgatni, új, az eredetihez kapcsolt mozgást indíts. A tényleges mennyiséget az új átvevő igazolja.</p>${button('Helyesbítést indítok',`data-correct-move="${m.id}"`,'secondary')}</details>`;
  return out;
}
function stockView() {
  const loc=stockLocation;
  const pending=state.moves.filter(m=>!['done','cancelled'].includes(m.status)&&(m.from===loc||m.to===loc));
  const categories=[...new Set(state.products.map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'hu'));
  let out=heading('Készlet','Kereshetsz név, termékkód vagy csoport alapján. A termékek között a beküldött PDF nyomtatott tételei is szerepelnek; a készletmennyiségek tesztadatok.')+`<div class="stock-toolbar"><div class="field"><label for="stock-location">Melyik hely készletét nézed?</label><select id="stock-location">${LOCATIONS.map(l=>option(l,l,loc)).join('')}</select></div><div class="field"><label for="stock-search">Keresés név vagy kód alapján</label><input type="search" id="stock-search" value="${esc(stockSearch)}" placeholder="Például Pepsi vagy 521"></div><div class="field"><label for="stock-category">Termékcsoport</label><select id="stock-category">${option('','Minden csoport',stockCategory)}${categories.map(c=>option(c,c,stockCategory)).join('')}</select></div></div><div class="table-wrap"><table id="stock-table"><caption>${esc(loc)} · elérhető tesztkészlet</caption><thead><tr><th>Termék / csoport</th><th>Kód</th><th>Mennyiség</th><th>Egység</th></tr></thead><tbody>${state.products.map(p=>`<tr data-product-id="${p.id}"${(!normalized(productLabel(p)).includes(normalized(stockSearch))||(stockCategory&&p.category!==stockCategory))?' hidden':''}><th scope="row">${esc(p.name)}<span class="table-detail">${esc(p.category||'Általános mintatermék')}${p.needsReview?' · forrásadat ellenőrzendő':''}</span></th><td>${esc(p.sourceCode||'Minta')}</td><td data-quantity="${stockAt(state,loc,p.id)}">${fmt(stockAt(state,loc,p.id))}</td><td>${esc(unitLabel(p.baseUnit))}</td></tr>`).join('')}</tbody></table></div>`;
  if(pending.length)out+=`<section><h2>Külön követett, még nyitott mennyiségek</h2><p>Az elindított áru a kiadó hely elérhető készletében már nem szerepel. A fogadóhoz a ténylegesen igazolt mennyiség kerül.</p><ul class="record-list">${pending.map(m=>`<li><strong>${esc(moveReference(m))} · ${esc(m.from)} → ${esc(m.to)}</strong><p>${m.lines.filter(l=>l.pending>0).map(l=>`${esc(lineName(l))}: ${lineAmount(l,l.pending)}`).join(', ')} · ${esc(stateLabel(m.status))}</p>${button('Átadás megnyitása',`data-move-id="${m.id}"`,'secondary')}</li>`).join('')}</ul></section>`;
  out+=`<details class="demo-controls"><summary>Hogyan jelenik meg a kasszás fogyás?</summary><p>Az eladás az r_keeperben történik. Az app a StoreHouse-ban már elszámolt fogyást követi; ugyanazt nem vonhatja le újra.</p><p>Az alábbi tesztlépés 2 kóla és 3 ásványvíz fogyását mutatja a Csárda pultnál, és 0,36 kg húsét a Konyhán. Kitalált kasszaadat, valódi kapcsolat nélkül.</p>${actor.role==='manager'?button(state.appliedSales.includes('demo-sales-1')?'Ugyanennek a tesztadatnak az ismétlése':'Kasszás fogyás tesztje','id="demo-sales" data-action="sales"','secondary'):''}</details>`;
  return out;
}
function wasteView() {
  let out=heading('Selejt jelzése',`${actor.location} · a jelentést a raktárfelelős ellenőrzi, és csak utána véglegesíti.`);
  if(actor.role!=='receiver')return out+guard('receiver');
  if(!WAREHOUSES.includes(actor.location)&&!activeShift())return out+`<div class="notice warning"><p>A selejtjelentés a pult működő műszakjához tartozik. Először indíts műszakot a saját neveddel.</p>${button('Műszak indítása','data-view="shifts"')}</div>`;
  const p=product(val('waste-form','productId'));
  return out+`<section class="panel"><form id="waste-form">${productSearchControls('waste-form','waste',p?.id||'','productId')}${select('Melyik termékkel történt?','productId',[['','Válassz terméket'],...matchingProducts(val('waste-form','search-waste'),val('waste-form','category-waste'),p?.id||'').map(p=>[p.id,productLabel(p)])],p?.id||'','required')}<div class="form-grid">${field('Selejtes mennyiség','quantity',val('waste-form','quantity'),'type="number" min="0.000001" step="any" required')}${select('Mértékegység','unit',p?Object.keys(p.units).map(u=>[u,unitLabel(u)]):[['','Előbb válassz terméket']],val('waste-form','unit',p?.baseUnit||''),'required')}</div>${reason('waste-form','Mi történt az áruval?')}${submit('Selejtjelentés elküldése')}</form></section>`;
}
function wasteDetailView() {
  const w=record(state.waste);
  if(!w)return heading('A jelentés nem található');
  let out=heading('Selejtjelentés',w.location)+`<div id="waste-status" data-waste-id="${w.id}" data-status="${w.status}" class="badge ${w.status==='done'?'':'pending'}">${w.status==='done'?'Ellenőrizve és véglegesítve':'Raktárfelelősi ellenőrzésre vár'}</div><section class="panel" style="margin-top:20px"><h2>${esc(productLabel(product(w.productId)))} · ${amount(w.productId,w.baseQuantity)}</h2><p><strong>Indok:</strong> ${esc(w.reason)}</p>`;
  if(w.status==='pending')out+=actor.role==='manager'?`<form id="waste-approve-form">${check('reviewed','Ellenőriztem a mennyiséget és a selejt okát.')}${submit('Ellenőrzött selejt véglegesítése')}</form>`:`<p>A jelentés még nem csökkentette a készletet.</p>${guard('manager')}`;
  else out+=`<p>A selejt mennyisége levonásra került a közös készletből.</p>${button('Készlet megnyitása','data-view="stock"','secondary')}`;
  return out+'</section>';
}
function countStartView() {
  const manager=actor.role==='manager';
  if(!manager&&WAREHOUSES.includes(actor.location))return heading('Raktári vagy konyhai leltár','Ezen a helyen a raktárfelelős indít leltárt szükség szerint.')+guard('manager');
  const loc=manager?val('count-start-form','location',WAREHOUSES.includes(actor.location)?actor.location:'Italraktár'):actor.location;
  const kind=manager?val('count-start-form','kind','full'):'shift';
  if(!manager&&!activeShift())return heading('Először indíts műszakot','A pult elszámolása a kijelölt átvevő műszakjához tartozik.')+button('Műszak indítása','data-view="shifts"');
  return heading(manager?'Raktári leltár indítása':'Műszakvégi elszámolás',manager?'Teljes készletet vagy néhány kiválasztott terméket is ellenőrizhetsz.':'Minden műszak végén számold meg a pultnál maradt italokat.')+`<section class="panel"><form id="count-start-form">${manager?`<div class="form-grid">${select('Hol számolsz?','location',WAREHOUSES,loc)}${select('Mit számolsz meg?','kind',[['full','Az összes terméket'],['partial','Csak kiválasztott termékeket']],kind)}</div>`:`<p><strong>Hely: ${esc(loc)}</strong></p><input type="hidden" name="location" value="${esc(loc)}"><input type="hidden" name="kind" value="shift">`}<fieldset id="count-products"${kind!=='partial'?' hidden':''}><legend>Melyik termékeket?</legend><div class="field"><label for="count-search">Keresés a termékek között</label><input id="count-search" type="search"></div>${state.products.map(p=>`<label class="check" data-product-id="${p.id}"><input type="checkbox" name="productIds" value="${p.id}"${(drafts['count-start-form']?.productIds||[]).includes(p.id)?' checked':''}>${esc(productLabel(p))}</label>`).join('')}</fieldset>${check('paused','Ezen a helyen a számolás idejére leállítottuk a kiadást és az árumozgást.')}<p class="muted">A nyitott ügyek mellett is leadhatod a számolást. Ilyenkor az összehasonlítás előzetes; a raktárfelelős a nyitott ügyeket is tisztázza.</p>${submit('Számolás indítása')}</form></section>`;
}
function bottleHelp(p,c) {
  if(!p.bottleReference)return '';
  const r=p.bottleReference;
  return `<details><summary>Palackszámból és mérlegelésből számolok</summary><p class="small">Kitalált palackadatok ehhez a bemutatóhoz: üres ${r.emptyGrams} g, teli ${r.fullGrams} g, ${r.volumeMl} ml. Valódi méréshez ezeket ne használd.</p>${field('Bontatlan palackok száma',`closed-${p.id}`,val(`count-${c.id}`,`closed-${p.id}`,0),'type="number" min="0" step="1"')}<div class="field"><label for="weights-${p.id}">Bontott palackok mért súlya, grammban</label><textarea id="weights-${p.id}" name="weights-${p.id}" placeholder="Palackonként egy sor. Ha nincs bontott palack, hagyd üresen.">${esc(val(`count-${c.id}`,`weights-${p.id}`))}</textarea></div>${button('Kiszámolom és beírom az összes litert',`data-bottle-product="${p.id}"`,'secondary')}<p class="small muted" style="margin-top:12px">A számítás az adott palack súlyából határozza meg a maradékot; a grammot nem tekinti milliliternek.</p></details>`;
}
function countCancelSection(c) {
  return `<details><summary>Félbehagyott számolás megszakítása</summary><p>A készlet nem változik. A számolás lezárul, és a helyen újra lehet árut mozgatni. ${c.kind==='shift'?'A kötelező műszakelszámolást később pótolni kell.':'Később új leltárt indíthatsz.'}</p><form id="count-cancel-form">${reason(`count-cancel-${c.id}`,'Miért szakítod meg a számolást?')}${submit('Megszakítás ellenőrzése')}</form></details>`;
}
function countIncludeSection(c) {
  const selected=val('count-include-form','product-include');
  return `<details><summary>Más terméket is találtam</summary><p>Ha a polcon olyan áru is van, ami nem szerepel a számolandó listán, vedd fel ide. A nulla várt készlet is látható marad; a tényleges mennyiséget ezután írd be.</p><form id="count-include-form">${productSearchControls('count-include-form','include',selected)}${select('Talált termék','product-include',[['','Válassz terméket'],...matchingProducts(val('count-include-form','search-include'),val('count-include-form','category-include'),selected).filter(p=>!Object.hasOwn(c.expected,p.id)).map(p=>[p.id,productLabel(p)])],selected,'required')}${submit('Termék hozzáadása a számoláshoz')}</form></details>`;
}
function countDetailView() {
  const c=record(state.counts);
  if(!c)return heading('A számolás nem található');
  if(c.status==='cancelled')return heading('A számolást megszakították',c.location)+`<section class="panel"><p>${esc(c.cancellationReason)}</p><p>A készlet nem változott, az árumozgás újra engedélyezett. ${c.kind==='shift'?'A műszak elszámolása továbbra is szükséges.':'Szükség esetén később új leltárt indíthatsz.'}</p>${button('Vissza az áttekintéshez','data-view="home"')}</section>`;
  const owner=c.kind==='shift'?'receiver':'manager';
  const mayCount=actor.role===owner&&(owner==='manager'||actor.location===c.location);
  let out=heading(c.kind==='shift'?'Műszakvégi elszámolás':'Leltár',c.location)+`<div id="count-status" data-count-id="${c.id}" data-status="${c.status}" class="badge ${c.status==='done'?'':'pending'}">${c.status==='counting'?'Számolás folyamatban':c.status==='pending'?'Raktárfelelősi ellenőrzésre vár':'Ellenőrzés lezárva'}</div>`;
  if(!['done','cancelled'].includes(c.status)&&c.unresolvedAtStart?.length)out+=`<div class="notice warning" style="margin-top:20px"><p>A számolás kezdetén nyitott ügyek is voltak. Az eltérés egyelőre előzetes; a raktárfelelős ezekkel együtt ellenőrzi.</p></div>`;
  if(c.status==='counting'&&actor.role==='manager')out+=countCancelSection(c);
  if(c.status==='counting') {
    if(!mayCount)return out+`<div class="notice" style="margin-top:20px"><p>A számolást ${owner==='manager'?'a raktárfelelős':`${esc(c.location)} átvevője`} végzi.</p>${button('A számoló dolgozó belépése',owner==='manager'?'data-open-manager':`data-open-tablet="${esc(c.location)}"`,'secondary')}</div>`;
    return out+`<section class="panel" style="margin-top:20px"><h2>Mennyi van ténylegesen?</h2><p>Számold meg az árut, és minden sorban add meg a maradékot. A számolás leadása önmagában még nem javítja a nyilvántartást.</p><div class="field"><label for="count-search">Keresés a számolandó termékek között</label><input id="count-search" type="search"></div><p id="count-progress" class="small muted"></p><form id="count-submit-form">${Object.entries(c.expected).map(([id,n])=>{const p={...product(id),...(c.productSnapshots?.[id]||{})};return `<div class="count-row" data-product-id="${id}" data-expected="${n}"><h3>${esc(productLabel(p))}</h3><p class="muted">A nyilvántartás szerint a számolás kezdetén: ${countAmount(c,id,n)}</p>${field(`Összesen megszámolt mennyiség (${unitLabel(p.baseUnit)})`,`actual-${id}`,val(`count-${c.id}`,`actual-${id}`),`type="number" min="0" step="${p.baseUnit==='db'?'1':'any'}" required`)}${bottleHelp(p,c)}</div>`;}).join('')}${submit('Számolás leadása ellenőrzésre')}</form></section>${countIncludeSection(c)}`;
  }
  out+=`<div class="table-wrap"><table><caption>A leadott számolás eredménye</caption><thead><tr><th>Termék</th><th>Nyilvántartás a számoláskor</th><th>Megszámolt</th><th>Eltérés</th></tr></thead><tbody>${Object.entries(c.expected).map(([id,n])=>`<tr><th scope="row">${esc(productLabel({...product(id),...(c.productSnapshots?.[id]||{})}))}</th><td>${countAmount(c,id,n)}</td><td>${countAmount(c,id,c.actual[id])}</td><td>${Math.abs(c.actual[id]-n)<1e-6?'Egyezik':`${c.actual[id]>n?'+':''}${countAmount(c,id,c.actual[id]-n)}`}</td></tr>`).join('')}</tbody></table></div>`;
  if(c.status==='pending') {
    out+=`<p>A számolást leadták, de a nyilvántartott készlet még nem változott. A dolgozónak nem kell megvárnia az ellenőrzést.</p>`;
    if(actor.role!=='manager')out+=guard('manager');
    else out+=`<section class="panel"><h2>Raktárfelelősi ellenőrzés</h2><p>Ellenőrizd a számolást, az átadásokat és a kasszás fogyást. Egy korábban hibás bejegyzés javítását ne számold el még egyszer leltárkülönbözetként.</p><form id="count-approve-form">${select('Szükséges külön leltárjavítás?', 'adjustment', [['','Válassz az ellenőrzés eredménye alapján'],['apply','Igen, a kimutatott eltérést átvezetem'],['none','Nem, az eltérést már rendeztük vagy nem indokolt javítás']], val(`count-approve-${c.id}`,'adjustment'),'required')}${reason(`count-approve-${c.id}`)}${check('reviewed','A számolást és az eltérés okát ellenőriztem.')}${submit('Ellenőrzés lezárása, indokolt eltérés rendezése')}</form></section>`;
  } else out+=`<section class="panel"><h2>Az ellenőrzés lezárult.</h2><p>${esc(c.reason)}</p><p>${c.adjustment==='none'?'Az ügyet további készletváltoztatás nélkül zártad le.':'A jóváhagyott különbözet átvezetve a közös készletbe.'}</p>${button('Készlet megnyitása','data-view="stock"','secondary')}</section>`;
  const later=state.history.slice(c.historyStart??state.history.length).filter(h=>(h.changes||[]).some(x=>x.location===c.location));
  if(later.length)out+=`<details><summary>A számolás kezdete óta rögzített készletváltozások</summary><ul class="record-list">${later.map(h=>`<li><strong>${esc(h.summary)}</strong>${changeList(h.changes.filter(x=>x.location===c.location))}</li>`).join('')}</ul></details>`;
  return out;
}
function historyMatches(h) {
  const move=h.moveId?state.moves.find(m=>m.id===h.moveId):null;
  const places=new Set([h.location,h.actor?.location,move?.from,move?.to,...(h.changes||[]).map(c=>c.location)]);
  const text=normalized(`${h.summary} ${h.actor?.name||''} ${move?moveReference(move):''}`);
  const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(h.at));
  return (!historyFilters.search||text.includes(normalized(historyFilters.search)))&&(!historyFilters.location||places.has(historyFilters.location))&&(!historyFilters.status||move?.status===historyFilters.status)&&(!historyFilters.date||date===historyFilters.date);
}
function filterHistoryRows() {
  app.querySelectorAll('#history-list [data-history-id]').forEach(row=>{const h=state.history.find(h=>h.id===row.dataset.historyId);row.hidden=!historyMatches(h);});
}
function historyView() {
  const records=[...state.history].reverse();
  const rows=records.map(h=>{const move=h.moveId?state.moves.find(m=>m.id===h.moveId):null;return `<li data-history-id="${h.id}"${historyMatches(h)?'':' hidden'}><strong>${move?`${esc(moveReference(move))} · `:''}${esc(h.summary)}</strong><p class="muted small">${timeTag(h.at)} · ${esc(h.actor.name||h.actor.id||'Korábbi mintaszerep')} · ${h.actor.role==='manager'?'Raktárfelelős':`${esc(h.actor.location)} átvevője`}</p>${changeList(h.changes||[])}${move?button(`${moveReference(move)} részletei`,`data-move-id="${move.id}"`,'secondary'):''}</li>`;});
  return heading('Eddigi műveletek','Az eredeti bejegyzés, a személy, az időpont és a helyesbítés együtt visszakereshető.')+`<div class="history-toolbar form-grid"><div class="field"><label for="history-search">Keresés ügyre, dolgozóra vagy műveletre</label><input id="history-search" type="search" value="${esc(historyFilters.search)}"></div>${select('Hely','history-location',[['','Minden hely'],...LOCATIONS],historyFilters.location,'data-history-filter="location"')}${select('Átadás jelenlegi állapota','history-status',[['','Minden állapot'],['pending','Igazolásra vár'],['discrepancy','Eltérés'],['done','Lezárva'],['cancelled','Visszavonva']],historyFilters.status,'data-history-filter="status"')}${field('Nap (budapesti idő szerint)','history-date',historyFilters.date,'type="date" data-history-filter="date"')}</div>`+(records.length?`<ul id="history-list" class="record-list">${rows.join('')}</ul>`:empty('Még nincs rögzített művelet.','A kezdeti tesztkészlet után végzett változások itt jelennek meg.'));
}
function helpView() {
  return heading('Hogyan használd ezt a felületet?')+`<dl class="help-list"><dt>Saját belépés</dt><dd>A saját neveddel és PIN-kódoddal lépj be. Dolgozóváltáskor a felső „Másik dolgozó belépése” gombbal zárd le a jelenlegi belépést. A nyitott ügyek megmaradnak.</dd><dt>Áttekintés</dt><dd>Itt látod a különálló átadásokat, a késéseket, a műszakokat és az ellenőrzésre váró ügyeket.</dd><dt>Rögzítés előtt</dt><dd>A felület összefoglalja a helyeket és a tételeket. Csak az „Ellenőriztem, rögzítem” gomb küldi be a műveletet.</dd><dt>Piszkozat</dt><dd>A bevitelt a saját nevedhez mentjük. A mentés jelzi, hogy a közös rendszerben, ezen a készüléken vagy csak ebben az ablakban őrződik meg. Kapcsolat-visszatéréskor nincs automatikus készletkönyvelés.</dd><dt>Műszak</dt><dd>A ténylegesen működő pultnál indíts műszakot és jelöld az átvevőt. Műszakváltáskor add át a feladatot; a korábbi átadások továbbra is látszanak. A műszak végén számold meg a maradékot.</dd><dt>Téves kiadás</dt><dd>Ha az áru még nem indult el, a raktárfelelős indokkal visszavonhatja. Lezárt átadásnál új, az eredetihez kapcsolt helyesbítő mozgás szükséges; az előzmény nem törlődik.</dd></dl><details><summary>A termékek és a tesztkészlet eredete</summary><p>A termékek között szerepelnek a beküldött leltáríveken olvasható kódok, nevek és egységek. A régi papíros mennyiségeket nem vettük át. Minden induló készlet és a korábbi általános mintatermékek palackreferenciája kitalált tesztadat.</p><p>A nyomtatott termékkód még nem igazolt StoreHouse API-azonosító. Hiányzó karton- vagy palackátváltást nem találunk ki a névből; csak a termékhez megadott egységek választhatók.</p></details><details><summary>Mi működik most, és mi vár rendszerkapcsolatra?</summary><p>A rögzítés, ellenőrzés, névhez kötött előzmény és a műszakok a tesztüzemben kipróbálhatók. A közös kiszolgálós változat több készülék munkáját tárolja. Az önálló HTML helyi próba; a mentés lehetőségét mindig a felső állapot mutatja.</p><p>A valódi r_keeper / StoreHouse-kapcsolat, szállítólevél-fotókiolvasás és a helyszíni készlet még nincs bekötve. A kasszás fogyás később a meglévő rendszerből érkezik, ismételt levonás nélkül.</p></details><details><summary>Mit jelent a piros késési jelzés?</summary><p>A kiadástól számított 30 perc után a még nem igazolt ügy piros lesz. Ez nem jelent készlethiányt és nem igazolja automatikusan az árut. Részleges igazolás után a maradék raktárfelelősi eltérésrendezés.</p><p>A közös rendszerben a kiszolgáló órája adja az időpontokat. A kijelzés budapesti idő szerint történik.</p></details>${session.mode==='local'?`<details class="demo-controls"><summary>Késés kipróbálása várakozás nélkül</summary><p>A helyi tesztóra 31 perccel előrelép. Ez nem változtat készletet vagy igazolást.</p>${button('Helyi tesztóra: +31 perc','data-action="advance-demo-clock"','secondary')}</details><details class="demo-controls"><summary>A helyi teszt újrakezdése</summary><p>A helyi próba összes készletművelete és előzménye törlődik, és visszaáll a kezdeti tesztkészlet. A közös kiszolgálót ez nem érinti.</p><form id="reset-form">${check('confirmed','Törlöm a helyi teszt korábbi rögzítéseit.')}${submit('Helyi teszt újrakezdése')}</form></details>`:''}`;
}
const screens={login:loginView,review:reviewView,shifts:shiftsView,shiftDetail:shiftDetailView,home:homeView,receipt:receiptView,issue:moveCreateView,return:moveCreateView,move:moveDetailView,stock:stockView,waste:wasteView,wasteDetail:wasteDetailView,count:countStartView,countDetail:countDetailView,history:historyView,help:helpView};
function draftKey(form) {
  if(form.id==='move-form')return `move-${form.dataset.kind}`;
  if(form.id==='move-receive-form')return `receive-${selectedId}`;
  if(form.id==='move-resolve-form')return `resolve-${selectedId}`;
  if(form.id==='move-cancel-form')return `cancel-${selectedId}`;
  if(form.id==='count-submit-form')return `count-${selectedId}`;
  if(form.id==='count-approve-form')return `count-approve-${selectedId}`;
  if(form.id==='count-cancel-form')return `count-cancel-${selectedId}`;
  if(form.id==='shift-handover-form')return `handover-${selectedId}`;
  return form.id;
}
const draftWrites=new Map();
function remember(form,save=true) {
  if(!form||!session.authenticated||['login-form','reset-form'].includes(form.id))return;
  const data=new FormData(form);
  const key=draftKey(form);
  drafts[key]=Object.fromEntries(data);
  if(form.id==='count-start-form')drafts[key].productIds=data.getAll('productIds');
  if(form.id==='move-form')drafts[key]._lineCount=lineCounts[form.dataset.kind];
  if(form.id==='receipt-form')drafts[key]._lineCount=lineCounts.receipt;
  drafts[key]._view=view;
  drafts[key]._selectedId=selectedId;
  if(save){
    clearTimeout(draftTimers.get(key));
    draftMessage='Piszkozat mentése…';draftError=false;updateStatus();
    draftTimers.set(key,setTimeout(()=>{draftTimers.delete(key);persistDraft(key);},350));
  }
}
async function persistDraft(key) {
  if(!drafts[key]||!session.authenticated)return;
  const value=structuredClone(drafts[key]);
  const owner=actor.id;
  const work=(draftWrites.get(key)||Promise.resolve()).catch(()=>{}).then(async()=>{
    if(actor.id!==owner)return;
    try {
      const saved=await runtime.saveDraft(key,value);
      savedDrafts[key]=saved;
      draftMessage=saved.source==='server'?'Piszkozat mentve a közös rendszerben.':saved.source==='device'?'Piszkozat mentve ezen a készüléken.':'A piszkozat csak ebben az ablakban marad meg.';
      if(saved.unsynced)draftMessage+=' A kiszolgálóhoz még nem jutott el.';
      draftError=saved.source==='memory';
    }catch(error){draftMessage=`A piszkozat mentése nem sikerült. ${error.message}`;draftError=true;if(error.code==='DRAFT_CONFLICT'&&error.draft)savedDrafts[key]={...(savedDrafts[key]||{}),conflict:true,serverValue:error.draft.value,revision:error.draft.revision};}
    updateStatus();
  });
  draftWrites.set(key,work);
  await work;
}
async function flushDrafts() {
  const keys=[...draftTimers.keys()];
  for(const key of keys){clearTimeout(draftTimers.get(key));draftTimers.delete(key);persistDraft(key);}
  await Promise.allSettled([...draftWrites.values()]);
}
async function clearDraft(key) {
  if(!key)return;
  clearTimeout(draftTimers.get(key));draftTimers.delete(key);
  await (draftWrites.get(key)||Promise.resolve());
  delete drafts[key];delete savedDrafts[key];
  try{await runtime.deleteDraft(key);}catch{draftMessage='A művelet rögzítve. Egy másik eszköz piszkozatát megőriztük, vagy a törlését még ellenőrizni kell.';draftError=true;}
}
function restoreLineCounts() {
  for(const [kind,key] of [['receipt','receipt-form'],['issue','move-issue'],['return','move-return']]){
    const saved=drafts[key];
    const indexes=Object.keys(saved||{}).filter(k=>/^product-\d+$/.test(k)).map(k=>Number(k.split('-').at(-1)));
    lineCounts[kind]=Math.max(1,Number(saved?._lineCount)||0,...indexes.map(i=>i+1));
  }
}
function applySnapshot(snapshot) {
  if(!snapshot?.state)return;
  state=snapshot.state;revision=snapshot.revision;actor=snapshot.actor||actor;connection=snapshot.connection||{};
  session.authenticated=!!snapshot.actor;
  connectionError='';
}
function draftVersionSummary(value={}) {
  const rows=[];
  if(value.from||value.to)rows.push(['Áru útja',`${value.from||'—'} → ${value.to||'—'}`]);
  if(value.supplier||value.document)rows.push(['Bevételezés',[value.supplier,value.document].filter(Boolean).join(' · ')]);
  if(value.location)rows.push(['Hely',value.location]);
  for(const key of Object.keys(value).filter(k=>/^product-\d+$/.test(k))){
    const i=key.split('-').at(-1),p=product(value[key]);
    if(p)rows.push([productLabel(p),`${value[`quantity-${i}`]||'—'} ${unitLabel(value[`unit-${i}`]||p.baseUnit)}${value[`destination-${i}`]?` → ${value[`destination-${i}`]}`:''}`]);
  }
  for(const key of Object.keys(value).filter(k=>k.startsWith('actual-'))){const p=product(key.slice(7));if(p&&value[key]!=='')rows.push([productLabel(p),`${value[key]} ${unitLabel(p.baseUnit)}`]);}
  if(value.productId)rows.push([productLabel(product(value.productId)),`${value.quantity||'—'} ${unitLabel(value.unit||'')}`]);
  if(value.name)rows.push(['Termék',`${value.name} · ${unitLabel(value.baseUnit||'')}`]);
  if(value.assigneeId)rows.push(['Átvevő',session.users.find(u=>u.id===value.assigneeId)?.name||value.assigneeId]);
  if(value.reason)rows.push(['Indok',value.reason]);
  if(!rows.length)rows.push(['Bevitel','A piszkozatot ellenőrizni kell a kiválasztott változat betöltése után.']);
  return `<dl class="draft-compare-values">${rows.map(([label,text])=>`<dt>${esc(label)}</dt><dd>${esc(text)}</dd>`).join('')}</dl>`;
}
function updateDraftConflict() {
  const section=document.querySelector('#draft-conflict');
  const form=app.querySelector('form:not(#login-form)');
  const key=review?.key||(form?draftKey(form):null);
  const saved=key?savedDrafts[key]:null;
  section.hidden=!session.authenticated||!saved?.conflict;
  if(section.hidden){section.innerHTML='';section.renderSignature='';return;}
  const signature=JSON.stringify({key,local:drafts[key],server:saved.serverValue,revision:saved.revision});
  if(section.renderSignature===signature)return;
  section.renderSignature=signature;
  section.innerHTML=`<h2>Másik készüléken is módosították ezt a piszkozatot</h2><p>Hasonlítsd össze a két változatot. Egyiket sem írtuk felül automatikusan; válassz, melyikkel folytatod.</p><div class="draft-compare"><section><h3>Saját bevitelem ezen a készüléken</h3>${draftVersionSummary(drafts[key])}${button('A saját bevitelemet mentem',`data-draft-choice="device" data-draft-key="${esc(key)}" data-draft-revision="${saved.revision}"`,'secondary')}</section><section><h3>A közös rendszerben mentett változat</h3>${draftVersionSummary(saved.serverValue)}${button('A közös piszkozatot használom',`data-draft-choice="server" data-draft-key="${esc(key)}" data-draft-revision="${saved.revision}"`,'secondary')}</section></div>`;
}
async function lockExpiredSession() {
  await flushDrafts();
  loginSuggestion=actor.id;session.authenticated=false;review=null;view='login';render(true);
}
function updateStatus() {
  const status=document.querySelector('#connection-status');
  const draft=document.querySelector('#draft-status');
  const pending=document.querySelector('#pending-command');
  const next=runtime.getPending();
  const clock=document.querySelector('#demo-clock-notice');
  clock.hidden=!connection.demoClockOffsetMinutes;
  clock.textContent=connection.demoClockOffsetMinutes?`Előreléptetett helyi tesztóra: +${connection.demoClockOffsetMinutes} perc.`:'';
  updateDraftConflict();
  status.hidden=!session.authenticated;
  status.className=`connection-status${connectionError?' connection-error':''}`;
  status.innerHTML=session.authenticated?`<strong>${session.mode==='server'?'Közös tesztüzem':'Helyi tesztüzem'}</strong><span>${esc(connectionError||session.storage?.label||'')}</span><span>StoreHouse / r_keeper: nincs összekötve</span>${connection.lastSuccessfulAt?`<span>Utolsó frissítés: ${timeTag(connection.lastSuccessfulAt,true)}</span>`:''}`:'';
  draft.hidden=!session.authenticated||!draftMessage;
  draft.textContent=draftMessage;
  draft.className=`draft-status${draftError?' draft-error':''}`;
  pending.hidden=!session.authenticated||!next;
  const pendingSignature=next?`${next.id}:${pending.dataset.missing}`:'';
  if(next&&pending.renderSignature!==pendingSignature)pending.innerHTML=`<strong>Egy beküldés eredményét még ellenőrizni kell.</strong><p>A válasz nem érkezett meg biztosan. Új műveletet addig ne indíts; az eredeti beküldés azonosítója megmaradt.</p><div class="actions">${button('Ellenőrzöm a beküldés eredményét','data-action="check-pending"','secondary')}${pending.dataset.missing==='true'?button('Az eredeti beküldést megismétlem','data-action="retry-pending"','secondary'):''}</div>`;
  if(!next)pending.dataset.missing='false';
  pending.renderSignature=pendingSignature;
  document.querySelector('.page-footer').textContent=session.mode==='server'?'Közös tesztadatok: az ügyek és az előzmények a kiszolgálón megmaradnak. A PDF terméknevei mellett minden készletmennyiség próbaadat.':session.storage?.persistent?'Helyi tesztadatok: ezen a böngészőn megmaradnak. Másik készülékkel a közös kiszolgálós változatot használd.':'Ebben az előnézetben a tárolás nem engedélyezett. Az adatok csak az ablak bezárásáig maradnak meg.';
}
function refreshLines() {
  app.querySelectorAll('[data-line]').forEach(row=>{
    const index=row.dataset.line,form=row.closest('form');
    const p=product(form.elements.namedItem(`product-${index}`).value),output=row.querySelector('[data-line-summary]');
    if(!p){output.textContent='Válaszd ki az árut és a mennyiséget.';return;}
    const raw=form.elements.namedItem(`quantity-${index}`).value;
    let text='';
    try{if(raw!=='')text=`Ez összesen ${amount(p.id,convertQuantity(p,Number(raw),form.elements.namedItem(`unit-${index}`).value))}. `;}catch(error){text=error.message+' ';}
    if(form.id==='move-form')text+=`A kiadó helyen elérhető: ${amount(p.id,stockAt(state,form.elements.namedItem('from').value,p.id))}. `;
    if(p.needsReview)text+='A forrásban javítás vagy bizonytalan adat szerepel: a nyomtatott terméket ellenőrizd. ';
    if(p.sourceCode)text+='A PDF-ből származó termék; a mennyiség tesztadat.';
    output.textContent=text||'Add meg a mennyiséget.';
  });
  const progress=app.querySelector('#count-progress');
  if(progress){const fields=[...app.querySelectorAll('#count-submit-form input[name^="actual-"]')];progress.textContent=`${fields.filter(f=>f.value!=='').length} / ${fields.length} termék mennyisége megadva.`;}
}
function refreshBacklog() {
  const form=app.querySelector('#move-form'),output=app.querySelector('#move-backlog');
  if(!form||!output)return;
  const html=moveBacklog(form.elements.namedItem('from').value,form.elements.namedItem('to').value,form.dataset.kind);
  if(output.innerHTML!==html)output.innerHTML=html;
}
function refreshDashboardQueue() {
  const queue=app.querySelector('#transfer-groups');if(!queue)return;
  const focused=queue.contains(document.activeElement)?document.activeElement.dataset.moveId:null;
  queue.innerHTML=transferGroups();
  if(focused)queue.querySelector(`[data-move-id="${focused}"]`)?.focus({preventScroll:true});
}
function refreshTimedAreas() {
  if(!session.authenticated)return;
  if(view==='home'){
    const values=dashboardValues();
    app.querySelectorAll('[data-metric]').forEach(el=>{const key=el.dataset.metric;el.dataset.value=values[key];el.querySelector('strong').textContent=values[key];el.classList.toggle('has-overdue',key==='overdue'&&values[key]>0);});
    refreshDashboardQueue();
  }else{
    app.querySelectorAll('[data-transfer-timing]').forEach(el=>{const m=state.moves.find(m=>m.id===el.dataset.transferTiming);if(m)el.innerHTML=transferTimeContent(m,el.dataset.detail==='true');});
    const status=app.querySelector('#move-status');
    if(status){const m=state.moves.find(m=>m.id===status.dataset.moveId);const overdue=transferTiming(m,appNow()).overdue;status.className=`badge ${overdue?'overdue':['done','cancelled'].includes(m.status)?'':'pending'}`;status.textContent=overdue?'Késik a visszaigazolás':stateLabel(m.status);}
    refreshBacklog();
  }
}
function render(focus=false) {
  document.querySelector('#actor-name').textContent=session.authenticated?actor.name:'Nincs bejelentkezve';
  document.querySelector('#actor-place').textContent=session.authenticated?(actor.role==='manager'?'Raktárfelelős · minden hely':actor.location):'Személyes belépés szükséges';
  document.querySelector('#lock-session').hidden=!session.authenticated;
  document.querySelector('#nav').hidden=!session.authenticated;
  if(!session.authenticated)view='login';
  app.innerHTML=screens[view]();
  app.querySelectorAll('form').forEach(form=>form.dataset.revision=String(revision));
  document.querySelectorAll('#nav [data-view]').forEach(b=>{const target=['stock','history','help'].includes(view)?view:'home';if(b.dataset.view===target)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  refreshLines();refreshTimedAreas();updateStatus();
  if(focus)app.querySelector('#screen-title')?.focus();
}
function navigate(next) {
  if(!Object.hasOwn(screens,next))return;
  remember(app.querySelector('form'));view=next;feedback.innerHTML='';render(true);
}
function openRecord(kind,id) {selectedId=id;navigate(kind);}
function numeric(data,name) {
  const raw=data.get(name);if(typeof raw!=='string'||!raw.trim())throw new Error('Add meg az összes szükséges mennyiséget.');
  const n=Number(raw.replace(',','.'));if(!Number.isFinite(n))throw new Error('Érvényes számot adj meg.');return n;
}
function linesFrom(form,data) {return [...form.querySelectorAll('[data-line]')].map(row=>{const i=row.dataset.line;return {productId:data.get(`product-${i}`),quantity:numeric(data,`quantity-${i}`),unit:data.get(`unit-${i}`),...(form.id==='receipt-form'?{destination:data.get(`destination-${i}`),checked:data.has(`checked-${i}`)}:{})};});}
function setBusy(value) {busy=value;document.querySelectorAll('button').forEach(b=>b.disabled=value);document.querySelector('#app').setAttribute('aria-busy',String(value));}
function startReview(form,action,after) {
  review={action,after,key:draftKey(form),returnView:view,selectedId,expectedRevision:Number(form.dataset.revision)};
  view='review';render(true);
}
async function commit(action,after,key=null,expectedRevision=revision) {
  setBusy(true);
  try{
    const snapshot=await runtime.command(action,{expectedRevision});applySnapshot(snapshot);
    await clearDraft(key);
    review=null;
    if(after)after();
    render(true);
    const event=state.history.at(-1);
    notify(snapshot.replayed?'A korábban rögzített művelet eredményét kaptad vissza; nem történt újabb könyvelés.':event?.summary||'A műveletet rögzítetted.',false,snapshot.replayed?[]:event?.changes||[]);
  }catch(error){
    if(error.snapshot)applySnapshot(error.snapshot);
    if(error.code==='REVISION_CONFLICT'&&review){view=review.returnView;selectedId=review.selectedId;review=null;render(true);}
    if(['UNAUTHORIZED','SESSION_CHANGED'].includes(error.code))await lockExpiredSession();
    notify(error.message,true);updateStatus();
  }finally{setBusy(false);}
}
async function signOut(suggested='',resume=null) {
  if(busy)return;
  remember(app.querySelector('form'));
  await flushDrafts();
  try{await runtime.logout();}catch(error){notify(error.message,true);return;}
  session.authenticated=false;drafts={};savedDrafts={};draftMessage='';draftWrites.clear();review=null;
  loginSuggestion=suggested;resumeAfterLogin=resume;view='login';render(true);
}
async function processForm(form) {
  if(!form||busy)return;
  if(form.id==='count-submit-form'&&[...form.querySelectorAll('input[name^="actual-"]')].some(f=>!f.value)){const search=app.querySelector('#count-search');if(search)search.value='';filterCountRows('');}
  if(!form.reportValidity())return;
  const data=new FormData(form);
  if(form.id==='login-form'){
    setBusy(true);
    try{
      applySnapshot(await runtime.login(data.get('userId'),data.get('pin')));
      const loaded=await runtime.loadDrafts();drafts=loaded.drafts||{};savedDrafts=loaded.saved||{};restoreLineCounts();draftError=Object.values(savedDrafts).some(s=>s.conflict);draftMessage=draftError?'Egy piszkozatot másik készüléken is módosítottak. Ellenőrizd a beviteledet; nem írtuk felül automatikusan.':Object.keys(drafts).length?'A saját korábbi piszkozataid visszatöltve.':'';
      stockLocation=actor.role==='receiver'?actor.location:'Fő raktár';
      view=resumeAfterLogin?.view||'home';selectedId=resumeAfterLogin?.selectedId||null;resumeAfterLogin=null;review=null;
      render(true);notify(`Beléptél: ${actor.name}. A rögzítések a saját nevedhez tartoznak.`);
    }catch(error){notify(error.message,true);}finally{setBusy(false);}return;
  }
  remember(form);await flushDrafts();
  if(savedDrafts[draftKey(form)]?.conflict){notify('Előbb válassz a két piszkozatváltozat közül. A bevitel megmaradt.',true);updateStatus();return;}
  try{
    let action,after;
    switch(form.id){
      case 'receipt-form': {const lines=linesFrom(form,data);action={type:'RECEIPT',supplier:data.get('supplier'),document:data.get('document'),lines};after=()=>{lineCounts.receipt=1;stockLocation=lines[0].destination;view='stock';};break;}
      case 'product-form':action={type:'ADD_PRODUCT',name:data.get('name'),sourceCode:data.get('sourceCode')||undefined,category:data.get('category')||undefined,baseUnit:data.get('baseUnit'),packUnit:data.get('packUnit'),packSize:numeric(data,'packSize'),countInShift:data.has('countInShift')};after=()=>{view='receipt';};break;
      case 'move-form':{const kind=form.dataset.kind;action={type:'MOVE_CREATE',kind,from:data.get('from'),to:data.get('to'),lines:linesFrom(form,data),...(data.get('correctsMoveId')?{correctsMoveId:data.get('correctsMoveId'),reason:data.get('reason')}: {})};after=()=>{lineCounts[kind]=1;selectedId=state.moves.at(-1).id;stockLocation=data.get('from');view='move';};break;}
      case 'move-receive-form':{const m=record(state.moves);action={type:'MOVE_RECEIVE',id:m.id,received:m.lines.map((_,i)=>numeric(data,`received-${i}`))};after=()=>{stockLocation=m.to;view='move';};break;}
      case 'move-resolve-form':action={type:'MOVE_RESOLVE',id:selectedId,resolution:data.get('resolution'),reason:data.get('reason')};after=()=>{view='move';};break;
      case 'move-cancel-form':action={type:'MOVE_CANCEL',id:selectedId,reason:data.get('reason'),physicalStillAtSource:data.has('physicalStillAtSource')};after=()=>{view='move';};break;
      case 'waste-form':action={type:'WASTE_REPORT',location:actor.location,productId:data.get('productId'),quantity:numeric(data,'quantity'),unit:data.get('unit'),reason:data.get('reason')};after=()=>{selectedId=state.waste.at(-1).id;view='wasteDetail';};break;
      case 'waste-approve-form':action={type:'WASTE_APPROVE',id:selectedId};after=()=>{view='wasteDetail';};break;
      case 'count-start-form':action={type:'COUNT_START',location:data.get('location'),kind:data.get('kind'),productIds:data.getAll('productIds'),paused:data.has('paused')};after=()=>{selectedId=state.counts.at(-1).id;view='countDetail';};break;
      case 'count-submit-form':{const c=record(state.counts);action={type:'COUNT_SUBMIT',id:c.id,actual:Object.fromEntries(Object.keys(c.expected).map(id=>[id,numeric(data,`actual-${id}`)]))};after=()=>{view='countDetail';};break;}
      case 'count-approve-form':action={type:'COUNT_APPROVE',id:selectedId,adjustment:data.get('adjustment'),reason:data.get('reason')};after=()=>{view='countDetail';};break;
      case 'count-cancel-form':action={type:'COUNT_CANCEL',id:selectedId,reason:data.get('reason')};after=()=>{view='countDetail';};break;
      case 'count-include-form':action={type:'COUNT_INCLUDE_PRODUCTS',id:selectedId,productIds:[data.get('product-include')]};after=()=>{view='countDetail';};break;
      case 'shift-open-form':action={type:'SHIFT_OPEN',location:data.get('location'),assigneeId:data.get('assigneeId'),deputyId:data.get('deputyId')||undefined};after=()=>{selectedId=state.shifts.at(-1).id;view='shiftDetail';};break;
      case 'shift-handover-form':action={type:'SHIFT_HANDOVER',id:selectedId,assigneeId:data.get('assigneeId'),deputyId:data.get('deputyId')||undefined,reason:data.get('reason')};after=()=>{view='shiftDetail';};break;
      case 'reset-form':applySnapshot(await runtime.reset());drafts={};savedDrafts={};draftMessage='';demoClockOffset=0;transferFilter='all';Object.keys(lineCounts).forEach(k=>lineCounts[k]=1);selectedId=null;view='home';render(true);notify('A helyi tesztadatok alaphelyzetbe álltak.');return;
      default:return;
    }
    startReview(form,action,after);
  }catch(error){notify(error.message,true);}
}
function filterStockRows() {
  app.querySelectorAll('#stock-table [data-product-id]').forEach(row=>{const p=product(row.dataset.productId);row.hidden=(!normalized(productLabel(p)).includes(normalized(stockSearch)))||(stockCategory&&p.category!==stockCategory);});
}
function filterCountRows(search) {
  app.querySelectorAll('.count-row[data-product-id], #count-products [data-product-id]').forEach(row=>{row.hidden=!normalized(productLabel(product(row.dataset.productId))).includes(normalized(search));});
}
app.addEventListener('input',event=>{
  const form=event.target.closest('form'),row=event.target.closest('[data-line]');
  if(form?.id==='login-form')return;
  if(row&&form.id==='receipt-form'&&!event.target.name.startsWith('checked-'))row.querySelector('[type="checkbox"]').checked=false;
  if(event.target.dataset.productSearch)refreshProductOptions(event.target);
  if(event.target.id==='stock-search'){stockSearch=event.target.value;filterStockRows();return;}
  if(event.target.id==='count-search'){filterCountRows(event.target.value);return;}
  if(event.target.id==='history-search'){historyFilters.search=event.target.value;filterHistoryRows();return;}
  remember(form);refreshLines();
});
app.addEventListener('change',event=>{
  const form=event.target.closest('form'),row=event.target.closest('[data-line]');
  if(form?.id==='login-form')return;
  if(event.target.dataset.productCategory)refreshProductOptions(event.target);
  if(row&&event.target.name.startsWith('product-')){const p=product(event.target.value);const unit=form.elements.namedItem(`unit-${row.dataset.line}`);unit.innerHTML=p?Object.keys(p.units).map(u=>option(u,unitLabel(u),p.baseUnit)).join(''):option('','Előbb válassz terméket','');}
  if(form?.id==='waste-form'&&event.target.name==='productId'){const p=product(event.target.value);form.elements.namedItem('unit').innerHTML=p?Object.keys(p.units).map(u=>option(u,unitLabel(u),p.baseUnit)).join(''):option('','Előbb válassz terméket','');}
  if(form?.id==='count-start-form'&&event.target.name==='kind')app.querySelector('#count-products').hidden=event.target.value!=='partial';
  if(event.target.id==='stock-location'){stockLocation=event.target.value;render();return;}
  if(event.target.id==='stock-category'){stockCategory=event.target.value;filterStockRows();return;}
  if(event.target.dataset.historyFilter){historyFilters[event.target.dataset.historyFilter]=event.target.value;filterHistoryRows();return;}
  remember(form);refreshLines();
  if(form?.id==='shift-open-form'&&event.target.name==='location'){delete drafts['shift-open-form'].assigneeId;delete drafts['shift-open-form'].deputyId;render();return;}
  if(form?.id==='move-form'&&['from','to'].includes(event.target.name))refreshBacklog();
});
document.addEventListener('click',async event=>{
  const target=event.target.closest('button');if(!target||target.matches(':disabled')||busy)return;
  if(target.type==='submit'&&target.form){event.preventDefault();await processForm(target.form);return;}
  if(target.dataset.action==='lock'){await signOut();return;}
  if(target.dataset.openTablet||target.hasAttribute('data-open-manager')){const who=session.users.find(u=>target.hasAttribute('data-open-manager')?u.role==='manager':u.role==='receiver'&&u.location===target.dataset.openTablet);await signOut(who?.id||'',{view,selectedId});return;}
  if(target.dataset.action==='confirm-review'&&review){await commit(review.action,review.after,review.key,review.expectedRevision);return;}
  if(target.dataset.action==='edit-review'&&review){view=review.returnView;selectedId=review.selectedId;review=null;render(true);return;}
  if(target.dataset.transferFilter){transferFilter=target.dataset.transferFilter;refreshDashboardQueue();app.querySelectorAll('[data-transfer-filter]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.transferFilter===transferFilter));return;}
  if(target.dataset.view){navigate(target.dataset.view);return;}
  if(target.dataset.moveId){openRecord('move',target.dataset.moveId);return;}
  if(target.dataset.wasteId){openRecord('wasteDetail',target.dataset.wasteId);return;}
  if(target.dataset.countId){openRecord('countDetail',target.dataset.countId);return;}
  if(target.dataset.shiftId){openRecord('shiftDetail',target.dataset.shiftId);return;}
  if(target.dataset.draftChoice){
    setBusy(true);
    try{await flushDrafts();const loaded=await runtime.resolveDraftConflict(target.dataset.draftKey,target.dataset.draftChoice,Number(target.dataset.draftRevision));drafts=loaded.drafts||{};savedDrafts=loaded.saved||{};restoreLineCounts();review=null;draftMessage='A kiválasztott piszkozatváltozat betöltve. Rögzítés előtt ellenőrizd a tételeket.';draftError=false;render(true);}
    catch(error){if(error.draft)savedDrafts[target.dataset.draftKey]={...(savedDrafts[target.dataset.draftKey]||{}),conflict:true,serverValue:error.draft.value,revision:error.draft.revision};notify(error.message,true);updateStatus();}
    finally{setBusy(false);}return;
  }
  if(target.dataset.draftKey){const draft=drafts[target.dataset.draftKey];if(draft){selectedId=draft._selectedId||null;view=Object.hasOwn(screens,draft._view)?draft._view:'home';render(true);}return;}
  if(target.dataset.correctMove){
    const m=state.moves.find(x=>x.id===target.dataset.correctMove);const lines=m.lines.filter(l=>l.received>0);
    const kind=WAREHOUSES.includes(m.from)&&!WAREHOUSES.includes(m.to)?'return':'issue';
    const key=`move-${kind}`;
    drafts[key]={from:m.to,to:m.from,correctsMoveId:m.id,_lineCount:Math.max(1,lines.length)};
    lines.forEach((l,i)=>Object.assign(drafts[key],{[`product-${i}`]:l.productId,[`quantity-${i}`]:l.received,[`unit-${i}`]:l.productSnapshot?.baseUnit||product(l.productId).baseUnit}));
    lineCounts[kind]=Math.max(1,lines.length);navigate(kind);return;
  }
  try{
    if(target.dataset.action==='check-pending'||target.dataset.action==='retry-pending'){
      setBusy(true);const pending=runtime.getPending();
      const result=target.dataset.action==='retry-pending'?{status:'confirmed',snapshot:await runtime.retryPending()}:await runtime.reconcilePending();
      if(result.status==='confirmed'){applySnapshot(result.snapshot);await clearDraft(pendingDraftKey(pending?.action));review=null;view='home';render(true);notify('A beküldés eredménye ellenőrizve. A művelet egyszer szerepel a nyilvántartásban.');}
      else{document.querySelector('#pending-command').dataset.missing='true';notify('A kiszolgálón még nem található ez a beküldés. Az eredeti azonosítóval megismételheted; új ügyet ne hozz létre helyette.');updateStatus();}
      return;
    }
    if(target.dataset.action==='advance-demo-clock'){applySnapshot(await runtime.advanceClock(31));demoClockOffset=0;view='home';render(true);notify('A helyi tesztóra 31 perccel előrébb jár. A készlet és az igazolások nem változtak.');return;}
    if(target.dataset.action==='add-line'||target.dataset.action==='remove-line'){
      remember(app.querySelector('form'));const kind=view==='receipt'?'receipt':view;
      if(target.dataset.action==='add-line')lineCounts[kind]++;
      else if(lineCounts[kind]>1){const i=--lineCounts[kind];const key=kind==='receipt'?'receipt-form':`move-${kind}`;for(const field of ['product','quantity','unit','destination','checked','search','category'])delete drafts[key]?.[`${field}-${i}`];}
      render();return;
    }
    if(target.dataset.action==='sales'){await commit({type:'DEMO_SALES',batchId:'demo-sales-1'},()=>{view='stock';});return;}
    if(target.dataset.bottleProduct){
      const p=product(target.dataset.bottleProduct),form=target.closest('form'),data=new FormData(form);const closed=numeric(data,`closed-${p.id}`);
      if(!Number.isInteger(closed)||closed<0)throw new Error('A bontatlan palackok száma nem negatív egész szám legyen.');
      const weights=String(data.get(`weights-${p.id}`)||'').trim();const opened=weights?weights.split(/[\n;]+/).map(v=>Number(v.trim().replace(',','.'))).reduce((sum,w)=>sum+measuredVolumeLiters(w,p.bottleReference),0):0;
      const total=Number((closed*p.bottleReference.volumeMl/1000+opened).toFixed(6));form.elements.namedItem(`actual-${p.id}`).value=total;remember(form);refreshLines();notify(`${p.name}: összesen ${fmt(total)} liter került a megszámolt mennyiséghez.`);return;
    }
  }catch(error){if(error.snapshot)applySnapshot(error.snapshot);notify(error.message,true);updateStatus();}finally{setBusy(false);}
});
function pendingDraftKey(action) {if(!action)return null;return ({RECEIPT:'receipt-form',MOVE_CREATE:`move-${action.kind}`,MOVE_RECEIVE:`receive-${action.id}`,MOVE_RESOLVE:`resolve-${action.id}`,MOVE_CANCEL:`cancel-${action.id}`,WASTE_REPORT:'waste-form',COUNT_START:'count-start-form',COUNT_SUBMIT:`count-${action.id}`,COUNT_APPROVE:`count-approve-${action.id}`,SHIFT_OPEN:'shift-open-form',SHIFT_HANDOVER:`handover-${action.id}`})[action.type]||null;}
app.addEventListener('submit',event=>{event.preventDefault();processForm(event.target);});
let polling=false;
async function refreshSharedState() {
  if(!session.authenticated||busy||polling||document.hidden)return;
  polling=true;
  try{
    const previous=revision;applySnapshot(await runtime.refresh());
    if(previous!==revision&&!app.querySelector('form')&&view!=='review')render();
    else if(previous!==revision){connectionError='Új adat érkezett. Beküldés előtt ellenőrizd a friss állapotot; a beviteled megmaradt.';}
  }catch(error){connectionError=error.message;if(['UNAUTHORIZED','SESSION_CHANGED'].includes(error.code))await lockExpiredSession();}
  finally{polling=false;refreshTimedAreas();updateStatus();}
}
async function bootstrap() {
  try{
    session=await runtime.bootstrap();
    if(session.snapshot)applySnapshot(session.snapshot);
    if(session.authenticated){const loaded=await runtime.loadDrafts();drafts=loaded.drafts||{};savedDrafts=loaded.saved||{};restoreLineCounts();draftError=Object.values(savedDrafts).some(s=>s.conflict);draftMessage=draftError?'Egy piszkozatot másik készüléken is módosítottak. Ellenőrizd a beviteledet; nem írtuk felül automatikusan.':Object.keys(drafts).length?'A saját korábbi piszkozataid visszatöltve.':'';view='home';}
    render();
  }catch(error){app.innerHTML=heading('A rendszer most nem érhető el')+`<div class="notice danger"><p>${esc(error.message)}</p><p>A meglévő adatokat nem helyettesítettük másik tesztkészlettel. Próbáld újratölteni az oldalt, amikor a kapcsolat helyreállt.</p></div>`;}
}
setInterval(refreshTimedAreas,10000);
setInterval(refreshSharedState,15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSharedState();});
bootstrap();

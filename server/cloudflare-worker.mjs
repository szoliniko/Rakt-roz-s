import {DurableObject} from 'cloudflare:workers';
import {createHash,randomUUID} from 'node:crypto';
import {WarehouseStoreCore,SESSION_MS} from '../src/application/store-core.mjs';
import {AppError,ensure} from '../src/application/errors.mjs';
import {cloudflareDatabase} from './cloudflare-database.mjs';
import {authenticated,accessCookie,cookieValue,loginPage,secretEquals} from './cloudflare-access.mjs';
import assets from '../.local/cloudflare-assets.mjs';

const TABLES=['metadata','app_state','commands','users','sessions','login_limits','drafts'];
const security={
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'same-origin',
  'Strict-Transport-Security':'max-age=31536000',
  'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
};
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{...security,'Content-Type':'application/json; charset=utf-8',...headers}});
const html=(text,status=200,headers={})=>new Response(text,{status,headers:{...security,'Content-Type':'text/html; charset=utf-8',...headers}});
const sessionCookie=(token,age=SESSION_MS/1000)=>`warehouse_session=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;

async function boundedText(request,max=512000){
  ensure(Number(request.headers.get('Content-Length')??0)<=max,413,'REQUEST_TOO_LARGE','Túl nagy kérés.');
  if(!request.body)return '';
  const reader=request.body.getReader(),parts=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new AppError(413,'REQUEST_TOO_LARGE','Túl nagy kérés.');}parts.push(value);}
  return Buffer.concat(parts).toString('utf8');
}
async function body(request){
  ensure(request.headers.get('Content-Type')?.split(';')[0]==='application/json',415,'JSON_REQUIRED','JSON formátumú kérés szükséges.');
  try{const value=JSON.parse(await boundedText(request));ensure(value&&typeof value==='object'&&!Array.isArray(value),400,'INVALID_JSON','Érvénytelen kérés.');return value;}
  catch(error){if(error instanceof AppError)throw error;throw new AppError(400,'INVALID_JSON','A kérés nem olvasható.');}
}

export class Warehouse extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);
    this.bootId=randomUUID();
    this.store=new WarehouseStoreCore({db:cloudflareDatabase(ctx.storage),transaction:fn=>ctx.storage.transactionSync(fn)});
  }
  async handle(request){
    const store=this.store,url=new URL(request.url),path=url.pathname,method=request.method;
    let actor;
    try{
      if(path==='/api/bootstrap'&&method==='GET')return json({mode:'test',users:store.listUsers(),testPin:'1234'});
      if(path==='/api/session'&&method==='POST'){
        const data=await body(request),login=store.login(data.userId,data.pin);
        return json(store.snapshot(login.actor),200,{'Set-Cookie':sessionCookie(login.token)});
      }
      if(path==='/api/session'&&method==='DELETE'){
        if(request.headers.has('X-Actor-Id')){const current=store.authenticate(cookieValue(request,'warehouse_session'));ensure(request.headers.get('X-Actor-Id')===current.id,403,'SESSION_CHANGED','Közben másik dolgozó jelentkezett be.');}
        store.logout(cookieValue(request,'warehouse_session'));return json({loggedOut:true},200,{'Set-Cookie':sessionCookie('',0)});
      }
      actor=store.authenticate(cookieValue(request,'warehouse_session'));
      ensure(!request.headers.has('X-Actor-Id')||request.headers.get('X-Actor-Id')===actor.id,403,'SESSION_CHANGED','Közben másik dolgozó jelentkezett be.');
      if((path==='/api/state'||path==='/api/session')&&method==='GET')return json(store.snapshot(actor));
      if(path==='/api/commands'&&method==='POST'){
        const data=await body(request);ensure(!data.actorId||data.actorId===actor.id,403,'SESSION_CHANGED','Közben másik dolgozó jelentkezett be.');return json(store.command(actor,data));
      }
      if(path.startsWith('/api/commands/')&&method==='GET'){
        ensure(!url.searchParams.get('ownerId')||url.searchParams.get('ownerId')===actor.id,403,'SESSION_CHANGED','Közben másik dolgozó jelentkezett be.');return json(store.commandStatus(actor,decodeURIComponent(path.slice('/api/commands/'.length))));
      }
      if(path==='/api/drafts'&&method==='GET')return json({drafts:store.drafts(actor),serverNow:store.now()});
      if(path==='/api/drafts'&&method==='PUT'){
        const data=await body(request);ensure(!data.ownerId||data.ownerId===actor.id,403,'SESSION_CHANGED','Közben másik dolgozó jelentkezett be.');return json({draft:store.saveDraft(actor,data.key,data.value,data.expectedRevision??0)});
      }
      if(path==='/api/drafts'&&method==='DELETE'){
        ensure(!url.searchParams.get('ownerId')||url.searchParams.get('ownerId')===actor.id,403,'SESSION_CHANGED','Közben másik dolgozó jelentkezett be.');store.deleteDraft(actor,url.searchParams.get('key'),url.searchParams.has('expectedRevision')?Number(url.searchParams.get('expectedRevision')):undefined);return json({deleted:true});
      }
      if(path==='/api/admin/status'&&method==='GET'){
        ensure(actor.role==='manager',403,'FORBIDDEN','Raktárfelelősi belépés szükséges.');return json({bootId:this.bootId,buildId:BUILD_ID,revision:store.snapshot(actor).revision,storage:'durable-sqlite',mode:'test'});
      }
      if(path==='/api/admin/backup'&&method==='GET'){
        ensure(actor.role==='manager',403,'FORBIDDEN','Raktárfelelősi belépés szükséges.');
        const payload=store.transaction(()=>({format:'raktar-backup-v1',createdAt:store.now(),tables:Object.fromEntries(TABLES.map(t=>[t,store.db.prepare(`SELECT * FROM ${t}`).all()]))}));
        const encoded=JSON.stringify(payload),sha256=createHash('sha256').update(encoded).digest('hex');
        return json({payload,sha256},200,{'Content-Disposition':`attachment; filename="raktar-mentes-${store.now().slice(0,10)}.json"`});
      }
      if(path==='/api/admin/restart-test'&&method==='POST'&&this.env.ENABLE_RESTART_TEST==='true'){
        ensure(actor.role==='manager',403,'FORBIDDEN','Raktárfelelősi belépés szükséges.');
        ensure(secretEquals(request.headers.get('X-Operations-Key'),this.env.OPERATIONS_KEY),403,'FORBIDDEN','Üzemeltetői azonosítás szükséges.');
        await this.ctx.storage.sync();this.ctx.abort('Authorized persistence verification restart');
      }
      throw new AppError(404,'NOT_FOUND','Ez a művelet nem érhető el.');
    }catch(error){
      const status=error instanceof AppError?error.status:500;
      if(status===500)console.error(JSON.stringify({event:'warehouse-request-failed',code:error.code??'INTERNAL_ERROR',message:error.message}));
      const result={error:{code:error instanceof AppError?error.code:'INTERNAL_ERROR',message:error instanceof AppError?error.message:'A kiszolgáló nem tudta befejezni a kérést. A mentett munka megmarad.'}};
      if(status===409&&actor)Object.assign(result,store.snapshot(actor));
      if(error.code==='DRAFT_CONFLICT')result.currentDraft=error.currentDraft;
      return json(result,status);
    }
  }
}

export default {
  async fetch(request,env){
    try{
      const url=new URL(request.url),path=url.pathname;
      ensure(env.GATE_PASSWORD?.length>=24,503,'ACCESS_NOT_CONFIGURED','A hozzáférés beállítása folyamatban van.');
      ensure(url.origin===env.PUBLIC_ORIGIN,403,'HOST_NOT_ALLOWED','Ez a kiszolgálócím nincs engedélyezve.');
      if(!['GET','HEAD','OPTIONS'].includes(request.method)){
        const origin=request.headers.get('Origin'),site=request.headers.get('Sec-Fetch-Site');
        ensure((!origin||origin===env.PUBLIC_ORIGIN)&&(!site||['same-origin','none'].includes(site)),403,'ORIGIN_NOT_ALLOWED','Másik weboldalról érkező módosítás nem engedélyezett.');
      }
      if(path==='/access'&&request.method==='GET')return html(loginPage());
      if(path==='/access'&&request.method==='POST'){
        ensure(request.headers.get('Origin')===env.PUBLIC_ORIGIN,403,'ORIGIN_NOT_ALLOWED','A saját belépőoldalt használd.');
        ensure(request.headers.get('Content-Type')?.split(';')[0]==='application/x-www-form-urlencoded',415,'FORM_REQUIRED','A belépőoldalt használd.');
        const data=new URLSearchParams(await boundedText(request,4096));
        if(!secretEquals(data.get('password'),env.GATE_PASSWORD))return html(loginPage(true),401);
        return new Response(null,{status:303,headers:{...security,Location:'/', 'Set-Cookie':accessCookie(env.GATE_PASSWORD)}});
      }
      if(!authenticated(request,env.GATE_PASSWORD)){
        if(path==='/'||path==='/index.html')return new Response(null,{status:303,headers:{...security,Location:'/access'}});
        return json({error:{code:'ACCESS_REQUIRED',message:'A hozzáférési jelszó megadása szükséges.'}},401);
      }
      if(path.startsWith('/api/'))return await env.WAREHOUSE.getByName('tordasi-warehouse-test-v1').handle(request);
      ensure(request.method==='GET'||request.method==='HEAD',405,'METHOD_NOT_ALLOWED','Ez a kérés nem támogatott.');
      const asset=assets[path==='/index.html'?'/':path];ensure(typeof asset==='string',404,'NOT_FOUND','A fájl nem érhető el.');
      const type=path.endsWith('.css')?'text/css; charset=utf-8':path.endsWith('.mjs')?'text/javascript; charset=utf-8':'text/html; charset=utf-8';
      return new Response(request.method==='HEAD'?null:asset,{headers:{...security,'Content-Type':type}});
    }catch(error){
      if(!(error instanceof AppError))console.error(JSON.stringify({event:'warehouse-gateway-failed',message:error.message}));
      return json({error:{code:error instanceof AppError?error.code:'INTERNAL_ERROR',message:error instanceof AppError?error.message:'A kiszolgáló átmenetileg nem érhető el.'}},error instanceof AppError?error.status:503);
    }
  }
};

import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { WarehouseStore, SESSION_MS } from '../src/application/store.mjs';
import { AppError, ensure } from '../src/application/errors.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const MAX_BODY=512000;
function cookieToken(req){return String(req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('warehouse_session='))?.slice('warehouse_session='.length);}
function cookie(token,maxAge=SESSION_MS/1000){return `warehouse_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;}
async function body(req){
  ensure(String(req.headers['content-type']??'').split(';')[0]==='application/json',415,'JSON_REQUIRED','JSON formátumú kérés szükséges.');
  let size=0;const parts=[];
  for await(const part of req){size+=part.length;ensure(size<=MAX_BODY,413,'REQUEST_TOO_LARGE','Túl nagy kérés. Kevesebb tételt adj meg egyszerre.');parts.push(part);}
  try{const value=JSON.parse(Buffer.concat(parts).toString('utf8'));ensure(value&&typeof value==='object'&&!Array.isArray(value),400,'INVALID_JSON','Érvénytelen kérés.');return value;}catch(error){if(error instanceof AppError)throw error;throw new AppError(400,'INVALID_JSON','A kérés nem olvasható. A kitöltött adatokat őrizd meg és próbáld újra.');}
}
function send(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));}

/** Explicit test server. No route dispatches any StoreHouse write. A future live
 * adapter must pass the integration contract and local verification first. */
export function createWarehouseServer({database,clock,initialState,mode='test',allowedHosts=['localhost','127.0.0.1','[::1]']}={}){
  const store=new WarehouseStore({filename:database,clock,initialState,mode});
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
    let actor;
    try{
      const host=String(req.headers.host??'');
      const url=new URL(req.url,`http://${host}`);
      ensure(allowedHosts.includes(url.hostname),403,'HOST_NOT_ALLOWED','Ez a kiszolgálócím nincs engedélyezve.');
      const path=url.pathname;
      if(!['GET','HEAD','OPTIONS'].includes(req.method)){
        const origin=req.headers.origin;
        ensure(!origin||origin===url.origin,403,'ORIGIN_NOT_ALLOWED','Másik weboldalról érkező módosítás nem engedélyezett.');
        ensure(!req.headers['sec-fetch-site']||['same-origin','none'].includes(req.headers['sec-fetch-site']),403,'ORIGIN_NOT_ALLOWED','Másik weboldalról érkező módosítás nem engedélyezett.');
      }
      if(path==='/api/bootstrap'&&req.method==='GET')return send(res,200,{mode:'test',users:store.listUsers(),testPin:'1234'});
      if(path==='/api/session'&&req.method==='POST'){
        const data=await body(req);const login=store.login(data.userId,data.pin);
        return send(res,200,store.snapshot(login.actor),{'Set-Cookie':cookie(login.token)});
      }
      if(path==='/api/session'&&req.method==='DELETE'){if(req.headers['x-actor-id']){const current=store.authenticate(cookieToken(req));ensure(req.headers['x-actor-id']===current.id,403,'SESSION_CHANGED','Közben másik dolgozó jelentkezett be.');}store.logout(cookieToken(req));return send(res,200,{loggedOut:true},{'Set-Cookie':cookie('',0)});}
      if(path.startsWith('/api/')){
        actor=store.authenticate(cookieToken(req));
        ensure(!req.headers['x-actor-id']||req.headers['x-actor-id']===actor.id,403,'SESSION_CHANGED','Közben másik dolgozó jelentkezett be. A műveletet nem végeztük el másik név alatt.');
        if((path==='/api/state'||path==='/api/session')&&req.method==='GET')return send(res,200,store.snapshot(actor));
        if(path==='/api/commands'&&req.method==='POST'){const data=await body(req);ensure(!data.actorId||data.actorId===actor.id,403,'SESSION_CHANGED','Közben másik dolgozó jelentkezett be. A művelet nem került másik név alatt rögzítésre.');return send(res,200,store.command(actor,data));}
        if(path.startsWith('/api/commands/')&&req.method==='GET'){ensure(!url.searchParams.get('ownerId')||url.searchParams.get('ownerId')===actor.id,403,'SESSION_CHANGED','Közben másik dolgozó jelentkezett be.');return send(res,200,store.commandStatus(actor,decodeURIComponent(path.slice('/api/commands/'.length))));}
        if(path==='/api/drafts'&&req.method==='GET')return send(res,200,{drafts:store.drafts(actor),serverNow:store.now()});
        if(path==='/api/drafts'&&req.method==='PUT'){const data=await body(req);ensure(!data.ownerId||data.ownerId===actor.id,403,'SESSION_CHANGED','Közben másik dolgozó jelentkezett be. Az előző dolgozó piszkozatát nem mentettük az új név alatt.');return send(res,200,{draft:store.saveDraft(actor,data.key,data.value,data.expectedRevision??0)});}
        if(path==='/api/drafts'&&req.method==='DELETE'){ensure(!url.searchParams.get('ownerId')||url.searchParams.get('ownerId')===actor.id,403,'SESSION_CHANGED','Közben másik dolgozó jelentkezett be. A piszkozatot nem töröltük.');store.deleteDraft(actor,url.searchParams.get('key'),url.searchParams.has('expectedRevision')?Number(url.searchParams.get('expectedRevision')):undefined);return send(res,200,{deleted:true});}
        throw new AppError(404,'NOT_FOUND','Ez a művelet nem érhető el.');
      }
      ensure(req.method==='GET'||req.method==='HEAD',405,'METHOD_NOT_ALLOWED','Ez a kérés nem támogatott.');
      if(path==='/'||path==='/index.html'){
        let html=await readFile(resolve(ROOT,'demo/template.html'),'utf8');
        html=html.replace('<head>','<head><base href="/demo/"><script>window.__WAREHOUSE_SERVER__=true;</script>');
        res.writeHead(200,{'Content-Type':MIME['.html'],'Cache-Control':'no-store'});return res.end(req.method==='HEAD'?'':html);
      }
      ensure(/^\/(demo|src\/domain|data)\//.test(path),404,'NOT_FOUND','A fájl nem érhető el.');
      const decoded=decodeURIComponent(path);
      const file=resolve(ROOT,'.'+decoded);
      const rootReal=await realpath(ROOT);let fileReal;
      try{fileReal=await realpath(file);}catch{throw new AppError(404,'NOT_FOUND','A fájl nem található.');}
      ensure(['demo','src/domain','data'].some(folder=>fileReal.startsWith(resolve(rootReal,folder)+sep)),404,'NOT_FOUND','A fájl nem érhető el.');
      const type=MIME[extname(fileReal)];ensure(type,404,'NOT_FOUND','A fájl nem érhető el.');
      const data=await readFile(fileReal);
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
    }catch(error){
      const status=error instanceof AppError?error.status:500;
      const result={error:{code:error.code??'INTERNAL_ERROR',message:error instanceof AppError?error.message:'A kiszolgáló nem tudta befejezni a kérést. A mentett munkád megmarad; ellenőrizd a művelet állapotát.'}};
      if(status===409&&actor)Object.assign(result,store.snapshot(actor));
      if(error.code==='DRAFT_CONFLICT')result.currentDraft=error.currentDraft;
      if(!res.headersSent)send(res,status,result);else res.end();
    }
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  return {server,store,close:()=>new Promise((resolve,reject)=>server.close(error=>{store.close();error?reject(error):resolve();}))};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(!args.includes('--test')||args.includes('--live')){process.stderr.write('Csak kifejezett --test módban indítható. Az éles StoreHouse-kapcsolat még nincs beállítva.\n');process.exit(1);}
  const value=(flag,fallback)=>{const i=args.indexOf(flag);return i<0?fallback:args[i+1];};
  const host=value('--host','127.0.0.1');
  const port=Number(value('--port','4174'));
  const database=value('--database',resolve(ROOT,'.local/warehouse-test.sqlite'));
  const allowedHosts=['localhost','127.0.0.1','[::1]',host,...String(value('--allowed-hosts','')).split(',').filter(Boolean)];
  const app=createWarehouseServer({database,allowedHosts});
  app.server.listen(port,host,()=>process.stdout.write(`Közös tesztrendszer: http://${host}:${app.server.address().port}\nA tesztfelhasználók PIN-kódja: 1234. Nincs élő StoreHouse-kapcsolat.\n`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit(0)));
}

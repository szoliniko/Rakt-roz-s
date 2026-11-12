import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
const COOKIE='__Host-raktar_access';
const MAX_AGE=8*60*60;
const hash=value=>createHash('sha256').update(String(value)).digest();
export const secretEquals=(a,b)=>typeof a==='string'&&typeof b==='string'&&timingSafeEqual(hash(a),hash(b));
export const cookieValue=(request,name)=>request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);
const sign=(value,password)=>createHmac('sha256',password).update('raktar-access-v1:'+value).digest('base64url');
export function authenticated(request,password){
  if(!password||password.length<24)return false;
  const auth=request.headers.get('Authorization');
  if(auth?.startsWith('Basic ')){
    try{if(secretEquals(atob(auth.slice(6)),'raktar:'+password))return true;}catch{}
  }
  const token=cookieValue(request,COOKIE);
  if(!token)return false;
  const [expires,nonce,signature,...extra]=token.split('.');
  if(extra.length||!expires||!nonce||!signature)return false;
  const ttl=Number(expires)-Math.floor(Date.now()/1000);
  return ttl>0&&ttl<=MAX_AGE&&secretEquals(signature,sign(expires+'.'+nonce,password));
}
export function accessCookie(password){
  const value=(Math.floor(Date.now()/1000)+MAX_AGE)+'.'+randomBytes(24).toString('base64url');
  return `${COOKIE}=${value}.${sign(value,password)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}`;
}
export function loginPage(error=false){
  return `<!doctype html><html lang="hu"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Raktár – védett belépés</title><style>body{font:18px system-ui;background:#f5f2eb;color:#28342f;margin:0;display:grid;min-height:100svh;place-items:center}main{background:white;padding:36px;max-width:420px;border-radius:12px;margin:20px;border:1px solid #ddd}h1{font-size:30px;margin-top:0}p{line-height:1.5;color:#526057}label{display:block;margin-bottom:8px}input{box-sizing:border-box;width:100%;font:inherit;padding:12px;border:1px solid #84958b;border-radius:6px}button{width:100%;font:inherit;background:#245c43;color:white;border:0;border-radius:6px;padding:14px;margin-top:20px}.error{color:#a32626}</style><main><h1>Raktár</h1><p>Védett közös tesztüzem. Add meg a hozzáférési jelszót, majd válaszd ki a dolgozót.</p>${error?'<p class="error" role="alert">A jelszó nem megfelelő.</p>':''}<form method="post" action="/access"><label for="password">Hozzáférési jelszó</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus><button type="submit">Belépés</button></form></main></html>`;
}

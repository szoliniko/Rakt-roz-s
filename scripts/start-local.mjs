import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWarehouseServer } from '../server/server.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Opens a fixed, locally constructed HTTP URL without passing it through a shell. */
export function openDefaultBrowser(url) {
  const command = process.platform === 'win32' ? 'rundll32.exe'
    : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  return new Promise((resolveOpened, reject) => {
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolveOpened()
      : reject(new Error(`A böngésző megnyitása nem sikerült (${code}).`)));
    child.unref();
  });
}

/** Same server and durable database as npm start; this launcher only adds
 * readiness verification, browser opening and a friendly shutdown prompt. */
export async function startLocal({
  port = 4174,
  database = resolve(ROOT, '.local/warehouse-test.sqlite'),
  openBrowser = openDefaultBrowser,
  log = console.log,
} = {}) {
  const app = createWarehouseServer({ database, mode: 'test' });
  try {
    await new Promise((resolveListening, reject) => {
      app.server.once('error', reject);
      app.server.listen(port, '127.0.0.1', () => {
        app.server.removeListener('error', reject);
        resolveListening();
      });
    });
  } catch (error) {
    app.store.close();
    if (error.code === 'EADDRINUSE') {
      throw new Error(`A ${port}-es helyi portot már használja egy program. Ha a raktárkezelő korábbi indítóablaka még nyitva van, használd azt, vagy állítsd le benne Enterrel, és indítsd újra. Más programot az indító nem állít le.`);
    }
    throw error;
  }

  const url = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const response = await fetch(`${url}/api/bootstrap`, {
      signal: AbortSignal.timeout(5000), redirect: 'error',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bootstrap = await response.json();
    if (bootstrap.mode !== 'test' || !bootstrap.users?.some(user => user.id === 'test-manager')) {
      throw new Error('Nem a várt raktárkezelő válaszolt.');
    }
  } catch (error) {
    await app.close();
    throw new Error(`A helyi kiszolgáló ellenőrzése nem sikerült: ${error.message}`);
  }

  log(`\nA raktárkezelő ezen a gépen fut: ${url}`);
  log('Belépés: Teszt raktárfelelős; PIN: 1234.');
  log('Tesztadatokat használ. Nincs élő r_keeper / StoreHouse-kapcsolat.');
  log(`A rögzített munka ebben a fájlban marad meg: ${database}`);
  log('Tartsd nyitva ezt az ablakot, amíg használod a rendszert.');

  // A browser association failure must not erase data or stop a healthy server.
  const browserOpening = Promise.resolve().then(() => openBrowser(url)).catch(error => {
    log(`A böngészőt nem sikerült automatikusan megnyitni: ${error.message}`);
    log(`Másold ezt a címet a böngésző címsorába: ${url}`);
  });
  return { ...app, url, database, browserOpening };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const app = await startLocal();
    const input = createInterface({ input: process.stdin, output: process.stdout });
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      console.log('\nA kiszolgáló leállítása…');
      input.close();
      try {
        await app.close();
        console.log('Leállt. A mentett munka a következő indításkor is megmarad.');
        process.exitCode = 0;
      } catch (error) {
        console.error(`Leállítási hiba: ${error.message}`);
        process.exitCode = 1;
      }
    };
    input.once('line', stop);
    input.once('SIGINT', stop);
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    console.log('\nLeállítás: Enter vagy Ctrl+C ebben az ablakban.');
  } catch (error) {
    console.error(`\nNem sikerült elindítani a raktárkezelőt.\n${error.message}`);
    process.exitCode = 1;
  }
}

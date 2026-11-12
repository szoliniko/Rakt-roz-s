# Védett, tartós Cloudflare-tesztüzem

2026. november 12. · Kapcsolódó követelmények: **ALAP-05/07, SZER-02, KAP-05–07**. Az eredeti [hosztolási átadás](hosztolas-atadas.md) szerinti külső ellenőrzések sikeresek.

## Elérés és belépés

**https://tordasi-raktar.tordasi-szoliniko.workers.dev/**

A saját Cloudflare-fiókban telepített alkalmazás a helyi géptől függetlenül működik. A cím nem ideiglenes helyi alagút vagy lejáró előnézet. Az üzemeltetés a Cloudflare-fiók és szolgáltatás rendelkezésre állásától függ.

1. A külön átadott hozzáférési jelszóval nyisd meg a védett kaput.
2. Válaszd a **Teszt Raktárfelelős** személyt; a teszt-PIN **1234**. Másik böngészőben például **Teszt átvevő · Saloon** használható, szintén 1234 PIN-nel.
3. A felület **Közös tesztüzem** állapotot jelez. Az ügyek közösek, a piszkozatok személyhez kötöttek.

A hozzáférési jelszó és az üzemeltetői titok Cloudflare-secret; nem része a repositorynak. A kapu munkamenete 8 órás, `Secure`, `HttpOnly`, `SameSite=Strict`, `__Host-` sütit használ. A személyes alkalmazásbelépés külön munkamenet. A teljes API, termékkatalógus és alkalmazáskód a kapu mögött van; csak a jelszókérő oldal nyilvános. Másik HTTPS-eredetről érkező írás elutasított.

## Futtatás és adattárolás

A Cloudflare nem az eredeti Node-folyamat helyi lemezét futtatja. A teljes felület és az összes meglévő alkalmazás-API egy Workerben fut; a változatlan üzleti szabályokat a közös `WarehouseStoreCore` használja. A Node-változat továbbra is `node:sqlite` fájlba ír. A felhőben egyetlen névvel azonosított `Warehouse` Durable Object tartós SQLite-adatbázisa őrzi az állapotot, az auditot, parancsazonosítókat, felhasználókat, belépéseket, PIN-próbakorlátokat és piszkozatokat.

Az atomi műveletek `storage.transactionSync` alatt futnak. Az összes kliens ugyanazt az adattárat éri el. Nincs kérésenként külön készlet, memóriában tárolt végleges állapot vagy API-hibánál önálló HTML-re váltás. A kliens által küldött személy és állapotverzió továbbra is ellenőrzött.

## Ellenőrzött bizonyíték

- **62/62 JavaScript-teszt sikeres**, beleértve az eredeti 61 tesztet. Az új teszt a tényleges Workers-futtatókörnyezet helyi változatával vizsgálja a kaput, manipulált sütit, tranzakciót, külön munkameneteket, újraindítást, teljes futtatóleállítást, tartós tárolást és mentés-visszaállítást. A Windows SQLite-tesztlezárás a fájl eltávolítása előtt bezárja a kapcsolatot.
- Külső HTTPS-en a névtelen API- és statikus kérések **401**, a főoldal **303** a belépőre. Idegen Origin és hamisított személy **403**, elavult állapot **409**. A megismételt parancs ugyanazt az eredményt adja, második készlethatás nélkül.
- **Á-0001**: 2 darab teszt-ásványvíz Fő raktár → Saloon. Két független API-munkamenet, majd **Chrome és az alkalmazásba épített külön böngésző** is ugyanazt az ügyet látta, raktárfelelősi és Saloon-átvevői belépéssel. A böngészős hibajegyzékek üresek voltak.
- A Durable Object tényleges leállítása (`storage.sync`, majd `ctx.abort`) után az indulási azonosító megváltozott; az ügy, teljes előzmény, munkamenet és személyes piszkozat változatlanul visszaolvasható maradt.
- Új Worker-verzió telepítése és mindkét böngésző újratöltése után is megmaradt az ügy, előzmény és piszkozat. A kiszolgált JavaScript-, CSS- és katalógusfájlok egyeztek a helyi forrással.
- A felhős mentés ellenőrzőösszege és visszaállítása új Node/SQLite-adatbázisba sikeres. A készlet, ügy, előzmény, piszkozat és parancsazonosító megmaradt; az ismétlés visszaállítás után sem könyvelt újra. Meglévő adatbázis célként elutasított.
- A próbaátadás a támogatott, indokolt **visszavonással** lezárva; a kiinduló készlet pontosan visszaállt, az audit megmaradt. A saját próbapiszkozat törölve, záró mentés készítve és visszaállítva. Végső állapotváltozat: **2**.
- A kizárólag ellenőrzésre szolgáló újraindítási végpont kikapcsolva: **404** a jogosult üzemeltetőnek is.

A gépi, titokmentes bizonyíték: [cloudflare-ellenorzes.json](cloudflare-ellenorzes.json). A képek, hozzáférési fájl és adatmentés külön, helyi átadási csomagban vannak; a repositoryba munkamenet vagy nyers adatbázis nem kerül.

## Mentés és helyreállítás

Raktárfelelősi belépés után a **[/api/admin/backup](https://tordasi-raktar.tordasi-szoliniko.workers.dev/api/admin/backup)** cím letölti a tranzakciósan egységes, SHA-256 ellenőrzőösszeggel ellátott mentést. A mentés tartalmazza a tesztadatokat és a hitelesítés hash-adatait is; védett fájlként kezelendő.

Visszaállítás új, még nem létező adatbázisba, Node.js 24 mellett:

```sh
node scripts/restore-cloudflare-backup.mjs mentes.json uj-adatbazis.sqlite
node server/server.mjs --test --database uj-adatbazis.sqlite
```

Ez a hordozható mentésből Node/SQLite-ba történő helyreállítás útja. A futó felhős adatbázist nem írja felül. Cloudflare-be visszatöltő adminművelet és külön rendszeres külső mentési ütemezés nincs beállítva; a letöltést az üzemeltető kezdeményezi. Éles használat előtt a mentési gyakoriság, megőrzés és helyreállítási eljárás külön rögzítendő.

## Telepítés és karbantartás

Node.js 24, pnpm és a rögzített lockfile:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm exec wrangler whoami
pnpm exec wrangler deploy --dry-run
pnpm exec wrangler deploy
```

A `wrangler.jsonc` rögzíti a saját fiókot, a Worker nevét, a pontos külső eredetet és a tartós objektum SQLite-migrációját. A `scripts/build-cloudflare.mjs` csak a szükséges alkalmazásfájlokat csomagolja. A hozzáférési titok megléte nélkül minden tartalom zártan, 503-mal áll meg. Az első telepítés titkai figyelmen kívül hagyott JSON-fájlból a `wrangler deploy --secrets-file ...` kapcsolóval adhatók át; titkot ne tegyél parancssori értékbe vagy verziókezelésbe.

Az ellenőrző `scripts/verify-cloudflare-live.mjs start` / `finish` tudatos, készletet is érintő **tesztüzemi** művelet. A `start` előtti telepítésnél csak a próba idejére kell `ENABLE_RESTART_TEST:true` és az `OPERATIONS_KEY` secret; a végleges konfigurációban a kapcsoló **false**. A script kizárólag a fent megnevezett tesztkiszolgálót célozza. Egy új ellenőrzést csak az előző rendezése és az elkülönített `.local` napló archiválása után szabad indítani.

## Megmaradó határok

Ez a teljes meglévő alkalmazás **szerveres tesztüzeme**. A valódi r_keeper/StoreHouse-kapcsolat, kasszafogyás és helyszíni könyvelés nincs bekötve. Az induló mennyiségek kitalált próbaadatok. **NYIT-01 és NYIT-15 nyitott:** a helyszíni integráció és a felhasználói/valódi tabletes elfogadás továbbra is külön feladat.

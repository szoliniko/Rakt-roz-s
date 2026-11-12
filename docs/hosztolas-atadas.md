# Átadás: böngészőből elérhető szerveres tesztüzem

**2026. november 12-i kiegészítés:** a [védett Cloudflare-tesztüzem elkészült és ellenőrzött](cloudflare-hosztolas.md), tényleges újraindítással, új telepítéssel, két külön böngészővel és mentés-visszaállítással. Az alábbi októberi leírás a kiinduló Node-változat és az átadási feltételek történeti dokumentuma; a felhős változat tartós Durable Object SQLite-adattárat használ.

2026. október 27. · A felhasználó egy megnyitható linket kér, amely mögött valódi kiszolgáló és tartós közös adatbázis működik. A futtatás helye mellékes. A GitHub-feltöltést és a másik munkamenetben történő Sites-publikálást kérte lehetséges folytatásként. Ez a lap a következő megvalósító számára készült; nem állít már létező külső címet vagy sikeres telepítést.

Kapcsolódó követelmények: ALAP-05/07, SZER-02, KAP-05–07; NYIT-01 és NYIT-15 továbbra is nyitott. A [működési terv](mukodesi-terv-vazlat.md), [követelményjegyzék](kovetelmenyjegyzek.md) és [ellenőrzött megvalósítás](alapok-megvalositasa.md) a teljes feladat alapja.

## Első döntés: mit tud a célkörnyezet?

Ellenőrizd a használt Sites-szolgáltatás tényleges képességeit: tartósan futó Node.js 24 folyamat, bejövő HTTP-kérések, tartósan írható lemez, HTTPS és hozzáférés-védelem. Ezeket a szolgáltatás neve alapján nem feltételezzük.

Ha csak statikus oldalt tud kiszolgálni, a szervernek külön megfelelő futtatási hely kell, a felület és az API számára lehetőleg közös webcímmel. A `demo/index.html` vagy `raktar-bemutato-v6.html` közzététele önmagában nem teljesíti a közös szerveres tesztüzem célját. Sikertelen API-elérés esetén ne válts észrevétlenül helyi HTML-próbaállapotra.

## A jelenlegi alkalmazás pontos indítása

- Node.js **24 vagy újabb**, beépített `node:sqlite`; nincs telepítendő npm-függőség. A kiszolgáló nem igényel frontend-buildet.
- `npm start` → `node server/server.mjs --test`; alapértelmezett cím **127.0.0.1:4174**.
- A `/` útvonal a `demo/template.html` felületet szerveres módban szolgálja ki; az API ugyanazon a címen, `/api/*` alatt működik.
- A kiszolgáló jelenleg **nem olvassa automatikusan a platform `PORT` környezeti változóját**. Indítási kapcsolói: `--host`, `--port`, `--database`, `--allowed-hosts`.
- A `--host` a figyelési cím. Konténeres futtatáshoz a platform szerint lehet szükség `0.0.0.0` értékre; az alkalmazás a hozzáférést ellenőrző HTTPS-kiszolgáló mögött maradjon.
- A `--allowed-hosts` vesszővel elválasztott pontos gépneveket fogad, séma, port és útvonal nélkül. A fogadott `Host` fejlécnek szerepelnie kell az engedélyezett listán.
- `--database` nélkül az adatfájl a projekt `.local/warehouse-test.sqlite` útvonalára kerül. A telepítés külön, tartósan megőrzött könyvtárban adja meg a helyét.

## Tartós tárolás és HTTPS

Az adatbázis könyvtára a SQLite WAL/SHM kísérőfájlokkal együtt legyen írható és megőrzött újraindítás, új telepítés és konténercsere után. A jelenlegi SQLite-változat egy kiszolgálópéldánnyal induljon; ne keletkezzen több külön, eltérő készletet tároló adatbázis automatikus skálázáskor. Üres ideiglenes fájlrendszer újraindulása nem tekinthető tartós tárolásnak. Mentés: `scripts/backup.mjs`; a visszaállítás új célfájlba történik.

A HTTPS-előtétet és az alkalmazás eredetellenőrzését együtt kell beállítani. A jelenlegi kód a kérés `Host` fejlécéből **HTTP** eredetet képez, ezért a böngésző által küldött `https://…` Origin fejléccel végzett írás egyszerű TLS-előtét mögött is elutasítható. A helyes megoldás ellenőrzött külső eredet támogatása a szerverben, vagy a pontos külső eredetet előbb ellenőrző, majd belső Host/Origin értékre átvezető proxy. Az eredetellenőrzést ne kapcsold ki, és idegen Origin fejlécet ne írj át ellenőrzés nélkül. A munkamenetsütik HTTPS-hez szükséges `Secure` beállítása szintén telepítési feladat; a jelenlegi süti `HttpOnly; SameSite=Strict`.

## A hozzáférést a megnyitás előtt védd

A mostani tesztfelhasználók PIN-je **1234**, és a `/api/bootstrap` ezt visszaadja. Ez kifejezetten helyi tesztazonosítás, nem nyilvános szolgáltatás hitelesítése. Védelem nélkül ne tedd internetre az írható tesztrendszert.

A teszteléshez megfelelő lehet a teljes alkalmazást és összes API-/statikus útvonalát védő szolgáltatói beléptetés vagy külön hozzáférés-védelem, erős, nem a repositoryban tárolt hitelesítő adattal. Alternatíva a tesztfiókok hitelesítésének és bootstrapjának tényleges megerősítése; ez jelenleg még nincs megvalósítva. Egy rejtett URL vagy az ismert 1234 PIN nem ilyen védelem. A próbaadatbázis, munkamenetek, titkok és a felhőben korábban végzett próbák nem kerülnek GitHubra.

## A link átadása előtti ellenőrzés

1. A tényleges külső HTTPS-címen működjön a hozzáférés-védelem és az alkalmazás belépése; a képernyő szerveres tesztüzemet jelezzen.
2. Tesztadatokkal rögzíts visszavonható kiadást, és külön böngészős munkamenetből ellenőrizd, hogy ugyanaz az ügy látszik. A vizsgálat után a saját próbaműveletet a támogatott munkafolyamattal rendezd.
3. Újratöltés és a kiszolgáló tényleges újraindítása után is maradjon meg az ügy, előzmény és mentett piszkozat. A puszta böngészőfrissítés nem bizonyít újratelepítés utáni adatmegőrzést.
4. Ugyanannak a parancsazonosítónak az ismétlése ne készítsen második készletmozgást; elavult állapot és hibás személyazonosság továbbra is elutasítandó.
5. Külső hozzáférés-azonosítás nélkül az API és a felület se legyen elérhető. Idegen Originből érkező módosítás ne menjen át a proxyn. Nézd meg a böngésző API-/JavaScript-hibáit is.
6. Add át a ténylegesen ellenőrzött linket és a belépés módját, valamint jelezd, ha a cím vagy a tárhely csak ideiglenes.

Ez valódi kiszolgálón működő **tesztüzem**. A PDF termékazonosságai és a kitalált próbakészlet használhatók; az éles r_keeper/StoreHouse-kapcsolat, valódi kasszafogyás és helyszíni könyvelés továbbra sincs bekötve. A hosztolás ezeket nem pótolja.

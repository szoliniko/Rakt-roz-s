# r_keeper–StoreHouse integráció: források és ellenőrzési alap

Ellenőrzés dátuma: 2026. október 24.

Az eredeti dokumentum érdemi műszaki kiindulópontot ad: külön tárgyalja a POS- és raktárinterfészt, megnevezi az első diagnosztikai végpontokat, és leírja az értékesítésből származó készletfogyás útját. Ezeket az alábbiakban oldalszámmal visszakereshetően megőrizzük. **A dokumentumból átvett képesség és a helyben igazolt működés külön bizonyíték:** telepített verziót, engedélyezett API-t, licencet vagy elérhető eljárást még nem ellenőriztünk élő rendszeren.

A jelenlegi cél érthető raktárkezelő felület r_keeper-kapcsolattal, ételekhez és italokhoz. A korábbi anyag menetrendíróra, előzetes igénytervezésre és rendelésgenerálásra épülő javaslatai nem az első változat követelményei.

## Forrás és bizonyosság

Elsődleges helyi forrás: [az eredeti dokumentum változatlan átirata](forrasok/rkeeper-eredeti-atirat.md). Az alábbi „PDF / nyomtatott” számok a fájl oldalcímeire és a dokumentum eredeti oldalszámaira utalnak. A forrásjegyzék szerint a korábbi szerző 2026. augusztus 1-jén ellenőrizte a linkeket; ez nem jelenlegi ellenőrzési eredmény.

| Bizonyíték | Jelenlegi állapot |
| --- | --- |
| Az eredeti anyag konkrét műszaki állításai | Kiolvasva; alább oldalszámmal hivatkozva. |
| Hivatalos dokumentáció mostani tartalma | Nem sikerült lekérni: a hálózati proxy CONNECT 403 Forbidden választ adott. |
| A felhasználó telepített r_keeper/StoreHouse rendszere | Nem történt élő kapcsolatpróba; pontos verzió, modul, API és jogosultság nem igazolt. |
| Készletváltoztató művelet | Nem futott; sem nyilvános, sem magán üzleti rendszerre nem küldtünk író kérést. |

## Az eredeti dokumentumból megőrzött műszaki alap

### POS, raktár és a kapcsolódó interfészek

| Terület | A forrás megállapítása | Forrás: PDF / nyomtatott oldal |
| --- | --- | --- |
| r_keeper 7 | POS/front-office: menü, ár, asztal, rendelés, kedvezmény, fizetés, kassza, operatív riport. | 9 / 5 |
| StoreHouse | Termék- és mértékegységtörzs, készlet, receptúra, önköltség, beszállító, beszerzés, termelés, belső mozgás. | 9 / 5; 15 / 8 |
| StoreHouse Web API | HTTP/JSON alapú szervereljárás-hívás; nem szokásos REST-erőforrásmodell. A helyi eljárásjog és adatszerkezet lekérdezhető. | 15 / 8; 17 / 9 |
| r_keeper 7 XML | POS-, rendelés-, fizetési és referencia-műveletek; HTTPS/XML, RK7-dolgozóhoz kötött HTTP Basic hitelesítés; írás licencfüggő. A forrásban szereplő útvonal: `/rk7api/v0/xmlinterface.xml`, a tényleges gép és HTTPDataPort helyi beállítás. | 17 / 9; 21 / 11; 25 / 13 |
| OrderNotify | Rendelési/pénztári eseményértesítés. A forrás korlátozott sort és eseményvesztési helyzetet említ; nem bizonyít általános StoreHouse-készletváltozás-webhookot. | 17 / 9 |
| White Server API v2 + WSA | Távoli integráció; a helyi White Server Agent közvetít r_keeper/StoreHouse felé. JSON-RPC, szinkron/aszinkron feladat, `taskGuid` szerinti státusz; külön onboarding és licenc. | 19 / 10; 25 / 13 |
| Delivery API | Menü, stoplista és kiszállítási rendelés; OAuth2. Nem a raktári bevételezés és belső mozgás interfésze. | 19 / 10; 21 / 11 |
| Riport-/SQL-export | Olvasási analitika lehetséges tartalék útja. A forrás nem javasol közvetlen StoreHouse-adatbázis-írást. | 15 / 8; 19 / 10; 59 / 30 |

A forrás az XML interfész régi `rk7xml.dll` útvonalát az autentikáció hiánya miatt nem ajánlja. Ez nem jelenti azt, hogy a helyi telepítés XML-hozzáférése eleve rendelkezésre áll. A White Server és a Delivery jelenléte sem előfeltételezhető pusztán az r_keeper használatából.

### StoreHouse diagnosztika és konkrét eljárásnevek

A következő nevek az eredeti anyagból származnak, **nem az élő szerver már ellenőrzött képességlistája**.

| Cél | A forrásban szereplő név | Határ / ellenőrzendő rész | Forrás |
| --- | --- | --- | --- |
| API-, szerver- és adatbázisverzió | `/api/sh5info` | A válasz mezőit és a hitelesítés szükségességét a konkrét szolgáltatáson kell ellenőrizni. | PDF 15 / 8, 20. pont; PDF 21–23 / 11–12 |
| Eljárásjog ellenőrzése | `/api/sh5able` | Eljárásonkénti jog; nem ad új jogosultságot. | PDF 17 / 9, 21. pont |
| Bemeneti/kimeneti struktúra | `/api/sh5struct` | A telepített build szerkezete a mérvadó. | PDF 17 / 9, 22. pont |
| Eljárás végrehajtása | `/api/sh5exec` | A kiválasztott eljárástól függően olvas vagy ír; önmagában nem „csak olvasó” végpont. | PDF 17 / 9, 23. pont |
| Felhasználó-/szerepkör-kezelés | `/api/sh5user`, `/api/sh5role` | Adminisztratív műveletek; az első olvasási próbához nem szükségesek. | PDF 17 / 9, 24. pont |
| Raktárak/részlegek | `Departs` | Javasolt olvasási kiindulópont; mezői és elérhetősége helyben ellenőrzendő. | PDF 23 / 12 |
| Termékek és egységek | `Goods`, `GoodsItem`, `GoodsMUnits` | Az azonosítók, alapegység és kiszerelés-átváltások szükségesek a mennyiségek helyes értelmezéséhez. | PDF 23 / 12; 37–39 / 19–20 |
| Készlet | `GRemns` | Időpont, raktár, mennyiség és a készletfogalom jelentése helyben ellenőrzendő. | PDF 17 / 9; 23 / 12 |
| Igény-/rendelési dokumentum olvasása | `ODocs`, `ODoc` | A dokumentum ezeket is a kezdő olvasási listában nevezi meg; nem általánosítjuk minden bizonylattípusra. | PDF 23 / 12 |
| Receptúra olvasása/írása | Nincs biztos, konkrét eljárásnév megadva | A forrás külön kéri a verzióhoz tartozó eljárás és receptverzió-kezelés megerősítését. | PDF 23 / 12; 27 / 14 |
| Termék létrehozása | `InsGood` | A termék létrehozása külön művelet a bevételezéstől. Duplikáció, termékazonosító és egységváltás kezelendő. | PDF 37–39 / 19–20 |
| Bevételezés | `InsGDoc0` | A forrás inaktív bizonylat előkészítésére javasolja; ezt a konkrét builden kell igazolni. | PDF 23 / 12; 39 / 20, 76. pont |
| Belső mozgás | `InsGDoc11` | A forrás inaktív belső mozgásra javasolja; kötelező mezők és készlethatás tesztelendő. | PDF 23 / 12; 39 / 20 |
| Kompletálás/termelés | `InsGDoc12` | Alapanyag-felhasználás, létrejött félkész/kész termék és kihozatal; nem egyszerű raktárközi átadás. | PDF 23 / 12; 41 / 21 |
| Belső igény/rendelés módosítása | `ModODoc` | A forrás nevezi meg; a jelenlegi első változat nem vállal rendelésgenerálást. | PDF 23 / 12; 39–41 / 20–21 |
| Bizonylat aktiválása | `ActivateGDoc` | Külön készletváltoztató lépésként kezeli; a puszta létrehozás és az aktiválás nem vonható össze feltételezés alapján. | PDF 23 / 12; 41 / 21 |
| Kiadás, selejt és leltár | Képesség szerepel, teljes konkrét eljáráslista nincs | Nem nevezünk ki találomra API-metódust. Leltár/selejt saját mezői, státuszai és készlethatása külön ellenőrzendők. | PDF 17 / 9; 29 / 15; 41 / 21 |

A dokumentum V2 esetén gyakori 9797-es, V3 esetén gyakori 9798-as portot említ, és külön Web API buildet, valamint akár egyirányú V3-migrációt is jelez (PDF 17 / 9; 21 / 11). **A StoreHouse 4/5/Pro termékverzió és a Web API V2/V3 változat külön adat.** A felsorolt `sh5...` útvonalakból nem következik, hogy StoreHouse 4-ben is ugyanez az interfész elérhető. SH4-kompatibilitást a jelenlegi bizonyítékok nem igazolnak.

A PDF 21 / 11 szerint a Web API 2 önmagában nem igényel külön licencet; a helyi szerződés, telepítés, frissítés, támogatás és más modulok díját ettől még ellenőrizni kell. Ezt most nem sikerült friss gyártói oldallal megerősíteni. A forrás a nagy válaszokhoz GZIP támogatást/követelményt is említ (PDF 17 / 9); részletes méretkorlát vagy tömörítési szerződés innen nem állapítható meg.

### Hogyan lesz a POS-eladásból alapanyag- és italfogyás?

Az eredeti folyamat a PDF 27 / nyomtatott 14. oldalon, a 41–45. pontban:

1. Az r_keeperben a rendelést kifizetik és lezárják.
2. Az értékesítés bekerül a kumulatív adatbázisba.
3. A QUSH importálja a megfelelő menü- és értékesítési adatot.
4. A StoreHouse a receptúra szerint alapanyagokra és félkész termékekre bontja a fogyást.
5. Az automatikus leírás vagy online készletszámítás frissíti a készletképet.

A PDF 9 / 5 az MS SQL/PostgreSQL kumulatív adatbázist, ütemezett napi importot és néhány perces online frissítést említ. A PDF 27 / 14 különbséget tesz **könyvelt készlet** és a már fizetett, de még véglegesen le nem könyvelt POS-fogyást is figyelembe vevő **online készlet** között. Ez nem igazol szigorúan valós idejű működést vagy azt, hogy egy nyitott rendelés már készletet csökkent.

A PDF 35 / 18 szerint az értékesítési helyhez rendelt leírási részleg határozza meg, mely készlethely fogyását kell kezelni. A korábbi anyag Főraktár/Konyha felosztása javaslat; ebből nem állapítható meg a tényleges raktár-, pult- vagy italraktár-hozzárendelés.

Az italoknál ugyanúgy ellenőrizni kell a POS-cikk ↔ StoreHouse-termék/recept kapcsolatot és a darab/liter/adag/kiszerelés váltást. A forrás nem ad kész, igazolt szabályt a csapolt sörre, bontott palackra, kevert italra vagy göngyölegre. Ezek támogatását és a használt egységeket a valós törzsadatból és egy-egy ellenőrzött eladásból kell megállapítani. A saját felület nem számolhatja le újra ugyanazt az eladást, ha a megjelenített StoreHouse-készlet már tartalmazza azt; ez integrációs ellenőrzési követelmény, nem külön gyártói végpont.

### Státusz, hibakezelés és idempotencia

A PDF 23 / 12 és 39 / 20 megkülönbözteti az inaktív dokumentumot az aktivált bizonylattól. A konkrét státuszmezők, alapértelmezések, létrehozási visszatérési értékek és visszavonási szabályok nincsenek teljes szerződésként megadva.

A PDF 25 / 13, 40. pont minden íráshoz idempotenciakulcsot, auditnyomot és jóváhagyást javasol. **Ez tervezési követelmény; nem bizonyítja, hogy a StoreHouse API natívan elfogad idempotenciakulcsot.** A PDF 39 / 20 egyedi külső bizonylatazonosítót javasol, de nem ad ehhez ellenőrzött JSON-mezőt vagy egyediség-garanciát. Újrapróbálás, időtúllépés utáni visszaolvasás és duplázás elleni védelem csak a tényleges szerződés ismeretében tervezhető véglegesen.

A PDF 47 / 24 szerint a már aktív dokumentum hibáját üzletileg megfelelő ellenbizonylattal célszerű kezelni; ez a korábbi terv ajánlása, nem minden bizonylatra igazolt, kész API-művelet. Az eredeti `get_stock_by_department`, `draft_receipt`, `draft_internal_transfer` és hasonló nevek a javasolt saját üzleti eszközök nevei (PDF 45 / 23), **nem gyártói API-metódusok**.

## Jelenlegi nyilvános forrásellenőrzés

A 2026. október 24-i HTTPS-lekérések eredménye:

| Pontosan megkísérelt URL | Eredmény |
| --- | --- |
| https://docs.rkeeper.ru | A proxy az alagút létrehozását `403 Forbidden` válasszal elutasította; oldalt nem kaptunk. |
| https://docs.rkeeper.com | Ugyanez; oldalt nem kaptunk. |
| https://docs.restera.com | Ugyanez; oldalt nem kaptunk. |

Nem került sor TLS-ellenőrzés kikapcsolására vagy a proxy megkerülésére. A fenti URL-ek honlapcímek, nem kitalált cikkhivatkozások. A szkennelt forrásjegyzék a címeket és domaineket őrzi, az egyes oldalak teljes URL-jét nem; ezért konkrét cikk-URL-t és most ellenőrzött oldalcímet jelenleg nem tudunk megadni.

A PDF 63 / nyomtatott 32. oldalon megnevezett, később közvetlenül ellenőrizendő fő források:

| A szkennelt forrásjegyzékben szereplő cím | Megadott domain |
| --- | --- |
| r_keeper 7 XML interfész; XML interfész előfizetés és fejlesztői token | docs.rkeeper.ru |
| HTTP OrderNotify eseményküldés | docs.rkeeper.com |
| StoreHouse Web API; StoreHouse szervereljárás-katalógus | docs.rkeeper.ru |
| StoreHouse rendszertelepítés – Web API 2 licencinformáció; Web API telepítése; HTTPS-beállítása | docs.rkeeper.ru |
| StoreHouse V2-V3 átállás | docs.rkeeper.ru |
| r_keeper 7 és StoreHouse kapcsolat beállítása; StoreHouse online készletek; Online készletjelentés tartalma | docs.restera.com |
| StoreHouse receptúrák és félkész termékek; értékesítési hely és leírási részleg; QUSH-kapcsolatok; online leírás | docs.rkeeper.ru |
| InsGood; InsGDoc0; ModODoc; InsGDoc11; InsGDoc12; ActivateGDoc | docs.rkeeper.ru |
| StoreHouse licencelés | docs.rkeeper.com |
| StoreHouse mobil adatgyűjtő terminál | docs.rkeeper.ru |
| White Server API v2; gyorsindítás; integrációk licencelése; Agent v2 telepítése | docs.rkeeper.ru |

## Minimális feltételek és az első olvasási próba

A konkrét integráció megvalósíthatóságához szükséges:

1. A tényleges r_keeper-verzió és a felhasználó által megerősített StoreHouse termék-/szerver-/adatbázis-verzió azonosítása, továbbá annak ellenőrzése, hogy melyik Web API-változat érhető el. Az eredeti dokumentum ehhez kifejezetten StoreHouse 4/5/Pro kérdést ír elő (PDF 59 / 30, 144–146. pont).
2. A rendszergazda/UCS által megadott teszt- vagy éles API-cím, elérési út, jogosultság és szolgáltatásállapot. A portot nem találgatjuk, magánhálózati címeket nem pásztázunk.
3. Az első adatokhoz külön olvasási jogosultság; a konkrét eljárások és struktúrák ellenőrzése; a raktárak, termékazonosítók, egységek és receptek mintájának egyeztetése.
4. Ha a POS-fogyást készletben is látni kell: a QUSH vagy más tényleges adatút, értékesítésihely-hozzárendelés, receptkapcsolat, importidőzítés és készletfogalom igazolása egy ellenőrzött példán.
5. Írás előtt tesztadatbázis vagy jóváhagyott teszteljárás, dokumentumstátusz- és készlethatás-vizsgálat, hibajavítási és duplikációkezelési bizonyíték. Ez nem akadálya az előzetes olvasási diagnosztikának.

**Következő legkisebb próba:** a rendszergazda által megerősített teljes `/api/sh5info` URL-re egy hitelesítés nélküli GET, a megerősített hálózati útvonalon. Alapja a PDF 21 / nyomtatott 11. oldal „Első, jelszó nélküli kapcsolati próba” része. Ez a régi anyagból származó próbaszerződés; helyben még nem igazolt.

Az eredeti példa `errorCode: 0`, `errMessage: "OK"` és `Version` jellegű választ mutat. Nem feltételezzük, hogy minden változat pontosan ezeket a mezőket adja. A HTTP-státuszt, a válasz értelmezhetőségét és a tényleges verzióadatot kell rögzíteni; egy HTTP 200 önmagában nem igazolja a raktári funkciók működését. Hitelesítési hiba esetén a diagnosztika megáll, nem próbál jelszót vagy más végpontot találgatni.

A PDF 23 / 12 külön hitelesített `POST /api/sh5info` példát is mutat `UserName` és `Password` JSON-mezőkkel. Ez most nincs hivatalos oldallal újraellenőrizve, ezért az első diagnosztika nem küld ilyen adatot. Hitelesítő érték nem kerül ebbe a dokumentumba, a repositoryba vagy a naplóba.

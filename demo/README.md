# A raktárkezelő tesztüzem kipróbálása

A napi munkafolyamatok közös készletet használnak. A termékek között a beküldött PDF ellenőrizhető nyomtatott tételei is szerepelnek; a készletmennyiségek **kitalált tesztadatok**. A tesztüzem nem kapcsolódik a valódi StoreHouse-hoz vagy r_keeperhez.

## Közös, tartós tesztüzem indítása

A saját Windows-gépen a hordozható csomag `Inditas.cmd` fájlja indítja a kiszolgálót és a böngészőt; nem a HTML-fájlt kell megnyitni. [Kibontás, belépés, adatmegőrzés és leállítás](../docs/windows-inditas.md). Az alábbi parancsos indítás a fejlesztői forráskönyvtárra vonatkozik. A felhőben indított szerver localhost címe nem jelenti automatikusan a felhasználó saját gépén futó szervert.

Node.js 24 vagy újabb szükséges. A projekt gyökerében:

```sh
npm start
```

Ezután nyisd meg: **http://127.0.0.1:4174**.

A **Ki használja a tabletet?** belépőképernyőn választható a tesztfelhasználó neve. A közös teszt-PIN **1234**. Ezek kitalált próbafelhasználók; az éles dolgozókat és saját PIN-jeiket majd külön kell felvenni. A raktárfelelős, a helyi átvevők és helyettesek eltérő személyazonossággal dolgoznak. A kiszolgáló határozza meg a jogosultságot; a képernyő választója önmagában nem adhat új szerepet.

A rögzített ügyek, előzmények és kiszolgálóra mentett piszkozatok a `.local/warehouse-test.sqlite` fájlban maradnak meg. Az oldal újratöltése és a kiszolgáló újraindítása nem újrakezdés. A külön böngészőben indított, ugyanarra a kiszolgálóra kapcsolódó munkamenetek ugyanazt a közös készletet használják; az eltérő felhasználói piszkozatok elkülönülnek.

A pontos indítási parancs megadható külön tesztadatbázissal is:

```sh
node server/server.mjs --test --port 4174 --database .local/warehouse-test.sqlite
```

Alapértelmezésben a kiszolgáló csak a saját gépről érhető el. Fizikai tabletek hálózati eléréséhez a hálózati címet és az engedett gépneveket kifejezetten be kell állítani; ezt a helyszíni üzemeltetéssel együtt kell megtenni. Ez a HTTP-s helyi tesztindítás nem éles HTTPS-telepítés. A `--live` indítás a még nem konfigurált valódi kapcsolatot nem helyettesíti tesztüzemmel.

## Egy napi próba menete

1. Lépj be raktárfelelősként. A **Műszakok és átvevők** feladatban nyisd meg a ténylegesen működő pult — például a Saloon — műszakját, kijelölt átvevővel és szükség szerint helyettessel. Az adott pultnál ők igazolhatnak és jelenthetnek selejtet. A raktári/konyhai helyi átvevőhöz nem kell pultműszak. Az **Áttekintés** mutatja a nyitott ügyeket és az indítható feladatokat.
2. Bevételnél vagy kiadásnál terméknévre/kódra kereshetsz; ellenőrizd a csoportot és az egységet is. Adj meg saját próbatételeket és mennyiségeket. Az **Ellenőrzés rögzítés előtt** összefoglalón ellenőrizd: honnan, hová és pontosan mi kerül. Az **Ellenőriztem, rögzítem** gomb küldi be a műveletet. A mentett piszkozat még nem készletmozgás.
3. Kiadás után a **Másik dolgozó belépése / zárolás** gombbal válts belépésre, és lépj be a fogadó hely kijelölt átvevőjével. Külön munkamenet vagy másik böngésző is használható. Csak a ténylegesen ellenőrzött mennyiséget igazold. Kevesebb áru esetén a különbözetet a raktárfelelős rendezi.
4. A **Készlet** és az **Eddigi műveletek** alatt nézd meg a helyenkénti eredményt és a személyhez/időponthoz kapcsolt előzményt. Egy lezárt átadás később is megnyitható.
5. Műszak végén a kijelölt felelős indítsa a számolást. A korábban megnyitott pultműszak miatt akkor is látszik a még el nem kezdett zárás, ha senki nem nyitotta meg a számolást. A számolás alatt az adott hely árumozgása szünetel; leadás után a raktárfelelős külön ellenőrzi az eredményt.

A pulti számolás a hely ismert italválasztékából indul, a korábban használt, most nulla készletű tételekkel együtt. Ha a dolgozó további árut talál, hozzáadhatja a számoláshoz; attól, hogy egy sor nem szerepelt a kezdeti listában, még nem szabad kihagyni a fizikai számbavételből. A teljes forráskatalógus összes, ott soha nem tárolt termékét nem kell minden pultnál végigszámolni.

A Fő raktárban, Italraktárban és Konyhán továbbra is szükség szerint indítható teljes vagy részleges leltár. Ezek nem kapnak kötelező pultműszakot.

## Több nyitott átadás és javítás

Ugyanarra a pultra több kiadás indulhat. Mindegyik külön azonosítóval, tételekkel és határidővel marad meg; az egyik igazolása nem zárja le a többit. Újabb kiadásnál figyelmeztetés mutatja a meglévő ügyeket. A még nem igazolt átadás 30 perc után piros, szöveges késési jelzést kap. Ez nem készlethiány-megállapítás és nem automatikus könyvelés.

Ha a függő átadásban szereplő áru valójában még a forráshelyen van, a raktárfelelős indokkal visszavonhatja. A már igazolt ügyet külön, az eredetire hivatkozó helyesbítő árumozgás rendezi; az eredeti történet nem törlődik. Az áru tényleges helyzetét és az új mozgás mennyiségét ellenőrizni kell.

Félbehagyott számolásnál a raktárfelelős indokolt megszakítással oldhatja fel a hely zárolását. Ez nem írja át a készletet. A műszak felelősségének átadása külön esemény, saját azonosítással; a korábbi művelet végzője nem változik meg.

## Kapcsolathiba és megőrzött munka

A felület megkülönbözteti az adott készülékre és a közös kiszolgálóra mentett piszkozatot. Sikertelen mentésnél nem szabad mentettnek tekinteni az adatot. Másik dolgozó saját belépése nem használja észrevétlenül az előző piszkozatát vagy nevét.

Ha a beküldés válasza eltűnik, a művelet eredménye ellenőrzésre várhat. Ugyanannak az azonosítónak az eredményét kell ellenőrizni; a kapcsolat visszatérése nem hoz létre magától új műveletet. Ha közben más dolgozó változtatott a készleten, az elavult adatból küldés friss ellenőrzést kér. A bevitt tételek megmaradnak, de a véglegesítést a friss helyzet alapján kell áttekinteni.

## A terméklista forrása

A [tesztkatalógus leírása](../docs/forrasok/storehouse-tesztkatalogus.md) rögzíti, mely nyomtatott kódok, nevek és egységek kerültek be, és mely bizonytalan sorok várnak külön ellenőrzésre. A darab, kg, liter mellett az adag és zacskó is önálló egység lehet. A terméknévben szereplő kiszerelés nem számít automatikusan ellenőrzött átváltásnak.

A forrásból felvett termékekhez a tesztkezdőkészlet a **Fő raktárban** ad próbamennyiséget; a többi helyre bevételezéssel vagy igazolt átadással kerülnek. Az egységtől függően 60 darab, 20 liter, 10 kg, 10 adag vagy 10 zacskó a kitalált alapmennyiség. Ezek egyike sem a papírról kiolvasott mai készlet.

A papír termékkódja nem bizonyított StoreHouse API-azonosító. A kézzel átírt név/egység külön jelzést igényel; a nyomtatott és kézi adat nem olvad össze észrevétlenül. A régi kézi készletmennyiségek nem kerülnek át a tesztbe mai készletként. A hat általános bemutatótermék a korábbi folyamatok kipróbálásához külön mintaként megmaradhat.

## Adatbázismentés és visszaállítás

A helyi tesztadatbázis mentése új fájlba:

```sh
node scripts/backup.mjs create .local/warehouse-test.sqlite /tmp/warehouse-test-backup.sqlite
```

Visszaállítás egy **új**, még nem létező céladatbázisba:

```sh
node scripts/backup.mjs restore /tmp/warehouse-test-backup.sqlite .local/warehouse-restored.sqlite
node server/server.mjs --test --port 4175 --database .local/warehouse-restored.sqlite
```

A mentés a parancsazonosítókat és az előzményeket is őrzi, hogy a visszaállítás ne nyissa meg a kétszeri rögzítés lehetőségét. A parancs nem arra való, hogy észrevétlenül felülírjon egy futó vagy meglévő adatbázist. Az éles mentési ütemezés és helyszíni helyreállítási próba külön üzemeltetési feladat.

## Önálló HTML és fejlesztési forrás

Az [önálló v6 bemutatófájl](raktar-bemutato-v6.html) kiszolgáló nélkül is megnyitható. Helyi módja nem jelent közös többtabletes tárolást vagy éles hitelesítést. A tényleges mentési lehetőséget a felület jelzi; korlátozott beágyazott előnézetben tartós böngészőtárolás nem feltétlenül érhető el. A közös tárolás és jogosultság kipróbálásához a fenti kiszolgálós indítást használd.

A szerkesztendő felület a `template.html`, `app.mjs`, `runtime.mjs` és `style.css`. Az üzleti szabályok a `src/domain/inventory.mjs` fájlban, a kiszolgáló és a kapcsolati réteg külön könyvtárban található. A megnyitható HTML-fájlok generált kimenetek:

```sh
python3 scripts/build_demo.py
```

## Ellenőrzés és éles határ

A [kilenc alap lefedettsége](../docs/alapok-megvalositasa.md) sorolja fel a helyi eredményeket és a hozzájuk tartozó teszteket. A [korábbi dashboard-bizonyíték](../docs/bemutato-ellenorzes.md) a v5 állapot története; nem bizonyítja automatikusan az új közös kiszolgáló minden folyamatát.

A rendszerben továbbra sincs igazolt StoreHouse-könyvelés, élő r_keeper/QUSH-fogyás, szállítólevél-OCR vagy valós palackreferencia. A helyi teszt nem igazolja a késő kasszaadat és a leltári időpont teljes egyeztetését. A helyszíni adapter, adatok, személyek, jogosultságok és fizikai tabletes próba továbbra is szükséges.

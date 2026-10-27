# Raktárkezelő felület – termékalap

<!-- impeccable:product-schema 1 -->

Ez a dokumentum az egyeztetett termékcélt és a jelenlegi bemutató kereteit rögzíti. A teljes követelményforrás a [működési terv](docs/mukodesi-terv-vazlat.md) és a [követelményjegyzék](docs/kovetelmenyjegyzek.md).

## Platform

web

A jelenlegi kattintható bemutató böngészőben, elsősorban közös tableten kipróbálható. Az éles alkalmazás végleges telepítési módja és technológiája még nincs kiválasztva; a bemutató nem dönti ezt el.

## Stack

A felület HTML/CSS és JavaScript-modulok. A tiszta üzleti szabályokat a `src/domain/inventory.mjs`, a közös tárolást és kiszolgálást Node.js 24 és SQLite adja, külső futásidejű csomag nélkül. A felület és a kapcsolati réteg különül: a StoreHouse/r_keeper megfeleltetése nem épül a képernyőkbe. Az önálló HTML helyi próbára marad; a közös tesztüzem külön kiszolgálón fut. Az előkészítő StoreHouse-metaadatpróba továbbra is külön Python-segéd.

A jelenlegi megvalósítás tesztüzem. A helyszíni éles adapter, telepítés és jogosultságkiosztás még nincs igazolva; a konfigurálatlan éles indítás nem válthat csendben tesztadatokra.

## Users

- Raktárfelelős: személyesen bevételez, kiadást és visszavétet rögzít, ellenőriz, véglegesít, terméket hoz létre és leltárt indít.
- Műszakonként kijelölt helyi átvevő/helyettes: igazolja a tényleges mennyiséget, jelzi a selejtet, pultfelelősként műszakot számol el.
- Vezető: áttekintést kap; ennek részletei még kidolgozandók.

## Product Purpose

Érthető, magyar nyelvű felület a napi raktári munkához. Az egyeztetett feladatokhoz nem kell a StoreHouse saját felületére átlépni. Az appban véglegesített művelet a háttérben ténylegesen a StoreHouse-ba kerül; ezt a helyszíni kapcsolaton még igazolni kell.

## Operating Context

Közös tabletek a raktárfelelősnél és a kijelölt helyeken. Személyes név/PIN és visszakereshető műveletek szükségesek a végleges rendszerben. Az eladást az r_keeperben rögzítik, az italcsomagos fogyasztást is. A receptúrás fogyást az app követi, a már elszámolt mennyiséget nem vonja le újra.

A konyha beszállítói lerakodási pont lehet; a tényleges célraktár tételenként választható. Átadásnál részleges átvétel és tisztázandó különbözet is lehetséges. A pult műszakvégi fizikai számolása kötelező; számoláskor ott megáll a kiadás és az árumozgás. A bontott palackot mérlegelik, a súlyt kézzel viszik be, ellenőrzött palackadatok alapján számolnak maradékot.

## Capabilities and Constraints

A bevételezés, átadás, visszavét, termékfelvitel, selejt, leltár, pultelszámolás és készletmegtekintés mind az első változat része. Nincs menetrendíró-függőség, igénytervezés, rendelés-összeállítás vagy pulti árukérés. A teljes listát a stabil követelményazonosítók őrzik.

Nincs ellenőrzött helyszíni r_keeper/StoreHouse-elérés. A tesztüzem adatai nem tényleges készletadatok. A helyi személyes belépés, tárolás és parancskezelés külön ellenőrzése nem igazolja a valódi StoreHouse-könyvelést, szállítólevél-OCR-t vagy üzemi telepítést. A végleges felület nincs jóváhagyva.

A jelenlegi bemutató szerephez és helyhez igazított feladatlistából indul, és minden művelethez közös készletet használ. Saját termékekkel, mennyiségekkel és több tétellel kipróbálható a bevételezés, átadás és visszavét; a nyitott ügyek, selejt és számolás ugyanennek a folyamatnak a része. A korábbi rögzített kólás példa és különálló menük helyett ezt a szerkezetet a felhasználó érthetőségi kifogása indokolta. A világos, zöld hangsúlyú megjelenés megmarad. A felhasználó a Fő raktár → Saloon kiadást, a szerepváltást és az igazolást már érthetőnek találta; ez az adott út visszajelzése, nem a teljes felület elfogadása.

A dashboard az igazoló hely szerint csoportosítja a különálló átadásokat, és 30 perc után piros, szöveges késési jelzést ad a még igazolatlan ügyre. Az időpontok és a következő felelős szerep segítik az elmaradt munka felismerését. A részleges átvétel maradéka külön raktárfelelősi eltérésrendezés. A felület egyszerűsége nem csökkenti a követett állapotokat vagy a megőrzendő üzleti szabályokat.

## Evidence on Hand

Teljes forrásátirat: `docs/forrasok/`. Egyeztetett döntések: `docs/egyeztetes.md`. Technikai forrás és nyitott kapcsolati kérdések: `docs/integracios-terv.md`, `docs/integracios-forrasok.md`. A bemutató mintaadatai nem tényleges készletadatok.

Az [alapok megvalósítási jegyzéke](docs/alapok-megvalositasa.md) rögzíti a közös tesztüzem 61 sikeres JavaScript-tesztjét, 12 valódi helyi kiszolgálós böngészőellenőrzését és a bizonyíték korlátait; a [korábbi bemutató-ellenőrzés](docs/bemutato-ellenorzes.md) a v5 állapotot őrzi. A szükséges alapok és a PDF-tesztkatalógus megvalósításának elfogadásával a jegyzék 74 alkalmazáskövetelményt, 14 határt és 16 nyitott pontot, összesen 104 stabil azonosítót tartalmaz. A helyszíni integráció és a végleges felület felhasználói elfogadása továbbra is hiányzik.

## Product Principles

- A dolgozó számára a következő konkrét feladat és a saját felelőssége legyen egyértelmű.
- Az áru tényleges átvételét és megmaradt mennyiségét ember ellenőrzi.
- A bemutatott állapot és a ténylegesen végrehajtott háttérművelet nem keverhető össze.
- A kisebb próbakör nem szűkíti a teljes megbeszélt feladatkört.

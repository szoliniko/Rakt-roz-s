# A tabletes bemutató felületi döntései

Állapot: kipróbálható munkafolyamat-vázlat, nem elfogadott végleges arculat. Mode: Operate. A 2026. október 27-i működési alapok a már érthető dashboardot egészítik ki személyhez kötött, tartós közös tesztüzemmel. Az ismert világos/zöld megjelenés és a napi feladatból induló szerkezet megmarad.

## Feladat és szerkezet

A kezdőképernyőt az aktuális dolgozó feladatai és a folyamatban lévő ügyek vezetik. A raktárfelelős a történésből indul: áru érkezett, árut ad ki, visszahozott árut vesz át, vagy leltárt indít. A helyi átvevő az igazolásokat és selejtjelentést látja, a pultoknál pedig műszakzárást is indíthat. Raktárban és Konyhán nem jelenik meg kötelező műszakzáró feladat.

A fő navigáció négy közös belépési pontja: **Áttekintés**, **Készlet**, **Eddigi műveletek**, **Segítség**. A napi műveletek a feladatlistából nyílnak meg. A kezdőlap összesítői után az igazoló hely szerint csoportosított nyitott átadások, az egyéb ügyek és az új feladat indítása következik; a szerep szűri a látott munkát. Kisebb képernyőn a szerkezet egymás alá rendeződik. Nincs rögzített termékkel és mennyiséggel eljátszandó kezdőjelenet. A termék és mennyiség mezői üresek, a dolgozó adja meg a saját próbatételeit.

A közös tesztüzemben minden munkafelület ugyanannak a kiszolgálón tárolt készletnek a változatát használja. Az önálló HTML helyi módja ettől külön jelölt; a mentési jelzés a ténylegesen elérhető tárolást nevezi meg. A rögzítés visszajelzése megmutatja az érintett helyek és termékek előző és új mennyiségét; a Készlet és az Eddigi műveletek ugyanezt az eredményt mutatja. A nyitott átadás, különbözet, selejtjelentés és számolás a kezdőlapon visszanyitható. A táblázat a döntéshez szükséges mennyiséget és állapotot mutatja.

Az átadás rögzítése és a tényleges mennyiség igazolása két külön ember lépése. A kijelölt helyi felelős a saját tesztazonosságával lép be; a közös kiszolgálón a nézetváltás nem adhat jogosultságot. A belépőlap és a fejléc egyértelművé teszi a személyt, a helyet és a tesztüzemet. Másik dolgozóhoz kijelentkezés és új belépés tartozik. A visszavétet a visszaadó hely igazolja; a Konyha → raktár mozgásnál a konyhai igazolás külön szerephatár marad.

A bemutatójelzés a felső sávban egyértelmű. A technikai részletek a Segítség és a dokumentáció alatt találhatók. A napi űrlap csak a feladathoz szükséges korlátot magyarázza, például a bevételezésnél a kézi sorfelvitelt vagy a mérésnél a kitalált palackreferenciát. A kasszaadat szemléltetése lenyitható magyarázat része, nem új eladásrögzítő munkafeladat.

## Átadások figyelése

Az ugyanott igazolandó átadások közös csoportban, külön ügyként maradnak meg. Az egyedi azonosító, az útvonal, a termékek, az indítás és az igazolásra várás ideje segít megkülönböztetni őket. A legrégebbi nyitott ügy kerül előre; a piros jelzés pontosan a 30 percet elérő, még igazolatlan átadást jelöli. Részleges igazolás után a hangsúly a raktárfelelősi eltérésrendezésre vált. A határidő nem hoz létre készletműveletet.

Új kiadáskor az adott hely nyitott ügyei figyelmeztetésként látszanak, de nem akadályozzák önkényesen az áruellátást. A dashboard konkrét ügyre vezető lépéseket ad, nem csak állapotszámokat. Az időjelzések budapesti időt használnak. Közös üzemnél az esemény idejét a kiszolgáló adja; egy tablet órájának átállítása nem módosíthatja a közös határidőt. Az önálló helyi változat esetleges időléptető segédje kizárólag külön jelölt bemutatóeszköz lehet.

## Megőrzött munka és ellenőrzés

Beküldés előtt az összefoglaló azokat az adatokat mutatja, amelyekből a dolgozó hibát ismerhet fel: hely, termékkód/név, egység és mennyiség. A nyomtatott katalógus hosszú listájához keresés és csoport szerinti szűrés tartozik; egy kiválasztott tétel nem cserélődhet ki szűrés vagy frissítés miatt. A korábbi bizonylat a rögzítéskori tételadatot mutatja.

A mentési és beküldési jelzés külön fogalom. „Piszkozat mentve” csak sikeres mentést követhet; a készüléken maradt és a közös kiszolgálón mentett példány nem ígérhet ugyanazt. Bizonytalan beküldésnél az ellenőrzésre vezető lépés látszik, nem egy új bizonylatot létrehozó általános „Próbáld újra” gomb. Háttérfrissítés nem törli az űrlap tartalmát vagy fókuszát. Elavult adatnál a friss állapot és a megőrzött bevitel alapján új ellenőrzés következik.

A visszavonás és a helyesbítés az ügyhöz kötött művelet. A függő, fizikailag el nem vitt áru visszavonása indokot és helyzetmegerősítést kér; a lezárt ügy javítása külön új mozgás. A műszak nyitása, felelősségátadása és számolása külön követhető. Félbehagyott számolás rendezése nem rejtett készletkorrekció.

## Megjelenés

A világos, zöld hangsúlyú felület és a meglévő vizuális alap megmarad. A szerkezetet az érthetőség miatt változtattuk meg; új arculati irányt ez a munka nem vezet be. Rendszerbetűt használunk, 16 px alapmérettel; a fő műveleti gombok legalább 48 px magasak. A szín a műveletet és állapotot jelöli, a hibát és függő állapotot szöveg is megnevezi.

| Token | Érték | Használat |
| --- | --- | --- |
| `--page` | `#f4f5f1` | Oldalháttér |
| `--surface` | `#ffffff` | Űrlap és adatfelület |
| `--ink` | `#202b24` | Elsődleges szöveg |
| `--muted` | `#536458` | Másodlagos szöveg |
| `--green` | `#20563e` | Elsődleges művelet, aktív navigáció |
| `--green-light` | `#e8f2eb` | Visszajelzés és kiemelés |
| `--line` | `#cbd5cd` | Elválasztók |
| `--amber-light` | `#fff5da` | Bemutatójelzés és figyelmet igénylő állapot |
| `--red` | `#9d2929` | Javítandó hiba és lejárt igazolási határidő, mindig szöveges jelzéssel |
| `--focus` | `#006e91` | Billentyűzetfókusz |

A fő menü minden szélességen felül található. Az űrlap oszlopai kisebb szélességnél egymás alá kerülnek; az adattáblák saját területükön görgethetők. Közvetlen mezőcímkék, látható billentyűzetfókusz és a visszajelzéshez tartozó élő státuszterület segíti a kezelést. A mozgás visszafogott gombállapot-váltásra korlátozódik, és figyelembe veszi a csökkentett mozgás beállítását.

## Állapotok és ellenőrzési határ

A számolás leadása, az eltérés vizsgálata és a készlet indokolt javítása külön lépés. A raktárfelelős kifejezetten választ a kimutatott különbözet átvezetése és a további készletváltoztatás nélküli lezárás között. A nyitott ügyekkel indult összehasonlítás előzetes jelzést kap; a későbbi készletváltozások visszanézhetők. Ez segít megérteni a döntést, de nem helyettesíti az éles adatút időpont szerinti egyeztetését.

A modell-, kiszolgáló- és böngészőpróbák a megjelölt helyi tesztüzemet ellenőrzik. A közös tárolás és tesztfelhasználói belépés nem igazolja a helyszíni StoreHouse-kapcsolatot, a valós dolgozók jogosultságkiosztását, a szállítólevél-OCR-t vagy az üzemi telepítést. A pontos elkészültség az alapok megvalósítási jegyzékében követhető. A közös készlet szemléltető könyvelési időzítése nem zárja le NYIT-06-ot, a számolás kézi jóváhagyása pedig nem bizonyítja NYIT-14 teljesülését. A végleges képernyőterv elfogadása NYIT-15 szerint nyitott marad.

## Korábbi próbák tanulsága

A korábbi változatban a felhasználó végig tudta kattintani a kiadást, de a hat kólás példa, a különálló képernyők és a fejlesztői magyarázatok nem tették számára érthetővé a napi munkát. Az ezt követő szövegegyszerűsítés önmagában sem igazolta az érthetőséget. A jelenlegi változat ezért a saját tételbevitelre, a folyamatban lévő ügyekre és a mindenütt azonos készletre épít. A felhasználó ezen a változaton a Fő raktár → Saloon kiadást, a nézetváltást és az igazolást már megértette. A dashboardot ezután kérte; a teljes végleges felületterv elfogadása továbbra is hátravan.

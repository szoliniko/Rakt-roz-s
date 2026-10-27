# Raktárkezelő felület

StoreHouse/r_keeper rendszerhez kapcsolódó, közös tableteken használható raktárkezelő felület terve. A napi raktári feladatokat az új appból kell intézni.

**Állapot:** elkészült a közös, tartós tesztüzem és a későbbi StoreHouse/r_keeper-illesztésre bontott alkalmazásalap. Valódi helyszíni rendszerkapcsolat nincs igazolva. A [megvalósítás és ellenőrzés aktuális állapota](docs/alapok-megvalositasa.md) külön követhető.

## Itt kezdd

**Böngészőből elérhető szerver közzététele:** [átadási leírás a következő munkamenetnek](docs/hosztolas-atadas.md). A teljes alkalmazáshoz Node.js-kiszolgáló és tartós adatbázis szükséges; az önálló HTML közzététele csak a helyi előnézetet adja.

**Saját Windows-gépen:** a hordozható csomag kibontása után dupla kattintás az `Inditas.cmd` fájlon. Elindítja a helyi kiszolgálót, és megnyitja a böngészőt. [Rövid Windows-indítási útmutató](docs/windows-inditas.md). A futtatókörnyezetet a Windows-csomag tartalmazza; a forráskönyvtár önmagában nem.

**Közös tesztüzem:** Node.js 24 mellett `npm start`, majd **http://127.0.0.1:4174**. A belépőképernyő tesztfelhasználóinak PIN-je **1234**. [Indítás, napi próba és adatmentés](demo/README.md).

A nyitott átadások, a 30 perc után késő igazolások és a műszakfeladatok közös áttekintésből intézhetők. A PDF-ből 590 külön nyomtatott termékkód szerepel választható tesztadatként, kitalált próbakészlettel. A [kiszolgáló nélkül megnyitható helyi változat](demo/raktar-bemutato-v6.html) is elérhető; a közös többtabletes működéshez a kiszolgálós indítás szükséges.

2026. október 27-i bemutatóállapot (Europe/Budapest): a felhasználó a Fő raktár → Saloon kiadást, nézetváltást és igazolást már érthetőnek találta. Ez a konkrét út visszajelzése; a teljes felület elfogadása és a fizikai tabletes próba még hátravan. A [helyi ellenőrzések és korlátok](docs/bemutato-ellenorzes.md) külön nyilvántartásban szerepelnek.

1. [Közérthető áttekintés, képernyővázlatok és indulási sorrend](docs/attekintes-es-indulas.md)
2. [Részletes működési terv](docs/mukodesi-terv-vazlat.md)
3. [Egyeztetési jegyzet és elfogadott döntések](docs/egyeztetes.md)
4. [Tételes követelményjegyzék és ellenőrzési feltételek](docs/kovetelmenyjegyzek.md)
5. [Rendszerkapcsolat és megvalósítási sorrend](docs/integracios-terv.md)
6. [Az eredeti dokumentum műszaki információi és a forrásellenőrzés](docs/integracios-forrasok.md)
7. [Hozzáférés egyeztetése – előkészített műszaki megkeresés](docs/hozzaferesi-egyeztetes.md)
8. [A szükséges alapok megvalósítása és ellenőrzése](docs/alapok-megvalositasa.md)
9. [Alkalmazásarchitektúra és a későbbi StoreHouse-kapcsolat határa](docs/alkalmazas-architektura.md)
10. [Hasznos későbbi bővítések – még nem elfogadott ötletek](docs/kesobbi-hasznos-bovitesek.md)

Az első dokumentum a mindennapi munkát mutatja be. A második a tervezett működést foglalja össze. A harmadik a döntések és a még ellenőrizendő technikai feltételek részletes nyilvántartása.

A követelményjegyzék tartja nyilván a teljes elfogadott tartalmat. A kapcsolati terv választja szét a régi anyag használható technikai információit, a megváltozott üzleti döntéseket és a még bizonyítandó helyi működést. A fejlesztési folytonosságot az [AGENTS.md](AGENTS.md) is rögzíti.

## Eredeti forrás

A beszkennelt dokumentum teljes, változatlan digitális átirata a projektben is megtalálható: [szerkeszthető szöveg](docs/forrasok/rkeeper-eredeti-atirat.md), [Word-dokumentum](docs/forrasok/rkeeper-eredeti-atirat.docx). A régi javaslatok nem automatikusan jelenlegi követelmények.

A később beküldött 50 oldalas részleges leltárlista is feldolgozva: [mit tudunk meg a tételekről, egységekről és raktárakról](docs/forrasok/storehouse-tetelek-elemzes.md), [kereshető OCR-munkapéldány](docs/forrasok/storehouse-tetelek-ocr.md). A kézi mennyiségek nem aktuális készletként, a javítások nem törzsmódosítási utasításként szerepelnek; a későbbi felhasználói döntés a nyomtatott termékadatok [tesztkatalógusba vételét](docs/forrasok/storehouse-tesztkatalogus.md) engedélyezi, éles készletmódosítás nélkül.

## Első technikai lépés

A [kapcsolati diagnosztika leírása](scripts/README.md) az explicit célcímen végzett, csak metaadatot kérő `sh5info` próbát ismerteti. Ez előkészítő eszköz, nem kész StoreHouse-integráció. A helyi tesztek és a helyszíni kapcsolat igazolása külön eredmény.

2026. október 24-i állapot: a diagnosztika 20 helyi tesztje sikeres. A tesztek helyi HTTP-kiszolgálót használnak; valódi StoreHouse-kapcsolat vagy készletművelet nem történt. A következő külső előfeltétel az elérést biztosító üzemeltető azonosítása és a tényleges API-cím/hálózati út biztosítása. Addig egy alkalmazáskövetelmény sem tekinthető helyszínen igazoltnak.

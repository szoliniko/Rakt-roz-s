# A működési alapok független záró felülvizsgálata

2026. október 27. · Korlátozott, csak olvasó kód- és felületi felülvizsgálat. A megvalósításon ez a felülvizsgálat nem változtatott.

**Döntés: a közös helyi tesztüzem további felhasználói kipróbálásra átadható.** A megvizsgált állapotban nincs újonnan talált blokkoló felületi hiba. Ez nem éles bevezetési vagy StoreHouse-integrációs jóváhagyás.

## Bizonyíték és határ

Az ellenőrzés az `AGENTS.md`, `README.md`, `PRODUCT.md`, `demo/DESIGN.md`, a működési terv, az érintett követelmények, a kilenc alap lefedettségi lapja és az alkalmazásarchitektúra alapján történt. A felületi kód mellett a kliens parancs-/piszkozatkezelése, a kijelölt műszakfelelős domainellenőrzése és a konfigurálatlan StoreHouse-adapter határa is szerepelt az olvasásban. Teljes biztonsági vagy üzemi audit nem történt.

A böngészős ellenőrzést végző agent a képsorozatot az akkori végső `app.mjs`, `runtime.mjs` és stílusváltozattal megerősítette. Egyetlen közös vizuális körben mind a tíz képet áttekintettem: `foundations-{catalog,dashboard,handover,count-closed,draft-conflict}-{tablet,mobile}.png`, 1024 és 390 px szélességen. A [böngészős jegyzék](foundations-browser.json) 12, tényleges helyi kiszolgálón, ideiglenes SQLite-adatbázissal végzett folyamatot rögzít; JavaScript-hibát vagy külső kérést nem jelent. Ezt a bizonyítékot áttekintettem, a teljes próbát nem futtattam megismételve. A képek után elkészült két célzott tartalmi javítást forráskódból ellenőriztem; az alábbi lezárás ezekre is kiterjed.

## Az átadási döntés alapja

- A felső tesztjelzés, a közös/helyi tárolás megnevezése, a frissítési idő és a „StoreHouse / r_keeper: nincs összekötve” szöveg együtt egyértelművé teszi az adatok eredetét. A PDF nyomtatott kódja külön `sourceCode`, az ellenőrizetlen külső azonosító `null`; a kézi régi készlet nem jelenik meg mai készletként.
- A tabletes áttekintésből felismerhető a nyitott ügy, helye, mennyisége, időpontja és következő felelőse. A műszakátadás a személyt és a helyet nevezi meg; a számolás lezárása külön jelzi, ha nem történt készletkorrekció.
- A két piszkozatverzió összehasonlítása láthatóan megőrzi a 4 és 3 darab közti különbséget, mindkét helyet és ugyanazt a termékkódot. A döntési gombok jelentése egyértelmű. A kliens a választás előtt újra ellenőrzi a közös piszkozat változatát; nincs hallgatólagos felülírás.
- A bizonytalan parancs saját ellenőrzési útvonalat kap, új művelet indítását a kliens elutasítja. Elavult adatnál a bevitel megőrzése és az új ellenőrzés a kódban és a böngészős jegyzékben is követhető.
- A 390 px szélességű nézetben a feladatok és az űrlapok egymás alá rendeződnek, a hosszú magyar feliratok olvashatók, a gombok nem takarják egymást. A számolási táblázat saját területén vízszintesen görgethető. A 1024 px szélességű elsődleges tabletes nézetben a döntési adatok és műveletek együtt áttekinthetők.
- A StoreHouse-port kifejezetten konfigurálatlan és hibával leálló határ; a dokumentáció a valódi termék-/egység-/helymegfeleltetést és a külső eredmény ellenőrzését külön helyszíni feladatként őrzi. A helyi modell nem bizonyítja a külső könyvelés időzítését vagy a kasszafogyás tényleges adatútját.

## Lezárt észrevétel

**P2 · Javítva: a számolás végső ellenőrző összefoglalójának adattartalma.** A végső `countReviewTable()` és `actionSummary()` forrásellenőrzése igazolja, hogy a leadás a számolás helyét, a történeti terméknevet/egységet, a várt és megszámolt mennyiséget, valamint a különbözetet is megismétli. A jóváhagyás az érintett eltéréseket és a készletváltoztatásról szóló döntést mutatja; eltérés hiányát külön kimondja. Nincs új vizuális rendszer vagy állapotátmenet. Érintett követelmények: ALAP-01, LELT-03/06–08, KAP-02; a 4. és 8. működési alap.

Ugyanebben a végső tartalmi csomagban a selejtjelentés is megkapta a meglévő név-/kód-/csoportkeresést. A forráskód alapján az 590 termék között a választó szűkíthető, és a korábban kiválasztott tétel szűréskor is megmarad. A helyi átadást akadályozó nyitott felületi észrevétel nem maradt.

## Ami továbbra sem bizonyított

Nincs valódi StoreHouse/r_keeper-hozzáférés, külső könyvelési próba, üzemi felhasználó- és jogosultságkiosztás, helyszíni mentési rend vagy fizikai tableten végzett dolgozói elfogadás. A kilenc alap helyi megvalósítása és a végső felület teljes felhasználói elfogadása külön állítás marad.

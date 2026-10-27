# Hogyan fog működni, és mivel kezdünk?

Ez egy közérthető bemutató a [működési tervhez](mukodesi-terv-vazlat.md). A munkafolyamatok az eddigi válaszokra épülnek; a képernyők elrendezése és a bevezetési sorrend javaslat. A vázlat nem működő alkalmazás, a példaszámok mintaadatok. A végleges megjelenés még nincs kiválasztva.

**Aktuális tesztüzem:** a közös, tartós működéshez a projekt gyökerében `npm start`, majd `http://127.0.0.1:4174`; [indítás és próba](../demo/README.md). A [kiszolgáló nélküli helyi mintafelület](../demo/index.html) külön kipróbálható. Saját helyekkel, termékekkel és mennyiségekkel indíthatsz munkát; az összes művelet közös készletet használ. A kezdőlap a nyitott átadásokat és a figyelmet igénylő ügyeket is összefoglalja. [Részletes használat és korlátok](../demo/README.md).

## Amit a dolgozó használ

A raktárfelelős és a kijelölt pultos ugyanazt az új alkalmazást használja, a saját feladataival. A közös tableten személyes PIN-kóddal azonosítják magukat. A raktári munkához nem kell átlépniük a StoreHouse kezelőfelületére.

Az eladásokat továbbra is az r_keeper kasszába ütitek. Az új app a meglévő rendszerben elszámolt fogyást mutatja. A StoreHouse marad a háttérben a készletnyilvántartás; a jóváhagyott raktári műveleteket az appnak oda is át kell vezetnie.

## Korábbi kezdőképernyő-vázlatok és a továbbfejlesztett áttekintés

A következő szöveges vázlatok az eredeti tervezési példákat őrzik; nem a jelenlegi képernyő pontos leírásai. A 2026. október 27-i kérés alapján a kezdőlap dashboardként, külön követhető párhuzamos átadásokkal, időpontokkal és 30 perc utáni piros késési jelzéssel bővül. A használó saját tételeket ad meg, nincs kötelező példatermék vagy példamennyiség.

Tabletre nagy, jól olvasható feliratokat és könnyen megnyomható gombokat javaslok. A kezdőlapon a következő teendő legyen feltűnő. Az adott hely és a bejelentkezett személy mindig látszódjon. A színek, a betűtípus és a pontos elrendezés még tervezendő.

**Raktárfelelős — javasolt kezdőképernyő, mintaadatokkal:**

```text
RAKTÁRFELELŐS                         Saját név

Mit szeretnél intézni?

[ Áru érkezett ]       [ Áru kiadása ]
[ Visszavét ]          [ Készletek ]
[ Leltár indítása ]

Ellenőrzésre vár
  Saloon · műszakzárás · 1 üveg kóla eltérés
  [ Megnézem ]

Átadás alatt
  Italraktár → Saloon · 6 üveg kóla
  A pult még nem igazolta az átvételt.
```

Az „Áru érkezett” a beszállítói bevételezéshez vezet: szállítólevél fotózása/feltöltése, kiolvasott adatok ellenőrzése, tényleges mennyiség és célraktár megadása, véglegesítés. Az „Áru kiadása” a saját készlethelyek közötti átadást indítja.

**Saloon pultfelelőse — javasolt kezdőképernyő, mintaadatokkal:**

```text
SALOON                                Saját név

Átvételre vár
  Italraktárból · 6 üveg kóla
  [ Átvétel ellenőrzése ]

Igazolásra váró visszaadás
  Italraktárba · 2 bontatlan üveg bor
  [ Visszaadott mennyiség ellenőrzése ]

[ Készlet megtekintése ]
[ Selejt jelzése ]
[ Műszakzárás ]
```

A pultnál a saját hely teendői kerülnek előre. Átvételkor a ténylegesen megérkezett mennyiséget lehet igazolni: 6 küldött kólából 5 átvétele is rögzíthető, az 1 eltérés tisztázandó marad. A visszavétet a raktárfelelős rögzíti, a pult a visszaadott mennyiséget igazolja.

## Egy munkanap a gyakorlatban

| Mi történik? | Ki mit csinál? | Mit kell mutatnia az új appnak? |
| --- | --- | --- |
| Megérkezik a beszállító. | A raktárfelelős odamegy, ellenőrzi az árut, lefotózza a szállítólevelet, ellenőrzi a kiolvasott tételeket, majd véglegesít. | Az átvett áru a kiválasztott célraktárba kerül. A konyhai lerakodás önmagában nem jelent Konyhára könyvelést. |
| A Saloon kap 6 kólát az Italraktárból. | A raktárfelelős elindítja a kiadást az appban. | A tétel „átadás alatt”, a Saloonnál átvételi teendő jelenik meg. |
| A pult ellenőrzi a szállítmányt. | A kijelölt pultfelelős igazolja a ténylegesen megérkezett mennyiséget. | Az átvett mennyiség a pult készletében látszik. Az eltérés külön tisztázandó. |
| A vendégek fogyasztanak. | A dolgozók a megszokott r_keeper kasszába ütnek, az italcsomagos fogyasztást is. | A meglévő rendszer szerinti fogyás megjelenik; az app nem vonja le még egyszer. Az ételek receptúrás fogyására ugyanez vonatkozik. |
| Megmaradt árut visznek vissza. | A raktárfelelős átveszi és rögzíti; a pult igazolja a visszaadott mennyiséget. | A visszavét követhető. Bontott ital is visszavehető a tényleges maradékkal. |
| Vége a műszaknak. | Az adott pultnál megáll a kiadás és az árumozgás; a pultfelelős számol, a bontott palackokat mérlegeli, beírja az eredményt és beküldi. | A tényleges és a nyilvántartott mennyiség eltérése látszik. A raktárfelelős később, ugyanebben az appban ellenőrzi és rendezi. |

A számolás beküldése önmagában nem írja át a készletet. A hiányos vagy késő kasszaadatot és a függő átadást is figyelembe kell venni az eltérés ellenőrzésekor. A kapcsolat megszakadásakor a piszkozat és a még el nem végzett rögzítés állapota legyen egyértelmű.

## Milyen sorrendben érdemes haladni?

1. **A StoreHouse/r_keeper kapcsolat feltárása a dokumentum alapján.** Ez a fejlesztés első műszaki lépése. A hozzáférés, a telepített változat és az elérhető kapcsolódási lehetőségek alapján ellenőrizzük a termékek, készletek, receptek és helyek olvasását, valamint a kasszafogyás útját és frissülését. Ezután megfelelő tesztkörnyezetben a szükséges írási műveleteket is igazolni kell. A technikai kiindulópont megvan az eredeti dokumentumban; a helyi elérés és működés még ellenőrizendő.
2. **Ezzel párhuzamosan a napi munkát bemutató mintafelület.** A fenti vázlatból elkészülne egy kattintható bemutató, egyértelműen jelölt mintaadatokkal. Végigjárható benne a raktárfelelős és a pultfelelős útja. Ekkor derül ki, hogy a gombok, elnevezések és lépések valóban érthetők-e. Ez még nem módosítana éles készletet, és nem bizonyítaná a rendszerkapcsolat működését.
3. **Egy kis, teljes működési kör megépítése és kipróbálása.** Javasolt kezdés: egy raktár, egy pult és néhány termék. Kiadás → átvétel → kasszafogyás megjelenése → visszavét → műszakzárás → eltérés rendezése. Próbálni kell a részleges átvételt és a megszakadó kapcsolatot is. A tesztkör pontos helyét a rendszerből ellenőrzött készlethelyek alapján választjuk ki.
4. **A teljes induló feladatkör és az adatok előkészítése.** A beszállítói bevételezés, szállítólevél-kiolvasás, új termék felvitele, selejt és raktári leltár is a megbeszélt első változat része. Be kell állítani a személyeket, helyetteseket és tableteket, ellenőrizni a kiszereléseket, recepteket és induló készletet, felvenni a palackmérés referenciaadatait.
5. **Felügyelt próba, majd fokozatos bevezetés.** A raktárfelelős és egy kijelölt pultfelelős a tényleges munkakörnyezetben próbálja ki a teljes folyamatot. Az eredmények alapján javítjuk a felületet, majd bevonjuk a többi helyet. A pontos ütemezés a technikai feltárás után adható meg.

A megkezdett műszaki lépés a rendszerkapcsolat előkészítése, a teljes [követelményjegyzék](kovetelmenyjegyzek.md) alapján. A képernyőbemutató ezt támogatja. A képernyővázlat és a próbakör részletei egyelőre javaslatok; az üzleti válaszok nem jelentik a végleges felület jóváhagyását. A részletes sorrendet a [kapcsolati terv](integracios-terv.md) rögzíti.

## Hol vannak a fájlok?

A fájlok a felhős munkakörnyezet `/workspace/Rakt-roz-s/` projektkönyvtárában vannak. A projekt [README](../README.md) fájlja az áttekinthető belépőpont.

- Ez a bemutató: `docs/attekintes-es-indulas.md`.
- A részletes működési terv: `docs/mukodesi-terv-vazlat.md`.
- Az egyeztetett döntések jegyzete: `docs/egyeztetes.md`.

A dokumentum írásakor ezek munkakörnyezeti fájlok, még nincsenek GitHubra feltöltve. A chatben megjelenő fájlhivatkozás nem nyilvános webcím és nem jelenti, hogy a fájl a saját gépedre is le lett mentve.

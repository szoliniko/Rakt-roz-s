# Raktárkezelő felület – egyeztetési jegyzet

Állapot: a kiküldött üzleti kérdések megválaszolva, az egyeztetett döntések rögzítve. A technikai feltárás és a megvalósítás még hátravan.

## A felhasználó által megadott keretek

- Nincs menetrendíró alkalmazás, ezért erre nem épülhet függőség.
- Az első változatban nem kell előzetes igénytervezés.
- Az első változatban nem kell rendelést összeállítani.
- A cél egy nagyon érthető, kezelhető, r_keeperhez kapcsolódó raktári felület.
- Az egyeztetett raktári feladatokat teljes egészében az új appban kell elvégezni. A felhasználó külön megerősítette, hogy nem akarja a StoreHouse saját felületét kezelni. A „StoreHouse-ban véglegesítés” a háttérben végrehajtott adatátvezetést jelenti, nem átlépést annak felületére.
- Az italkezelés is része a megoldandó feladatnak.
- A korábbi PDF kiinduló anyag; régi projektre vonatkozó javaslatai nem automatikusan követelmények.
- A felhasználó a mattpocock/skills grill-me készséggel teljes körű kikérdezést kért.
- A kérdéseket a kérdéseszközzel kell feltenni, egyszerű megfogalmazással és konkrét példákkal.
- A felhasználó kéri, hogy a kérdések lezárása után, külön a végén magyarázzuk el konkrét példákkal, hogyan képzeljük a leltározást. Ekkor térjünk ki a műszakvégi számolásra, a raktári leltárra, az eltérések ellenőrzésére és a StoreHouse-készlet változásának időpontjára. A részletes magyarázatot addig ne hozzuk előre.

## Használt fogalmak

- **Külső bevételezés:** beszállítótól érkező áru készletre vétele. Példa: a Halker kiszállít, a raktárfelelős ellenőrzi az árut és a szállítólevelet, majd az új appban rögzíti az átvett mennyiséget; az app vezeti át a bevételezést a StoreHouse-ba. A szállítólevél fotózása/feltöltése és gépi kiolvasása ehhez a folyamathoz tartozik.
- **Belső átadás:** a már meglévő áru mozgatása saját készlethelyek között, például az Italraktárból a Saloonba. Az appban indított kiadás és az átvevő igazolása rögzíti; ehhez nem szükséges beszállítói papír fotózása.
- **Visszavét:** a kiadott, megmaradt áru belső visszamozgatása a raktárba, az átvevő igazolásával. Ez nem azonos a beszállítónak történő visszaküldéssel.

## Ellenőrzött környezeti tények

- **2026. november 12., hosztolás:** a felhasználó a teljes szerveres alkalmazás működő webcímét, tartós adatbázisát, védett hozzáférését, mentését és újraindítás utáni adatmegőrzését kérte. A közvetlen Cloudflare/Wrangler hozzáférést külön engedélyezte. A [Cloudflare-tesztüzem](cloudflare-hosztolas.md) telepítve és külső címen ellenőrizve; a tesztadatok és éles StoreHouse-kapcsolat közötti határ változatlan.

- A projekt tárolójában a készségek letöltése előtt nem volt alkalmazáskód.
- A digitalizált forrás: `/workspace/documents/rkeeper/Rkeeper_digitalis_atirat.md`.
- A felhasználó megerősítette, hogy a raktárkészletet StoreHouse-ban vezetik. A jelenlegi vendéglátóhelyi rendszerhez nincs ellenőrzött kapcsolat ebben a környezetben; a StoreHouse-verzió, a QUSH és az API elérhetősége/működése továbbra is ellenőrizendő. A régi PDF ezekre nem szolgáltat telepítési bizonyítékot.
- A `grill-me` és az általa használt `grilling` készség eredeti fájljai a projekt `.agents/skills/` könyvtárába kerültek. Forrásverzió: `5beb35b040e3de97e54fa9e386d7e42d15c295c2`.

## Megerősített döntések

- A raktári, pultos és konyhai munkát is támogatja a felület; vezetői áttekintés is kell. Az átvételt műszakonként kijelölt helyi átvevő vagy helyettese igazolja a közös tableten, aki ténylegesen ellenőrzi az árut. Ez elfogadott döntés; nem minden pultos kap automatikusan átvevői szerepet. A konkrét személyek és a további jogosultságok még nyitottak.
- A közös tableten minden kijelölt dolgozó a saját nevével és rövid, személyes PIN-kóddal azonosítja magát. A műveleteknél visszakereshető legyen az eljáró személy. Dolgozói kártya/chip nem szükséges az első változathoz.
- Az első változatban készletmegtekintés, bevételezés, készlethelyek közötti átadás, leltár és selejt rögzítése is kell.
- Visszavét is kell: ez elsősorban a pultnak vagy konyhának kiadott, megmaradt áru raktárba történő visszavétele. Példa: rendezvény után visszakerül 8 bontatlan üveg bor. A beszállítónak történő visszaadás még nem elfogadott követelmény.
- A pultból visszahozott árut a raktárfelelős veszi át és rögzíti az új appban; a pult kijelölt felelőse ugyanott igazolja a visszaadott mennyiséget. Ezt a szerepkiosztást a felhasználó kifejezetten elfogadta.
- A zárt palackok és dobozok mellett a bontott és kimért mennyiségeket is kezelni kell, a használt italfajták szerint. A bontott boros/töményitalos palackokhoz elfogadott mérleges módszert külön rögzítjük alább; a termékenkénti mértékegységek és referenciaadatok ellenőrzendők.
- A készletet helyenként külön kell látni. Elfogadott példa: a raktárban 40, a pultnál 12 üveg kóla van; 6 üveg átadásakor a raktárban 34, a pultnál 18 marad.
- A felhasználó külön hangsúlyozta: a felületen végzett átadás a meglévő r_keeperhez kapcsolódó rendszerben is vonja le a kiadó helyről és adja hozzá az átvevő helyhez a mennyiséget. A tényleges rendszerkapcsolaton keresztüli készletmozgás alapkövetelmény.
- A meglévő raktárnyilvántartó program a felhasználó válasza szerint StoreHouse. Az új felület készletműveleteinek ehhez kell kapcsolódniuk.
- Kiadáskor és visszavétkor az átvevő is igazolja a tényleges átvételt. Példa: kiadásnál a pultos, visszavételnél a raktáros.
- A kiadást az első változatban a raktáros indítja el, az átvevő igazolja. Elsőként ez elegendő; a pult/konyha által az appban küldhető árukérés nem része az elfogadott induló feladatkörnek.
- Az átvevő jelezheti, ha a ténylegesen megkapott mennyiség eltér a kiadottól. Az eltérést a raktárossal tisztázni kell; a rendszer nem könyvelheti automatikusan selejtnek a hiányzó mennyiséget.
- Részleges átvétel megengedett: a ténylegesen átvett mennyiség már az átvevő készletébe kerül, miközben a különbözet tisztázandó marad. Elfogadott példa: 6 kiadott üvegből 5 a pult készletébe kerül, 1 üveg még tisztázandó.
- A belső átadás tisztázandó eltérését a raktárfelelős rendezi az érintett átvevővel való egyeztetés után, külön vezetői jóváhagyás nélkül. A javító személyt, az időpontot és az indokot meg kell őrizni. Példa: a 6 kiadottnak jelölt kólából 1 ténylegesen a raktárban maradt, ezért a nyilvántartást ennek megfelelően javítja.
- Az átvétel visszaigazolásáig az áru külön „átadás alatt” állapotban/mennyiségként jelenjen meg. A megjelenítés elfogadott követelmény; a StoreHouse-beli könyvelés pontos időpontja és technikai megoldása még nincs eldöntve.
- Bontott ital is visszavehető a raktárba a megmaradt mennyiséggel. Elfogadott példa: 8 bontatlan üveg bor mellett 0,35 liter maradék bor. A visszavett bontott és bontatlan mennyiség megkülönböztetendő.
- A bontott ital mennyiségének bevitele kézi; korábbi elfogadott példa a „3,5 dl bor” megadása. A záráskori palackméréshez később mérleget és kézi súlybevitelt választott a felhasználó. Automatikus mérlegkapcsolat nem szükséges. A termékenként megengedett egységek és a bevitel ellenőrzése a rendszeradatokkal összevetendő.
- Az r_keeper kasszában rögzített eladás automatikusan jelenjen meg az új felület készletében. Példa: egy eladott üveg kóla csökkenti a pult készletét; nincs külön kézi eladásrögzítés az új felületen. A frissítés elvárt késése és a tényleges adatút még tisztázandó.
- Az à la carte ételértékesítés is a működés része: az eladott ételhez rendelt receptúra alapján az összetevők fogyásának kell megjelennie a megfelelő készlethely készletében. Ez nem csak a darabra eladott italokra vonatkozik. A felhasználó úgy tudja, hogy ezt a meglévő r_keeper/StoreHouse rendszer receptúra alapján végzi, de a pontos működésében bizonytalan.
- Vannak korlátlan italcsomagok. A felhasználó szerint ezeknél a tényleges fogyasztást beütik az r_keeperbe, az ital ára pedig a csomagban van benne. A készlet követésének a tényleges termékmennyiséget kell tükröznie, a vendégnek felszámított darabártól függetlenül. Az italcsomagos tételek helyi StoreHouse-elszámolását ellenőrizni kell; sem a nulla/kedvezményes tételár, sem a csomagár nem bizonyítja önmagában, hogy az alapanyag- vagy itallevonás megtörtént.
- A felhasználó megerősítette: minden elfogyó italt beütnek az r_keeperbe; nincs külön, kasszába egyáltalán nem rögzített fogyasztási folyamat. A fogyás követésének forrása ezért a meglévő r_keeper/StoreHouse adatút, az italcsomagos fogyasztást is beleértve. Külön appbeli italeladás-/fogyasztásrögzítés nem szükséges; a selejt ettől külön, már elfogadott folyamat.
- A meglévő rendszer receptalapú fogyását és annak megjelenítését kell ellenőrizni. A már StoreHouse-ban elszámolt POS-fogyást az új app nem vonhatja le újra. A jelenlegi receptek megléte/helyessége, a POS-termék és StoreHouse-recept kapcsolata, a leírási részleg, a mértékegységek, valamint az online/könyvelt készlet és QUSH tényleges működése műszaki feltárási feladat. Ezeket nem szabad a régi PDF vagy a felhasználó feltételezése alapján működőnek tekinteni.
- A kiadás és a visszavét egymással ellentétes irányú készletmozgás. Az eltérés rendezése a raktárfelelős feladata. A köztes állapot és a StoreHouse-beli véglegesítés pontos technikai módját még ellenőrizni kell.
- A helyszíneket és készlethelyeket egyetlen kérdésben tárgyaló megfogalmazás nem volt érthető a felhasználónak. A készlethelyenkénti nyilvántartás már elfogadott; az érintett telephelyek száma továbbra is nyitott.
- A felhasználó elvárja, hogy a végleges raktár-/részleglistát a meglévő rendszerből vegyük át, ne az emlékezetből megadott felsorolás legyen a teljes törzsadat. A StoreHouse-készlethelyek és az r_keeper értékesítési helyek/kasszák megfeleltetését a működő hozzáférés birtokában ellenőrizni kell.
- A raktárfelelősnél és az érintett pultoknál/konyhán közös helyszíni tablet legyen. A felhasználó a közös tablet és kijelölt átvevő/helyettes megoldást elfogadta. Saját telefon használata nem követelmény. A konkrét eszközszám, típus és elhelyezés még nincs felmérve.
- A beszállítótól érkező külső áru szállítólevelének feldolgozása fotó vagy feltöltés alapján gépi kiolvasással és emberi ellenőrzéssel történjen. A dolgozó a rögzítés előtt ellenőrzi/javítja a tételeket és a ténylegesen átvett mennyiséget. A felhasználó Halker-példával külön rákérdezett, hogy ez a külső bevételezésre vonatkozik-e; ezt egyértelműsítettük. Az új termék appból történő létrehozása elfogadott követelmény. A szállítólevél sorainak termékpárosítása, a hiányos szállítás és a kettős bevételezés elleni védelem részletes megoldása még megtervezendő.
- A raktárfelelős az áru és a szállítólevél ellenőrzése után önállóan véglegesíthesse a külső bevételezést a StoreHouse-ban az új felületről. Ehhez nem kell minden alkalommal külön vezetői jóváhagyás. A konkrét API-művelet és technikai jogosultság továbbra is ellenőrizendő.
- Egy beszállítói szállítólevél tételei több célraktárba is kerülhetnek; a célraktár tételenként választható. Az appban egy szállítólevél feldolgozása a StoreHouse képességeitől függően több összetartozó bizonylatot is jelenthet; a technikai megoldás nincs eldöntve.
- A konyhánál átvett külső szállítmány teljes bevételezését a raktárfelelős személyesen, a helyszínre menve intézi. A javasolt konyhai előkészítés és távoli raktárfelelősi véglegesítés nem lett elfogadva.
- A selejtet a hely kijelölt felelőse jelzi a tableten, mennyiséggel és indokkal. A raktárfelelős ellenőrzi és véglegesíti a készletet érintő selejtezést. Ez elfogadott munkafolyamat.
- Minden műszak végén kötelező pultelszámolás kell. A pultoknál az alkalmi leltárra korlátozott induló javaslatot a felhasználó nem választotta.
- A Fő raktárban, Italraktárban és Konyhán a raktárfelelős szükség szerint indíthat teljes vagy részleges leltárt. Elfogadott példa: csak a húsok ellenőrzése vagy az egész Italraktár számolása. Ezekre a helyekre nem írtunk elő automatikusan kötelező műszakvégi teljes leltárt.
- A raktári/konyhai teljes vagy részleges leltár eltéréseit is a raktárfelelős ellenőrzi, és külön vezetői jóváhagyás nélkül véglegesíti a szükséges készletkorrekciót az új appban. A StoreHouse-ba az app vezeti át a jóváhagyott műveletet; a raktárfelelősnek nem kell annak saját felületére átlépnie. A technikai végrehajthatóságot még ellenőrizni kell.
- A kötelező műszakvégi pultelszámolás tényleges számolással és automatikus összehasonlítással történjen. A tablet végigvezeti a kijelölt pultfelelőst az italokon, ő beírja a ténylegesen megmaradt mennyiségeket, az app pedig összeveti ezeket a kassza és készletmozgások alapján várt mennyiségekkel. Elfogadott példa: 12 várt kóla és 11 megszámolt kóla esetén 1 üveg eltérés jelenik meg. A kizárólag számított, fizikai ellenőrzés nélküli zárójelentés nem elegendő.
- A műszakvégi számolás idejére az adott pultnál megáll az italok kiadása és az árumozgás. A többi pult közben működhet. Ez nem a háttérben érkező kasszaadatok frissítésének leállítása: a számolási időponthoz tartozó adatok egyeztetését technikailag biztosítani kell.
- A felhasználó elmondása szerint jelenleg „nem nagyon van leltár készítve”, és éppen ennek kialakítása az új rendszer egyik célja. Meglévő, működő leltározási rendet nem szabad feltételezni. A fogalom konkrét példás tisztázása után elfogadta a kijelölt pultfelelős által végzett tényleges számolást és az automatikus összehasonlítást.
- A műszakzáráskor jelzett hiányt vagy többletet a raktárfelelős vizsgálja meg, tisztázza az okát, és az új appban véglegesítheti a szükséges készletkorrekciót, amelyet az app vezet át a StoreHouse-ba. Ehhez nem kell külön vezetői jóváhagyás. A pultfelelős számolásának beküldése önmagában nem jogosít automatikus készletkorrekcióra.
- A pultfelelős eltérés esetén is leadhatja a műszakvégi elszámolást. Az elszámolás „ellenőrzésre vár” állapotot kap, a raktárfelelős később vizsgálja, és a StoreHouse-készletkorrekció csak az ellenőrzés után történik meg. A dolgozónak a számolás leadásához nem kell megvárnia az ellenőrzést.
- Az új appból teljesen új StoreHouse-terméket is lehessen létrehozni. Az a korábbi ajánlás, hogy új termék felvételéhez egyelőre a StoreHouse saját felületére kelljen átlépni, nem lett elfogadva. A kötelező mezőket, kiszereléseket és a terméklétrehozó API tényleges lehetőségeit a telepített rendszerből kell ellenőrizni; nem szabad ismeretlen mezőszerkezettel létrehozni terméket.
- A raktárfelelős az új termék adatait ellenőrizve önállóan létrehozhatja azt az appból a StoreHouse-ban. Ehhez nem szükséges külön vezetői jóváhagyás. Az app segítse a már létező termék felismerését a kettős felvitel elkerülésére.
- Bevételezésnél és kiadásnál kiszerelésben, például kartonban vagy ládában is lehessen mennyiséget megadni. Az átváltás a termék ellenőrzött, beállított kiszerelése alapján automatikus. Elfogadott példa: 2 karton × 12 üveg = 24 üveg. Az ismeretlen kiszerelés átváltási tényezőjét nem szabad találgatni.
- A bontott boros/töményitalos palackok maradékának mérésére eddig nem volt kialakult módszer. A felhasználó elfogadta a javasolt egyszerű digitális mérleget és a mért súly kézi bevitelét. Az app a termék/palacktípus előre ellenőrzött üres/teli súlya és térfogata alapján számíthatja a maradékot. A referenciaadatok felvétele és ellenőrzése indulási feladat; automatikus mérlegkapcsolat nem szükséges. A tömeg és a térfogat nem felcserélhető, ismeretlen vagy nem megfelelő referencia alapján nem szabad készletmennyiséget találgatni.
- Rendszerkapcsolat megszakadásakor az elkezdett rögzítés piszkozatként megmarad. Helyreállás után ellenőrizve véglegesíthető, és egyértelműen látszik, hogy addig még nincs a StoreHouse-ban rögzítve. Ez nem jelent korlátlan offline üzemet vagy automatikus utólagos könyvelést; a végrehajtás eredményének bizonytalanságát és a duplikációvédelmet technikailag kezelni kell.

## Tisztázott különbség: fizikai átvételi hely és készlethely

A felhasználó megerősítette: **a konyha a beszállítói áru fizikai átvételi helye**. A raktárfelelős ott veszi át az árut, majd a megfelelő célraktárhoz rögzíti és elviszi/ott hagyja. A fizikai lerakodás nem jelenti automatikusan, hogy az áru előbb a Konyha nyilvántartott készletére kerül. A célraktár továbbra is tételenként választható a tényleges elhelyezés alapján.

Ha már ténylegesen a Konyha készletére bevett áru később másik raktárba kerül, az külön belső mozgás. Az erre korábban feltett Konyha → Fő raktár példában a felhasználó raktárfelelősi indítást és konyhai kiadásigazolást választott. A konyhai lerakodásból önmagában nem szabad ilyen plusz mozgást generálni. A „konyhára csak érkezik” pontosítás nem jelent általános tiltást minden Konyháról induló készletmozgásra.

## Előzetesen megadott raktár- és helynevek

A felhasználó felsorolása, az általa megadott írásmóddal:

- Fő raktár
- Italraktár
- Konyha
- Csárda pult
- Grill terasz
- Nádfedeles terasz
- Saloon
- westfood

A felsorolás kifejezetten nem biztos, hogy teljes. A nevekhez tartozó rendszerazonosítók, a készlethely/értékesítési hely besorolás, a kapcsolatok és az esetleges további helyek még nem ellenőrzöttek. A rendszerből beolvasott adatok alapján kell véglegesíteni.

## A kérdéskör állapota

A kiküldött üzleti kérdésekre megérkeztek a válaszok. A két utolsó szerepköri pontosítás is elfogadott: a pultból történő visszavétet a raktárfelelős rögzíti a pult igazolásával; a raktári/konyhai leltárkorrekciót is önállóan véglegesíti az új appban. A StoreHouse kezelőfelületére történő átlépés nem része az elvárt napi működésnek.

A felhasználó külön kérte, hogy a kérdések lezárása után, a végén konkrét példákkal magyarázzuk el a leltározás tervezett menetét. A műszaki feltárás és a megvalósítás nem tekinthető ezzel lezártnak.

A leltározási magyarázat után a felhasználó jelezte, hogy még nem látja át teljesen a működést, a felület megjelenését és az indulás sorrendjét. Ehhez külön [közérthető bemutató](attekintes-es-indulas.md) készült. Az egyes üzleti döntések elfogadása nem jelenti a teljes felületterv jóváhagyását; a képernyővázlat és a bevezetési sorrend javaslat marad.

A felhasználó ezt követően engedélyezte a munka megkezdését, és külön megkövetelte a teljes kép megőrzését: minden elfogadott megbeszélt funkció maradjon követhető, ne épüljön terven kívüli vagy valós működéssel nem alátámasztott megoldás. Rákérdezett az r_keeper és a StoreHouse különbségére, az API-val való kezdésre, és hangsúlyozta az eredeti dokumentum műszaki információinak felhasználását. A megkezdett feladat ezért a [követelményjegyzék](kovetelmenyjegyzek.md), a [forrásra épülő rendszerkapcsolati terv](integracios-terv.md) és az első metaadat-lekérdezés eszközének előkészítése. Az eredeti dokumentum hasznos technikai leírásai megőrzendők, a korábbi üzleti javaslatait pedig a mostani döntésekhez kell igazítani.

A kapcsolati próba hozzáférésére vonatkozó kérdésre a felhasználó válasza: „Még nem tudom, ki tud hozzáférést adni.” Ezért helyi szervercímet, tesztkörnyezetet vagy hozzáférést nem feltételezünk. A [megkereséstervezet](hozzaferesi-egyeztetes.md) a régi anyagban megnevezett UCS/helyi üzemeltető felé történő egyeztetést készíti elő; külső üzenet nem lett elküldve.

A felhasználó kérte a levél Outlook-piszkozatba helyezését és a bemutató folytatását. A munkamenetben Outlook-eszköz nem állt rendelkezésre; a helyi EML-előkészítés után a felhasználó visszavonta a levéllel kapcsolatos feladatot („hagyd a levelet akkor intezem en”). A levelet ő intézi; Outlook-piszkozat nem jött létre és levél nem lett elküldve. A kattintható bemutató készítése a korábban elfogadott munkafolyamatok alapján folytatódik, egyértelműen jelölt mintaadatokkal. Ez nem a végleges felület vagy a helyszíni integráció jóváhagyása.

A felhasználó a bemutató appon belüli megnyitásakor vizualizációs hibát és fehér oldalt jelzett, majd pontosította, hogy az `index.html` nyílt meg. A javítás a megnyitási csomagot érinti: önálló `index.html`, külső/modulbetöltési függőség nélkül, és beágyazott előnézetben is helyben kezelt űrlapműveletek. Az új kompatibilitási próba nem bizonyítja a még nem megfigyelt konkrét felhasználói megjelenítő működését, és nem változtat az üzleti követelményeken.

Az érintett telephelyek száma továbbra sem ismert; a készlethelyek végleges listája és megfeleltetése rendszerből ellenőrizendő. Az előzetes felsorolásból ezek nem következtethetők ki.

## Hátralévő feltárás és tervezés

- A ténylegesen használt r_keeper/StoreHouse verziók, API-k, hozzáférés és technikai jogosultságok ellenőrzése.
- A készlethelyek, termékek, egységek, kiszerelések, receptek és POS-megfeleltetések rendszerből történő feltárása; a korábbi PDF nem telepítési bizonyíték.
- A POS-fogyás tényleges adatútja, frissítési késése és az online/könyvelt készlet jelentése. A már elszámolt fogyás nem vonható le újra; elavult vagy hiányos adatból nem szabad végleges leltárhiányt megállapítani.
- A számolási időponthoz tartozó egyeztetett készletállapot, a függő átadások és a késve beérkező kasszaadatok kezelése.
- A StoreHouse-bizonylatok létrehozása/véglegesítése, készletkorrekció, új termék felvitele, visszaellenőrzés és ismételt végrehajtás elleni védelem.
- A személyek/helyettesek, tabletek és hálózati elérés felmérése; PIN-es azonosítás és piszkozatmentés részletes megtervezése.
- A palacktípusonkénti mérési referenciaadatok felvétele, ellenőrzése, a mérés pontosságának próbája és a megfelelő eszközök biztosítása. Az egyéb italtípusok, például csapolt italok tényleges mértékegységei és ellenőrzési lehetőségei külön feltárandók.
- A kezelőfelület képernyőterve, az induló adatok ellenőrzése és a bevezetés megtervezése. Ezek nem kész vagy tesztelt képességek.

Az elfogadott üzleti döntéseket, a későbbi tervezési javaslatokat és az ellenőrizetlen műszaki feltételezéseket továbbra is külön kell kezelni.

## A bemutató érthetőségének korábbi javítása – előzmény

A javított bemutató megnyitása után a felhasználó a Kiadás és átvétel fülön elvégezte a 6 kólás példát, de jelezte, hogy sem ezt, sem a többi menü értelmét nem látja át. Külön zavarónak nevezte a neki fejlesztőként szóló megjegyzéseket és a „Hol van a mintakészlet?” címet; kérte a munka folytatását. Ez sikeres elérésről szóló visszajelzés, nem felületterv-elfogadás.

Ennek megfelelően a munkaképernyők a dolgozó feladatát magyarázzák, a műszaki korlátok a dokumentációban maradnak; a felületen egyértelmű bemutatójelzés látható. Első út a 6/6 átadás, a szerepváltás két külön ember egymás utáni feladatát mutatja, a 6/5 eltérés külön kipróbálható. Az áttekintés röviden leírja az összes menü napi szerepét. Kapcsolódó követelmények: ALAP-01, ALAP-04–05, SZER-01–04, TORZS-01, MOZ-01–08. Üzleti döntés és éles képesség nem változott; az érthetőség újabb felhasználói ellenőrzése nyitott (NYIT-15).

## Összefüggő napi munkafolyamat – 2026. október 27. (Europe/Budapest)

A felhasználó továbbra sem találta érthetőnek a rögzített hat kólás példát és a különálló menük működését; érthető magyarázatot vagy használható felületet kért. Az előző fejezet szövegegyszerűsítése korábbi kísérlet volt, nem elfogadott végleges megoldás. A jelzés a bemutató szerkezetének és követhetőségének hibáját rögzíti; az elfogadott üzleti feladatkör nem csökken.

Az új [v4 bemutató](../demo/raktar-bemutato-v4.html) a dolgozó saját feladataiból és a folyamatban lévő ügyeiből indul. A raktárfelelős maga választja ki a helyet, terméket, mennyiséget és kiszerelést; bevételezésnél és mozgásnál több sort is felvihet. A kijelölt helyi dolgozó külön igazolja a tényleges mennyiséget. A részleges átvétel, indokolt eltérésrendezés, bontatlan/bontott visszavét, helyi selejtjelentés és raktárfelelősi ellenőrzés ugyanazt a készletet változtatja. A Készlet és az Eddigi műveletek ebből a közös állapotból mutatja az eredményt.

A pulti számolás leadása önmagában nem módosít készletet, és nyitott ügyek mellett is lehetséges előzetes összehasonlítással. A raktárfelelős a függő ügyek rendezése után kifejezetten választ az indokolt különbözet átvezetése és a további korrekció nélküli lezárás között. A helyi pillanatkép és a későbbi műveletek megőrzése szemléltető megoldás; a késő kasszaadat és eredeti hibás esemény teljes egyeztetése továbbra is nyitott. A Fő raktárban, Italraktárban és Konyhán továbbra is szükség szerinti teljes/részleges leltár szerepel, kötelező pulti műszakzárás nélkül.

Kapcsolódó sorok: ALAP-01, ALAP-04–05; SZER-01–05; TORZS-01–06; BEV-02–07; MOZ-01–08; VISSZA-01–04; FOGY-01–05; SEL-01–02; LELT-01–10; MER-01–03; HATAR-08, HATAR-10–11. A 61 alkalmazáskövetelmény, 14 megőrzendő határ és 16 nyitott pont változatlanul megmarad. Különösen NYIT-06, NYIT-14 és NYIT-15 továbbra is nyitott.

Helyi ellenőrzés: 21/21 modellteszt, az összefüggő böngészős munkafolyamatok és 56 oldal/szerep/szélesség kombináció sikeres; a [lefedettségi jegyzék](bemutato-ellenorzes.md) hivatkozik a bizonyítékokra. A minta nem igazol helyszíni API-kapcsolatot, könyvelést, OCR-t, személyes PIN-t vagy tartós mentést/auditot. Az új változat felhasználói kipróbálása és elfogadása még hátravan; a helyi próba és a belső felületi áttekintés ezt nem helyettesíti.

## Dashboard, több nyitott átadás és időpontok – 2026. október 27. (Europe/Budapest)

A felhasználó a közös készletű bemutatót már sokkal érthetőbbnek találta. A Fő raktár → Saloon kiadást saját tételekkel végigvitte, értette a nézetváltást és a jóváhagyást. Ez az adott út felhasználói kipróbálása és érthetőségi visszajelzése; nem igazolja a többi feladatot vagy a végleges felületterv elfogadását (NYIT-15).

Új kérése, hogy különítsük el a dolgozó számára egyszerű kezelést a szoftver háttérbeli alaposságától. Dashboard jellegű kezdőképernyőt, az ugyanarra a pultra felgyűlő igazolatlan átadások követését, időbélyegeket és piros késési jelzést kért. A kérdésre kifejezetten a **„30 perc után – kezdeti javaslat”** választ adta. Ez az indítástól mért, még el nem végzett igazolás kezdeti határa.

A v5 helyi bemutatóban az átadások külön ügyek maradnak, és az igazolás helye szerint csoportosítva látszanak. Felületi megoldásként a régebbi nyitott ügy kerül előre, és új kiadásnál figyelmeztetés mutatja az ottani elmaradásokat; ez nem tiltja meg automatikusan az új kiadást. Az átvétel, eltérésrendezés és készlethatás továbbra is ügyenként történik. A határidő lejárta nem könyvel és nem minősít selejtnek. Részleges igazolás után a maradékot a raktárfelelős rendezi; nem marad tévesen új teljes átvételre váróként.

Új követelmények: **ALAP-06, MOZ-09–11**. A korábbi 61 alkalmazáskövetelmény megmarad; a bővített jegyzék 65 alkalmazáskövetelményt, 14 határt és 16 nyitott pontot tartalmaz. Az időpontok helyi demonstrációja nem azonos a személyhez kötött, tartós éles audittal. A szerveróra, többeszközös megőrzés és éles kapcsolat ellenőrzése nem kész.

A felhasználó jelezte, hogy az r_keeper még nem válaszolt. Ebből nem következik új API-elérés vagy engedély; valódi kapcsolati próba nem történt. A levelet továbbra is ő intézi. Az emlékeztetési csatornák, vezetői eszkaláció és további műszakáttekintés csak később pontosítandó lehetőség, nem már elfogadott vagy megvalósított értesítési működés.

A dashboard helyi ellenőrzése: 28/28 modellteszt, az összefüggő folyamatok 56 oldal/szerep/szélesség kombinációja és a külön időhatáros dashboardpróba sikeres. A [részletes bizonyíték](bemutato-ellenorzes.md) külön jelöli az önálló és a beágyazott futtatás határát. Az eredmény nem éles API-bizonyíték és nem a teljes felület felhasználói elfogadása.

## Részleges termék-/leltárlisták mint új forrás – 2026. október 27.

A felhasználó új, 50 oldalas szkennelt PDF-et adott, megjegyzése szerint a StoreHouse-ban szereplő tételek egy részével. Az [elemzés](forrasok/storehouse-tetelek-elemzes.md) és az [összes oldalt tartalmazó OCR-munkapéldány](forrasok/storehouse-tetelek-ocr.md) a projektben van. Az OCR ellenőrizetlen munkapéldány; 45 tartalmas és 5 üres oldal, ismétlődő listák és különböző időpontok szerepelnek a forrásban. Nem készült készletimport vagy igazolt egyedi terméktörzs.

A korábban elfogadott feltárást pontosító megfigyelések: Főraktár, Takarítószer raktár és Étterem raktár nyomtatott helynevek; adag/zacskó egységek; két külön kódú és csoportú Bazsalikom azonos névvel/egységgel; kézzel módosított terméknév és kg/db jelölés. A nyomtatott kód és helynév API-megfeleltetése, a tényleges kiszerelés és a javítások helyessége rendszerből ellenőrizendő. Az adatok nem zárják le NYIT-02–03-at, és nem jelentenek engedélyt új termék/hely automatikus létrehozására vagy átnevezésére. A takarítószer- és csomagolóanyag-kezelés pontos köre ebből önmagában nem válik elfogadott funkcióvá.


## A szükséges alapok megvalósítása és PDF-tesztkatalógus – 2026. október 27.

A felhasználó kifejezetten kérte a [szükséges alapok](alapmukodes-felulvizsgalat.md) azonnali megvalósítását. Kiemelt feltétel: a rendszert úgy kell felépíteni, hogy a későbbi r_keeper/StoreHouse-kapcsolat illeszthető legyen hozzá. A PDF-ben szereplő termékeket választható **tesztadatként** kéri; a pontos aktuális készletet nem ismerjük. Ez felülírja a korábbi, importot még nem engedélyező forrásfeldolgozási állapotot, de nem engedélyez valódi StoreHouse-terméklétrehozást, készletfeltöltést vagy régi kézi mennyiségek mai készletként kezelését.

A megvalósítás iránya: közös, tartós kiszolgálói állapot; személyhez kötött belépés és piszkozat; szerveridős napló; műveletenkénti egyszeri végrehajtás és párhuzamos szerkesztés elleni védelem; téves átadás állapothoz illő visszavonása vagy külön helyesbítő mozgása; megnyitott pultműszak és felelősségátadás; félbehagyott számolás rendezése; kereshető terméklista és visszakereshető történeti tételadat. A szükséges üzleti adatút és a külső kapcsolati réteg elkülönül; ismeretlen eredmény nem válhat automatikusan sikeressé vagy vakon újraküldhetővé.

A helyi megvalósítás és ellenőrzés bizonyítékát az [alapok lefedettsége](alapok-megvalositasa.md), a rétegek kapcsolatát az [alkalmazás architektúrája](alkalmazas-architektura.md) írja le. A konkrét tesztnevek nem a dolgozók adatai; a teszt-PIN nem éles jogosultságkiosztás. Az éles StoreHouse-megfeleltetés, jogosultság, recept-/kasszaadat és a helyszíni nyitókészlet ellenőrzése továbbra is szükséges.

Új követelmények: ALAP-07, SZER-07, TORZS-07, MOZ-12–13, LELT-11, KAP-05–07. A korábbi 95 azonosító megmaradt; 74 alkalmazáskövetelmény, 14 határ és 16 nyitott pont, összesen 104 azonosító. A [hasznos későbbi bővítések](kesobbi-hasznos-bovitesek.md) külön listája nem lett ezzel automatikusan végrehajtási feladattá: például a vonalkódos kamera, lejáratkövetés és értesítési szabály továbbra is külön pontosítandó.

A megvalósítás helyi ellenőrzése lezárult: 61 JavaScript-teszt és 12, tényleges helyi kiszolgálón/SQLite-adatbázison futó böngészős munkafolyamat sikeres. A [lefedettségi jegyzék](alapok-megvalositasa.md) a részletes bizonyítékot és az éles határt tartalmazza. A PDF-ből 590 külön nyomtatott termékkód került a tesztkatalógusba, a régi kézi mennyiségek átvétele nélkül. A közös kiszolgáló tesztfelhasználókat és kitalált készletet használ; a StoreHouse/r_keeper-kapcsolat ettől továbbra sem igazolt.

## Elérhető szerver és GitHub-átadás – 2026. október 27.

A felhasználó böngészőből, linkkel elérhető, szerveres kipróbálást kér tartós adatokkal; a futtató gép helye számára mellékes. Az önálló HTML megnyitása ezt önmagában nem teljesíti. Kifejezetten engedélyezte a teljes projekt feltöltését a `szoliniko/Rakt-roz-s` GitHub-tárolóba, hogy másik Work-beszélgetésből is publikálható legyen Sitesra. A jelen munkamenetben nincs Sites-közzétételi eszköz, a megpróbált külső alagút elérését a hálózati proxy 403-mal elutasította. A [hosztolási átadás](hosztolas-atadas.md) tartalmazza a tényleges kiszolgáló indítását és az elérés elfogadási próbáit. A GitHub-feltöltés nem helyettesíti a működő webcímet, és nem igazolja az élő StoreHouse-kapcsolatot. Kapcsolódó sorok: ALAP-05/07, KAP-05–07, NYIT-15.

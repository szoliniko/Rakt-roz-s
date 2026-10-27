# Raktárkezelő felület – működési tervvázlat

**Állapot:** a megválaszolt kérdések alapján összeállított üzleti működési tervvázlat. A közös helyi tesztüzem alapjai elkészültek; a helyszíni műszaki feltárás, az éles rendszerkapcsolat és a teljes bevezetés még hátravan.

**Forrás:** [Egyeztetési jegyzet](egyeztetes.md). Az alábbi elfogadott működés üzleti elvárás; a meglévő rendszerben való megvalósíthatóság külön ellenőrzést igényel. A korábbi PDF javaslatai önmagukban nem követelmények.

**Közérthető bemutató:** [Hogyan fog működni, képernyővázlatokkal és javasolt indulási sorrenddel](attekintes-es-indulas.md). A képernyővázlatok még nem jóváhagyott végleges felületek.

**A terv részletes mellékletei:** [tételes követelményjegyzék és ellenőrzési feltételek](kovetelmenyjegyzek.md), [rendszerkapcsolati terv és megvalósítási sorrend](integracios-terv.md), [műszaki források](integracios-forrasok.md). Ez a fájl az összefoglaló; a mellékletekkel együtt kell használni. Az elfogadott üzleti követelmény, a nyitott műszaki részlet és a bizonyított megvalósítás külön állapot.

**Aktuális tesztüzem:** [indítás és használat](../demo/README.md), [önálló v6 helyi változat](../demo/raktar-bemutato-v6.html), [a szükséges alapok megvalósítása és ellenőrzése](alapok-megvalositasa.md). A közös kiszolgálós üzem tartós tárolást, személyhez kötött belépést, piszkozatot és műveletkezelést ad a napi folyamatokhoz. A tesztkatalógus a PDF nyomtatott termékeit használja, kitalált mennyiségekkel. Az aktuális helyi ellenőrzés eredménye a külön lefedettségi lapon követhető; helyszíni StoreHouse-könyvelést ez nem igazol.

**Korábbi v5 bizonyíték:** 28 modellteszt, az összefüggő böngészős próba 56 oldal/szerep/szélesség kombinációval és a külön dashboardpróba sikeres volt. A [történeti v5 jegyzék](bemutato-ellenorzes.md) ezt őrzi; nem az új kiszolgáló ellenőrzési eredménye. A StoreHouse-időzítés (NYIT-06), a későadat-egyeztetés (NYIT-14) és a végleges felületi elfogadás (NYIT-15) továbbra is nyitott.

## Elfogadott működési alapok megvalósítása

A következő kipróbálási cél egy linkkel elérhető, tartós adatbázissal működő kiszolgáló. A felhasználó engedélyezte a GitHub-átadást másik Work/Sites munkamenet számára; a gép helye nem követelmény. A [hosztolási átadás](hosztolas-atadas.md) az indítást és az ellenőrzést rögzíti. Statikus HTML-publikálás, GitHub-feltöltés vagy helyi HTTP-próba önmagában nem bizonyítja a felhasználó számára elérhető szerveres működést; NYIT-15 továbbra is nyitott.

A felhasználó a [szükséges alapok](alapmukodes-felulvizsgalat.md) megvalósítását kérte, a későbbi r_keeper/StoreHouse-kapcsolatra előkészített szerkezettel. A [rétegek és felelősségek](alkalmazas-architektura.md), valamint a [kilenc alap megvalósítási lefedettsége](alapok-megvalositasa.md) a terv melléklete. Az új technikai alap nem helyettesíti a tényleges API-feltárást.

A közös kiszolgáló őrzi az ügyeket, előzményeket, parancsazonosítókat és felhasználóhoz kötött piszkozatokat. Minden készletművelet saját azonosítót és állapotváltozatot kap: ismétléskor az eredmény ellenőrizhető, elavult állapotnál a dolgozó friss adat alapján újra ellenőriz. A személy és az esemény időpontja a kiszolgálóból származik. Sikertelen vagy bizonytalan mentés külön jelzést kap; kapcsolat-visszatérés nem könyvel magától.

Az átadás véglegesítése előtt áttekinthető a hely és a mennyiség. A még nem igazolt, ténylegesen a forráshelyen maradt áru kiadása indokkal visszavonható. Már lezárt ügyet külön, rá hivatkozó helyesbítő árumozgás rendez; az eredeti előzmény megmarad, az új mozgást a megfelelő átvevő igazolja. A képernyőadatot nem szabad történet nélküli törléssel javítani.

A pultműszak megnyitása rögzíti az aktív helyet és kijelölt felelőst/helyettest. Az áttekintés megkülönbözteti a számolás nélkül nyitott, számolás alatt álló, leadott és ellenőrzött műszakot. Indokolt személyváltás átadja a felelősséget, a korábbi műveleteket nem írja át. Félbehagyott számolást a raktárfelelős indokkal megszakíthat; ez az árumozgás zárolását oldja fel, készletkorrekciót nem végez. Nem kerül be menetrendíró vagy munkaidő-beosztó függőség.

A PDF nyomtatott tételei **választható tesztkatalógusba** kerülhetnek, a felhasználó külön kérésére. A kód, név, csoport, egység és forrás megmarad; bizonytalan OCR-sor nem lesz ellenőrzött törzsadat. A kezdeti próbamennyiség kitalált tesztadat, nem a papíron írt régi készlet. A korábbi tétel őrzi a rögzítéskori egységet és átváltást. Az éles termékazonosító és StoreHouse-kapcsolat külön feltárandó.

Új stabil sorok: ALAP-07, SZER-07, TORZS-07, MOZ-12–13, LELT-11, KAP-05–07. A megvalósítás tesztüzeme, helyi ellenőrzése és a még hátralévő éles igazolás külön állapot.

## Cél és hatókör

Nagyon érthető, közös helyszíni tableteken használható felület készül a raktár, a pultok és a konyha munkájához, vezetői áttekintéssel. A hivatalos készletnyilvántartás a meglévő **StoreHouse**. Az új felület a készletet helyenként mutatja, és a véglegesített készletműveleteket ténylegesen ebben a rendszerben rögzíti.

**Minden itt leírt raktári feladatot az új appban kell intézni.** A dolgozó ott rögzít, ellenőriz és véglegesít; az app a háttérben vezeti át a jóváhagyott műveletet a StoreHouse-ba. A „StoreHouse-ban rögzítés” nem jelenti annak saját kezelőfelületének megnyitását vagy kézi kettős adminisztrációt. Ez a kialakítandó működés követelménye, nem már elkészült rendszerkapcsolat.

Az első változat része a készletmegtekintés, a külső bevételezés, a belső átadás és visszavét, az új termék felvitele, a selejtjelentés, a leltár és a kötelező műszakvégi pultelszámolás. Kezeli a bontatlan és bontott italokat is.

Nem része a menetrendíró, az igény-előrejelzés, a rendelés-összeállítás vagy a pultból/konyhából indított árukérés. A pénztári pénzelszámolás és a beszállítónak történő visszaküldés nincs az eddig elfogadott feladatok között; ezekre nem tekintünk hallgatólagosan vállalt funkcióként.

## Szerepek és azonosítás

| Szerep | Feladat |
| --- | --- |
| Raktárfelelős | Helyszíni külső bevételezés; belső kiadás indítása; visszavét rögzítése és raktári átvétel; átadási eltérés rendezése; selejt ellenőrzése és véglegesítése; műszakzárási készleteltérés vizsgálata és szükséges korrekciója; raktári/konyhai teljes vagy részleges leltár indítása, eltérésvizsgálata és korrekciójának véglegesítése; új termék létrehozása. Mindezt az új appban végzi. |
| Műszakra kijelölt helyi átvevő vagy helyettese | A tényleges áruátvétel, illetve a visszaadott mennyiség igazolása, eltérés jelzése; helyi selejtjelentés; pultfelelősként a műszakvégi fizikai számolás és annak beküldése az új appban. Nem minden pultos kap automatikusan átvevői szerepet. |
| Vezető | Áttekintés. A raktárfelelős elfogadott bevételezési, terméklétrehozási, átadási eltérésrendezési, műszakzárási és raktári/konyhai leltárkorrekciós műveleteihez nem kell külön vezetői jóváhagyás. |

A kijelölt dolgozó a közös tableten saját nevével és rövid, személyes PIN-kóddal azonosítja magát. A műveletet végző személy visszakereshető. Saját telefon, dolgozói kártya és chip nem szükséges az induláshoz.

## Napi áttekintés és figyelmet igénylő ügyek

A kezdőképernyő dashboardként fogja össze a dolgozó feladatait: az igazolásra váró átadásokat, a késéseket, a rendezendő eltéréseket és a többi nyitott munkát. A felhasználó 2026. október 27-i kérése szerint az egyszerű kezelés mellett a szoftvernek segítenie kell észrevenni az elmaradt lépéseket is. Kapcsolódó új követelmények: ALAP-06, MOZ-09–11.

Ugyanarra a pultra több kiadás is indulhat. Ezek külön ügyek maradnak, saját azonosítóval, termékekkel, mennyiséggel és időponttal; az egyik átvétele nem igazolja a többit. A dashboard az igazolást végző hely szerint együtt mutatja őket. A bemutató felületi megoldása a legrégebbi ügyet helyezi előre, és új kiadásnál megmutatja a célhely már nyitott ügyeit. Ez figyelmeztetés; önmagában nem tiltja meg a további szükséges áruellátást.

**Elfogadott kezdeti határ: 30 perc.** Az indítástól számított 30 perc elteltével a még nem igazolt átadás piros, szöveges késési jelzést kap. Az indítás, igazolás és eltérésrendezés időpontja külön megmarad. A piros jelzés az elmaradt igazolásra figyelmeztet, nem bizonyít elveszett árut. Nem von maga után automatikus átvételt, összevonást, selejtet vagy készletkorrekciót. Részleges igazolás után az átvett mennyiség és a tisztázandó maradék elkülönül; a következő teendő a raktárfelelősi eltérésrendezés, nem egy újabb teljes átvétel.

A név szerinti felelős/helyettes azonosítása már elfogadott cél (SZER-02–03), de az eszközök és műszakok valódi összekapcsolása még nincs megvalósítva. További emlékeztetők, vezetői eszkaláció és összesített műszakállapot hasznos következő tervezési lehetőségek; ezek részletes címzettje, határideje és értesítési csatornája még nincs elfogadva. A dashboard önmagában nem küld külső üzenetet. A [napi működés alapjainak külön felülvizsgálata](alapmukodes-felulvizsgalat.md) az egyszeri végrehajtást, tartós mentést, felelősséget, javíthatóságot és indulási ellenőrzést bontja tovább; az abban szereplő új részletszabályok javaslatok. A [későbbi hasznos bővítések](kesobbi-hasznos-bovitesek.md) külön ötletlista: nem az elfogadott első változat hallgatólagos bővítése.

A bemutató időpontjai a helyi böngésző órájából származnak. Ez nem tartós, szerver által hitelesített, több tablet között közös audit. A valódi rendszerben az egységes időforrás, tartós megőrzés és személyes műveletnapló szükséges; a kapcsolati feltárás továbbra is hátravan.

## Fő munkafolyamatok

### 1. Beszállítói áru bevételezése

A raktárfelelős személyesen odamegy a konyhai átvételi ponthoz, ellenőrzi az árut és lefotózza vagy feltölti a szállítólevelet. A gépi kiolvasás előkészíti a tételeket; a raktárfelelős ellenőrzi és javítja a termékpárosítást, mennyiséget és kiszerelést. Az app segít felismerni a már létező terméket; valóban új terméket a raktárfelelős ellenőrzés után az appból hozhat létre a StoreHouse-ban.

Minden tételnél a tényleges elhelyezés szerinti célraktárt választja. Egy szállítólevél több célraktárt is érinthet. Az ellenőrzött bevételezést önállóan véglegesíti; a gépi kiolvasás nem jelent automatikus készletre vételt.

**A konyha a beszállítói áru fizikai átvételi pontja.** A könyvelés a tényleges célraktárra történik: az Italraktárba kerülő áru közvetlenül annak készletébe vehető fel. Ha az áru már valóban a Konyha készletén van, későbbi áthelyezése külön belső mozgás; a megbeszélt Konyha → Fő raktár esetben a raktárfelelős indít, a konyha igazolja a kiadott mennyiséget.

### 2. Belső kiadás és átvétel

A raktárfelelős megadja a kiadó és fogadó helyet, a terméket és a mennyiséget. Az áru visszaigazolásig „átadás alatt” látszik. A kijelölt átvevő tényleges ellenőrzés után igazolja a megkapott mennyiséget.

Részleges átvétel lehetséges: 6 kiadott üvegből 5 átvételekor 5 kerül a fogadó készletébe, 1 tisztázandó marad. A hiány nem válik automatikusan selejtté. Az eltérést a raktárfelelős rendezi az átvevővel való tisztázás után, külön vezetői jóváhagyás nélkül. A javító személy, az időpont és az indok visszakereshető. A köztes állapot és a StoreHouse-könyvelés időzítésének technikai megoldását ellenőrizni kell.

Bevételezésnél és kiadásnál kartonban vagy ládában is megadható mennyiség. Például 2 karton × 12 üveg = 24 üveg, ha ez a termék ellenőrzött kiszerelése. Ismeretlen átváltási tényezőt az app nem találgat.

### 3. Visszavét

A megmaradt áru visszamozgatása az átadás ellenkező iránya. A pultból visszahozott árut a raktárfelelős átveszi és rögzíti az új appban, a pult kijelölt felelőse pedig igazolja a visszaadott mennyiséget. Bontatlan és bontott ital külön is visszavehető, például 8 bontatlan üveg és 0,35 liter maradék bor. A mennyiségbevitel kézi; automatikus mérlegkapcsolat nem szükséges. A bontott palackok mérleges ellenőrzését a műszakzárásnál ismertetjük.

### 4. Eladás és készletmegtekintés

Az r_keeperben rögzített eladás készlethatása automatikusan megjelenik az új felületen. Ez a darabra eladott italokra és az à la carte ételek receptúra szerinti összetevőfogyására is vonatkozik, a megfelelő készlethelyen. Nincs külön kézi eladásrögzítés. A StoreHouse-ban már elszámolt fogyást az új app **nem vonhatja le még egyszer**. Az általános receptalapú működést az eredeti dokumentum is leírja; a helyi receptek, kapcsolatok és elszámolás helyessége még nincs ellenőrizve.

Korlátlan italcsomagoknál a tényleges fogyasztást beütik a kasszába, az ár a csomag része. A készletnek a kiadott mennyiséget kell követnie, a tételárától függetlenül. A felhasználó megerősítette, hogy minden elfogyó ital bekerül az r_keeperbe, ezért külön appbeli fogyasztásrögzítés nem szükséges. A csomagos és egyéb tételek tényleges StoreHouse-elszámolását ellenőrizni kell.

### 5. Selejt és műszakvégi elszámolás

A helyi felelős mennyiséggel és indokkal jelenti a selejtet; a készletet érintő selejtezést a raktárfelelős ellenőrzi és véglegesíti.

Minden pultműszak végén kötelező a fizikai számolás. A számolás idejére az adott pultnál megáll a kiadás és az árumozgás; a többi pult működhet. A tablet végigvezeti a kijelölt felelőst az italokon, és a beírt maradékot automatikusan összehasonlítja az eladások és készletmozgások alapján várttal. Például 12 várt és 11 megszámolt kóla esetén 1 üveg eltérést mutat.

Az összehasonlításhoz a számolás időpontjához tartozó, egyeztetett adat szükséges. A függő átadásokat és a késve frissülő kasszaadatokat külön kell kezelni; hiányos vagy elavult adatból nem tekinthető véglegesnek a kimutatott eltérés. Ennek pontos megoldása a helyi rendszer feltárásától függ.

A bontott boros/töményitalos palackokhoz egyszerű digitális mérleget használnak, kézi súlybevitellel. Az app a termék/palacktípus előre ellenőrzött üres/teli súlya és térfogata alapján számít maradékot. A referenciaadatok felvétele és ellenőrzése indulási feladat; a tömeg nem tekinthető automatikusan azonos térfogatnak. Automatikus mérlegcsatlakozás nem szükséges.

Az elszámolás eltéréssel is beküldhető, „ellenőrzésre vár” állapotban. A dolgozó nem várja meg a vizsgálatot. A raktárfelelős az új appban ellenőrzi az eltérést, tisztázza az okot, majd szükség esetén ugyanott véglegesíti a korrekciót. A jóváhagyott műveletet az app vezeti át a StoreHouse-ba, visszaellenőrzött eredménnyel. A beküldött számolás önmagában nem módosítja a készletet.

Példa a számolás értelmére: 24 üveg nyitókészlet + 12 átvett üveg − 20 kasszában rögzített fogyasztás − 4 visszaadott üveg = 12 várt üveg, ha más készletmozgás nem volt. Ha a dolgozó 11-et számol, az app 1 üveg eltérést jelez. Ez még nem bizonyított elveszett áru: lehet számolási hiba, tévesen rögzített mozgás vagy késő adat is. Az eredeti hibás eseményt kell helyesbíteni, ha ez az ok; ugyanazt az eltérést nem szabad egy külön leltárkorrekcióval is elszámolni.

A Fő raktárban, Italraktárban és Konyhán a raktárfelelős szükség szerint indíthat teljes vagy részleges leltárt, például csak a húsokra vagy az egész Italraktárra. Ezeknél is ő ellenőrzi az eltéréseket és véglegesíti az indokolt készletkorrekciót az új appban, külön vezetői jóváhagyás nélkül. Az app a háttérben vezeti át a műveletet a StoreHouse-ba; a dolgozónak nem kell megnyitnia a StoreHouse felületét.

### 6. Megszakadó rendszerkapcsolat

Az elkezdett rögzítés piszkozatként megmarad, és egyértelműen látszik, hogy még nincs véglegesítve a StoreHouse-ban. Helyreállás után ellenőrizve véglegesíthető. Ez nem korlátlan offline könyvelés és nem automatikus utólagos végrehajtás.

## Műszaki feltárás és induló adatok

Az r_keeper kassza és a StoreHouse külön összetevő. A régi dokumentum szerint az értékesítés QUSH-on keresztül jut el a StoreHouse-ba, ahol a receptúrás vagy termékszintű fogyás elszámolása történik. A megvalósítás első műszaki lépése a StoreHouse API elérésének és ennek az r_keeper fogyási útvonalnak az ellenőrzése. Közvetlen r_keeper XML vagy White Server kapcsolatot akkor kell hozzáadni, ha a helyi adatút és a szükséges frissesség ezt indokolja. A kasszafogyás nem maradhat ki a megoldásból.

Nincs ellenőrzött kapcsolat a helyszíni rendszerhez. Fel kell mérni a hozzáférést és jogosultságokat, a telepített StoreHouse/r_keeper verziókat, API-t és QUSH-t; a bizonylat- és terméklétrehozás lehetőségeit; a recepteket, egységeket és POS-megfeleltetéseket; a készletfrissülést, köztes állapotokat és a bizonytalan végrehajtás/duplikáció kezelését.

A megadott helynevek előzetesek: Fő raktár, Italraktár, Konyha, Csárda pult, Grill terasz, Nádfedeles terasz, Saloon, westfood. A végleges listát, azonosítókat és kapcsolatokat a meglévő rendszerből kell ellenőrizni. A telephelyek, tabletek és konkrét szerepkiosztások felmérése még hátravan; működő importot vagy kész rendszerkapcsolatot nem állítunk.

### A beküldött terméklistákból pontosított feltárás

A 2026. október 27-én feltöltött, 50 oldalas „Nem az összes de Storehouse tételek ha jól értem.pdf” részleges, ismétlődő leltárnyomtatványokat tartalmaz. Elkészült [a beküldött leltárnyomtatványok elemzése](forrasok/storehouse-tetelek-elemzes.md) és [az összes oldal kereshető, ellenőrizetlen OCR-munkapéldánya](forrasok/storehouse-tetelek-ocr.md). A különböző 2025–2026-os dátumok, a nyomtatási idő és a friss szkennelés nem bizonyítanak aktuális készletet. A nyomtatott termékkód még nem igazolt API-azonosító; a kézi javítás nem végrehajtási utasítás.

A nyomtatott **Főraktár, Takarítószer raktár és Étterem raktár** új helymegfeleltetési támpont, nem automatikusan importálandó lista. Az Étterem raktár nem nevezhető át ellenőrzés nélkül Konyhára, a kézzel Saloonnak jelölt Főraktár-ív pedig nem bizonyít önálló raktárt. A törzs egységei között **adag és zacskó** is van: az éles megoldás nem korlátozhatja a törzset a bemutató db/kg/l egységeire, és kiszerelési szorzót nem találhat ki a névből. A **134-es és 187-es Bazsalikom** azonos névvel/egységgel, de külön csoportban szerepel; névegyezésből önmagában nem dönthető el a duplikáció. A 118-as Paprikacsík kézi „Hagymakarika” javítása és a 90-es Húspogácsa kg/db eltérése rendszerbeli ellenőrzést igényel. Kapcsolódás: TORZS-02, TORZS-04–06, BEV-02, NYIT-02–03. Ez a korábban vállalt törzsfeltárást pontosítja; a forráselemzés idején még nem történt import. A későbbi felhasználói döntés a nyomtatott termékadatok tesztkatalógusba vételét engedélyezi; a takarítószer-/csomagolóanyag-fogyás éles kezelési módját ettől még tisztázni kell.

## A teljes tartalom megőrzése fejlesztés közben

Minden fejlesztési részfeladatot a követelményjegyzék megfelelő azonosítóihoz kell kötni. A kis próbakör nem törli vagy halasztja ki automatikusan az első változat többi elfogadott funkcióját. A jegyzékben külön kell látszania a megvalósításnak és az ellenőrzési bizonyítéknak; egy képernyő vagy helyi teszt nem bizonyít valódi StoreHouse-könyvelést.

A jelenlegi tervben maradt műszaki ismeretleneket feltárási feladatként tartjuk nyilván. Az eredmény alapján pontosítjuk a megoldást; egy követelményt nem hagyunk el azért, mert a kezdeti próbakörbe nem fért bele, és nem mutatunk helyette működőnek látszó szimulációt.

A bemutató korábbi kipróbálásakor a felhasználó érthetőségi hibát jelzett. A szövegek egyszerűsítése után sem fogadta el a rögzített kólás példára és különálló menükre épülő megoldást. A 2026. október 27-i változat ezért saját tételbevitelre, közös készletre, szerep szerinti feladatokra és visszanyitható nyitott ügyekre épül. Ez a fenti üzleti működést nem változtatja meg. A részleteket az egyeztetési jegyzet és a bemutató-ellenőrzési dokumentum rögzíti. A végleges felület elfogadása továbbra is nyitott (NYIT-15).

A legutóbbi kipróbáláskor a felhasználó a Fő raktárból a Saloonba mozgatta saját tételeit, értette a nézetváltást és az igazolást. Ez konkrét előrelépés az érthetőségben, nem a teljes felület vagy az éles rendszer elfogadása. A következő fejlesztési kérés a fenti dashboard és az időponttal, késési jelzéssel követhető párhuzamos átadások. Az r_keeper válasza még nem érkezett meg; a helyi folyamatmodellel addig is lehet haladni, valódi rendszerkapcsolatot állítani nem lehet.

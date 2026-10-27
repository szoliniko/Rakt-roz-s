# A napi működéshez szükséges alapok

2026. október 27. · A felhasználó kérésére készült működési felülvizsgálat.

A könnyen kezelhető képernyő mögött az appnak meg kell őriznie a munkát, meg kell akadályoznia a kettős rögzítést, és érthetően kell kezelnie a hibás vagy félbemaradt ügyeket. Ezek fontosabbak az éles induláshoz, mint további látványos funkciók.

**Elfogadott megvalósítási alap, 2026. október 27.** A felhasználó a kilenc alap megvalósítását kérte, a későbbi StoreHouse/r_keeper-illeszthetőséggel együtt. A tényleges állapotot és bizonyítékot az [alapok megvalósítása](alapok-megvalositasa.md) követi. Az alábbi szöveg a döntést megelőző hiányvizsgálatot is őrzi; „javaslat” és „nyitott részlet” jelölései nem már elkészült funkciót jelentenek.

**Az eredeti hiányvizsgálat:** A már elfogadott üzleti elvárásokat a [követelményjegyzék](kovetelmenyjegyzek.md) és a [működési terv](mukodesi-terv-vazlat.md) rögzíti; a megvalósítás részletes állapotát a külön lefedettség jelzi. A vizsgálat idején a v5 bemutató egy böngésző memóriájában működött. A helyi modell ellenőrzése nem bizonyít több valódi tablet közös működését vagy StoreHouse-könyvelést.

Az aktuális dashboardfejlesztés már foglalkozik a különálló párhuzamos átadásokkal, időpontokkal, helyenkénti összesítéssel és a felhasználó által választott 30 perces késési jelzéssel. Az alábbi lista ezek mögötti működést egészíti ki; nem nevezi őket ismét hiányzó funkciónak.

## Az éles napi használathoz szükséges feltételek

### 1. Ugyanaz az áru ne legyen kétszer kiadva

**Helyzet:** a raktáros kétszer érinti meg a gombot, két tablet egyszerre nyitja meg ugyanazt az átadást, vagy az elküldés után eltűnik a hálózat. Az is előfordulhat, hogy a StoreHouse már végrehajtotta a műveletet, csak a válasz nem érkezett vissza.

**Alapjavaslat:** minden elküldött műveletnek maradjon egyedi azonosítója. Az ismétlés ugyanannak az ügynek az eredményét ellenőrizze. Két dolgozó egyidejű módosításakor a második kapja meg a friss állapotot; ne írja felül észrevétlenül az elsőt. A „végrehajtás ellenőrzése folyamatban” külön állapot legyen, ne siker vagy szabadon újraküldhető piszkozat. Több célraktáras bevételezésnél az összetartozó részek állapota is követhető legyen.

**Meglévő vállalás:** KAP-02–04, NYIT-07–08. **Nyitott részlet:** a helyi API alapján kell igazolni az azonosítást, visszaolvasást és a részben teljesült művelet helyreállítását.

**Bizonyíték:** dupla kattintás, két egyidejű átvevő és elveszett válasz próbájában is csak egyszer változik a készlet. Több célraktárból csak az egyik sikeres végrehajtása nem jelenik meg teljes sikerként.

### 2. A munka újratöltés és tabletcsere után is megmaradjon

**Helyzet:** a szállítólevél felét már beírták, amikor lemerül a tablet. Egy másik dolgozó ugyanazon a készüléken jelentkezik be.

**Alapjavaslat:** az ügyek és előzményeik tartósan, közösen legyenek tárolva. A felület külön jelezze, hogy egy piszkozat hol és mikor lett sikeresen mentve; egy sikertelen mentés ne látszódjon mentettnek. A visszanyitás őrizze meg a tételeket és a felelőst. Másik dolgozó ne véglegesíthesse észrevétlenül az előző nevében. A központi adatok biztonsági mentése mellé visszaállítási próba is szükséges.

**Meglévő vállalás:** KAP-01–03, SZER-02 és NYIT-13. **Új részletjavaslat:** a másik eszközről folytatás, a piszkozat átadásának joga és az üzemeltetési mentési rend még kidolgozandó. Az eszközön offline maradt piszkozat nem ígérhető automatikusan elérhetőnek egy másik tableten.

**Bizonyíték:** kapcsolatvesztés, böngészőbezárás és újraindítás után a megígért mentési szintig visszaáll a munka, könyvelés nélkül. Egy visszaállított központi mentésből az ügyek és az előzmények összerendelhetők.

### 3. Mindig látszódjon, kinél van a következő teendő

**Helyzet:** a Saloon kijelölt átvevőjének véget ér a műszakja, miközben három átadás még nyitott. A következő dolgozó másik ember bejelentkezésében találja a tabletet.

**Alapjavaslat:** a tablet mutassa a helyet, az aktuálisan azonosított dolgozót és a feladatért felelős szerepet. A műszakra kijelölt átvevő/helyettes csak saját azonosítással igazoljon. A befejezetlen ügyek maradjanak láthatók műszakváltáskor, ne tűnjenek el a korábbi dolgozó kijelentkezésével. A raktárfelelős számára az is derüljön ki, ha nincs kijelölt átvevő.

**Meglévő vállalás:** SZER-01–05, NYIT-12–13. **Új részletjavaslat:** a kijelölés módja, a műszakátadás menete és a közös tablet zárolási szabálya még döntendő. Ez nem menetrendíró vagy teljes munkaidő-beosztó alkalmazás.

**Bizonyíték:** két külön ember ugyanazon a tableten saját néven dolgozik; jogosulatlan dolgozó nem igazol. Műszakváltáskor minden nyitott ügy megmarad, az új felelős és a korábbi művelet végzője elkülönül.

### 4. A téves rögzítést javítani lehessen, az előzményt megőrizve

**Helyzet:** a raktáros Grill terasz helyett Saloont választott, rossz mennyiséget adott meg, vagy elindított egy átadást, amely végül nem ment el. A tényleges áru helye nem mindig egyezik a félbehagyott képernyővel.

**Alapjavaslat:** véglegesítés előtt legyen összefoglaló a helyekről, tételekről és kiszerelésekről. A még el nem küldött piszkozat javítható legyen. Elindított vagy már könyvelt ügyet csak az állapotának megfelelő, indokolt helyesbítés rendezzen: az eredeti tartalom, a javító személy és a módosítás eredménye maradjon látható. Ne lehessen történetet eltüntető törléssel készletet javítani. A „még nem vittük el” és a „már máshol van” helyzet más készlethatást igényel.

**Meglévő vállalás:** MOZ-06, SZER-05, LELT-08 az eltérésrendezést már lefedi. **Új működési javaslat:** a téves célhely, visszavonás, többletátvétel és már lezárt ügy helyesbítésének pontos menete még nincs elfogadva. A StoreHouse megfelelő bizonylatművelete NYIT-05–07 szerint ellenőrizendő.

**Bizonyíték:** elküldés előtti, elküldés utáni és átvétel utáni hibára külön próba; a tényleges helyen lesz az áru, egyetlen korrekcióval és olvasható előzménnyel.

### 5. Egy készletszám mellett az is derüljön ki, mennyire aktuális

**Helyzet:** az áru már megérkezett a pulthoz, de még nincs igazolva; közben az r_keeper eladásai később jutnak át a StoreHouse-ba. A dolgozó eltérést lát, amely valójában még nem összehasonlítható adatból származik.

**Alapjavaslat:** különüljön el a könyvelt/elérhető készlet, az úton lévő mennyiség, a tisztázandó eltérés és a még ellenőrizetlen művelet. Legyen látható az utolsó sikeres adatfrissítés és az érintett kapcsolat hibája. A rendszer a saját óráját használja az események sorrendjéhez; a tablet elállított órája ne változtassa meg a határidőt. Késő adat után ugyanaz a fogyás vagy hiány ne legyen újra elszámolva.

**Meglévő vállalás:** ALAP-03, MOZ-03–06, FOGY-02–05, LELT-04/08, KAP-02, SZER-05; NYIT-03–07/14. **Nyitott részlet:** melyik adat mikorra vonatkozik, milyen késés fogadható el, és hogyan történik az egyeztetés. A bemutató helyi időbélyege ezt az éles problémát nem oldja meg.

**Bizonyíték:** késő kasszaadat, részleges átvétel, hibás tabletóra és megszakadó kapcsolat mellett is helyes állapot és egyszeri készlethatás. A hiányos összehasonlítás előzetesként látszik.

### 6. A kötelező műszakzárás elmulasztása is legyen felismerhető

**Helyzet:** a „Lezárom a műszakot” gomb működik, de senki sem nyomja meg. Máskor a számolást elkezdik, majd félbehagyják; a hely így indokolatlanul szünetelő állapotban marad.

**Alapjavaslat:** a rendszer tudja, mely pult melyik műszakját kell elszámolni, és mutassa külön a nem kezdett, folyamatban lévő, leadott és ellenőrzött zárást. Csak a ténylegesen működő pultoktól várjon elszámolást. Félbehagyott számolásból legyen szabályozott folytatás vagy indokolt megszakítás. A már elfogadott szabály megmarad: eltéréssel is leadható a számolás, a raktárfelelős később ellenőrizhet.

**Meglévő vállalás:** LELT-01–06, NYIT-12–14. **Új részletjavaslat:** a műszak azonosítása, a nyitott/zárt pult jelzése és a félbehagyott számolás rendezése még megtervezendő. Nem következik belőle automatikus munkavégzési tiltás vagy büntetés.

**Bizonyíték:** egy működő, számolást nem indító pult is hiányzó elszámolásként látszik; a zárva tartó nem. Félbeszakított számolás nem fagyasztja be végleg a helyet, és nem eredményez rejtett készletkorrekciót.

### 7. A megfelelő terméket nagy listában is biztonságosan meg lehessen találni

**Helyzet:** a szállítólevélen rövidített név szerepel; hasonló nevű 0,33 és 0,5 literes termék is van. A dolgozó egész kartont választ, de a csomagolás már megváltozott.

**Alapjavaslat:** kereshető terméklista, felismerhető kiszerelés és látható átváltás segítse a választást. Az összetéveszthető tételeket meg kell különböztetni; a gépi kiolvasás bizonytalan találata külön ellenőrzést igényeljen. A korábbi bizonylat őrizze meg az akkor alkalmazott egységet és szorzót, akkor is, ha a terméktörzs később változik. A nagy ügylistában helyre, állapotra és időszakra lehessen szűrni.

**Meglévő vállalás:** TORZS-02/04–06, BEV-02–06, NYIT-08–10. **Új felületi részletjavaslat:** a keresők, szűrők és a kiszerelésváltozás kezelése a valós törzslista alapján alakítandó ki. A hiányzó átváltást nem helyettesíti találgatás.

**Bizonyíték:** valós méretű terméklistában összetéveszthető termékek, hibás OCR-párosítás és változó kartonméret mellett is helyes termék és mennyiség. Egy régi ügy visszanyitása nem számolja át utólag a történeti készlethatást.

### 8. A dolgozó értse a visszajelzést és tudja, hogyan folytathatja

**Helyzet:** beküldés után csak egy forgó jel látszik, a gomb már eltűnt, vagy a hiba azt mondja: „Sikertelen”. A dolgozó nem tudja, megmaradt-e a munkája és újra kezdje-e.

**Alapjavaslat:** a fontos művelet után rövid, konkrét eredmény jelenjen meg: mi került rögzítésre, melyik ügyben, ki következik. Hiba esetén legyen megnevezett ok vagy ismert bizonytalanság, megőrzött bevitel és végrehajtható következő lépés. A piros/sárga állapothoz szöveg is tartozzon. A beírt mennyiségek ne vesszenek el automatikus frissítéstől vagy nézetváltástól.

**Meglévő vállalás:** ALAP-01/05, KAP-01–04. **Felületi részletjavaslat:** mezőhöz kötött javítás, egyértelmű folyamatjelzés, érintéshez alkalmas gombok és rövid helyi magyarázatok. A technikai hibát nem kell a dolgozóra hárítani, de az igazolatlan könyvelést sikerként mutatni sem lehet.

**Bizonyíték:** a kijelölt dolgozó önállóan javít hibás mezőt, folytat félbemaradt munkát és megkülönbözteti a mentett piszkozatot a véglegesített ügytől a tényleges tableten is.

### 9. Az induló készlet és a törzsadat legyen ellenőrzött

**Helyzet:** a felület jól működik, de a kiinduló nyilvántartás eltér a polcokon lévő árutól, vagy egy kassza rossz raktár receptkészletét fogyasztja. Ettől minden műszak újabb érthetetlen hiánnyal indulna.

**Alapjavaslat:** indulás előtt a helyek, termékek, kiszerelések, kassza-/receptkapcsolatok és palackreferenciák ellenőrzése szükséges. Egy kiválasztott helyen teljes napi próbával kell összekötni a bevételezést, átadást, kasszás fogyást, visszavétet és zárást. A nyitó mennyiségek eltérését az indulási rendben kell tisztázni; a régi adatot nem szabad hallgatólagosan pontosnak tekinteni.

**Meglévő vállalás:** TORZS-01–06, FOGY-01–05, MER-01–03; NYIT-02–04/10–11/15. **Új indulási javaslat:** ellenőrzött nyitóleltár és korlátozott helyszíni próba, helyi felelőssel; ennek időzítése és a különbségek rendezése még egyeztetendő.

**Bizonyíték:** a kipróbált hely tényleges nyitókészlete, az események és a záró számolás egymással összevezethetők, a valódi StoreHouse-eredmény visszaolvasható. Az indulás nem veszít el nyitott régi ügyet és nem számol el kétszer fogyást.

## Javasolt sorrend

Elsőként az egyszeri végrehajtást, a tartós munkamegőrzést és az ügyek felelősének azonosítását kell az éles működéshez megtervezni. Ezek nélkül a dashboard pontosnak látszó, de megbízhatatlan állapotot mutathatna. Ezzel párhuzamosan kidolgozható a téves rögzítések rendezése és a műszakok követése.

Az API-hozzáférésre várva elkészíthetők a hiba- és helyreállítási képernyők, az állapotátmenetek, a több dolgozóval végzett próbaforgatókönyvek és a döntendő működési részletek. A tényleges könyvelés, a frissesség és a megszakadt írás helyreállítása csak a helyi r_keeper/StoreHouse-kapcsolattal bizonyítható. Az új ötletek tervezése nem halaszthatja ki a korábban vállalt funkciókat.

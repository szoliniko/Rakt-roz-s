# Rendszerkapcsolat és megvalósítási sorrend

Állapot: a régi dokumentum és az elfogadott üzleti döntések alapján készített műszaki kiindulópont. A helyszíni rendszerhez nincs igazolt kapcsolat. A dokumentált eljárásnév nem bizonyítja az adott telepítés jogosultságát vagy működését.

A felhasználó még nem tudja, ki tudja biztosítani a hozzáférést. A forrásban megnevezett támogatási partner alapján elkészült egy [továbbítható műszaki megkeresés](hozzaferesi-egyeztetes.md); ez nincs elküldve. A helyi API-cím és az elérés tisztázása a következő külső előfeltétel.

## r_keeper, StoreHouse és az új app

| Összetevő | Feladata ebben a projektben |
| --- | --- |
| r_keeper POS | A kasszában rögzített tényleges étel- és italfogyasztás, beleértve az italcsomagokat. |
| QUSH és az értékesítési adatátadás | A régi dokumentumban leírt kapcsolat az r_keeper értékesítési adatai és a StoreHouse között. A helyi működés és frissítés ellenőrizendő. |
| StoreHouse | Termékek, egységek, készlethelyek, receptek, készlet és raktári bizonylatok. A már elszámolt fogyás forrása. |
| Új app és a hozzá tartozó kiszolgáló | A dolgozók tabletes kezelőfelülete, személyes azonosítás, átadási igazolások, számolás, ellenőrzés és a jóváhagyott műveletek átvezetése a meglévő rendszerbe. |

Az r_keeper és a StoreHouse külön összetevő. A megőrzendő adatút:

```text
r_keeper kasszás értékesítés
        ↓ meglévő értékesítési kapcsolat (a forrásban QUSH)
StoreHouse receptúrás/italfogyás és készlet
        ↕ ellenőrzött rendszerkapcsolat
új app kiszolgálója ↔ dolgozói tabletek
```

A közvetlen r_keeper XML/API-kapcsolat szükségességét az dönti el, hogy a StoreHouse/QUSH adatút elegendő és megfelelően friss adatot ad-e a működéshez. Ha további POS-adatra van szükség, a dokumentált közvetlen interfészt vagy a White Server útját kell megvizsgálni. A közvetlen POS-kapcsolat sem jelenthet újabb készletlevonást a már elszámolt fogyás mellett.

## Az alkalmazásból már előkészíthető kapcsolati határ

A szükséges működési alapok megvalósításával az alkalmazás rétegei különválnak: felület és kliens, üzleti szabályok, közös tartós kiszolgáló, majd a külső rendszerhez tartozó kapcsolati réteg. A [részletes szerkezet](alkalmazas-architektura.md) és a [helyi bizonyíték](alapok-megvalositasa.md) külön dokumentált. A tesztüzem adatbázisa nem a StoreHouse készletének második éles könyvelése.

A kapcsolati rétegnek az egyedi műveletazonosítót, a több részből álló művelet részeredményeit és a bizonytalan végrehajtást meg kell őriznie. A helyi tesztadapter ellenőrizheti az elveszett válasz és részleges eredmény viselkedését. A valódi adapterhez azonban a bizonylatfajtákat, küldési és visszaolvasási műveleteket a telepítésen kell igazolni; az elkészült csatlakozási határ nem jelent működő StoreHouse-API-t. Konfigurálatlan éles indítás nem válthat észrevétlenül tesztadatokra.

## Mit ad konkrétan a beszkennelt dokumentum?

A teljes változatlan átirat a [forrásmappában](forrasok/rkeeper-eredeti-atirat.md) is megvan. A PDF-oldal a feltöltött fájl fizikai oldala, a nyomtatott oldal az eredeti belső számozás.

| Forráshely | Használható műszaki kiindulópont | Még igazolandó |
| --- | --- | --- |
| PDF 15., nyomtatott 8. oldal | Raktárhoz StoreHouse Web API, POS-hoz RK7 XML/OrderNotify, távoli kapcsolathoz White Server; nem egyetlen általános r_keeper API. | Melyik út elérhető a tényleges telepítésben? |
| PDF 15–17., nyomtatott 8–9. oldal, 20–24. pont | `sh5info`: verzióadat; `sh5able`: eljárásjog; `sh5struct`: mezőszerkezet; `sh5exec`: eljárás-végrehajtás. | Tényleges API-verzió, szervercím, válaszséma, hitelesítés és jogosultság. |
| PDF 21–23., nyomtatott 11–12. oldal | Első `sh5info` próba; olvasási eljárások és a bizonylatok műszaki kiindulópontjai. | A példacím nem a vendéglátóhely valódi szervercíme. A neveket és mezőket a helyi builden kell igazolni. |
| PDF 23., nyomtatott 12. oldal | Például `Departs`, `Goods`, `GoodsMUnits`, `GoodsItem`, `GRemns`; bizonylatoknál `InsGDoc0`, `InsGDoc11`, valamint aktiválás vizsgálata. | Nem vakon használható jogosultságlista. A visszavét, részleges átadás és leltár végleges leképezése még tervezendő. |
| PDF 27., nyomtatott 14. oldal, 41–45. pont | Lezárt/kifizetett POS-rendelés → kumulatív adatbázis → QUSH → receptúrafelbontás → leírás vagy online készlet. | Helyi receptek, részleg-hozzárendelések, italcsomagos tételek, a könyvelt és online állapot, időbeli késés. |

A forrásban szereplő 9797/9798 port, verziószám, technikai felhasználónév és mintacím nem tekinthető helyi konfigurációnak. A publikus dokumentáció ellenőrzését és korlátait külön [forrásjelentés](integracios-forrasok.md) rögzíti.

## Mit váltottak fel a mostani döntések?

| Régi dokumentum javaslata | A jelenlegi projektben érvényes döntés |
| --- | --- |
| Menetrendíróra épülő előrejelzés, rendelési draft és konyhai batch-tervezés. | Nincs ilyen függőség vagy induló funkció. A napi raktári működés a cél. |
| Ember a StoreHouse kliensében aktiválja az előkészített bizonylatot. | A raktárfelelős az új appban véglegesít; az app vezeti át a jóváhagyott műveletet. Az ehhez szükséges API-lehetőséget igazolni kell. |
| Új termékből az agent csak javaslatot készít. | A raktárfelelős az új appból önállóan létrehozhat új StoreHouse-terméket, adatellenőrzéssel és duplikációfelismeréssel. |
| A pilot csak olvas és inaktív draftokat készít. | Az első kapcsolati próba lehet csak olvasó. A kész első változatnak az elfogadott véglegesítési feladatokat is teljesítenie kell. |
| Bevételezés a Főraktárra, előre tervezett főraktár–konyha mozgás. | A célraktár tételenként a tényleges elhelyezés szerint választható. A konyhai lerakodás nem jelent automatikus készletre vételt a Konyhán. |
| Receptíró/előrejelző asszisztens és automatikus beszerzési javaslatok. | A meglévő receptúrás fogyást követjük. Új receptszerkesztő és rendelési rendszer nem került az elfogadott első változatba. |

## A munka sorrendje

1. **Követelmények és források rögzítése.** A [követelményjegyzék](kovetelmenyjegyzek.md) minden elfogadott döntést azonosítóval és ellenőrzési feltétellel tart nyilván. A teljes vállalt tartalom megmarad a kis próbakör mellett is.
2. **Rendszerkapcsolat feltárása.** Először a dokumentált verziólekérdezés, majd az olvasási jogosultságok és mezőszerkezetek vizsgálata. Ezután valódi helyek, termékek, egységek és készlet lekérdezése. Ehhez a tényleges elérési cím és a helyi elérés szükséges.
3. **Az r_keeper fogyási útjának ellenőrzése.** Egy darabos ital, italcsomagos fogyasztás és receptúrás étel ismert próbája alapján igazolni kell a megfelelő készlethelyet, mennyiséget, frissülést és azt, hogy nincs kétszeres levonás. A helyszíni próba pontos környezetét és végrehajtását előre rögzíteni kell.
4. **Képernyőbemutató az igazolt adatkapcsolat keretei között.** A tabletes felület vázlata és mintaadatokat használó bemutatója párhuzamosan készülhet. Minden minta egyértelműen jelölt; a működő rendszerhez való kapcsolódás nem színlelhető. A felhasználó még nem hagyta jóvá a végleges elrendezést.
5. **Az írási műveletek igazolása tesztadatbázison.** Bevételezés, belső mozgás/visszavét, termékfelvitel, selejt és leltárkorrekció létrehozása, megfelelő jogosultságú véglegesítése és visszaolvasása. A StoreHouse-beli véglegesítéshez nem kellhet kézi átlépés. Külön vizsgálandó a részleges átvétel, a függő mennyiség és a bizonytalan végrehajtási eredmény ismétlés nélküli rendezése.
6. **Egy teljes kis működési kör.** Egy raktár, egy pult, néhány termék; kiadás, átvétel, fogyás, visszavét, műszakzárás, eltérésvizsgálat. Ez nem a funkciólista csökkentése: a többi vállalt folyamat külön is megvalósítandó.
7. **Teljes induló feladatkör és bevezetés.** A követelményjegyzék szerinti összes terület, ellenőrzött kezdőkészlet, kiszerelések, mérési referenciaadatok, dolgozók és tabletek. Felügyelt próba után fokozatos kiterjesztés.

## Hogyan bizonyítjuk, hogy valóban elkészült?

Minden érintett követelménynél külön rögzítjük a megvalósítást és az ellenőrzés eredményét. Egy képernyő vagy helyi teszt nem bizonyítja a StoreHouse-ban végrehajtott műveletet. API-s készletmódosításnál a szükséges bizonyíték a megfelelő személy művelete, a várható bizonylat/állapot és a helyes készlethatás visszaolvasása, a kapcsolódó hibás és ismételt kérések kezelésével.

Ha valamely képesség a telepített rendszerben nem elérhető, az érintett követelmény akadályozott marad és dokumentált megoldást igényel. Nem tűnhet el a tervből, és nem helyettesíthető jelöletlen szimulációval.

## Az első kapcsolati eszköz határa

A [kapcsolati segédprogram](../scripts/storehouse_probe.py) a forrás szerinti `sh5info` metaadat-lekérdezéshez elkészült. Kifejezetten megadott célcímet használ; készletet nem módosít és nem futtat üzleti eljárást. A 20 sikeres helyi teszt a diagnosztikai eszköz működését bizonyítja, többek között a pontos kérési útvonalat, a hibaválaszok és átirányítások kezelését, az idő- és méretkorlátokat. A helyszíni rendszerrel való kipróbálás a valós elérés hiányában még nem történt meg. Használat és tesztfuttatás: [technikai leírás](../scripts/README.md).

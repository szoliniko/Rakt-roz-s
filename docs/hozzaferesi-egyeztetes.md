# A helyi rendszer elérésének egyeztetése

Állapot: előkészített megkeresés, nincs elküldve. A felhasználó még nem tudja, ki tud hozzáférést biztosítani. Helyi API-cím, tesztkörnyezet és élő kapcsolatpróba egyelőre nincs.

## Kinél érdemes kezdeni?

Az eredeti dokumentum az UCS RKeepeR Rendszerház Kft.-t nevezi meg magyar képviseletként. A dokumentumban szereplő támogatási cím `support@ucs.hu`, általános cím `info@ucs.hu`, telefonszám `+36 1 331 0778` (PDF 11., nyomtatott 6. oldal). Ezek a forrásból átvett elérhetőségek; jelenlegi érvényességüket külön nem ellenőriztük.

Az első egyeztetés célja annak megállapítása, hogy a hely jelenlegi r_keeper/StoreHouse telepítését az UCS, más szervizpartner vagy a helyi rendszergazda kezeli-e. Nem feltételezzük, hogy a felhasználónak már van szerverhozzáférése.

## Továbbítható megkeresés

**Tárgy:** StoreHouse/r_keeper kapcsolat felmérése – saját raktárkezelő felület

Tisztelt Támogatás!

A meglévő r_keeper és StoreHouse rendszerünk mellé saját, belső, tableten használható raktárkezelő felületet készítünk. Kérjük segítségüket a jelenlegi telepítés és a támogatott integrációs hozzáférés azonosításában, illetve annak megadásában, ki tudja ezt biztosítani.

A dolgozók a bevételezést, raktárak közötti kiadást és átvételt, visszavétet, selejtet, leltárt és új termék felvitelét az új felületen intéznék. A kijelölt raktárfelelős ugyanott ellenőrizne és véglegesítene; a végleges műveleteknek a háttérben ténylegesen a StoreHouse-ban kell megjelenniük. A kasszás értékesítés az r_keeperben marad, a már elszámolt receptúrás és italfogyást az új app nem számolja el ismét. Előzetes igénytervezés és rendelés-összeállítás nem része ennek a fejlesztésnek.

Elsőként az alábbiakban kérünk segítséget:

1. Ki üzemelteti és támogatja jelenleg a telepítésünket? Mi az r_keeper, StoreHouse, QUSH és – ha telepítve van – a Web API pontos verziója? Helyi vagy felhős telepítésről van szó?
2. Elérhető-e támogatott StoreHouse Web API? Mi a tesztkörnyezet és a jóváhagyott elérési út? Első lépésként verzió/metaadat-lekérdezést, majd termék-, készlethely-, egység-, recept- és készletolvasást szeretnénk kipróbálni, erre alkalmas technikai felhasználóval.
3. Hogyan jutnak át jelenleg az r_keeper eladásai a StoreHouse-ba? Milyen időzítéssel frissül a könyvelt és az online készlet, mely értékesítési helyek mely készlethelyekről fogynak? Külön fontos a receptúrás étel és az italcsomagban rögzített fogyasztás helyes elszámolása.
4. Milyen dokumentált műveletek és jogosultságok szükségesek a bevételezés, belső mozgás/visszavét, új termék, selejt és leltárkorrekció létrehozásához, ellenőrzéséhez és API-n keresztüli véglegesítéséhez? Kérünk tesztelési lehetőséget és a telepített változatra érvényes mezőszerkezetet/státuszleírást. A cél az, hogy a dolgozónak ne kelljen a StoreHouse saját kezelőfelületére átlépnie.
5. Hogyan kérdezhető vissza egy bizonytalan eredményű művelet, milyen külső bizonylatazonosító és ismétlés elleni védelem használható? Van-e külön feltétel a részleges átadás és az átvételre váró mennyiség kezelésére?
6. Kell-e közvetlen r_keeper XML vagy White Server kapcsolat a szükséges adatokhoz? Milyen telepítési, licenc-, támogatási feltételek és költségek vannak?

Elsőként olvasási próbával indulnánk. A készletmódosító műveleteket megfelelő tesztkörnyezetben ellenőriznénk; ez nem helyettesíti a végleges appból történő készletkezelés fenti követelményét. A hozzáférési adatokat a megbeszélt biztonságos csatornán kérjük átadni.

Köszönjük segítségüket!

[Kapcsolattartó neve, üzlet/ügyfél azonosítása és elérhetősége]

## A kapott eredmény helye

A nem titkos műszaki tények és a kapcsolati próbák eredménye a [rendszerkapcsolati tervhez](integracios-terv.md) kerül. Jelszót és hozzáférési tokent nem írunk a dokumentumokba. Az eredményeket a [követelményjegyzék](kovetelmenyjegyzek.md) érintett soraihoz is hozzá kell rendelni; egyik nyitott funkció sem tekinthető késznek pusztán egy működő verziólekérdezéstől.

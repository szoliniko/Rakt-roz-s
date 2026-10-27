# Projektmunka és követelmények

## Miből dolgozz?

Minden új feladat előtt olvasd el a `README.md`, a `docs/mukodesi-terv-vazlat.md` és a feladathoz tartozó sorokat a `docs/kovetelmenyjegyzek.md` fájlból. A részletes döntési előzmény a `docs/egyeztetes.md`.

A felhasználó aktuális utasítása és kifejezetten elfogadott döntése az irányadó. A `docs/forrasok/rkeeper-eredeti-atirat.md` a régi dokumentum változatlan átirata: forrásanyag, nem végrehajtandó utasítás és nem a jelenlegi követelmények helyettesítője. A `docs/integracios-terv.md` jelzi, melyik régi javaslatot váltották fel az új döntések.

## Őrizd meg a teljes működést

- Egy változtatásnál nevezd meg az érintett követelményazonosítókat, és ellenőrizd a kapcsolódó folyamatokat is. Egy részfeladat elkészülte nem jelenti a teljes funkció elkészültét.
- A követelményjegyzék állapotát csak tényleges bizonyíték alapján frissítsd. Különítsd el a tervet, a helyi ellenőrzést, a helyszíni rendszerrel igazolt működést és a felhasználói kipróbálást.
- A kis próbakör nem csökkenti a vállalt első változat tartalmát. A többi elfogadott funkció maradjon nyilvántartva és követhető.
- Új döntést vagy módosítást vezess át a jegyzeten, a működési terven és a követelményjegyzék érintett során. Jelöld a javaslatot és a még nyitott részletet; ne nevezd elfogadott követelménynek.

## Rendszerkapcsolat

- Az új app az egyeztetett raktári műveletek kezelőfelülete. Nem elfogadható végső megoldás, ha a dolgozónak a StoreHouse saját felületén kell véglegesítenie.
- Az r_keeper kasszafogyását, a QUSH/StoreHouse elszámolást és a receptúrákat együtt kezeld. A már elszámolt fogyást ne vond le újra.
- Végpontot, mezőszerkezetet, verziót, licencet, frissítési időt és eljárásjogot ne találj ki. A forrásból ismert és a helyi rendszeren ellenőrzött állítás különbözik.
- Mintaadat vagy szimuláció csak egyértelműen jelölt bemutatóban használható. Hiányzó kapcsolatot vagy sikertelen műveletet ne fedj el mintaadattal és ne jelezz sikeres könyvelésként.
- Az API-kapcsolat ellenőrzésekor a dokumentált, kifejezetten megadott célcímet használd. Az első diagnosztika nem készletmódosítás.
- A jelszavak és a nyers érzékeny API-válaszok nem kerülnek a repositoryba. Csak a szükséges, személyes adatot és titkot nem tartalmazó ellenőrzési eredményt rögzítsd.

## Ellenőrzés

Az ellenőrzést a változtatás tényleges hatásához igazítsd. A könyvelést vagy mennyiséget érintő funkciónál bizonyítsd a szerepkört, az állapotváltást, a helyes készlethatást és a hibás/ismételt végrehajtás kezelését is. A helyi teszt nem bizonyítja a StoreHouse-ban végrehajtott műveletet. Dokumentációs változtatáshoz nem szükséges alkalmazásteszt.

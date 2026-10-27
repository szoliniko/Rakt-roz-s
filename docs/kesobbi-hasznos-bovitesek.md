# Hasznos bővítések a stabil alapműködés után

2026. október 27. · **Javaslatok, még nem elfogadott követelmények és nem elkészült funkciók.**

A felhasználó külön vizsgálatot kért az alapokon túli lehetőségekről. Az alábbi ötletek a kollégák napi munkáját könnyíthetik. Nem módosítják hallgatólagosan a [működési tervet](mukodesi-terv-vazlat.md) vagy a [követelményjegyzéket](kovetelmenyjegyzek.md). A megbízható működéshez szükséges alapokat a [külön felülvizsgálat](alapmukodes-felulvizsgalat.md) tárgyalja.

A személyes azonosítás, a kijelölt átvevő/helyettes, az ismételt könyvelés elleni védelem, a piszkozatmentés és a tényleges készletellenőrzés már az alapfeladat része. A most kért dashboard, a külön követhető párhuzamos átadások és a 30 perces piros késési jelzés szintén nem új ötlet ebben a listában.

## Javasolt sorrend

| Bővítés | Napi haszon | Várható ráfordítás | Mi kell hozzá előbb? |
| --- | --- | --- | --- |
| 1. Célzott emlékeztetés a nyitott ügyre | A piros jelzésből elintézendő feladat lesz; nem csak akkor veszik észre, amikor valaki a listára néz. | Közepes | Valós felelős/helyettes, tartós ügyállapot, egyeztetett értesítési szabály. |
| 2. Vonalkódos termékválasztás | Kevesebb keresés és hasonló nevű termék összekeverése. | Közepes | Ellenőrzött termék- és kiszereléskapcsolat, próba a tényleges tablettel. |
| 3. A polcok sorrendjét követő számolás | Kevesebb járkálás és kihagyott vagy kétszer számolt áru műszakzáráskor. | Kicsi–közepes | Helyenként rögzített fizikai sorrend és a számolás stabil alapfolyamata. |
| 4. Kép és rövid megjegyzés az eltéréshez | A raktárfelelős később is érti, mit látott az átvevő. | Közepes | Művelethez kapcsolt, jogosultsággal védett mellékletek és tárolás. |
| 5. Közelgő lejárat és felhasználási sorrend | Segít előbb felhasználni a hamarabb lejáró árut. | Nagy | Megbízható lejárati/tételadat és ténylegesen követhető tételmozgás. |
| 6. Alacsony készlet jelzése | A raktárfelelős időben látja, melyik hely készlete fogyott kevésre. | Közepes | Ellenőrzött készlet, frissesség, függő mozgások és megadott minimumok. |
| 7. Visszatérő fennakadások áttekintése | Megmutatja, hol érdemes a munkafolyamaton javítani. | Közepes | Kellő mennyiségű megbízható eseményadat és tisztázott időszakok. |

A ráfordítások egymáshoz viszonyított becslések, nem határidő- vagy API-képességígéretek. Elsőként az **1–3. pontot** érdemes kipróbálni: közvetlenül segítik az átvételt és a kötelező számolást, kevés új felületi elemmel.

## 1. Célzott emlékeztetés és továbbjelzés

**Helyzet:** a Saloonnak több átadása vár igazolásra. A 30 perces jelzés már piros, de az átvevő éppen más feladatot végez. Egy visszatérő, összevont feladatjelzés a Saloon tabletjén közvetlenül a legrégebbi nyitott ügyhöz vezethet. Ha továbbra sem történik intézkedés, a raktárfelelős a saját feladatai között láthatja, hogy személyes egyeztetés szükséges.

**Kevés új kezelőelem:** „3 átadás vár rád, ebből 1 késik” és „Megnyitom”. Ugyanarról a helyről ne érkezzen tételenként újabb értesítés; lezárt ügy ne emlékeztessen tovább. A helyettes szerepe már elfogadott, az automatikus értesítés és továbbjelzés új javaslat.

**Nyitott döntés:** ki, mikor és milyen csatornán kapjon jelzést, mi történjen műszakváltáskor, mikor lehet átmenetileg elhalasztani az emlékeztetést? Kezdésnek az appon belüli jelzés javasolt. E-mail, SMS vagy saját telefon nem előfeltétel. A késés nem bizonyít mulasztást, nem vezet automatikus átvételhez, büntetéshez vagy készletmódosításhoz.

**Próba:** két párhuzamos átadásból az egyik lezárásakor csak a másik maradjon a jelzésben; személyváltás után a kijelölt jogosult lássa, és az előző dolgozó ne kapjon tovább új feladatot.

## 2. Vonalkódos termékválasztás

**Helyzet:** bevételezésnél vagy kiadásnál több hasonló ital közül kell kiválasztani a pontos terméket. A tablet kamerájával beolvasott kód megnyitná a hozzá tartozó terméket; a dolgozó ellenőrzi a nevet, kiszerelést és mennyiséget.

**Kevés új kezelőelem:** „Vonalkód beolvasása” a termékmező mellett. A kézi keresés megmarad. A beolvasás önmagában nem igazolja az átvett mennyiséget és nem könyvel. Nem minden beszállítói vagy kartonkód azonos egy darab termék kódjával: ezt külön ellenőrzött kapcsolatnak kell kezelnie a rendszernek.

**Függőség:** valódi terméktörzs, kód–kiszerelés megfeleltetés, kameraengedély és olvashatósági próba a helyszíni tableten. Ismeretlen vagy több termékhez kötött kódnál választást/ellenőrzést kérjen; ne hozzon létre automatikusan új terméket. A vonalkódadat használhatóságát az elérhető StoreHouse-adatokból még igazolni kell (TORZS-04–06, NYIT-09).

**Próba:** darabkód, kartonkód, ismeretlen és kétértelmű kód esetén is a helyes termék és egység jelenjen meg, vagy egyértelmű kézi ellenőrzési lépés következzen.

## 3. A hely fizikai sorrendjét követő számolás

**Helyzet:** a pultfelelős a hűtővel kezd, utána a boros polcot, végül a töményeket számolja. Egy pusztán ábécés terméklista miatt többször kell ugyanoda visszamennie. Helyenként beállítható számolási sorrend követhetné a tényleges elrendezést.

**Kevés új kezelőelem:** rövid szakaszok, például „Hűtő”, „Borok”, „Tömények”, és „Még 4 termék nincs megszámolva”. A dolgozó folytathatja, ahol abbahagyta. Ha ugyanaz a termék két polcon van, a részszámolások láthatóan összeadódnak; nem írják felül egymást.

**Függőség:** helyszíni elrendezés és valaki, aki változáskor karbantartja. A polccsoport csak számolási segítség; nem új StoreHouse-raktár és nem készletmozgatás. A terméket a lista átrendezése vagy keresési szűrője nem hagyhatja ki a kötelező számolásból. Ez a már elfogadott vezetett számolás (LELT-01–03) további kényelmi bővítése, nem a fizikai számolás kiváltása.

**Próba:** egy két helyen tárolt termék mennyisége pontosan egyszer összesüljön, a ki nem töltött sor maradjon jól látható, és az elrendezés módosítása ne változtasson készletet.

## 4. Kép és megjegyzés az eltéréshez

**Helyzet:** sérült karton érkezett a pultba, vagy nem egyértelmű, melyik palackot hozták vissza. Az átvevő az adott ügyhöz rövid megjegyzést és szükség esetén képet csatolhatna. A raktárfelelős ugyanott látná a beszámolót és a mennyiségeket, amikor később tisztázza az eltérést.

**Kevés új kezelőelem:** az eltérésnél lenyitható „Megjegyzés vagy kép hozzáadása”. Ez nem kötelező fotózás minden belső mozgásnál; a MOZ-08 szerinti egyszerű átadás megmarad. A beszállítói szállítólevél fotózása már vállalt funkció, a belső eltéréshez csatolt kép új javaslat.

**Függőség:** mellékletkezelés, a megfelelő ügyhöz és szerzőhöz kötés, hozzáférés és megőrzés megtervezése. A kép nem módosít készletet és nem bizonyítja önmagában az eltérés okát. Felesleges személyfotó helyett a termék és a probléma legyen dokumentálható.

**Próba:** a megjegyzés és kép csak a megfelelő ügyben jelenjen meg; egy megszakadt feltöltés ne veszítse el a mennyiségeket és ne állítsa, hogy a kép már elérhető.

## 5. Közelgő lejárat és felhasználási sorrend

**Helyzet:** ugyanabból a húsból vagy italból több szállítmány van készleten, eltérő lejárattal. A kiadási képernyő megmutathatná, melyik ellenőrzött tételt érdemes előbb felhasználni, és melyiknél szükséges a felelős vizsgálata.

**Kevés új kezelőelem:** a termék mellett a lejárat és egy rövid figyelmeztetés; részletes tétellista csak megnyitáskor. Lejárat alapján előbb a hamarabb lejáró tétel következik, nem feltétlenül a korábban érkezett. Bontás utáni felhasználhatóság csak külön ellenőrzött szabályból jelenhetne meg.

**Függőség:** fel kell tárni, van-e megbízható tétel- és lejárati adat, és a tényleges kiadás/fogyás tételszinten követhető-e. Összesített StoreHouse-készletből nem lehet kitalálni, melyik lejáratú áru maradt meg. A hiányzó adatot láthatóan kezelni kell. A lejárati jelzés nem automatikus selejtezés és nem teljes élelmiszerbiztonsági rendszer.

**Próba:** két eltérő lejáratú tétel, részleges kiadás és visszavét után is bizonyítható legyen, melyikből mennyi maradt. Ha ez még nem biztosítható, a mennyiséget nem szabad megbízható tételkészletként kijelezni.

## 6. Alacsony készlet jelzése rendeléskészítés nélkül

**Helyzet:** valamelyik pult készlete az előre megadott minimum alá esik. A raktárfelelős láthatná, hogy érdemes ránéznie, valamint azt is, érkezik-e már oda áru. Így nem indítana újabb kiadást csak azért, mert a még átadás alatt lévő mennyiség nincs a pult elérhető készletén.

**Kevés új kezelőelem:** hely–termék sor, nyilvántartott készlet, minimum és „Úton van” mennyiség. A raktárfelelős dönt; nincs automatikus kiadás, pulti árukérés vagy beszállítói rendelés. Ez minimumszint-jelzés, nem az induló körből kizárt igény-előrejelzés (HATAR-02–03).

**Függőség:** külön megadott helyi minimumok, egységes mértékegység, igazolt készletfrissesség és függő mozgások. Elavult kasszaadat mellett ne állítsa biztosan, hogy valódi hiány van. A csomagos és receptúrás fogyás adatútját ugyanúgy ellenőrizni kell (FOGY-01–05, NYIT-03–04).

**Próba:** minimum alatti készlethez már úton lévő szállítmánynál jelenjen meg ez az összefüggés; hiányzó vagy régi adatok mellett ne szülessen megtévesztő sürgős készletigény.

## 7. Visszatérő fennakadások áttekintése

**Helyzet:** több hét használat után kiderülhet, hogy bizonyos napszakban rendszeresen sok átadás vár visszaigazolásra. A vezető azt vizsgálhatná, megfelelő helyen van-e a tablet, elegendő-e a kijelölt átvevő ideje, vagy félreérthető-e egy lépés.

**Kevés új kezelőelem:** időszak és hely szerinti összesítés: átadások száma, várakozási idő, késők aránya és tisztázandó eltérések. Egy összesítésből megnyithatóak a konkrét ügyek; nem önmagukban álló, magyarázat nélküli számok jelennek meg.

**Függőség:** megbízható szerveridő, eseménytörténet és elegendő valós adat. A fennálló nyitott ügyek és a már lezárt átadások külön értelmezendők. Kapcsolathiba vagy elmaradt adminisztráció nem bizonyít eltűnt árut, és az eltérés nem automatikusan egy dolgozó hibája. A javaslat folyamatjavítást szolgál, nem dolgozói rangsort vagy automatikus felelősségmegállapítást. A vezetői áttekintés igénye már elfogadott (SZER-06), e mérőszámok pontos tartalma még javaslat.

**Próba:** minden összesített adat visszavezethető legyen a megnyitható ügyekhez; azonos időszakra újraszámolva ugyanazt az eredményt adja, a kevés adat pedig látható korlát maradjon.

## Mit lehet most továbbtervezni?

Az első három bővítés kezelését valódi rendszerkapcsolat nélkül is lehet érthető példával és képernyővel vizsgálni, de ettől az értesítés, kameraolvasás vagy helyszíni számolási rend még nem lesz kész. A lejárati és készletminimum-funkció részletes megvalósítását az ellenőrzött törzs- és készletadatokra kell építeni. Éles folyamat-elemzéshez előbb valós használati adatok szükségesek.

Ebben a vizsgálatban nem készült alkalmazáskód és nem történt külső üzenetküldés vagy rendszerhívás. A javaslatokhoz üzleti választás és részletes tervezés után lehet külön követelményazonosítót rendelni; addig a meglévő vállalásokat nem bővítik és nem szűkítik.

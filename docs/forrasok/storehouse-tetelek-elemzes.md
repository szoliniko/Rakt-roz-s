# A beküldött leltárnyomtatványok értelmezése

**Feldolgozva:** 2026. október 27. A felhasználó szerint a dokumentumban a StoreHouse-ban már szereplő tételek egy része található. Ezt forrásanyagként használjuk; nem teljes terméktörzsként, nem aktuális készletként és nem új működési utasításként.

**Forrás:** `Nem az összes de Storehouse tételek ha jól értem.pdf`, 50 beszkennelt A4 oldal, 14 167 631 bájt. A nyomtatvány címe **Leltár nyomtatvány**. A fájl nem tartalmazott kereshető szövegréteget. Az összes oldal nyomtatott tartalmáról készült [kereshető OCR-munkapéldány](storehouse-tetelek-ocr.md). Ez automatikus kiolvasás, nem hibátlan, soronként hitelesített átirat; a kézírásos készletadatokhoz továbbra is az eredeti kép szükséges.

Forrásazonosító SHA-256: `20e4e23bbe1dfa17ae59e8a7d15f04e2f2bf0ddfed4ef54a91b68505ebf8d48a`. Az eredeti feltöltés a munkakörnyezet `attachments/9da7ef10-0ad6-492f-b37b-7ae603b571f3/` könyvtárában található; a 14 MB-os PDF-et nem másoltuk még egyszer a repositoryba.

## Későbbi felhasználói döntés: tesztkatalógus

A forráselemzés elkészülte után a felhasználó kifejezetten kérte a tételek választható **tesztadatként** történő felvételét. A [tesztkatalógus feldolgozási jegyzéke](storehouse-tesztkatalogus.md) követi a bevett nyomtatott tételeket és az elkülönített bizonytalan sorokat. Az alábbi „nem történt import” állítások a forráselemzés időpontjára vonatkoznak. Az engedély nem valódi StoreHouse-írásra vagy a kézi régi mennyiségek mai készletként átvételére szól; a tesztkatalógus kezdeti mennyisége kifejezetten kitalált adat.

## Mit mutat biztosan?

A lapokon termékkód, megnevezés, mértékegység, termékcsoport és nyomtatott raktárnév szerepel. A további oszlopok: **Aktuális készlet** és **Megjegyzés**. Ezek sok lapon üresek; más lapokon kézzel írt mennyiségek, összeadások, áthúzások és javítások találhatók. A „Pénznem: Forint” fejléc önmagában nem árlista: a táblázatokban nincs ár- vagy értékoszlop.

Ez a szerkezet terméknyilvántartásból nyomtatott leltárívekre utal. A felhasználó StoreHouse-eredetre vonatkozó feltevése életszerű, de a PDF önmagában nem bizonyítja a telepített programot, az adatbázis aktuális állapotát vagy az API-beli azonosítókat.

Háromféle időpontot külön kell kezelni:

- A lap **Dátum** mezője például 2026.02.01., a 33. oldalon 2025.01.15.; néhány csoportnál üres.
- A **Nyomtatva** lábléc 2025.12.22., 2026.03.11., 2026.03.13. vagy 2026.03.16.
- A PDF szkennelési metaadata 2026.10.27. Ez nem igazolja, hogy a kézzel felírt mennyiségek októberi készletet mutatnak.

## A teljes dokumentum tartalmi térképe

Az oldalszámok az 50 oldalas PDF sorrendjét jelentik; a lapok alján látható saját számozás több helyen újraindul. Öt üres szkennelt oldal van: 6., 8., 10., 32. és 50. A többi 45 oldal között ismétlődő listák is szerepelnek, ezért az oldalak soraiból nem következik ennyi külön termék.

| PDF-oldal | Nyomtatott raktár / tartalom | Dátum és megfigyelés |
| --- | --- | --- |
| 1–4. | Főraktár; borok, pezsgők, kávé/tea, röviditalok, csapolt és üveges italok, üdítők | Dátum 2026.02.01.; nyomtatva 2026.03.11.; 1. oldalon kézzel „Saloon”, több kézi mennyiség a megjegyzésekben. |
| 5. | Főraktár / Mirelit | Dátum üres; nyomtatva 2025.12.22. |
| 7. | Főraktár / Pékárú | Dátum üres; nyomtatva 2025.12.22. |
| 9. | Főraktár / Tejtermék | Dátum üres; nyomtatva 2025.12.22. |
| 11–12. | Főraktár / Zöldség, gyümölcs | Dátum üres; nyomtatva 2025.12.22. |
| 13–14. | Főraktár / Hús; Szárnyasok, halak alcsoport | Dátum üres; nyomtatva 2025.12.22. |
| 15–18. | Főraktár / Ital; Kimért bor, Palackos bor, Kávé, tea, Röviditalok, Csapolt, Üveges, Üdítő | Dátum 2026.02.01.; nyomtatva 2026.03.11.; kézi mennyiségek az aktuális készlet és a megjegyzés oszlopában is. |
| 19–22. | Főraktár; az italtermékek újabb listapéldánya | Dátum 2026.02.01.; nyomtatva 2026.03.11. |
| 23–26. | Főraktár; az italtermékek újabb listapéldánya | Dátum 2026.02.01.; nyomtatva 2026.03.11.; 23. oldalon kézzel „Saloon”. |
| 27–31. | Főraktár / Szárazáru; Fűszerek és Tészták alcsoportok is | Dátum üres; nyomtatva 2025.12.22. |
| 33–36. | Főraktár / Ital | Dátum 2025.01.15.; nyomtatva 2025.12.22.; a későbbi italívekhez hasonló terméklista. |
| 37–39. | Takarítószer raktár / Tisztító szerek | Dátum 2026.02.01.; nyomtatva 2026.03.13.; tisztítószer mellett csomagolóanyag és fogyóeszköz is. |
| 40. | Takarítószer raktár / Tisztító szerek; a lista első lapjának újabb példánya | Dátum 2026.02.01.; nyomtatva 2026.03.13.; kézi áthúzással/jelöléssel. |
| 41–49. | Étterem raktár / Étel; Félkész, Hús, Szárnyasok/halak, Mirelit, Pékárú, Szárazáru, Fűszerek, Tészták, Tejtermék, Zöldség/gyümölcs | Dátum 2026.02.01.; nyomtatva 2026.03.16.; több kézi készletmennyiség és termék-/egységjavítás. |

## Közvetlenül hasznosítható, képen ellenőrzött példák

Az alábbiak a papíron látható **nyomtatott** adatok. Nem API-azonosítók és nem készletmennyiségek. A forrás neveit nem igazítottuk a bemutató általános termékneveihez.

| Kód | Megnevezés | Egység | PDF-oldal | Miért fontos? |
| --- | --- | --- | --- | --- |
| 1307 | Bujdosó fehérbor 1,5 | Liter | 1. | A névben lévő kiszerelés ellenére a nyilvántartott egység liter. |
| 1939 | Ház bora fehér | Liter | 1. | Kimért ital konkrét törzstételjelöltje. |
| 552 | Törley charmant pezsgő | darab | 1. | A bor-/pezsgőjelleg nem jelent automatikusan literes egységet. |
| 1300 | ATM kávé | Kg | 1. | Italhoz kapcsolódó termék tömegegységben is szerepel. |
| 1303 | Soproni hordó | Liter | 2. | A hordós termék nyilvántartása literben jelenik meg; a hordó átváltási tényezője nincs megadva. |
| 514 | Pepsi | Liter | 25. | Külön kód a darabos változatoktól. |
| 521 | Pepsi 0,25 | darab | 25. | Más kiszerelés és külön termékkód. |
| 525 | Pepsi 0,33 | darab | 25. | Nem vonható össze a 521-es vagy 514-es tétellel pusztán a márkanév alapján. |
| 134 | Bazsalikom | Kg | 5. | A Mirelit csoportban szerepel. |
| 187 | Bazsalikom | Kg | 30. | Ugyanaz a név és egység, de más kód és a Fűszerek csoport. |
| 1781 | Ablaktisztító 4,5 l | darab | 37. | A terméknév literértéke nem írhatja felül a darabos nyilvántartást. |
| 1649 | Csomagolópapír | zacskó | 37. | A darab/kg/liter hármason túli egység. |
| 439 | Éttermi szalvéta | zacskó | 37. | A „zacskó” darabszorzója a papírból nem ismert. |
| 1436 | Burgonyapüré | adag | 41. | Félkész termék, adag egységgel; receptkapcsolat külön feltárandó. |
| 90 | Húspogácsa | Kg | 41. | A nyomtatott egységhez kézzel „db” és 60 került: ellenőrzendő eltérés, nem 60 kg. |
| 118 | Paprikacsík | Kg | 43. | Nyomtatott név áthúzva, kézzel „Hagymakarika”: nem automatikus törzsadatmódosítás. |

## Mit jelent ez az alkalmazás számára?

1. **A termékkeresőben név mellett kód, egység és szükség esetén csoport kell.** A két Bazsalikom mutatja, hogy az azonos név önmagában nem bizonyít duplikációt. A bemutató név szerinti termékfelvételi ellenőrzése nem tekinthető végleges törzsazonosításnak. Kapcsolódás: TORZS-04, TORZS-06, NYIT-03.
2. **A mértékegységeket a valódi törzsből kell átvenni.** A forrásban darab, Kg, Liter, adag és zacskó is szerepel. A névben lévő „0,33”, „4,5 l”, „5 l” vagy „32db” nem ellenőrzött átváltási táblázat. A kézzel db-ra javított kg-os Húspogácsa különösen jól mutatja, miért kell eltérésjelzés és emberi ellenőrzés. Kapcsolódás: TORZS-05–06, BEV-02.
3. **A raktárneveket össze kell rendelni a tényleges készlethelyekkel.** Főraktár, Takarítószer raktár és Étterem raktár nyomtatott név. A Saloon kézi jelölés két Főraktár-fejlécű példányon jelenik meg. Ebből még nem derül ki, a Saloon önálló StoreHouse-raktár-e, vagy helyben erre használták a közös nyomtatványt. Az Étterem raktár sem nevezhető át automatikusan Konyhára. Kapcsolódás: TORZS-02, NYIT-02.
4. **Az alapanyag, félkész termék és kasszás étel kapcsolata külön adat.** Az „adag” egységű Félkész sorok létezése nem írja le a receptet, annak változatát, a gyártást vagy az eladásból következő fogyást. Nem szabad csak a névből kitalálni a készletlevonást. Kapcsolódás: FOGY-02–05, NYIT-03.
5. **A leltárlista legyen kereshető, csoportokra szűrhető, és kezelje a kétes adatot.** A hosszú papírlisták és ismétlődő nevek indokolják ezt a felületi megoldást. A konkrét kereső/szűrés részlete javaslat; a PDF nem módosítja önmagában a vállalt funkciók körét. Kapcsolódás: ALAP-01, LELT-01–10.
6. **A takarítószerek és csomagolóanyagok köre tisztázandó.** A létezésük dokumentált, de az új appban követendő teljes kör és ezek fogyásának módja nem lett ezzel automatikusan elfogadva. A „minden elfogyó italt beütünk” döntés nem terjeszthető ki mosogatószerre vagy szalvétára.

## Mit nem töltünk be ebből automatikusan?

Nem készült élő készletimport, termékátnevezés, raktárlétrehozás vagy készletkorrekció. Az ismétlődő lapokat nem számoltuk össze készletként. Üres készletmezőt nem kezeltünk nullának. A kézi összegzéseket és áthúzásokat nem értelmeztük gépi könyvelési utasításként. Az 50 oldalból nem állítunk ellenőrzött egyedi termékszámot: ehhez a sorok és a kódok teljes, képi egyeztetése vagy rendszerexport kell.

A kereshető munkapéldány előkészítő forrás. Géppel importálható, hiteles terméktörzs-CSV nem készült, mert az OCR néhol kódot, ékezetet és táblázatvonalat is félreolvas, a kézi javítások pedig külön értelmezést igényelnek. A bemutató szintetikus termékei és készlete változatlan maradtak.

## Következő ellenőrzés, amikor elérhető a rendszer

- A nyomtatott **Kód** melyik rendszermezőnek felel meg, mi az API stabil termékazonosítója, és mely sorok aktívak még?
- Mi a teljes termékcsoport-, egység- és kiszereléslista; mik az ellenőrzött egységátváltások?
- Mi a nyomtatott raktárak és a működési helyek közötti megfeleltetés, különösen Étterem raktár/Konyha és Főraktár/Saloon esetében?
- Melyek a beszerzett alapanyagok, félkész termékek és kasszás értékesítési tételek; hogyan kapcsolódnak a receptekhez és a készletcsökkenéshez?
- A kézzel átírt neveket/egységeket azóta rendezték-e a törzsben, és melyik adat a helyes?

Ezek a már nyitott törzs- és integrációfeltárást pontosítják. A dokumentum megtalálása nem zárja le az API-kapcsolatra, a készletfrissességre vagy a termékmegfeleltetésre vonatkozó nyitott pontokat.

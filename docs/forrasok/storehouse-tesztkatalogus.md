# A leltárívekből felvett teszttermékek

2026. október 27. · A felhasználó kifejezetten kérte, hogy a beküldött termékek a rendszerben kiválasztható tesztadatok legyenek. A papír régi készletmennyiségei nem induló készletadatok.

**590 külön nyomtatott termékkódhoz készült választható teszttétel.** Ez a beküldött részleges dokumentumból összeállított lista, nem a teljes vagy jelenleg aktív StoreHouse-terméktörzs igazolása. A név, nyomtatott kód és mértékegység a lapképekkel ellenőrzött nyomtatott adatokból származik. A kódból nem következik API-azonosító; minden `externalId` üres (`null`).

- [A tesztkatalógus géppel olvasható adatai](../../data/test-catalog.json)
- [Az alkalmazás által használt JavaScript-modul](../../data/test-catalog.mjs)
- [A visszaállítható feldolgozó és képi javításjegyzék](../../scripts/extract_test_catalog.py)
- [Az 50 oldalas forrás értelmezése](storehouse-tetelek-elemzes.md), [megőrzött OCR-munkapéldány](storehouse-tetelek-ocr.md)

## Mi került a listába?

| Nyomtatott alapegység | Belső egységjel | Termékek száma |
| --- | --- | ---: |
| Kg | kg | 297 |
| darab | db | 160 |
| Liter | l | 96 |
| adag | adag | 24 |
| zacskó | zacskó | 13 |

A termékkódokhoz stabil `source-…` tesztazonosító tartozik. Név mellett a forráskód, csoport és egység is megjeleníthető. Például a **134-es Bazsalikom / Mirelit** és a **187-es Bazsalikom / Fűszerek** külön termék maradt. A **514-es Pepsi liter**, a **521-es Pepsi 0,25 darab** és az **525-ös Pepsi 0,33 darab** szintén külön sor.

A 12 csoport a papír alapján segíti a keresést. Az ismétlődő italívek alapján 129 termék tartozik az **Ital** csoporthoz, beleértve a kávéhoz tartozó kg-os termékeket is. Ezek `countInShift: true` jelölést kaptak a pulti számolási kör előkészítéséhez. Ez nem receptúra és nem készletlevonási szabály. A többi tételnél a jelölés hamis; a tényleges helyi választék és a fizikailag megtalált további tételek külön kezelendők.

**Kiszerelési szorzót nem találtunk ki a terméknévből.** Minden új forrástétel egyelőre kizárólag a nyomtatott alapegységében rögzíthető, annak szorzója 1. Az „Ablaktisztító 4,5 l” neve például nem írja felül a nyilvántartott **darab** egységet. Hordó, karton, zacskó vagy palack darabszorzója csak külön ellenőrzött adatból adható hozzá. A palacksúlyhoz és receptekhez sincs kitalált referencia.

## Ellenőrzés és ismétlődő lapok

Az 50 oldal megőrzött OCR-szövegéből minden felismert nyomtatott kód/név/egység jelöltet összegyűjtöttünk. A termékazonosság képi ellenőrzéséhez az 1–5., 7., 9., 11–14., 27–31., 37–39. és 41–42. oldalak nyomtatott listáit használtuk. Ezek együtt lefedik a kiválasztott termékazonosságokat; az OCR által kihagyott sorokat a képek alapján pótoltuk. Az ismétlődő oldalak újabb készletként vagy új termékként nem lettek összeadva.

A 15., 22., 23. és 36. oldali ellenőrzés több félreolvasott kódot is tisztázott: az OCR például `1938`, `835` vagy `6535` kódot készített meglévő 1939-es, illetve 535-ös sorokból. A feldolgozó csak a képen ellenőrzött javításokat tartalmazza; nem általános névhasonlóság alapján olvaszt termékeket össze.

Minden termék `provenance.verifiedPage` mezője az azonosság ellenőrzésének PDF-oldalát mutatja; a `pages` az OCR-rel megtalált további előfordulásokat is felsorolja. A `verified: true` jelentése kizárólag **a nyomtatott forrásazonosság ellenőrzött**, nem az, hogy a StoreHouse aktuális állapotát vagy API-megfeleltetését igazoltuk. A forrás SHA-256 lenyomata minden tételnél megmarad.

## Kézi javítások és bizonytalan kiegészítések

Négy választható, nyomtatott azonosságában ellenőrzött tétel külön `needsReview` figyelmeztetést kapott:

| Kód | A tesztben megőrzött adat | Mi igényel éles ellenőrzést? |
| --- | --- | --- |
| 90 | Húspogácsa, kg | A 41. oldalon kézzel db szerepel a nyomtatott Kg mellett. |
| 118 | Paprikacsík, kg | A 43. oldalon kézzel Hagymakarikára javított név látható. |
| 122 | Karfiol, kg | A 42. oldalon kézzel Rántott került a név mellé. |
| 2012 | kacsacomb, kg | A 42. oldalon kézzel db szerepel a nyomtatott Kg mellett. |

A kézi beírás nem módosította a tesztben megőrzött nyomtatott nevet vagy egységet. Nincs kg–db átváltás vagy új recept kitalálva.

Négy, a 4. oldalon kézzel hozzáírt név — Soproni 0% dobozos, Leffe, Erdinger, barista zabtej — **nem választható termék**, mert nincs hozzájuk ellenőrzött nyomtatott kód és egység. A `CATALOG_REVIEW_ROWS` listában maradtak meg, így a későbbi egyeztetésnél nem vesznek el.

## Készlet és éles kapcsolódás

A katalógusmodul nem tartalmaz készletmennyiséget, árat, nyitóleltárt, raktár-hozzárendelést vagy kitalált StoreHouse-referenciaazonosítót. A tesztalkalmazás a saját, külön megjelölt tesztkészletével használja ezeket a neveket. Az adag- és zacskóegység szerepeltetése sem jelenti automatikusan félkésztermék-gyártás, tisztítószer-fogyás vagy más új éles folyamat megvalósítását.

Éles csatlakozáskor a termékek aktuális státuszát, valódi API-azonosítóját, egységeit, átváltásait és helyi használatát a StoreHouse-ból kell ellenőrizni. A nyomtatott forráskód és az API-kapcsolat adata külön mezőben marad. Kapcsolódó követelmények: TORZS-02, TORZS-04–06, BEV-02, LELT-01–10, NYIT-02–03 és NYIT-09–10.

Újragenerálás: `python scripts/extract_test_catalog.py`. A feldolgozó a megőrzött OCR-munkapéldányból és a kódban rögzített, képen ellenőrzött javításokból dolgozik; nem igényli újra az OCR-eszközöket vagy hálózati hozzáférést.

# Dashboard – független záróellenőrzés

Dátum: 2026. október 27. Döntés: **ship**, kizárólag a felhasználónak átadható, egyértelműen jelölt v5 bemutató szintjén. Nincs fennmaradó, az átadást akadályozó megjelenítési vagy használati hiba.

A vizsgálat az ALAP-06 és MOZ-09–11 dashboard-, párhuzamosügy-, időpont- és késéskezelésére összpontosított. Megőrzendő alap a felhasználó által már érthetőnek talált Fő raktár → Saloon kiadás, szerepváltás és igazolás; a teljes felület elfogadását ez továbbra sem jelenti. A világos, zöld hangsúlyú Operate felülethez nem javasoltam új arculatot vagy további csiszolási kört.

## Ellenőrzött bizonyíték

Elolvastam az AGENTS.md, README.md, PRODUCT.md, demo/DESIGN.md, a működési terv és a követelményjegyzék érintett részeit, valamint a felület és az állapotmodell forrását. Egy képi körben megvizsgáltam mind a tíz friss `dashboard-*.png` felvételt: `normal`, `issue-warning`, `overdue`, `receiver` és `discrepancy`, egyenként 1024 px széles tablet- és 390 px széles mobilnézetben. A képek a javított önálló v5 HTML-ből készültek.

A külön böngészős ellenőrző [dashboard-preview.json](dashboard-preview.json) eredményét és a kapcsolódó próbaforrást is elolvastam. A teszteket ez a review nem futtatta újra. Az Impeccable parancsindító korábban nem volt elérhető; ez kézi forrás- és képernyőellenőrzés, külön Playwright-bizonyítékkal, nem sikeres automatikus Impeccable-detektor vagy teljes akadálymentességi audit.

## Eredmény

- Az ugyanarra a pultra küldött szállítmányok külön azonosítóval, útvonallal, tételekkel, időpontokkal és külön megnyitással látszanak. Az egyik igazolása meghagyja a többit; az új kiadás figyelmeztet a meglévő ügyekre, de nem tiltja az új szállítmányt.
- A piros késési jelzés a még igazolatlan ügyet emeli ki. A „Késik a visszaigazolás” és a várakozás/késés szövege színérzékelés nélkül is értelmezhető. A részleges igazolás elkülönül: nem marad piros átvevői feladat, a következő lépés és az eltérésrendező gomb a raktárfelelőst nevezi meg.
- A tablet kétoszlopos és a mobil egymás alá rendezett felülete olvasható, a szövegek és gombok nem ütköznek, az űrlap közvetlen mezőcímkéket és látható fókuszt használ. Az időfrissítés forrása nem építi újra az aktív űrlapot; a külön böngészőpróba a bevitt érték és fókusz megmaradását is igazolta.
- A külön próba ellenőrizte a 29:59/30:00 időhatárt, az egymástól független határidőket, a budapesti idő kijelzését, a szűrést, a hely szerinti nézetet és a készlethatás nélküli időléptetést. A modellhatár pontosan 30 perc; a képernyő legfeljebb 10 másodperces időközzel frissül.

## Egy javított érdemi észrevétel

A kezdeti forrásban a lezárt, azonos útvonalú átadások előzményeit nem lehetett bizonylatazonosítóhoz kötni vagy visszanyitni. Ez a több párhuzamos ügy visszakövethetőségét akadályozta. Az egyetlen javítási csomagban mindhárom átadási esemény megkapta a `moveId` kapcsolatot (`demo/model.mjs:288`, `:312`, `:329`), az előzmény pedig az ügy hivatkozását és részletekre vezető gombját (`demo/app.mjs:213`). A végső forrást ellenőriztem; a friss böngészőpróba ugyanazt a lezárt ügyet, mennyiségeit és három eseményidőpontját nyitotta vissza, újabb igazolási vezérlő nélkül. Az észrevétel lezárva; újabb képi kör nem szükséges.

A döntés nem igazol fizikai tabletes vagy képernyőolvasós használói próbát, végleges felületi elfogadást, valódi StoreHouse/r_keeper-kapcsolatot, személyes PIN-kezelést, tartós mentést vagy több eszköz közös auditját. A bemutató ezen határait a felület és a dokumentáció továbbra is jelzi.

Questions skipped: a kijelölt feladat lezáró ellenőrzés volt; a megmaradt termékdöntések nem akadályozzák a jelölt bemutató átadását.

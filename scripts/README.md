# StoreHouse-kapcsolat előkészítő ellenőrzése

A `storehouse_probe.py` Python-standardkönyvtárat használó parancssori segéd. Egyetlen, hitelesítés nélküli `GET /api/sh5info` kérést küld az **általad megadott** címre. Nem olvas készletet, nem hívja a `sh5exec` végpontot, nem ír bizonylatot és nem módosít adatot.

Ez még nem megvalósított StoreHouse-integráció. A helyszíni végpont, hozzáférés és verzió ismeretlen; **valódi ügyfélrendszeren nem volt tesztelve**.

Kapcsolódó követelmények: [NYIT-01, ALAP-05 és HATAR-12](../docs/kovetelmenyjegyzek.md). A segéd ezek feltárását támogatja; nem minősíti őket teljesítettnek, és nem helyettesíti a teljes vállalt raktári működést.

## A felhasznált szerződés állapota

A kiinduló forrás a [digitalizált dokumentum](../docs/forrasok/rkeeper-eredeti-atirat.md) PDF 21. oldala (nyomtatott 11. oldal), „Első, jelszó nélküli kapcsolati próba”. A leírás `/api/sh5info` végpontot és ezt a várható válaszmintát adja:

```json
{"errorCode": 0, "errMessage": "OK", "Version": "..."}
```

A mezőneveket, HTTP-metódust és hitelesítés nélküli működést **nem sikerült aktuális gyártói dokumentációval vagy a telepített rendszerrel megerősíteni**. A gyártói dokumentáció hálózati elérése az ellenőrzéskor blokkolva volt. A fenti minta ezért vizsgálandó kiindulás, nem bizonyított API-szerződés.

A régi dokumentum hitelesített POST-példáját a segéd szándékosan nem valósítja meg. Nincs felhasználónév/jelszó paraméter, környezeti változóból olvasott hitelesítés vagy automatikus hitelesítési kísérlet. Ha a telepítés hitelesítést kér, előbb a tényleges szerződést kell ellenőrizni.

## Használat

Python 3.10 vagy újabb szükséges; nincs telepítendő csomag. A tároló gyökeréből:

```sh
python3 scripts/storehouse_probe.py --help
```

A szolgáltatás valódi HTTP(S)-eredetét az üzemeltető adja meg. Nem feltételezünk gépnevet vagy portot. A cím csak protokollból, gépnévből és szükség esetén portból állhat; a segéd hozzáilleszti az `/api/sh5info` útvonalat. Ne adj meg benne jelszót, felhasználónevet, útvonalat, query-paramétert vagy fragmentet.

Az üzemeltető által ellenőrzött cím beállítása után:

```sh
python3 scripts/storehouse_probe.py --base-url "$STOREHOUSE_BASE_URL" --timeout 5
```

A `STOREHOUSE_BASE_URL` itt a parancs számára előre beállított, **nem titkos címváltozó**; a segéd nem tölti ki és nem találja ki az értékét. Ügyfélrendszer felé az ellenőrzött, engedélyezett hálózati útvonalat kell használni.

HTTPS esetén a rendszer tanúsítvány- és gépnévellenőrzése mindig aktív. Saját hitelesítésszolgáltatónál a megbízható PEM CA-fájl külön megadható:

```sh
python3 scripts/storehouse_probe.py --base-url "$STOREHOUSE_BASE_URL" --ca-file /path/to/trusted-ca.pem
```

Nincs `--insecure` kapcsoló. A HTTP lehetőség hitelesítés nélküli, engedélyezett belső hálózati és helyi tesztekhez használható; nem küld titkot. Minden átirányítás blokkolt, azonos gépre is. Reverse proxy alatti eltérő útvonalat ez az első segéd nem támogat; ilyen telepítésnél előbb a konkrét elérést kell tisztázni.

## Eredmény és korlátok

A kimenet egy JSON-objektum. A nyers választ, szerverhiba-szöveget, célcímet és ismeretlen mezők nevét/értékét nem naplózza. Csak ismert mezők típusát, HTTP-státuszt, korlátozott egész hibakódot és egyszerű numerikus verzióalakot ír ki. Ismeretlen válaszszerkezetnél megőrzi a típuskülönbséget és a további mezők számát, de nem talál ki verzióadatot.

| Állapot | Jelentés |
| --- | --- |
| `sample_shape_matched` | A HTTP 200 válasz érvényes JSON, és illeszkedik a dokumentum sikeres mintájához. Ez nem bizonyít készletolvasást, írási jogosultságot vagy éles alkalmasságot. |
| `application_error` | Egész, nem nulla `errorCode` érkezett. A nyers hibaüzenet elmarad. |
| `unrecognized_response` | JSON érkezett, de a vizsgált minta nem igazolható. A tényleges szerződés ellenőrzendő. |
| `invalid_json` | Például HTML bejelentkezőoldal, hibás JSON vagy ismételt JSON-kulcs érkezett. |
| `http_error`, `redirect_blocked`, `unexpected_http_status` | A HTTP-válasz nem fogadható el a vizsgált kérés eredményeként. |
| `timeout`, `connection_failed`, `tls_verification_failed`, `transport_error` | Hálózati vagy TLS-probléma; a kimenet nem állítja, hogy hiányzik a hozzáférés vagy új titok szükséges. |
| `response_too_large`, `unsupported_content_encoding` | A válasz túllépte a korlátot, vagy a kért tömörítetlen formátumtól eltért. |
| `configuration_error` | A cím, időkorlát, méretkorlát vagy CA-beállítás érvénytelen. |

A folyamat kilépési kódja mintára illeszkedésnél `0`, egyéb diagnosztikai eredménynél `1`, beállítási/parancssori hibánál `2`. A `production_readiness` mező mindig `not_established`.

Az alap válaszkorlát 64 KiB, legfeljebb 1 MiB állítható be a `--max-response-bytes` kapcsolóval. A várakozási korlát alapból 5, megengedetten 0,1–30 másodperc; a CLI lassú DNS/válasz esetén is visszatér. Nincs automatikus újrapróbálkozás. A hálózati kérés háttérszála a CLI kilépésekor véget ér; ez a parancssori segéd nem tartós szolgáltatásba szánt klienskönyvtár.

## Helyi ellenőrzés

A tároló gyökeréből:

```sh
python3 -m unittest discover -s tests -p 'test_storehouse_probe.py' -v
```

A tesztek kizárólag helyben indított HTTP-kiszolgálóval dolgoznak. Ellenőrzik az egyetlen GET-kérést és pontos útvonalat, a hitelesítés hiányát, az átirányítások tiltását, HTTP- és alkalmazáshibát, hibás/ismeretlen JSON-t, a válaszméretet, az időkorlátot és a naplózható adatok szűrését. Ezek nem gyártói megfelelőségi vagy élő integrációs tesztek. A saját CA beállítása és a TLS-ellenőrzési alapbeállítás egységteszttel ellenőrzött; valódi ügyféltanúsítvány és HTTPS-kapcsolat még nincs tesztelve.

# A raktárkezelő elindítása a saját Windows-gépeden

A Windows-csomag a valódi helyi kiszolgálót és adatbázist használja. A böngésző a `http://127.0.0.1:4174` címen kapcsolódik hozzá. Ez továbbra is tesztüzem: a StoreHouse és az r_keeper még nincs összekötve vele.

1. A letöltött ZIP-en válaszd az **Összes kibontása** műveletet. Tedd a mappát olyan helyre, ahol később is meg akarod tartani.
2. A kibontott `Raktar` mappában kattints duplán az **Inditas.cmd** fájlra. Ne a ZIP-en belül indítsd el.
3. Az indítóablak nyitva marad, és megnyílik a böngésző. Belépés: **Teszt raktárfelelős**, PIN: **1234**. Ha a böngésző nem nyílik meg automatikusan, az indítóban megjelenő címet nyisd meg.

A csomag tartalmazza a Node.js futtatókörnyezetet Intel/AMD és ARM64 Windows-gépekhez. Az indító választ közülük. Nem telepít globális programot, nem módosít tűzfalszabályt, és nem igényel letöltést az első indításhoz. Modern, 64 bites Windows szükséges; a 32 bites Windows nem támogatott.

## Mi marad meg?

A kiszolgáló a csomag `.local/warehouse-test.sqlite` fájljába menti a próbaműveleteket. Ugyanebből a kibontott mappából indítva az előzmények megmaradnak a böngésző újratöltése és a kiszolgáló újraindítása után is. A mappát és az adatbázist ezért őrizd meg. Frissítéskor ne töröld vagy írd felül a `.local` mappát.

Az önálló HTML-előnézetben végzett korábbi műveletek nem kerülnek át automatikusan. A Windows-csomag első indítása saját, kitalált tesztkészlettel kezdődik, a PDF termékeivel.

## Leállítás és újraindítás

A kiszolgálót az indítóablakban jelzett módon, Enterrel vagy Ctrl+C-vel állítsd le. A böngészőfül bezárása önmagában nem állítja le. Következő alkalommal ugyanazt az **Inditas.cmd** fájlt indítsd el.

Ha a 4174-es címen már fut valami, az indító jelez és megáll; nem állít le más programot. Ha a raktárkezelő egy korábbi indítóablaka még fut, annak böngészőjét használd, vagy előbb ott állítsd le.

Ez a beállítás a saját gépedről érhető el. Több fizikai tablet csatlakoztatása későbbi, külön hálózati beállítást igényel.

## Ellenőrzési határ

A csomag hivatalos Node.js-kiadásból származó hordozható futtatókörnyezeteket tartalmaz; az eredeti archívumok SHA-256 ellenőrzése a csomagolás része. A forrás és ellenőrzőösszegek a `runtime/PROVENANCE.json` és `runtime/SHASUMS256.txt` fájlban találhatók, a licencek a futtatókörnyezet mellett.

A felhős fejlesztői munkamenet nem tud a felhasználó Windows-gépén parancsot futtatni. A helyi kiszolgáló kódja és az indítási ellenőrzések tesztelhetők a fejlesztői környezetben; a Windows dupla kattintás és a felhasználó alapértelmezett böngészőjének tényleges megnyitása csak a saját gépen igazolható.

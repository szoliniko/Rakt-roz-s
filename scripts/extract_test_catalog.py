#!/usr/bin/env python3
"""Rebuild the reviewed TEST catalog from the preserved OCR and explicit image checks.

Never imports quantities, prices, handwritten replacements or guesses package
conversions. Source codes are printed labels, not verified StoreHouse API IDs.
The review corrections below were checked against the original scanned pages.
"""
from pathlib import Path
import argparse
import json
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'Nem az összes de Storehouse tételek ha jól értem.pdf'
SOURCE_HASH = '20e4e23bbe1dfa17ae59e8a7d15f04e2f2bf0ddfed4ef54a91b68505ebf8d48a'
REVIEWED_PAGES = {1, 2, 3, 4, 5, 7, 9, 11, 12, 13, 14, 27, 28, 29, 30, 31, 37, 38, 39, 41, 42}
UNITS = {'liter':'l','líter':'l','darab':'db','kg':'kg','ka':'kg','adag':'adag','zacskó':'zacskó'}
# Text corrections only: each value follows the printed identity, including
# unusual printed spelling (e.g. Wouchester, Teneesee, Mikorszálas).
NAME_FIXES = {
 '284':'Dió','1499':'Köles','1687':'eper','529':'Sch narancs 0,33',
 '1307':'Bujdosó fehérbor 1,5','1443':'BB édes','543':'Prosecco 0,5','1301':'ATM csokipor','1302':'ATM tejpor',
 '608':'Gyümölcs tea','320':'Kávécukor, barna','1942':'Barack pálinka','1445':'Chivas Regal','1705':'J.Walker red 1l 40%',
 '1933':'Panyolai barack','600':'Szicsek ószilva','597':'Szicsek szilva kocka','585':'Tequila','1719':'0 % dobozos sör',
 '562':'Heineken 0,33 0%','563':'Heineken 0,33 5%','561':'Heineken 0,5 0%','560':'Heineken 0,5 5%',
 '570':'Soproni 0,5','517':'7up 0,25','528':'7up 0,33','533':'7up 0,5','1690':'Almalé 0,2',
 '524':'Mentesvíz 0,33','1689':'Őszibaracklé 0,2','522':'Pepsimax 0,25','532':'Pepsimax 0,5','539':'Megy-alma 0,5',
 '535':'Sch narancs 0,5','536':'Sch tonik 0,5','1503':'Glutén mentes brauni','136':'Mirelit fűszer',
 '118':'Paprikacsík','167':'Pita tészta','170':'Tortilla lap','638':'Teljeskiőrlésű kenyér','371':'Cheddar sajt tömb',
 '355':'Cheddar sajtszósz','389':'Minivaj','378':'UHT tej','413':'Bébispenót','434':'Fürj tojás','1684':'Gránátalma',
 '393':'Leves zöldség(karalábé, zeller,kelkáposzta,fehérrépa)','1283':'Rukkola','397':'Vöröskáposzta | Lilakáposzta',
 '422':'Szőlő','48':'Pulyka comb','614':'Sertésszűz','259':'Aszaltszilva','1882':'Barnamártás por',
 '286':'Burgonyapüré pehely','1832':'Búzasikér liszt','346':'Citromlé 1/1','299':'Dijoni mustár','343':'Ecet 20%',
 '334':'Lekvár, mini','336':'nutella 15 g','315':'Nutella 700g','263':'Sütőpor','270':'Szeletelt mandula kg',
 '333':'Torma ecetes 190 g','239':'Zabehely','1879':'Zöldborsó fasírtpor','647':'BBQ fűszersó',
 '1316':'Evita fűszersó','218':'Görög fűsz kev.','215':'Grill fűszersó','214':'Grill halak fűszersó',
 '649':'Grill zöldség fűszersó','219':'Gyros fűszersó','182':'Kömény egész','1643':'Pác só',
 '173':'Paprika őrölt erős','1642':'Sonka pác','1779':'Szárnyas fűszersó','1781':'Ablaktisztító 4,5 l',
 '1655':'Eldobható pohár (3dl)','1656':'Eldobható pohár (5dl)','1870':'Eldobható pohár 2,5 dl',
 '1698':'Elviteles tál (1 liter)','1651':'Elviteles tál (375ml)','1699':'Elviteles tál fedél (1liter)',
 '1796':'Fertőtlenítő lemosó 5 l','1865':'Folyékony szappan 5l','1866':'Gépi öblítőszer 5l',
 '482':'Ipari kéztörlő','662':'Kukazsák 120l','1785':'Kukazsák 135 l.','442':'Kukazsák 160l','661':'Kukazsák 240l',
 '443':'Kukazsák 35l','444':'Kukazsák 60 l','1775':'Mosogatószer 5 liter','1868':'Mosópor 1kg',
 '1693':'Mr Proper 5l','1795':'Öblítő 5 l','1650':'Öntetes tál (80ml)','1799':'Vanish Oxi Max 1,5 l',
 '462':'Vasalóvíz','475':'WC kefe','1869':'WC papír darabos','1797':'Zsíroldó 20 l','1798':'Zsíroldó 5 l','1652':'Zsírpaprír',
 '1270':'Coleslaw','1269':'Tépett hús','1550':'Sertés oldalas','1835':'Szejtán','2010':'sertés dagadó',
 '1983':'Csirke szárny','43':'Kacsamell','51':'Libamáj',
}
# Rows missed by OCR are explicitly transcribed from images. page|code|name|unit.
ADDITIONS = '''
2|598|Szicsek törköly|l
2|1304|Heinekken hordó|l
3|492|Málna szörp|l
3|494|Narancs szörp|l
4|512|Szénsavas víz|l
5|1694|Gyalult tök|kg
9|373|Camembert sajt|kg
9|363|Sajtkrém|kg
11|419|Alma|kg
11|1715|Ananász|kg
11|416|Citrom|kg
11|1596|Fejessaláta|db
11|1682|Kanadai tök|kg
11|1713|Őszibarack|kg
12|400|Újhagyma|kg
13|98|Bacon|kg
13|77|Csülök|kg
13|1857|Disznó sajt|kg
13|71|Házi sonka|kg
13|68|Karaj|kg
13|88|Marha comb darált|kg
13|618|Marha oldalas|kg
13|1711|Sertés darált hús|kg
13|80|Sertés velő|kg
13|1983|Csirke szárny|kg
13|629|Hal|kg
27|1695|Agavé szirup|kg
27|1794|Árpagyöngy|kg
27|276|Balszamecet krém|kg
27|281|BBQ szósz|kg
27|342|Ecet 10%|l
27|1716|Ecetes almapaprika|kg
27|352|Édes-savanyú csípős szósz|l
28|337|Folyékony édesítőszer|l
28|1717|Gabonagolyó|kg
28|1276|Házi baracklekvár|kg
28|348|Hollandimártás|l
28|1884|Kakaópor|kg
28|282|Kókusz reszelék|kg
28|255|Kristálycukor|kg
28|240|Kukoricaliszt|kg
28|1720|Lecsó üveges|l
28|1792|Lencse|kg
28|234|Liszt|kg
28|1850|Mazsola|kg
28|298|Mustár|kg
29|278|Pesto szósz|kg
29|258|Vanilliás cukor|kg
29|1317|Arab fűszersó|kg
30|176|Bors keverék őrölt|kg
30|1771|Kínai fűszerkeverék|kg
30|644|Kolbászkeverék édes|kg
30|207|Koriander levél|kg
30|186|Majoranna|kg
31|178|Mini bors 0,35|kg
31|184|Római kömény|kg
31|217|Sült csirke fűszersó|kg
31|1315|Zöldségleves kivonat|kg
38|1572|Hajtogatott kéztörlő|db
38|1784|Hajtogatott toalettpapír|db
39|445|WC papír 32db|db
41|1830|Aszaltparadicsom krém|adag
41|1134|Zöldségmix|kg
41|2009|sertés bél|kg
42|2012|kacsacomb|kg
'''
NOTES = {
 '90':'A 41. oldalon a nyomtatott Kg mellett kézzel db szerepel. Tesztben a nyomtatott egységet őrizzük; éles használat előtt ellenőrizendő.',
 '118':'A 43. oldalon a nyomtatott Paprikacsík nevet kézzel Hagymakarikára javították. Nem neveztük át; az éles termékazonosítás ellenőrizendő.',
 '2012':'A 42. oldalon a nyomtatott Kg mellett kézzel db szerepel. A teszt a nyomtatott egységet használja; átváltás nincs feltételezve.',
 '122':'A 42. oldalon a nyomtatott Karfiol mellé kézzel Rántott került. A teszt a nyomtatott nevet használja; külön termék/recept nem lett kitalálva.',
}


def category(page, code):
    if page in [1,2,3,4,15,16,17,18,19,20,21,22,23,24,25,26,33,34,35,36]: return 'Ital'
    if page == 5: return 'Mirelit'
    if page == 7: return 'Pékáru'
    if page == 9: return 'Tejtermék'
    if page in [11,12]: return 'Zöldség, gyümölcs'
    if page in [13,14]: return 'Hús / Szárnyasok, halak' if code in {'1917','40','1983','1883','33','30','63','629','43','1876','49','51','48','1853','623','2011','2012'} else 'Hús'
    if page in [27,28]: return 'Szárazáru'
    if page==29: return 'Fűszerek' if code in {'1780','1317','185'} else 'Szárazáru'
    if page==30: return 'Fűszerek'
    if page==31: return 'Tészták' if code in {'1801','224'} else 'Fűszerek'
    if page in [37,38,39,40]: return 'Tisztító szerek'
    if page==41: return 'Félkész' if code in {'1830','1436','1270','1286','1839','1268','1554','1253','1120','1271','1836','1265','1264','1267','1550','1495','1266','1551','1835','1130','1553','1829','1269','1285','1837','1134'} else 'Hús'
    if page==42: return 'Hús / Szárnyasok, halak' if code in {'2011','2012'} else 'Hús'
    return 'Ellenőrizendő'


def cleaned_name(name):
    name=re.sub(r'\s+',' ',name).strip(' ,!|;.:[]"/—')
    name=re.sub(r'^(?:I|j)\s+','',name)
    while re.search(r'\s+(?:i|ii|il|I|LL|MA|MY|mi|MI|KN|AN|B|H|s|e|TT|NI|NN|Hi)$',name):
        name=name.rsplit(' ',1)[0].rstrip(' ,!|;.:[]"/—')
    return name


def correct_code(page,code,name):
    if code=='7' and name.startswith('320 '): return '320'
    if code in {'835','6535'} and 'Sch narancs' in name: return '535'
    if code=='1938' and 'Ház' in name: return '1939'
    if code=='618' and 'narancs' in name.lower(): return '518'
    if code=='623' and 'Szénsavas' in name: return '523'
    if code=='69' and 'hátszín' in name: return '89'
    if code=='4277' and 'Sriracha' in name: return '1277'
    if code=='488' and 'Oregano' in name: return '188'
    return code


def build():
    text=(ROOT/'docs/forrasok/storehouse-tetelek-ocr.md').read_text()
    pages={int(p):t for p,t in re.findall(r'## PDF (\d+)\. oldal\n(.*?)(?=\n## PDF |\Z)',text,re.S)}
    candidates=[]
    for page,txt in pages.items():
        for line in txt.splitlines():
            m=re.search(r'^\W*(\d{1,4})\s*[!|;:.\-]*\s+(.+?)\s+["\[!|\s]*(liter|líter|darab|kg|ka|adag|zacskó)\b',line,re.I)
            if not m: continue
            code=correct_code(page,m[1],m[2]);name=cleaned_name(m[2]);unit=UNITS[m[3].lower()]
            if code=='1698':unit='db'
            candidates.append(dict(code=code,name=name,unit=unit,page=page))
    chosen={}
    for row in candidates:
        if row['page'] not in REVIEWED_PAGES: continue
        code=row['code']
        if code not in chosen:
            chosen[code]={**row,'name':NAME_FIXES.get(code,row['name'])}
    for line in ADDITIONS.strip().splitlines():
        page,code,name,unit=line.split('|')
        chosen[code]=dict(code=code,name=name,unit=unit,page=int(page))
    products=[]
    for code,row in sorted(chosen.items(),key=lambda pair:int(pair[0])):
        appearances=sorted({r['page'] for r in candidates if r['code']==code}|{row['page']})
        note=NOTES.get(code)
        provenance={'source':SOURCE,'sha256':SOURCE_HASH,'pages':appearances,'verifiedPage':row['page'],'verified':True,
                    'verification':'Printed code/name/unit checked against the scanned page; current StoreHouse mapping not verified.'}
        if note:provenance['note']=note
        products.append(dict(id=f'source-{code}',sourceCode=code,name=row['name'],category=category(row['page'],code),baseUnit=row['unit'],countInShift=category(row['page'],code)=='Ital',units={row['unit']:1},discrete=row['unit'] in {'db','zacskó'},externalId=None,needsReview=bool(note),provenance=provenance))
    review=[]
    for code in sorted({r['code'] for r in candidates}-set(chosen),key=int):
        rows=[r for r in candidates if r['code']==code]
        review.append({'sourceCodeCandidate':code,'nameCandidate':rows[0]['name'],'pages':sorted({r['page'] for r in rows}), 'reason':'Csak OCR-jelölt; nyomtatott azonossága még nem ellenőrzött. Nem választható termék.'})
    for name in ['Soproni 0% dobozos','Leffe','Erdinger','barista zabtej']:
        review.append({'sourceCodeCandidate':None,'nameCandidate':name,'pages':[4],'reason':'Kézzel hozzáírt név, ellenőrzött nyomtatott kód/egység nélkül. Nem hoztunk létre belőle terméket.'})
    assert len(products)==len({p['sourceCode'] for p in products})
    assert all(p['name'] and p['units']=={p['baseUnit']:1} and p['externalId'] is None for p in products)
    payload={'source':SOURCE,'sourceSha256':SOURCE_HASH,'kind':'reviewed-printed-test-catalog','products':products,'reviewRows':review}
    (ROOT/'data').mkdir(exist_ok=True)
    (ROOT/'data/test-catalog.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'data/test-catalog.mjs').write_text('// Generated by scripts/extract_test_catalog.py. Printed TEST identities only; no current stock, API IDs or guessed package conversions.\n'
        +'export const SOURCE_PRODUCTS = '+json.dumps(products,ensure_ascii=False,indent=2)+';\n'
        +'export const CATALOG_REVIEW_ROWS = '+json.dumps(review,ensure_ascii=False,indent=2)+';\n')
    print(json.dumps({'selectableProducts':len(products),'quarantinedRows':len(review),'unreviewedCodeCandidates':review[:-4]},ensure_ascii=False,indent=2))

if __name__=='__main__':build()

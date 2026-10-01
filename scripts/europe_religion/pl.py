"""Poland: religious affiliation by NUTS 3 subregion, National Census (NSP) 2021.

Source: Statistics Poland (GUS), NSP 2021 final results,
"Przynależność wyznaniowa - dane NSP 2021 dla kraju i jednostek podziału
terytorialnego.xlsx" (published 2024-04-29), sheet TABL.4 "Ludność powiatów
według grup wyznań w 2021 roku" (population of the 380 powiats by religious
group). Powiats are aggregated to NUTS 2021 NUTS 3 subregions with the
correspondence below, derived from Eurostat's "EU-27-LAU-2022-NUTS-2021.xlsx"
(gmina LAU code chars [4:6] = voivodeship TERYT, [9:11] = powiat TERYT); every
powiat lies wholly inside one subregion.

The xlsx is parsed with the standard library only (zipfile + xml.etree).
"""
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

SOURCE = "Statistics Poland (GUS), National Census (NSP) 2021"
YEAR = 2021
URL = ("https://stat.gov.pl/download/gfx/portalinformacyjny/pl/defaultaktualnosci/"
       "6536/10/1/1/przynaleznosc_wyznaniowa_-_dane_nsp_2021_dla_kraju_i_jednostek_"
       "podzialu_terytorialnego_1.xlsx")

# NUTS3 -> powiat TERYT codes (4 digits)
NUTS_POWIATS = {
    "PL213": "1261",
    "PL214": "1201 1206 1208 1209 1214 1219",
    "PL217": "1202 1204 1216 1263",
    "PL218": "1205 1207 1210 1262",
    "PL219": "1211 1215 1217",
    "PL21A": "1203 1212 1213 1218",
    "PL224": "2404 2406 2409 2464",
    "PL225": "2402 2403 2417 2461",
    "PL227": "2411 2412 2415 2467 2473 2479",
    "PL228": "2407 2413 2462 2471",
    "PL229": "2405 2466 2478",
    "PL22A": "2463 2469 2470 2472 2474 2476",
    "PL22B": "2401 2416 2465 2468 2475",
    "PL22C": "2408 2410 2414 2477",
    "PL411": "3001 3002 3019 3028 3031",
    "PL414": "3003 3009 3010 3023 3027 3030 3062",
    "PL415": "3064",
    "PL416": "3006 3007 3008 3012 3017 3018 3020 3061",
    "PL417": "3004 3005 3011 3013 3014 3015 3022 3029 3063",
    "PL418": "3016 3021 3024 3025 3026",
    "PL424": "3262",
    "PL426": "3201 3208 3209 3213 3261",
    "PL427": "3202 3203 3210 3212 3215 3216 3217 3218",
    "PL428": "3204 3205 3206 3207 3211 3214 3263",
    "PL431": "0801 0803 0805 0806 0807 0861",
    "PL432": "0802 0804 0808 0809 0810 0811 0812 0862",
    "PL514": "0264",
    "PL515": "0201 0205 0206 0207 0210 0212 0225 0226 0261",
    "PL516": "0203 0204 0209 0211 0216 0262",
    "PL517": "0202 0208 0219 0221 0224 0265",
    "PL518": "0213 0214 0215 0217 0218 0220 0222 0223",
    "PL523": "1601 1602 1606 1607 1610",
    "PL524": "1603 1604 1605 1608 1609 1611 1661",
    "PL613": "0403 0415 0461 0463",
    "PL616": "0402 0404 0405 0406 0412 0417 0462",
    "PL617": "0407 0409 0410 0419",
    "PL618": "0413 0414 0416",
    "PL619": "0401 0408 0411 0418 0464",
    "PL621": "2802 2803 2804 2807 2812 2815 2861",
    "PL622": "2801 2808 2809 2810 2811 2814 2817 2862",
    "PL623": "2805 2806 2813 2816 2818 2819",
    "PL633": "2261 2262 2264",
    "PL634": "2204 2205 2210 2211 2215",
    "PL636": "2201 2208 2212 2263",
    "PL637": "2202 2203 2206",
    "PL638": "2207 2209 2213 2214 2216",
    "PL711": "1061",
    "PL712": "1006 1008 1020 1021",
    "PL713": "1001 1007 1010 1012 1016 1062",
    "PL714": "1003 1009 1011 1014 1017 1018 1019",
    "PL715": "1002 1004 1005 1013 1015 1063",
    "PL721": "2604 2605 2607 2610 2611 2661",
    "PL722": "2601 2602 2603 2606 2608 2609 2612 2613",
    "PL811": "0601 0613 0615 0619 0661",
    "PL812": "0602 0603 0604 0606 0618 0620 0662 0664",
    "PL814": "0608 0609 0610 0617 0663",
    "PL815": "0605 0607 0611 0612 0614 0616",
    "PL821": "1801 1802 1805 1807 1817 1821 1861",
    "PL822": "1804 1809 1813 1814 1862",
    "PL823": "1806 1810 1815 1816 1819 1863",
    "PL824": "1803 1808 1811 1812 1818 1820 1864",
    "PL841": "2002 2011 2061",
    "PL842": "2003 2005 2006 2007 2010 2013 2014 2062",
    "PL843": "2001 2004 2008 2009 2012 2063",
    "PL911": "1465",
    "PL912": "1408 1412 1417 1434",
    "PL913": "1405 1414 1418 1421 1432",
    "PL921": "1401 1407 1409 1423 1425 1430 1436 1463",
    "PL922": "1402 1413 1420 1424 1437",
    "PL923": "1404 1419 1427 1462",
    "PL924": "1411 1415 1416 1422 1435 1461",
    "PL925": "1403 1410 1426 1429 1433 1464",
    "PL926": "1406 1428 1438",
}
POWIAT_NUTS = {p: n for n, ps in NUTS_POWIATS.items() for p in ps.split()}

_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def _col(ref: str) -> int:
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group():
        n = n * 26 + ord(ch) - 64
    return n - 1


def _sheet_rows(path: Path, name: str):
    z = zipfile.ZipFile(path)
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target")
            for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    target = None
    for s in wb.find(_NS + "sheets"):
        if s.get("name") == name:
            target = rels[s.get(_RNS)].lstrip("/")
            target = target if target.startswith("xl/") else "xl/" + target
    if target is None:
        raise KeyError(f"sheet {name} not found")
    ss = ["".join(t.text or "" for t in si.iter(_NS + "t"))
          for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(_NS + "si")]
    for _, el in ET.iterparse(z.open(target)):
        if el.tag == _NS + "row":
            row = {}
            for c in el.findall(_NS + "c"):
                v = c.find(_NS + "v")
                if v is None:
                    continue
                row[_col(c.get("r"))] = ss[int(v.text)] if c.get("t") == "s" else v.text
            if row:
                yield [row.get(i, "") for i in range(max(row) + 1)]
            el.clear()


def _download(cache: Path) -> Path:
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / "pl_wyznania_nsp2021.xlsx"
    if not f.exists() or f.stat().st_size < 1_000_000:
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=300) as r:
            f.write_bytes(r.read())
    return f


# label (first non-empty text in the indented label columns) -> key
LABELS = {
    "Ogółem": "total",
    "należący do wyznania": "members",
    "chrześcijaństwo": "christian",
    "Kościół katolicki": "catholic",            # Latin + Greek + Armenian rite
    "starokatolicyzm": "oldCatholic",           # Old Catholic / Mariavite churches
    "chrześcijaństwo wschodnie (ortodoksyjne)": "orthodox",  # incl. Oriental churches
    "protestantyzm i tradycja protestancka": "protestant",
    "nurt badaczy Pisma Świętego": "bibleStudents",  # Jehovah's Witnesses etc.
    "inne chrześcijańskie": "otherChr",
    "islam": "muslim",
    "judaizm": "jewish",
    "nienależący do żadnego wyznania": "none",
    "Odmawiający odpowiedzi na pytanie o wyznanie": "refused",
    "Nie ustalono": "unknown",
}


def load(cache: Path) -> dict[str, dict[str, int]]:
    f = _download(Path(cache))
    raw: dict[str, dict[str, int]] = {}
    for r in list(_sheet_rows(f, "TABL.4"))[3:]:
        if len(r) < 11 or not re.fullmatch(r"\d{4}", r[3].strip()):
            continue
        label = next((x.strip() for x in r[5:10] if x.strip()), "")
        label = label.split("\n")[0].strip()
        key = LABELS.get(label)
        if key is None:
            continue
        nuts = POWIAT_NUTS[r[3].strip()]
        d = raw.setdefault(nuts, {})
        d[key] = d.get(key, 0) + int(float(r[10] or 0))
    out = {}
    for nuts, d in raw.items():
        g = lambda k: d.get(k, 0)
        listed_chr = g("catholic") + g("oldCatholic") + g("orthodox") + g("protestant") \
            + g("bibleStudents") + g("otherChr")
        res = {
            "catholic": g("catholic"),
            "protestant": g("protestant"),
            "orthodox": g("orthodox"),
            # Old Catholic + Bible Students (JW) + other Christian; the remainder of
            # "chrześcijaństwo" not shown in sub-rows (normally 0) also goes here
            "otherChristian": g("christian") - listed_chr + g("oldCatholic")
            + g("bibleStudents") + g("otherChr"),
            "muslim": g("muslim"),
            "jewish": g("jewish"),
            # Buddhism, Hinduism, paganism, other religions = members - Christian - Islam - Judaism
            "other": g("members") - g("christian") - g("muslim") - g("jewish"),
            "none": g("none"),
            "notStated": g("refused") + g("unknown"),
            "total": g("total"),
        }
        out[nuts] = {k: v for k, v in res.items() if v}
    return out


if __name__ == "__main__":
    import json, sys
    print(json.dumps(load(Path(sys.argv[1] if len(sys.argv) > 1 else ".")), indent=1))

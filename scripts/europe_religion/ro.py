"""Romania: resident population by religion, by county (judet = NUTS3), Census 2021.

Source: INS, Recensamantul Populatiei si Locuintelor 2021, final results,
Tabel 2.04.1 "Populatia rezidenta dupa religie, pe macroregiuni, regiuni de
dezvoltare si judete, la 1 decembrie 2021".
'*' cells are confidential small values (suppressed) -> treated as 0.
"""
import re
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

SOURCE = "INS Romania, Population and Housing Census 2021 (Tabel 2.04.1)"
YEAR = 2021
URL = "https://www.recensamantromania.ro/wp-content/uploads/2023/06/Tabel-2.04.1-si-Tabel-2.04.2.xlsx"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

NUTS = {
    "BIHOR": "RO111", "BISTRITA-NASAUD": "RO112", "CLUJ": "RO113", "MARAMURES": "RO114",
    "SATU MARE": "RO115", "SALAJ": "RO116", "ALBA": "RO121", "BRASOV": "RO122",
    "COVASNA": "RO123", "HARGHITA": "RO124", "MURES": "RO125", "SIBIU": "RO126",
    "BACAU": "RO211", "BOTOSANI": "RO212", "IASI": "RO213", "NEAMT": "RO214",
    "SUCEAVA": "RO215", "VASLUI": "RO216", "BRAILA": "RO221", "BUZAU": "RO222",
    "CONSTANTA": "RO223", "GALATI": "RO224", "TULCEA": "RO225", "VRANCEA": "RO226",
    "ARGES": "RO311", "CALARASI": "RO312", "DAMBOVITA": "RO313", "GIURGIU": "RO314",
    "IALOMITA": "RO315", "PRAHOVA": "RO316", "TELEORMAN": "RO317",
    "MUNICIPIUL BUCURESTI": "RO321", "ILFOV": "RO322", "DOLJ": "RO411", "GORJ": "RO412",
    "MEHEDINTI": "RO413", "OLT": "RO414", "VALCEA": "RO415", "ARAD": "RO421",
    "CARAS-SEVERIN": "RO422", "HUNEDOARA": "RO423", "TIMIS": "RO424",
}

# column header prefix (accent-stripped, lowercased) -> group
GROUPS = [
    ("ortodoxa sarba", "orthodox"),
    ("ortodoxa", "orthodox"),
    ("romano-catolica", "catholic"),
    ("greco-catolica", "catholic"),
    ("reformata", "protestant"),
    ("penticostala", "protestant"),
    ("baptista", "protestant"),
    ("adventista", "protestant"),
    ("unitariana", "protestant"),  # Hungarian Unitarian Church (Reformation-era church)
    ("crestina dupa evanghelie", "protestant"),  # Christian Brethren
    ("evanghelica", "protestant"),  # Lutheran, Augsburg Confession, Romanian Evangelical
    ("crestina de rit vechi", "orthodox"),  # Old Believers (Lipovans)
    ("armeana", "orthodox"),  # Armenian Apostolic (Oriental Orthodox)
    ("musulmana", "muslim"),
    ("martorii lui iehova", "otherChristian"),
    ("mozaica", "jewish"),
    ("alta religie", "other"),
    ("fara religie", "none"),
    ("ateu", "none"),
    ("agnostic", "none"),
    ("informatie nedisponibila", "notStated"),
]

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def _norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    return " ".join("".join(c for c in s if not unicodedata.combining(c)).split()).strip()


def _read_xlsx(path, sheet_index=0):
    z = zipfile.ZipFile(path)
    ss = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(NS + "si"):
            ss.append("".join(t.text or "" for t in si.iter(NS + "t")))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rmap = {r.get("Id"): r.get("Target") for r in rels}
    sh = list(wb.find(NS + "sheets"))[sheet_index]
    tgt = rmap[sh.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")].lstrip("/")
    if not tgt.startswith("xl/"):
        tgt = "xl/" + tgt
    rows = []
    for row in ET.fromstring(z.read(tgt)).iter(NS + "row"):
        out = {}
        for c in row.iter(NS + "c"):
            col = re.match(r"[A-Z]+", c.get("r")).group()
            ci = 0
            for ch in col:
                ci = ci * 26 + ord(ch) - 64
            v = c.find(NS + "v")
            t = c.get("t")
            if t == "s" and v is not None:
                val = ss[int(v.text)]
            elif t == "inlineStr":
                val = "".join(x.text or "" for x in c.iter(NS + "t"))
            else:
                val = v.text if v is not None else None
            out[ci - 1] = val
        rows.append([out.get(i) for i in range(max(out) + 1)] if out else [])
    return rows


def _num(v):
    v = (v or "").strip()
    if v in ("", "-", "*"):
        return 0
    return int(float(v))


def load(cache: Path) -> dict:
    cache = Path(cache)
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / "ro_tabel_2.04.xlsx"
    if not f.exists():
        req = urllib.request.Request(URL, headers={"User-Agent": UA})
        f.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    rows = _read_xlsx(f, 0)
    # locate header row with religion names
    hdr_i = next(i for i, r in enumerate(rows) if any(_norm(c).lower().startswith("ortodoxa") for c in r if c))
    hdr = rows[hdr_i]
    colmap = {}
    for ci, h in enumerate(hdr):
        if not h or ci < 2:
            continue
        hn = _norm(h).lower()
        for pref, g in GROUPS:
            if hn.startswith(pref):
                colmap[ci] = g
                break
        else:
            raise ValueError(f"unmapped column: {h!r}")
    out = {}
    for r in rows[hdr_i + 1:]:
        if not r or not r[0]:
            continue
        name = _norm(r[0]).upper()
        code = NUTS.get(name)
        if not code:
            continue
        d = {"total": _num(r[1])}
        for ci, g in colmap.items():
            d[g] = d.get(g, 0) + _num(r[ci] if ci < len(r) else None)
        out[code] = {k: v for k, v in d.items() if v or k == "total"}
    missing = set(NUTS.values()) - set(out)
    if missing:
        raise ValueError(f"missing counties: {sorted(missing)}")
    return out

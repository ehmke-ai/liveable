"""Bulgaria: population by religion (veroizpovedanie), by district (oblast = NUTS3), Census 2021.

Source: NSI Bulgaria, Census 2021 results, "Census2021_Ethnocultural
characteristics_BG.xlsx", sheet 4 "Naselenie po veroizpovedanie, statisticheski
rayoni, oblasti i obshtini kam 7.09.2021".

Caveats:
- The religion question was voluntary. "Nepokazano" (not shown, 616,681
  nationally) = persons with no answer to the ethno-cultural block at all;
  together with "Ne zhelaya da otgovorya" (don't want to answer) and
  "Ne moga da opredelya" (cannot determine) they go to notStated.
- The district table only has "Christian" undivided. Nationally 97.0% of
  Christians are Eastern Orthodox, 1.7% Protestant, 0.9% Catholic, 0.1%
  Armenian Apostolic, 0.3% other Christian; the district split is not
  published in a machine-readable table, so all Christians are counted as
  "orthodox" here (CHRISTIAN_GROUP).
"""
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

SOURCE = "NSI Bulgaria, Census 2021 (Population by religion, districts)"
YEAR = 2021
URL = "https://www.nsi.bg/file/download/d6bebedae9d8dc7824e050bfc47124b402d9129b"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

CHRISTIAN_GROUP = "orthodox"

# NSI 3-letter district code -> NUTS 2021
NUTS = {
    "VID": "BG311", "MON": "BG312", "VRC": "BG313", "PVN": "BG314", "LOV": "BG315",
    "VTR": "BG321", "GAB": "BG322", "RSE": "BG323", "RAZ": "BG324", "SLS": "BG325",
    "VAR": "BG331", "DOB": "BG332", "SHU": "BG333", "TGV": "BG334",
    "BGS": "BG341", "SLV": "BG342", "JAM": "BG343", "SZR": "BG344",
    "SOF": "BG411", "SFO": "BG412", "BLG": "BG413", "PER": "BG414", "KNL": "BG415",
    "PDV": "BG421", "HKV": "BG422", "PAZ": "BG423", "SML": "BG424", "KRZ": "BG425",
}

COLS = {
    "Християнско": CHRISTIAN_GROUP,
    "Мюсюлманско": "muslim",
    "Юдейско": "jewish",
    "Друго": "other",
    "Нямам": "none",
    "Не мога да определя": "notStated",
    "Не желая да отговоря": "notStated",
    "Непоказано": "notStated",
}

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def _read_xlsx(path, sheet_name):
    z = zipfile.ZipFile(path)
    ss = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(NS + "si"):
            ss.append("".join(t.text or "" for t in si.iter(NS + "t")))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rmap = {r.get("Id"): r.get("Target") for r in rels}
    sh = next(s for s in wb.find(NS + "sheets") if s.get("name") == sheet_name)
    tgt = rmap[sh.get(RNS)].lstrip("/")
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
    if v in ("", "-", "*", ".."):
        return 0
    return int(float(v))


def load(cache: Path) -> dict:
    cache = Path(cache)
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / "bg_census2021_ethnocultural.xlsx"
    if not f.exists():
        req = urllib.request.Request(URL, headers={"User-Agent": UA})
        f.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    rows = _read_xlsx(f, "4")
    hdr_i = next(i for i, r in enumerate(rows) if r and "Християнско" in [(c or "").strip() for c in r])
    hdr = [(c or "").strip() for c in rows[hdr_i]]
    total_col = hdr.index("Общо")
    colmap = {}
    for ci, h in enumerate(hdr):
        key = re.sub(r"\d+$", "", h).strip()  # strip footnote digits ("Непоказано1")
        if key in COLS:
            colmap[ci] = COLS[key]
    if len(colmap) != len(COLS):
        raise ValueError(f"unexpected header: {hdr}")
    out = {}
    for r in rows[hdr_i + 1:]:
        if not r or not r[0]:
            continue
        code = NUTS.get(r[0].strip())
        if not code:
            continue
        d = {"total": _num(r[total_col])}
        for ci, g in colmap.items():
            d[g] = d.get(g, 0) + _num(r[ci] if ci < len(r) else None)
        out[code] = {k: v for k, v in d.items() if v or k == "total"}
    missing = set(NUTS.values()) - set(out)
    if missing:
        raise ValueError(f"missing districts: {sorted(missing)}")
    return out

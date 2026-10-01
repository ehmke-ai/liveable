"""Austria: Statistik Austria, religious affiliation 2021 (voluntary supplementary questions in the
Mikrozensus labour force survey, Q1-Q4 2021, ~27.7k respondents, extrapolated to total population).

!! NUTS2 ONLY !! Austria has had no religion question in a census since 2001 (the register-based
censuses 2011/2021 carry no religion). The 2021 survey is published only by Bundesland
(= NUTS2). The 2001 census does have NUTS3 detail but is 20 years stale (Catholic share fell
from ~74% to 55%), so we use 2021 and copy each Bundesland's figures (absolute counts of the
whole Bundesland, so shares are identical for all children) onto every NUTS3 child region.

Group mapping: Roemisch-katholisch -> catholic; Evangelisch A.B. und H.B. -> protestant;
Orthodox -> orthodox; Christentum minus those three -> otherChristian; Islam -> muslim;
Andere Religion (incl. Judaism, Hinduism, Buddhism, registered confessional communities,
other) -> other; Keiner ... angehoerig -> none. No "not stated" category is published
(non-response imputed by the survey). Values are published in thousands (with decimals).
"""
from __future__ import annotations

import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

SOURCE = "Statistik Austria, Religionszugehörigkeit 2021 (Mikrozensus supplementary survey), Bundesland level"
YEAR = 2021

URL = "https://www.statistik.at/fileadmin/pages/439/neu__Religion_2021_Bundesland.ods"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

# column order in the sheet after the "Österreich" column
LAENDER = ["AT11", "AT21", "AT12", "AT31", "AT32", "AT22", "AT33", "AT34", "AT13"]
HEADER = ["Burgen-land", "Kärnten", "Nieder-österreich", "Ober-österreich", "Salzburg",
          "Steier-mark", "Tirol", "Vorarl-berg", "Wien"]
# NUTS 2021 NUTS3 children of each Bundesland
NUTS3 = {
    "AT11": ["AT111", "AT112", "AT113"],
    "AT12": ["AT121", "AT122", "AT123", "AT124", "AT125", "AT126", "AT127"],
    "AT13": ["AT130"],
    "AT21": ["AT211", "AT212", "AT213"],
    "AT22": ["AT221", "AT222", "AT223", "AT224", "AT225", "AT226"],
    "AT31": ["AT311", "AT312", "AT313", "AT314", "AT315"],
    "AT32": ["AT321", "AT322", "AT323"],
    "AT33": ["AT331", "AT332", "AT333", "AT334", "AT335"],
    "AT34": ["AT341", "AT342"],
}
ROWS = {
    "Gesamtbevölkerung": "total",
    "Christentum": "_christian",
    "Römisch-katholisch": "catholic",
    "Evangelisch A.B. und H.B.": "protestant",
    "Orthodox": "orthodox",
    "Islam": "muslim",
    "Andere Religion, Konfession oder Glaubensgemeinschaft": "other",
    "Keiner Religion, Konfession oder Glaubensgemeinschaft angehörig": "none",
}

_T = "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}"
_X = "{urn:oasis:names:tc:opendocument:xmlns:text:1.0}"
_O = "{urn:oasis:names:tc:opendocument:xmlns:office:1.0}"


def _ods_rows(path: Path):
    root = ET.fromstring(zipfile.ZipFile(path).read("content.xml"))
    table = next(root.iter(_T + "table"))
    for r in table.iter(_T + "table-row"):
        row = []
        for c in r:
            if c.tag not in (_T + "table-cell", _T + "covered-table-cell"):
                continue
            n = min(int(c.get(_T + "number-columns-repeated", "1")), 50)
            txt = " ".join("".join(p.itertext()) for p in c.iter(_X + "p"))
            row += [c.get(_O + "value") or txt] * n
        yield row


def load(cache: Path) -> dict[str, dict[str, int]]:
    cache = Path(cache)
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / "at_religion_2021_bundesland.ods"
    if not f.exists():
        req = urllib.request.Request(URL, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=120) as r:
            f.write_bytes(r.read())

    nuts2: dict[str, dict[str, float]] = {k: {} for k in LAENDER}
    header_ok = False
    for row in _ods_rows(f):
        if not row:
            continue
        if row[0] == "Religion":
            assert row[2:11] == HEADER, row
            header_ok = True
            continue
        if row[0] == "" and len(row) > 1 and "Prozent" in row[1]:
            break  # stop before the percentage block
        g = ROWS.get(row[0])
        if g:
            for code, v in zip(LAENDER, row[2:11]):
                nuts2[code][g] = float(v) * 1000
    if not header_ok:
        raise RuntimeError("unexpected sheet layout")

    out = {}
    for code, d in nuts2.items():
        d["otherChristian"] = d.pop("_christian") - d["catholic"] - d["protestant"] - d["orthodox"]
        vals = {g: round(v) for g, v in d.items() if round(v) > 0}
        for child in NUTS3[code]:
            out[child] = dict(vals)
    return out

"""Switzerland: FSO/BFS Structural Survey (Strukturerhebung), religious affiliation by canton.

Table T 01.08.02.02 "Religionszugehoerigkeit nach Grossregion und Kanton, 2010-2024"
(BFS asset 36347568, one sheet per year). Weighted (extrapolated) counts of the permanent
resident population aged 15+ living in private households -- so "total" is that survey
universe, not the full canton population.

Cantons = NUTS3. To damp sampling noise in small cantons we average the three survey years
YEARS (default 2020-2022, centred on 2021). Cells marked "X" (<=4 observations, suppressed)
are averaged over the years in which they are published; if suppressed in all years they are
omitted (shows up as a small positive residual, mostly Jewish/other in small cantons).

Group mapping: Evangelisch-reformiert -> protestant; Roemisch-katholisch -> catholic;
Andere christliche Glaubensgemeinschaften (incl. Orthodox, Christ-Catholic, free churches,
etc. -- not separated in this table) -> otherChristian; Juedische -> jewish;
Islamische (+ derived communities) -> muslim; Andere Religionsgemeinschaften -> other;
Ohne Religionszugehoerigkeit -> none; Religionszugehoerigkeit unbekannt -> notStated.
"""
from __future__ import annotations

import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

SOURCE = "Swiss Federal Statistical Office (FSO/BFS), Structural Survey 2020-2022 (pop. 15+), table T 01.08.02.02"
YEAR = 2021
YEARS = ("2020", "2021", "2022")

URL = "https://dam-api.bfs.admin.ch/hub/api/dam/assets/36347568/master"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"}

CANTONS = {
    "Vaud": "CH011", "Valais / Wallis": "CH012", "Genève": "CH013",
    "Bern / Berne": "CH021", "Fribourg / Freiburg": "CH022", "Solothurn": "CH023",
    "Neuchâtel": "CH024", "Jura": "CH025",
    "Basel-Stadt": "CH031", "Basel-Landschaft": "CH032", "Aargau": "CH033",
    "Zürich": "CH040",
    "Glarus": "CH051", "Schaffhausen": "CH052", "Appenzell A. Rh.": "CH053",
    "Appenzell I. Rh.": "CH054", "St. Gallen": "CH055",
    "Graubünden / Grigioni / Grischun": "CH056", "Thurgau": "CH057",
    "Luzern": "CH061", "Uri": "CH062", "Schwyz": "CH063", "Obwalden": "CH064",
    "Nidwalden": "CH065", "Zug": "CH066", "Ticino": "CH070",
}
# value columns (0-based) in each sheet; odd columns between are confidence intervals
COLS = {"total": 1, "protestant": 2, "catholic": 4, "otherChristian": 6, "jewish": 8,
        "muslim": 10, "other": 12, "none": 14, "notStated": 16}

_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def _fetch(url: str, dest: Path) -> Path:
    if not dest.exists() or dest.stat().st_size == 0:
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=300) as r:
            data = r.read()
        tmp = dest.with_suffix(dest.suffix + ".part")
        tmp.write_bytes(data)
        tmp.replace(dest)
    return dest


def _col(ref: str) -> int:
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group():
        n = n * 26 + ord(ch) - 64
    return n - 1


def _sheet_rows(path: Path, sheet_name: str | None = None, sheet_file: str | None = None):
    z = zipfile.ZipFile(path)
    if sheet_file is None:
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        rmap = {r.get("Id"): r.get("Target") for r in rels}
        for s in wb.iter(_NS + "sheet"):
            if s.get("name") == sheet_name:
                t = rmap[s.get(_RNS + "id")].lstrip("/")
                sheet_file = t if t.startswith("xl/") else "xl/" + t
                break
        else:
            raise KeyError(sheet_name)
    ss = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(_NS + "si"):
            ss.append("".join(t.text or "" for t in si.iter(_NS + "t")))
    for row in ET.fromstring(z.read(sheet_file)).iter(_NS + "row"):
        cells = {}
        for c in row.iter(_NS + "c"):
            t = c.get("t")
            v = c.find(_NS + "v")
            if t == "inlineStr":
                val = "".join(x.text or "" for x in c.iter(_NS + "t"))
            elif v is None:
                continue
            elif t == "s":
                val = ss[int(v.text)]
            else:
                val = v.text
            cells[_col(c.get("r"))] = val
        yield [cells.get(i, "") for i in range(max(cells) + 1)] if cells else []


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace(" ", " ")).strip()


def load(cache: Path) -> dict[str, dict[str, int]]:
    path = _fetch(URL, Path(cache) / "ch_bfs_religion_kanton_36347568.xlsx")
    acc: dict[str, dict[str, list[float]]] = {}
    for year in YEARS:
        seen = set()
        for r in _sheet_rows(path, sheet_name=year):
            if not r:
                continue
            nuts = CANTONS.get(_norm(r[0]))
            if nuts is None:
                continue
            seen.add(nuts)
            d = acc.setdefault(nuts, {})
            for g, c in COLS.items():
                v = r[c].strip().strip("()") if c < len(r) else ""
                try:
                    d.setdefault(g, []).append(float(v))
                except ValueError:
                    pass  # "X" (suppressed) or blank
        missing = set(CANTONS.values()) - seen
        if missing:
            raise RuntimeError(f"sheet {year}: cantons not found {sorted(missing)}")
    out = {}
    for nuts, d in sorted(acc.items()):
        out[nuts] = {g: round(sum(v) / len(v)) for g, v in d.items() if v and round(sum(v) / len(v))}
    return out

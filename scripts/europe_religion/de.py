"""Germany: Zensus 2022 religious affiliation per municipality, aggregated to NUTS 2021 NUTS3.

Source table: Destatis "Bevoelkerung nach Religionszugehoerigkeit - Anzahl und Anteil je Gemeinde"
(Zensus 2022, Stichtag 15.05.2022, all 10,786 Gemeinden). The census only distinguishes
Roman Catholic church / Evangelical church (EKD) / "other, none, not stated" (other public-law
religious bodies are not reliably in the population registers), so the third bucket goes to
"nonMember".

Municipality (ARS 12-digit -> AGS 8-digit) -> NUTS3 via Eurostat's LAU 2022 / NUTS 2021
correspondence (EU-27-LAU-2022-NUTS-2021.xlsx). Exception: Eisenach (16063105) merged into the
Wartburgkreis on 2021-07-01 and is listed under DEG0P there, but NUTS 2021 still keeps
DEG0N = Eisenach, so it is assigned to DEG0N. Any municipality missing from the LAU list falls
back to the NUTS3 of its Kreis (first 5 digits).
"""
from __future__ import annotations

import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

SOURCE = "Statistische Ämter des Bundes und der Länder, Zensus 2022 (religion by municipality, Destatis)"
YEAR = 2022

RELIGION_URL = ("https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Bevoelkerung/Zensus2022/"
                "Publikationen/Downloads-Publikationen/Sonderauswertungen/"
                "bevoelkerung_religionszugehoerigkeit_je_gemeinde.xlsx?__blob=publicationFile&v=3")
LAU_URL = "https://ec.europa.eu/eurostat/documents/345175/501971/EU-27-LAU-2022-NUTS-2021.xlsx"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
OVERRIDES = {"16063105": "DEG0N"}  # Eisenach, Stadt

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


def _num(s: str) -> int:
    s = s.strip().strip("()").strip()
    if s in ("", "–", "-", "."):
        return 0
    return int(float(s))


def load(cache: Path) -> dict[str, dict[str, int]]:
    cache = Path(cache)
    rel = _fetch(RELIGION_URL, cache / "de_zensus2022_religion_gemeinde.xlsx")
    lau = _fetch(LAU_URL, cache / "EU-27-LAU-2022-NUTS-2021.xlsx")

    lau2nuts = {}
    for r in _sheet_rows(lau, sheet_name="DE"):
        if len(r) > 1 and re.fullmatch(r"DE[0-9A-Z]{3}", r[0] or "") and re.fullmatch(r"\d{8}", r[1] or ""):
            lau2nuts[r[1]] = r[0]
    lau2nuts.update(OVERRIDES)
    kreis_votes = defaultdict(Counter)
    for ags, n in lau2nuts.items():
        kreis_votes[ags[:5]][n] += 1
    kreis2nuts = {k: v.most_common(1)[0][0] for k, v in kreis_votes.items()}

    # religion workbook: the data sheet is the one with AGS rows
    z = zipfile.ZipFile(rel)
    sheets = sorted(n for n in z.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n))
    data_sheet = max(sheets, key=lambda n: z.getinfo(n).file_size)

    out: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    unmapped = []
    for r in _sheet_rows(rel, sheet_file=data_sheet):
        if len(r) < 9 or r[2] != "Gemeinde" or not re.fullmatch(r"\d{12}", r[0]):
            continue
        ars = r[0]
        ags = ars[:5] + ars[9:]
        nuts = lau2nuts.get(ags) or kreis2nuts.get(ars[:5])
        if nuts is None:
            unmapped.append(ars)
            continue
        d = out[nuts]
        d["total"] += _num(r[3])
        d["catholic"] += _num(r[4])
        d["protestant"] += _num(r[6])
        d["nonMember"] += _num(r[8])
    if unmapped:
        raise RuntimeError(f"unmapped municipalities: {unmapped[:10]} ({len(unmapped)})")
    return {k: {g: v for g, v in d.items() if v} for k, d in sorted(out.items())}

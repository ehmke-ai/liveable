"""Liechtenstein: Volkszaehlung 2020 (census, 31.12.2020), permanent population by religion.

Source: Amt fuer Statistik Liechtenstein, eTab PxWeb table 213.001d "Staendige Bevoelkerung nach
Stichtag, Religion, Heimat, Geschlecht und Gemeinde", queried through the PxWeb JSON API.
Liechtenstein is a single NUTS3 region (LI000).

In the 2020 vintage "Evangelisch (reformiert, protestantisch)" holds the Reformed church and is
exclusive of "Evangelisch-lutherisch" and "Andere protestantische Kirchen" (the separate
"Evangelisch-reformiert" line is '*' = n/a); the categories add up exactly to the total.
Jewish is not shown separately (inside "Andere Religionen").
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

SOURCE = "Amt für Statistik Liechtenstein, Volkszählung 2020 (eTab table 213.001d)"
YEAR = 2020

URL = ("https://etab.llv.li/PXWeb/api/v1/de/eTab"
       + urllib.parse.quote("/Bevölkerung/Bevölkerungsstruktur/213.001d.px"))
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

# religion value code -> group (code 3 "Evangelisch-reformiert" is '*' in 2020; skip it)
GROUPS = {
    "0": "total",
    "1": "catholic",
    "2": "protestant", "4": "protestant", "5": "protestant",
    "6": "orthodox",
    "7": "otherChristian",
    "8": "muslim",
    "9": "other", "10": "other",
    "11": "none",
    "12": "notStated",
}


def load(cache: Path) -> dict[str, dict[str, int]]:
    cache = Path(cache)
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / "li_etab_213.001d_2020.json"
    if not f.exists():
        q = {"query": [
            {"code": "Stichtag", "selection": {"filter": "item", "values": ["0"]}},  # 31.12.2020
            {"code": "Religion", "selection": {"filter": "all", "values": ["*"]}},
            {"code": "Heimat", "selection": {"filter": "item", "values": ["0"]}},
            {"code": "Geschlecht", "selection": {"filter": "item", "values": ["0"]}},
            {"code": "Gemeinde", "selection": {"filter": "item", "values": ["0"]}},
        ], "response": {"format": "json"}}
        req = urllib.request.Request(URL, data=json.dumps(q).encode(),
                                     headers={"User-Agent": UA, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as r:
            f.write_bytes(r.read())
    d = json.loads(f.read_bytes().decode("utf-8-sig"))
    out: dict[str, int] = {}
    for row in d["data"]:
        rel = row["key"][1]
        g = GROUPS.get(rel)
        v = row["values"][0]
        if g is None or not v.strip().isdigit():
            continue
        out[g] = out.get(g, 0) + int(v)
    return {"LI000": {g: v for g, v in out.items() if v}}

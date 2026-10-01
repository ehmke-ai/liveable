"""Denmark: Folkekirken (Evangelical Lutheran Church of Denmark) membership by landsdel.

Source: Statistics Denmark StatBank table KM6 "Population 1. January by municipality, sex,
age and member of the National Church" (sex/age eliminated = totals), via
https://api.statbank.dk/v1/data  (table KM6, FKMED F/U).
  F (member)      -> "protestant"
  U (not member)  -> "nonMember"   (religion otherwise unknown; Denmark registers only Folkekirken)
total = F + U = full population 1 Jan.

Municipality -> NUTS 2021 NUTS3 (landsdel) correspondence below follows Statistics Denmark's
landsdele (identical to NUTS3 DK011..DK050). Christiansø (411, not part of a municipality)
is put with Bornholm (DK014).
"""
import csv
import io
import json
import urllib.request
from pathlib import Path

SOURCE = "Statistics Denmark, StatBank KM6 (National Church membership by municipality), 1 Jan 2026"
YEAR = 2026

LANDSDEL = {
    "DK011": "101 147 155 185",
    "DK012": "165 151 153 157 159 161 163 167 169 183 173 175 187",
    "DK013": "201 240 210 250 190 270 260 217 219 223 230",
    "DK014": "400 411",
    "DK021": "253 259 350 265 269",
    "DK022": "320 376 316 326 360 370 306 329 330 340 336 390",
    "DK031": "420 430 440 482 410 480 450 461 479 492",
    "DK032": "530 561 563 607 510 621 540 550 573 575 630 580",
    "DK041": "657 661 756 665 760 779 671 791",
    "DK042": "710 766 615 707 727 730 741 740 746 706 751",
    "DK050": "810 813 860 849 825 846 773 840 787 820 851",
}
MUNI_TO_NUTS = {m: n for n, ms in LANDSDEL.items() for m in ms.split()}


def _fetch(cache: Path) -> str:
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / f"dk_km6_{YEAR}.csv"
    if not f.exists():
        body = {
            "table": "KM6", "format": "CSV", "lang": "en", "valuePresentation": "Code",
            "variables": [
                {"code": "KOMK", "values": ["*"]},
                {"code": "FKMED", "values": ["*"]},
                {"code": "Tid", "values": [str(YEAR)]},
            ],
        }
        req = urllib.request.Request(
            "https://api.statbank.dk/v1/data", data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            f.write_bytes(r.read())
    return f.read_text(encoding="utf-8-sig")


def load(cache: Path) -> dict[str, dict[str, int]]:
    out = {n: {"protestant": 0, "nonMember": 0} for n in LANDSDEL}
    seen = set()
    for row in csv.DictReader(io.StringIO(_fetch(cache)), delimiter=";"):
        m = row["KOMK"]
        if m not in MUNI_TO_NUTS:
            raise ValueError(f"unmapped municipality {m}")
        seen.add(m)
        g = {"F": "protestant", "U": "nonMember"}[row["FKMED"]]
        out[MUNI_TO_NUTS[m]][g] += int(row["INDHOLD"])
    missing = set(MUNI_TO_NUTS) - seen
    if missing:
        raise ValueError(f"municipalities missing from data: {missing}")
    for rec in out.values():
        rec["total"] = rec["protestant"] + rec["nonMember"]
    return out


if __name__ == "__main__":
    import sys
    d = load(Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / ".cache" / "religion"))
    for k, v in sorted(d.items()):
        print(k, v, f"{v['protestant']/v['total']:.1%}")
    print("DK total", sum(v["total"] for v in d.values()), sum(v["protestant"] for v in d.values()))

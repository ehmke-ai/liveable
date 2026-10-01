"""Norway: religious affiliation by fylke (= NUTS 2021 NUTS3), reference year 2020.

Why 2020: SSB's regional breakdown of non-Church-of-Norway communities by religion
(table 08531) ends in 2020, and the 2020-2023 county geography (Viken, Vestfold og
Telemark, Troms og Finnmark) is exactly the NUTS 2021 NUTS3 geography used by the map.

Sources (Statistics Norway PxWeb API v0, https://data.ssb.no/api/v0/en/table/<id>):
  12026 "Church users (M)" (KOSTRA), county aggregates EKAxx, year 2020:
        KOSmedlemmerdnk0000  members of the Church of Norway      -> "protestant"
        KOSpersoneralle0000  total population (1 Jan 2021)         -> "total"
  08531 "Members of congregations in religious and philosophical communities outside
        the Church of Norway, by religion/philosophy (C)", year 2020:
        600 Christianity  -> "otherChristian"  (NB: mostly Roman Catholic (~45 %),
                              plus Pentecostal/free churches, Orthodox, etc.; SSB gives no
                              county split by denomination)
        400 Islam         -> "muslim"
        200 Buddhism + 902 Other religion -> "other"
        900 Philosophy    -> "none" (secular life-stance communities, mainly the
                              Norwegian Humanist Association)
  Remainder (total - all of the above) -> "nonMember" (not registered in any
  state-supported religious/life-stance community).

County code (2020) -> NUTS 2021: 1:1 (see COUNTY_TO_NUTS).
"""
import csv
import io
import json
import urllib.request
from pathlib import Path

SOURCE = ("Statistics Norway (SSB) tables 12026 (Church of Norway members, KOSTRA) and "
          "08531 (members of other religious/life-stance communities by county), 2020")
YEAR = 2020

COUNTY_TO_NUTS = {
    "30": "NO082", "03": "NO081", "34": "NO020", "38": "NO091", "42": "NO092",
    "11": "NO0A1", "46": "NO0A2", "15": "NO0A3", "50": "NO060", "18": "NO071",
    "54": "NO074",
}
RELIGION = {"600": "otherChristian", "400": "muslim", "200": "other", "902": "other", "900": "none"}
API = "https://data.ssb.no/api/v0/en/table/"


def _post(table: str, query: list, cache: Path, name: str) -> list[dict]:
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / name
    if not f.exists():
        body = {"query": query, "response": {"format": "json-stat2"}}
        req = urllib.request.Request(API + table, data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            f.write_bytes(r.read())
    js = json.loads(f.read_text())
    dims, sizes = js["id"], js["size"]
    cats = []
    for d in dims:
        ix = js["dimension"][d]["category"]["index"]
        if isinstance(ix, list):
            ix = {k: i for i, k in enumerate(ix)}
        cats.append(sorted(ix, key=ix.get))
    # iterate full cartesian product in row-major order
    rows = []
    n = 1
    for s in sizes:
        n *= s
    for pos in range(n):
        rem, coord = pos, []
        for s in reversed(sizes):
            coord.append(rem % s)
            rem //= s
        coord.reverse()
        rows.append({**{d: cats[i][c] for i, (d, c) in enumerate(zip(dims, coord))},
                     "value": js["value"][pos]})
    return rows


def load(cache: Path) -> dict[str, dict[str, int]]:
    kostra = _post("12026", [
        {"code": "KOKkommuneregion0000", "selection": {"filter": "item",
                                                       "values": ["EKA" + c for c in COUNTY_TO_NUTS]}},
        {"code": "ContentsCode", "selection": {"filter": "item",
                                               "values": ["KOSmedlemmerdnk0000", "KOSpersoneralle0000"]}},
        {"code": "Tid", "selection": {"filter": "item", "values": [str(YEAR)]}},
    ], cache, f"no_12026_{YEAR}.json")
    rel = _post("08531", [
        {"code": "Region", "selection": {"filter": "item", "values": list(COUNTY_TO_NUTS)}},
        {"code": "ReligionLivs", "selection": {"filter": "item", "values": list(RELIGION)}},
        {"code": "Tid", "selection": {"filter": "item", "values": [str(YEAR)]}},
    ], cache, f"no_08531_{YEAR}.json")

    out = {n: {} for n in COUNTY_TO_NUTS.values()}
    for r in kostra:
        nuts = COUNTY_TO_NUTS[r["KOKkommuneregion0000"][3:]]
        key = "protestant" if r["ContentsCode"] == "KOSmedlemmerdnk0000" else "total"
        out[nuts][key] = int(r["value"])
    for r in rel:
        nuts = COUNTY_TO_NUTS[r["Region"]]
        g = RELIGION[r["ReligionLivs"]]
        out[nuts][g] = out[nuts].get(g, 0) + int(r["value"] or 0)
    for rec in out.values():
        counted = sum(v for k, v in rec.items() if k != "total")
        rec["nonMember"] = rec["total"] - counted
        for k in [k for k, v in rec.items() if v == 0]:
            del rec[k]
    return out


if __name__ == "__main__":
    import sys
    d = load(Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / ".cache" / "religion"))
    for k, v in sorted(d.items()):
        print(k, v, f"DNK {v['protestant']/v['total']:.1%}")

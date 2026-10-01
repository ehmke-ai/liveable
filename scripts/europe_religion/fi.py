"""Finland: religious affiliation by maakunta (region = NUTS3) from Statistics Finland.

Source table: StatFin vaerak 11ra "Key figures on population by region" (PxWeb API),
https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/vaerak/11ra.px
Contents used (population register, 31 Dec):
  vaerak-vaesto        population
  vaesto_usk_evlut_p   share belonging to the Evangelical Lutheran Church, %  -> "protestant"
  vaesto_usk_muu_p     share belonging to other religious groups, %          -> "other"
  vaesto_usk_ei_p      share with no religious affiliation, %                -> "none"
Shares are published to 0.1 %, so counts are share * population (rounded).
NOTE: "other" here is a mixed bag (Orthodox Church ~1 %, Catholics, free churches,
registered Muslim communities, etc.); StatFin publishes no finer regional split.

Region (maakunta, MK) -> NUTS 2021 NUTS3 correspondence (1:1).
"""
import json
import urllib.request
from pathlib import Path

SOURCE = "Statistics Finland, population register (StatFin 11ra key figures by region), 31 Dec 2025"
YEAR = 2025

URL = "https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/vaerak/11ra.px"

MK_TO_NUTS = {
    "MK01": "FI1B1", "MK02": "FI1C1", "MK04": "FI196", "MK05": "FI1C2",
    "MK06": "FI197", "MK07": "FI1C3", "MK08": "FI1C4", "MK09": "FI1C5",
    "MK10": "FI1D1", "MK11": "FI1D2", "MK12": "FI1D3", "MK13": "FI193",
    "MK14": "FI194", "MK15": "FI195", "MK16": "FI1D5", "MK17": "FI1D9",
    "MK18": "FI1D8", "MK19": "FI1D7", "MK21": "FI200",
}
CONTENTS = {
    "vaesto_usk_evlut_p": "protestant",
    "vaesto_usk_muu_p": "other",
    "vaesto_usk_ei_p": "none",
}


def _fetch(cache: Path) -> dict:
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / f"fi_11ra_{YEAR}.json"
    if not f.exists():
        query = {
            "query": [
                {"code": "alue_23_20260101", "selection": {"filter": "item", "values": list(MK_TO_NUTS)}},
                {"code": "contentscode", "selection": {"filter": "item", "values": ["vaerak-vaesto", *CONTENTS]}},
                {"code": "timeperiod_y", "selection": {"filter": "item", "values": [str(YEAR)]}},
            ],
            "response": {"format": "json-stat2"},
        }
        req = urllib.request.Request(
            URL, data=json.dumps(query).encode(), headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            f.write_bytes(r.read())
    return json.loads(f.read_text())


def load(cache: Path) -> dict[str, dict[str, int]]:
    js = _fetch(cache)
    dims = js["id"]
    sizes = js["size"]
    idx = {d: js["dimension"][d]["category"]["index"] for d in dims}
    # index lists -> dict
    idx = {d: (v if isinstance(v, dict) else {k: i for i, k in enumerate(v)}) for d, v in idx.items()}
    vals = js["value"]

    def get(area, content):
        pos = 0
        coords = {"alue_23_20260101": area, "contentscode": content, "timeperiod_y": str(YEAR)}
        for d, s in zip(dims, sizes):
            pos = pos * s + idx[d][coords[d]]
        return vals[pos]

    out = {}
    for mk, nuts in MK_TO_NUTS.items():
        pop = int(get(mk, "vaerak-vaesto"))
        rec = {}
        for c, g in CONTENTS.items():
            share = get(mk, c)
            if share:
                rec[g] = round(pop * float(share) / 100)
        rec["total"] = pop
        out[nuts] = rec
    return out


if __name__ == "__main__":
    import sys
    d = load(Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / ".cache" / "religion"))
    for k, v in sorted(d.items()):
        s = sum(x for g, x in v.items() if g != "total")
        print(k, v, "resid", v["total"] - s)

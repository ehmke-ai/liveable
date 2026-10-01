"""Cyprus: religion, Census of Population and Housing 2021 (1 Oct 2021).

Source: CYSTAT-DB PxWeb table 1891632E "Population Enumerated by Religion, Sex and
Citizenship Group 1.10.2021". Cyprus is a single NUTS 3 region (CY000). Coverage is the
government-controlled area only. Universe: total enumerated population, all ages.
The religion question was optional; "Not recorded/Not stated" also includes persons
enumerated from administrative sources without religion information.
"""
import json
import urllib.request
from pathlib import Path

SOURCE = "CYSTAT, Census of Population and Housing 2021 (table 1891632E; government-controlled area)"
YEAR = 2021

URL = ("https://cystatdb.cystat.gov.cy/api/v1/en/8.CYSTAT-DB/Population/"
       "Census%20of%20Population%20and%20Housing%202021/Population/"
       "Population%20-%20Language,%20Religion,%20Ethnic%20Religious%20Group/1891632E.px")

GROUP = {
    "1": "orthodox",     # Christian Orthodox
    "2": "orthodox",     # Armenian church (Oriental Orthodox)
    "3": "catholic",     # Maronite church (Eastern Catholic)
    "4": "catholic",     # Roman Catholic
    "5": "muslim",
    "6": "protestant",   # Anglican/Protestant
    "7": "other",        # Buddhist
    "8": "other",        # Sikh
    "9": "other",        # Hindu
    "10": "other",       # Other religion (incl. Jewish, other Christian not listed)
    "11": "none",        # Atheist/No religion
    "12": "notStated",   # Not recorded/Not stated
}


def _fetch(cache: Path) -> dict:
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / "cy_1891632E.json"
    if not f.exists():
        q = {
            "query": [
                {"code": "CITIZENSHIP GROUP", "selection": {"filter": "item", "values": ["0"]}},
                {"code": "SEX", "selection": {"filter": "item", "values": ["0"]}},
            ],
            "response": {"format": "json"},
        }
        req = urllib.request.Request(
            URL, data=json.dumps(q).encode(),
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            f.write_bytes(r.read())
    return json.loads(f.read_text(encoding="utf-8-sig"))


def load(cache: Path) -> dict[str, dict[str, int]]:
    d = _fetch(Path(cache))
    cols = [c["code"] for c in d["columns"]]
    ir = cols.index("RELIGION (1)")
    r: dict[str, int] = {}
    for row in d["data"]:
        code = row["key"][ir]
        v = row["values"][0]
        v = int(v) if v.strip().isdigit() else 0
        if code == "0":
            r["total"] = v
        else:
            g = GROUP[code]
            r[g] = r.get(g, 0) + v
    return {"CY000": {g: v for g, v in r.items() if v or g == "total"}}


if __name__ == "__main__":
    import sys
    res = load(Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/religion-cache"))
    for k, v in res.items():
        print(k, v, "residual", v["total"] - sum(x for g, x in v.items() if g != "total"))

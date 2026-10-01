"""Estonia: religious affiliation by NUTS 3 region, Population and Housing Census 2021.

Source table RL21452 (Statistics Estonia PxWeb, andmed.stat.ee): "At least 15-year-old
persons by religion and place of residence (administrative unit), 31 December 2021".
The table publishes the five NUTS 3 regions directly (EE001, EE004, EE008, EE009, EE00A).
Universe: persons aged 15+ (the census religion question was only asked of 15+).
"""
import json
import urllib.request
from pathlib import Path

SOURCE = "Statistics Estonia, Population and Housing Census 2021 (table RL21452, persons 15+)"
YEAR = 2021

URL = "https://andmed.stat.ee/api/v1/en/stat/RL21452"
NUTS = ["EE001", "EE004", "EE008", "EE009", "EE00A"]

# Usk codes -> group
GROUP = {
    "3": "protestant",      # Lutheran
    "4": "orthodox",        # Orthodox
    "5": "catholic",        # Roman Catholic
    "6": "protestant",      # Baptist
    "7": "otherChristian",  # Jehovah's Witness
    "8": "protestant",      # Pentecostal
    "9": "orthodox",        # Old Believer
    "10": "protestant",     # Adventist
    "11": "protestant",     # Methodist
    "12": "muslim",
    "13": "other",          # Buddhist
    "14": "protestant",     # Christian Free Congregations
    "15": "other",          # Earth Believer (Maausk)
    "16": "other",          # Taara Believer
    "17": "other",          # Other religion (incl. small Christian groups, Jewish etc. in this table)
    "18": "notStated",      # Affiliated, but which religion unknown
    "19": "none",
    "20": "notStated",      # Refused to answer
    "21": "notStated",      # Religious affiliation unknown
}


def _fetch(cache: Path) -> dict:
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / "ee_RL21452.json"
    if not f.exists():
        q = {
            "query": [
                {"code": "Elukoht", "selection": {"filter": "item", "values": NUTS}},
                {"code": "Usk", "selection": {"filter": "item", "values": ["1"] + list(GROUP)}},
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
    ie, iu = cols.index("Elukoht"), cols.index("Usk")
    out: dict[str, dict[str, int]] = {n: {} for n in NUTS}
    for row in d["data"]:
        k = row["key"]
        reg, usk = k[ie], k[iu]
        v = row["values"][0]
        v = int(v) if v.strip().isdigit() else 0  # "." = none / suppressed
        if usk == "1":
            out[reg]["total"] = v
        else:
            g = GROUP[usk]
            out[reg][g] = out[reg].get(g, 0) + v
    for r in out.values():
        for g in [g for g, v in r.items() if v == 0 and g != "total"]:
            del r[g]
    return out


if __name__ == "__main__":
    import sys
    res = load(Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/religion-cache"))
    for k, v in res.items():
        print(k, v, "residual", v["total"] - sum(x for g, x in v.items() if g != "total"))

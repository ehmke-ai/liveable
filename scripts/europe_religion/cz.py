"""Czechia: religious faith by kraj (= NUTS 3), Census (SLDB) 2021.

Source: Czech Statistical Office (CZSO/ČSÚ), open dataset `sldb2021_vira`
("Obyvatelstvo podle náboženské víry"), usually resident population,
reference date 2021-03-26. Territory codebook 100 = VÚSC (kraje).
"""
import csv
import urllib.request
from pathlib import Path

SOURCE = "Czech Statistical Office (ČSÚ), Census 2021 (sldb2021_vira)"
YEAR = 2021
URL = "https://csu.gov.cz/docs/107508/4250766c-69e6-3845-0eb4-580f7a692558/sldb2021_vira.csv"

# VÚSC (kraj) code -> NUTS 2021 NUTS3
KRAJ_NUTS = {
    "3018": "CZ010", "3026": "CZ020", "3034": "CZ031", "3042": "CZ032",
    "3051": "CZ041", "3069": "CZ042", "3077": "CZ051", "3085": "CZ052",
    "3093": "CZ053", "3107": "CZ063", "3115": "CZ064", "3123": "CZ071",
    "3131": "CZ072", "3140": "CZ080",
}

# vira_kod (codebook 3078) -> group
CATHOLIC = {8, 9, 41}  # Greek Catholic, Roman Catholic, "catholic (generic)"
PROTESTANT = {2, 3, 4, 5, 6, 10, 11, 12, 14, 15, 16, 19, 21, 25, 26, 42,
              47, 48, 53, 55, 56, 57, 61}
# 6 = Czechoslovak Hussite Church (national church, counted as Protestant)
ORTHODOX = {20, 36, 54}  # Orthodox Church in Czech lands, Russian Orthodox, Armenian Apostolic
OTHER_CHRISTIAN = {7, 17, 18, 22, 33, 35, 43, 58, 59, 63, 78}
# 7 LDS, 18 Jehovah's Witnesses, 22 Old Catholic, 43 "Christianity" generic,
# 78 "believer, church not specified" (church not named; assumed Christian)
MUSLIM = {27, 37}
JEWISH = {13, 44}
NONE = {1, 50, 67}  # no religious faith, atheism, agnosticism
NOT_STATED = {99}
BELIEVER = {46}  # "believer - not affiliated with any church or religious society"
# everything else (Buddhism, Hinduism, esoterism, paganism, Jedi, ...) -> other


def _group(code: int) -> str:
    for g, s in (("catholic", CATHOLIC), ("protestant", PROTESTANT),
                 ("orthodox", ORTHODOX), ("otherChristian", OTHER_CHRISTIAN),
                 ("muslim", MUSLIM), ("jewish", JEWISH), ("none", NONE), ("believer", BELIEVER),
                 ("notStated", NOT_STATED)):
        if code in s:
            return g
    return "other"


def _download(cache: Path) -> Path:
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / "cz_sldb2021_vira.csv"
    if not f.exists() or f.stat().st_size < 1_000_000:
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=300) as r:
            f.write_bytes(r.read())
    return f


def load(cache: Path) -> dict[str, dict[str, int]]:
    f = _download(Path(cache))
    out: dict[str, dict[str, int]] = {}
    with open(f, encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            if row["uzemi_cis"] != "100" or row["ukaz_kod"] != "3162":
                continue
            nuts = KRAJ_NUTS.get(row["uzemi_kod"])
            if not nuts:
                continue
            d = out.setdefault(nuts, {})
            val = int(row["hodnota"] or 0)
            if not row["vira_kod"]:
                d["total"] = val
            else:
                g = _group(int(row["vira_kod"]))
                d[g] = d.get(g, 0) + val
    for d in out.values():
        for k in [k for k, v in d.items() if v == 0]:
            del d[k]
    return out


if __name__ == "__main__":
    import json, sys
    res = load(Path(sys.argv[1] if len(sys.argv) > 1 else "."))
    print(json.dumps(res, indent=1, ensure_ascii=False))

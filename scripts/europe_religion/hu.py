"""Hungary: religion by county (vármegye, = NUTS 3), Census 2022.

Source: Hungarian Central Statistical Office (KSH), Census 2022 database
(https://nepszamlalas2022.ksh.hu/adatbazis/), dataflow WBS008
"A népesség vallása vármegyénként, településtípusonként" (population by
religion, county and settlement type). The database app uses a JSON REST API:
  /api/version                         -> {"version": "V67"}
  /api/dataflows/WBS008/<ver>/d/<key>  -> list of observations
Territory codes in CL_TERUL_GEO3 are already NUTS 3 codes (HU110 ... HU333).
Religion was a voluntary question; ~40% did not answer ("notStated").
"""
import json
import urllib.request
from pathlib import Path

SOURCE = "Hungarian Central Statistical Office (KSH), Census 2022"
YEAR = 2022
BASE = "https://nepszamlalas2022.ksh.hu"

GROUPS = {
    # RE_C = all Catholics (RE_RC Roman + RE_GC Greek Catholic are sub-items
    # of RE_C and are NOT added again)
    "catholic": {"RE_C"},
    "protestant": {"RE_CA", "RE_LU", "RE_UN", "RE_BA", "RE_ME", "RE_AD",
                   "RE_PE", "RE_AN", "RE_FC"},
    # Reformed, Lutheran, Unitarian, Baptist, Methodist, Adventist,
    # Pentecostal, Anglican, Faith Church (Hit Gyülekezete)
    "orthodox": {"RE_OG", "RE_ORU", "RE_OS", "RE_OB", "RE_ORO", "RE_OU", "RE_OO"},
    "otherChristian": {"RE_JW", "RE_CO"},  # Jehovah's Witnesses, other Christian
    "muslim": {"RE_M"},
    "jewish": {"RE_J"},
    "other": {"RE_B", "RE_H", "RE_OCD2"},  # Buddhist, Hindu, other religious community
    "none": {"RE_NOT"},
    "notStated": {"RE_NA"},
}
CODE_GROUP = {c: g for g, cs in GROUPS.items() for c in cs}
SUBITEMS = {"RE_RC", "RE_GC"}


def _get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0",
                                               "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def _download(cache: Path) -> Path:
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / "hu_census2022_WBS008.json"
    if not f.exists() or f.stat().st_size < 10_000:
        ver = json.loads(_get(BASE + "/api/version"))["version"]
        key = "TIME_PERIOD:2022,TERUL_GEO3,TERUL_TELTIP2:HU,VALLAS_V2,TARSJELL1:NEME_SEX"
        data = _get(f"{BASE}/api/dataflows/WBS008/{ver}/d/{key}")
        if not json.loads(data):
            raise RuntimeError("KSH API returned no observations")
        f.write_bytes(data)
    return f


def load(cache: Path) -> dict[str, dict[str, int]]:
    f = _download(Path(cache))
    obs = json.loads(f.read_text(encoding="utf-8"))
    out: dict[str, dict[str, int]] = {}
    for o in obs:
        geo = o["TERUL_GEO3"]
        if len(geo) != 5 or o["TIME_PERIOD"] != "2022" or o["TERUL_TELTIP2"] != "HU":
            continue  # only NUTS 3 rows, all settlement types
        code, val = o["VALLAS_V2"], o["OBS_VALUE"]
        val = int(float(val)) if val not in (None, "") else 0
        d = out.setdefault(geo, {})
        if code == "TOTAL":
            d["total"] = val
        elif code in CODE_GROUP:
            g = CODE_GROUP[code]
            d[g] = d.get(g, 0) + val
        elif code not in SUBITEMS:
            raise ValueError(f"unmapped HU religion code {code}")
    return {k: {g: v for g, v in d.items() if v} for k, d in out.items()}


if __name__ == "__main__":
    import sys
    print(json.dumps(load(Path(sys.argv[1] if len(sys.argv) > 1 else ".")), indent=1))

"""Slovakia: religious affiliation by kraj (= NUTS 3), Census (SODB) 2021.

Source: Statistical Office of the Slovak Republic, SODB 2021 dissemination
portal (scitanie.sk, "Obyvatelia > Základné výsledky > Náboženské vyznanie").
The portal's tables are backed by static JSON files; Z01_15_SR_SK0_KR.json is
"Počet obyvateľov podľa náboženského vyznania", all kraje of SR, already keyed
by NUTS 3 code (SK010 ... SK042). Reference date 2021-01-01.
"""
import json
import urllib.request
from pathlib import Path

SOURCE = "Statistical Office of the Slovak Republic, Census (SODB) 2021"
YEAR = 2021
URL = "https://www.scitanie.sk/themes/web-sodb/assets/public/disem/data/Z01_15_SR_SK0_KR.json?v=10"

GROUPS = {
    "catholic": {"01", "03"},  # Roman Catholic, Greek Catholic
    "protestant": {"02", "04", "07", "08", "09", "10", "11", "12", "15"},
    # 02 Lutheran (ECAV), 04 Reformed, 07 Methodist, 08 Christian Congregations,
    # 09 Apostolic, 10 Baptist, 11 Adventist, 12 Brethren, 15 Czechoslovak Hussite
    "orthodox": {"05"},
    "otherChristian": {"06", "14", "16", "18", "26"},
    # 06 Jehovah's Witnesses, 14 Old Catholic, 16 New Apostolic, 18 LDS,
    # 26 other and not precisely specified Christian churches
    "muslim": {"23"},
    "jewish": {"13"},
    "other": {"17", "24", "25", "29", "30", "99"},
    # Bahá'í, Buddhism, Hinduism, paganism/natural spirituality, ad hoc movements, other
    "none": {"28"},
    "notStated": {"00"},
}
CODE_GROUP = {c: g for g, cs in GROUPS.items() for c in cs}


def _download(cache: Path) -> Path:
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / "sk_Z01_15_SR_SK0_KR.json"
    if not f.exists() or f.stat().st_size < 10_000:
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            f.write_bytes(r.read())
    return f


def load(cache: Path) -> dict[str, dict[str, int]]:
    f = _download(Path(cache))
    table = json.loads(f.read_text(encoding="utf-8"))["table"]
    unknown = set(table["names"]) - set(CODE_GROUP) - {"total", "other"}
    if unknown:
        raise ValueError(f"unmapped SK religion codes: {unknown}")
    out: dict[str, dict[str, int]] = {}
    for nuts, row in table["data"].items():
        d: dict[str, int] = {}
        for code, cell in row["types"].items():
            if code == "total":
                d["total"] = int(cell["value"])
            elif code in CODE_GROUP:
                g = CODE_GROUP[code]
                d[g] = d.get(g, 0) + int(cell["value"])
        out[nuts] = {k: v for k, v in d.items() if v}
    return out


if __name__ == "__main__":
    import sys
    print(json.dumps(load(Path(sys.argv[1] if len(sys.argv) > 1 else ".")), indent=1))

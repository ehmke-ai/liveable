"""Iceland: National Church (Þjóðkirkjan) membership, capital region vs rest, 1 Dec 2023.

Source: Statistics Iceland PxWeb table MAN10289 "Population by parishes, congregations and
deaneries 1 December 2023",
https://px.hagstofa.is/pxen/api/v1/en/Samfelag/menning/5_trufelog/trufelog/MAN10289.px
Membership dimension (Aðild):
  2 Members of the National Church (16+)      -> "protestant"
  3 Not members of the National Church (16+)  -> "nonMember"
  0 Younger than 16 (membership not published) -> left out
total = 16 and over, so shares are of adults.
(Statistics Iceland's MAN10001 has the full breakdown by religious organisation, but only
nationally; no regional table by organisation exists.)

Parish -> NUTS3 correspondence:
  IS001 Höfuðborgarsvæði (Reykjavík, Kópavogur, Seltjarnarnes, Garðabær, Hafnarfjörður,
  Mosfellsbær, Kjósarhreppur) =
    deanery 01 Reykjavíkurprófastsdæmi vestra (whole; incl. Seltjarnarnes)
    deanery 02 Reykjavíkurprófastsdæmi eystra (whole; incl. Kópavogur)
    03.05 Hafnarfjarðarprestakall, 03.06 Víðistaðaprestakall (Hafnarfjörður)
    03.07 Garðaprestakall (Garðabær incl. Álftanes/Bessastaðir)
    03.08 Mosfellsprestakall (Mosfellsbær)
    03.09 Reynivallaprestakall (Kjalarnes [Reykjavík] + Kjós)
    03.10.02 Ástjarnarsókn (Hafnarfjörður)
  IS002 Landsbyggð = national total minus IS001 (includes the Suðurnes parishes of
  deanery 03: Grindavík, Útskálar, Keflavík, Njarðvík, Kálfatjörn/Vogar).
"""
import csv
import io
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

SOURCE = "Statistics Iceland, MAN10289 population by parish and National Church membership, 1 Dec 2023"
YEAR = 2023

URL = "https://px.hagstofa.is/pxen/api/v1/en/Samfelag/menning/5_trufelog/trufelog/MAN10289.px"
# PxWeb value codes of the 'Sóknir' dimension
TOTAL = "0"
CAPITAL = ["1", "14", "36", "37", "38", "41", "42", "47"]
EXPECTED_LABELS = {  # sanity check that codes still point at the intended parishes
    "1": "01 Reykjavíkurprófastsdæmi vestra", "14": "02 Reykjavíkurprófastsdæmi eystra",
    "36": "03.05 ", "37": "03.06 ", "38": "03.07 ", "41": "03.08 ", "42": "03.09 ",
    "47": "03.10.02 Ástjarnarsókn",
}
MEMBERSHIP = {"2": "protestant", "3": "nonMember"}


def _fetch(cache: Path) -> dict:
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / f"is_man10289_{YEAR}.json"
    if not f.exists():
        q = {"query": [
            {"code": "Sóknir", "selection": {"filter": "item", "values": [TOTAL, *CAPITAL]}},
            {"code": "Aðild", "selection": {"filter": "item", "values": list(MEMBERSHIP)}},
            {"code": "Kyn", "selection": {"filter": "item", "values": ["0"]}},
        ], "response": {"format": "json-stat2"}}
        data = json.dumps(q).encode()
        for attempt in range(30):  # hagstofa.is rate-limits aggressively (HTTP 429)
            try:
                req = urllib.request.Request(URL, data=data, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=60) as r:
                    body = r.read()
                if b"429" not in body[:100]:
                    break
            except urllib.error.HTTPError as e:
                if e.code != 429:
                    raise
            time.sleep(20)
        else:
            raise RuntimeError("Statistics Iceland kept returning HTTP 429")
        f.write_bytes(body)
    return json.loads(f.read_text())


def load(cache: Path) -> dict[str, dict[str, int]]:
    js = _fetch(cache)
    dims, sizes = js["id"], js["size"]
    idx = {}
    for d in dims:
        ix = js["dimension"][d]["category"]["index"]
        idx[d] = ix if isinstance(ix, dict) else {k: i for i, k in enumerate(ix)}
    labels = js["dimension"]["Sóknir"]["category"]["label"]
    for code, prefix in EXPECTED_LABELS.items():
        if not labels[code].startswith(prefix):
            raise ValueError(f"parish code {code} now means {labels[code]!r}")

    def get(parish, member):
        pos = 0
        coord = {"Sóknir": parish, "Aðild": member, "Kyn": "0"}
        for d, s in zip(dims, sizes):
            pos = pos * s + idx[d][coord[d]]
        return int(js["value"][pos] or 0)

    nat = {g: get(TOTAL, m) for m, g in MEMBERSHIP.items()}
    cap = {g: sum(get(p, m) for p in CAPITAL) for m, g in MEMBERSHIP.items()}
    rest = {g: nat[g] - cap[g] for g in nat}
    out = {"IS001": cap, "IS002": rest}
    for rec in out.values():
        rec["total"] = sum(rec.values())
    return out


if __name__ == "__main__":
    import sys
    d = load(Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / ".cache" / "religion"))
    for k, v in sorted(d.items()):
        print(k, v, f"members/16+ {v['protestant']/(v['protestant']+v['nonMember']):.1%}")

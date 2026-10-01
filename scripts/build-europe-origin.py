"""
Generates public/data/europe-region-origin.json for the Europe regions map: each NUTS 3 region's
population by country of birth, folded into origin groups, from the 2021 census:

  {
    "groups": [key, ...],                       # order of each region's "s" shares
    "countries": {"DE": "Germany", ...},        # reporting countries
    "origins": {"TR": "Türkiye", ...},          # countries of birth named in any region's "top"
    "regions": {nuts3: {"n": name, "p": population, "s": [share per group], "top": [[code, share], ...]}}
  }
  (% of population, one decimal; "top" is the region's five most common foreign countries of birth)

Source: Eurostat, Census 2021, "Population by country of birth, age groups and NUTS 3 region"
(cens_21cob_r3), all ages, both sexes. Cached in scripts/.cache. Covers the EU plus Switzerland,
Norway, Iceland, and Liechtenstein, on the NUTS 2021 regions.

Europe doesn't count race or ethnicity the way the US Census does, so origin here is country of
birth: a second-generation Turkish German born in Berlin counts as born in Germany.

Groups are built from Eurostat's own aggregates where they match (EU, non-EU Europe, Africa,
Latin America & Caribbean), and from individual countries where they don't (Middle East & North
Africa, South Asia, East & Southeast Asia). Turkey is split out of non-EU Europe as its own group.
Countries whose counts Eurostat suppresses in a region (flag "c") count as zero there, so a few of
those people fall into the continent's remainder group (Sub-Saharan Africa) or into Other.
Other is everyone not in a named group: North America, Oceania, Central Asia and the Caucasus,
unspecified countries, and unknown birthplace.
"""

import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache"
OUT = ROOT / "public" / "data" / "europe-region-origin.json"
DATASET = "cens_21cob_r3"
URL = (
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
    f"{DATASET}?format=JSON&lang=en&age=TOTAL&sex=T"
)

NORTH_AFRICA = ["DZ", "EG", "LY", "MA", "SD", "TN", "EH"]
MIDDLE_EAST = ["BH", "IQ", "IL", "JO", "KW", "LB", "PS", "OM", "QA", "SA", "SY", "AE", "YE", "IR"]
SOUTH_ASIA = ["AF", "BD", "BT", "IN", "MV", "NP", "PK", "LK"]
EAST_ASIA = [
    "CN", "JP", "MN", "KP", "KR", "TW",
    "BN", "KH", "ID", "LA", "MY", "MM", "PH", "SG", "TH", "TL", "VN",
]

# Origin groups, in the order the map lists them. Each is a function of a region's counts.
GROUPS = [
    ("native", lambda c: c("NAT")),
    ("eu", lambda c: c("EU_OTH")),
    ("europe", lambda c: c("EUR_NEU") - c("TR")),
    ("turkey", lambda c: c("TR")),
    ("mena", lambda c: sum(c(x) for x in NORTH_AFRICA + MIDDLE_EAST)),
    ("africa", lambda c: c("AFR") - sum(c(x) for x in NORTH_AFRICA)),
    ("southAsia", lambda c: sum(c(x) for x in SOUTH_ASIA)),
    ("eastAsia", lambda c: sum(c(x) for x in EAST_ASIA)),
    ("latin", lambda c: c("AME_X_N")),
]

TOP = 5


def load():
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{DATASET}.json"
    if not path.exists():
        urllib.request.urlretrieve(URL, path)
    return json.loads(path.read_text())


def cells(d):
    """{(geo, c_birth): count}, unpacking JSON-stat's flat index"""
    dims, size = d["id"], d["size"]
    inv = {k: {i: code for code, i in d["dimension"][k]["category"]["index"].items()} for k in dims}
    strides = [1] * len(size)
    for i in range(len(size) - 2, -1, -1):
        strides[i] = strides[i + 1] * size[i + 1]
    out = {}
    for flat, value in d["value"].items():
        flat = int(flat)
        co = {k: inv[k][(flat // strides[i]) % size[i]] for i, k in enumerate(dims)}
        out[(co["geo"], co["c_birth"])] = value
    return out


def pct(n, total):
    return round(100 * n / total, 1)


def main():
    d = load()
    counts = cells(d)
    geo_labels = d["dimension"]["geo"]["category"]["label"]
    birth_labels = d["dimension"]["c_birth"]["category"]["label"]
    # Single countries of birth, not aggregates like EU_OTH or AFR
    birth_countries = [k for k in d["dimension"]["c_birth"]["category"]["index"] if re.fullmatch(r"[A-Z]{2}", k)]

    regions = {}
    origins = set()
    # NUTS 3 codes are five characters; ZZZ is "extra-regio" (no fixed address) and the
    # outermost regions (FRY, the Canaries' island codes) fall outside the map
    for geo in sorted(g for g in geo_labels if len(g) == 5 and not g.endswith("ZZZ")):
        total = counts.get((geo, "TOTAL"))
        if not total:
            continue
        c = lambda code: counts.get((geo, code), 0)
        values = [max(0, f(c)) for _, f in GROUPS]
        shares = [pct(v, total) for v in values]
        other = max(0, round(100 - sum(shares), 1))
        top = sorted(
            ((code, c(code)) for code in birth_countries if code != geo[:2] and c(code) > 0),
            key=lambda x: -x[1],
        )[:TOP]
        origins.update(code for code, _ in top)
        regions[geo] = {
            "n": geo_labels[geo].removesuffix(" (NUTS 2021)"),
            "p": int(total),
            "s": shares + [other],
            "top": [[code, pct(n, total)] for code, n in top],
        }

    countries = sorted({geo[:2] for geo in regions})
    out = {
        "groups": [key for key, _ in GROUPS] + ["other"],
        "countries": {cc: geo_labels[cc] for cc in countries},
        "origins": {code: birth_labels[code].rstrip("*") for code in sorted(origins)},
        "regions": regions,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(regions)} regions in {len(countries)} countries, {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()

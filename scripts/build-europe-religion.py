"""
Generates public/data/europe-region-religion.json for the religion view of the Europe regions map:
each NUTS 3 region's population by religion, from each country's own census or church register:

  {
    "groups": [key, ...],                       # order of each region's "s" shares
    "countries": {"DE": "Germany", ...},        # reporting countries
    "sources": {"DE": "Destatis, ...", ...},    # where each country's figures come from
    "regions": {nuts3: {"n": name, "p": population, "s": [share per group]}}
  }
  (% of population, one decimal)

Eurostat has no religion table: religion isn't a core census topic, and many countries never ask
it (France, Belgium, the Netherlands, Spain, Italy, Greece, Slovenia, Luxembourg, Malta, Latvia)
or publish nothing regional that a script can fetch (Sweden; Lithuania's census table sits behind
a bot check). Those countries are left out and the map draws them gray.
Every other country has a loader in scripts/europe_religion/<cc>.py, which downloads its source
(cached in scripts/.cache/religion) and returns {nuts3: {group: count, "total": n}}; see each
loader's docstring for its source, year, and how its categories are folded into GROUPS.

What each country can report differs a lot:
  - Censuses that ask religion (IE, PT, PL, CZ, SK, HU, RO, BG, HR, EE, CY, CH, LI) give the
    full breakdown, with "not stated" where the question was voluntary. Czechia alone counts
    believers who belong to no church, as "Believer, no church". Bulgaria reports Christians
    as one figure, counted as Orthodox (97% of them nationally). Switzerland, Estonia, and Portugal
    ask only adults (15+), so their shares are of adults.
  - Germany's 2022 census records only Catholic and Protestant (EKD) church membership; everyone
    else is "Not a church member".
  - Church registers (DK, IS, FI, NO) count national-church members; the rest are "Not a church
    member" unless the register records them (Finland's "no religious community", Norway's other
    faith communities). Iceland reports membership for ages 16+ only, so its shares are of adults.
  - Austria last asked religion in the 2001 census; its 2021 survey is by state (Bundesland), so
    each region shows its state's shares.

"n" is taken from europe-region-origin.json and "p" is its 2021 census population, so the tooltip
matches the origin view; shares are of each source's own total.
"""

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache" / "religion"
LOADERS = ROOT / "scripts" / "europe_religion"
ORIGIN = ROOT / "public" / "data" / "europe-region-origin.json"
OUT = ROOT / "public" / "data" / "europe-region-religion.json"

# In the order the map lists them
GROUPS = [
    "catholic",
    "protestant",
    "orthodox",
    "otherChristian",
    "muslim",
    "jewish",
    "other",
    "none",
    "believer",
    "nonMember",
    "notStated",
]


def load_module(path):
    spec = importlib.util.spec_from_file_location(f"europe_religion_{path.stem}", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def pct(n, total):
    return round(100 * n / total, 1)


def main():
    origin = json.loads(ORIGIN.read_text())
    regions = {}
    sources = {}
    for path in sorted(LOADERS.glob("[a-z][a-z].py")):
        cc = path.stem.upper()
        module = load_module(path)
        counts = module.load(CACHE)
        expected = {k for k in origin["regions"] if k.startswith(cc)}
        missing = expected - counts.keys()
        extra = counts.keys() - expected
        if missing or extra:
            raise SystemExit(f"{cc}: missing {sorted(missing)}, unexpected {sorted(extra)}")
        for geo, c in counts.items():
            unknown = c.keys() - set(GROUPS) - {"total"}
            if unknown:
                raise SystemExit(f"{geo}: unknown groups {sorted(unknown)}")
            total = c["total"]
            shares = [pct(c.get(g, 0), total) for g in GROUPS]
            if abs(sum(shares) - 100) > 1.5:
                print(f"  warning: {geo} shares sum to {sum(shares):.1f}%")
            regions[geo] = {"n": origin["regions"][geo]["n"], "p": origin["regions"][geo]["p"], "s": shares}
        sources[cc] = module.SOURCE
        print(f"{cc}: {len(counts)} regions ({module.YEAR})")

    countries = sorted(sources)
    out = {
        "groups": GROUPS,
        "countries": {cc: origin["countries"][cc] for cc in countries},
        "sources": sources,
        "regions": dict(sorted(regions.items())),
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(regions)} regions in {len(countries)} countries, {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()

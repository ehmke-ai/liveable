"""
Generates public/data/county-election-2024.json for the 2024 election view of the US map: each
county's 2024 presidential general election result, keyed by 5-digit FIPS:

  [trump, harris, totalVotes]   (% of all votes cast for president, one decimal; third parties are the rest)

Source (cached in scripts/.cache): tonmcg/US_County_Level_Election_Results_08-24,
2024_US_County_Level_Presidential_Results.csv, compiled from state and county election offices.

Adjustments to fit the map's shapes:
  - Connecticut is reported by planning region (09110-09190), which the map already draws.
  - DC is reported by ward (11001-11008); the wards are summed into DC (11001).
  - Alaska is reported by state house district, which doesn't line up with its boroughs, so
    every borough gets the certified statewide result.
"""

import csv
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache"
OUT = ROOT / "public" / "data" / "county-election-2024.json"
URL = (
    "https://raw.githubusercontent.com/tonmcg/US_County_Level_Election_Results_08-24/"
    "master/2024_US_County_Level_Presidential_Results.csv"
)

# Certified statewide result (Alaska Division of Elections): Trump 184,458, Harris 140,026 of 338,177
ALASKA = (184458, 140026, 338177)


def load_rows():
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / "2024_US_County_Level_Presidential_Results.csv"
    if not path.exists():
        urllib.request.urlretrieve(URL, path)
    with path.open(newline="") as f:
        return list(csv.DictReader(f))


def county_fips():
    topo = json.loads((ROOT / "public" / "geo" / "us-counties-albers-10m.json").read_text())
    return [str(g["id"]) for g in topo["objects"]["counties"]["geometries"]]


def entry(gop, dem, total):
    return [round(gop / total * 100, 1), round(dem / total * 100, 1), total]


def main():
    votes = {}
    for row in load_rows():
        fips = row["county_fips"].zfill(5)
        if fips.startswith("02"):
            continue
        if fips.startswith("11"):
            fips = "11001"
        gop, dem, total = votes.get(fips, (0, 0, 0))
        votes[fips] = (
            gop + int(row["votes_gop"]),
            dem + int(row["votes_dem"]),
            total + int(row["total_votes"]),
        )

    for fips in county_fips():
        if fips.startswith("02"):
            votes[fips] = ALASKA

    out = {fips: entry(*v) for fips, v in sorted(votes.items()) if v[2] > 0}
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {len(out)} counties to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

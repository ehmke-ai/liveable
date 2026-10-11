"""
Generates the cost-of-living figures:

  src/data/state-cost.json        abbr -> {rpp, rppHousing, medianIncome, medianHomeValue, medianRent},
                                  plus "US" for the national figures
  public/data/county-cost.json    FIPS -> [medianIncome, medianHomeValue, medianRent] for the
  src/data/county-cost.json       county maps (client) and county pages (server); null where suppressed

Sources (cached in scripts/.cache):
  - BEA Regional Price Parities by state, 2024 (SARPP): all items and housing services, US = 100.
    https://apps.bea.gov/regional/zip/SARPP.zip
  - ACS 2020-2024 5-year estimates, for states, counties, and the nation:
    B19013 median household income, B25077 median value of owner-occupied homes, B25064 median
    gross rent. The 5-year tables are the only ones published for every county, so states use
    them too to keep every level comparable.

Connecticut's 2024 ACS figures are by planning region (09110-09190), which the county maps draw;
its county pages (the eight old counties) have no figures.
"""

import csv
import io
import json
import os
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache")
SARPP_URL = "https://apps.bea.gov/regional/zip/SARPP.zip"
TABLES = {"medianIncome": "B19013", "medianHomeValue": "B25077", "medianRent": "B25064"}
GEOS = {"us": "010XX00US", "states": "010XX00US$0400000", "counties": "010XX00US$0500000"}

STATE_ABBR = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE",
    "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA",
    "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
    "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM",
    "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
    "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
    "54": "WV", "55": "WI", "56": "WY",
}


def fetch(url, name):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=300) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def acs(table_id, geo):
    """GEO_ID suffix (FIPS, or "" for the nation) -> median estimate, None where suppressed"""
    path = fetch(
        f"https://data.census.gov/api/access/data/table?id=ACSDT5Y2024.{table_id}&g={geo}",
        f"ACSDT5Y2024.{table_id}_{geo.replace('$', '_')}.json",
    )
    data = json.load(open(path))["response"]["data"]
    head = data[0]
    out = {}
    for row in data[1:]:
        r = dict(zip(head, row))
        # Top- and bottom-coded medians read e.g. "2,000,000+" or "2,500-"; keep the bound
        raw = (r[f"{table_id}_001E"] or "").replace(",", "").rstrip("+-")
        out[r["GEO_ID"].split("US")[-1]] = int(raw) if raw.isdigit() else None
    return out


def rpp():
    """State FIPS -> (all items, housing services) RPP for the latest year"""
    with zipfile.ZipFile(fetch(SARPP_URL, "SARPP.zip")) as z:
        name = next(n for n in z.namelist() if n.startswith("SARPP_STATE_"))
        rows = list(csv.DictReader(io.TextIOWrapper(z.open(name), encoding="latin-1")))
    year = max(k for k in rows[0] if k.isdigit())
    out = {}
    for r in rows:
        fips = r["GeoFIPS"].strip().strip('"')[:2]
        if fips not in STATE_ABBR or r["LineCode"].strip() not in ("1", "3"):
            continue
        out.setdefault(fips, {})[r["LineCode"].strip()] = round(float(r[year]), 1)
    print(f"RPP year {year}")
    return {f: (v["1"], v["3"]) for f, v in out.items()}


def main():
    tables = {key: {level: acs(t, geo) for level, geo in GEOS.items()} for key, t in TABLES.items()}
    parities = rpp()

    states = {"US": {"rpp": 100.0, "rppHousing": 100.0, **{k: tables[k]["us"][""] for k in TABLES}}}
    for fips, abbr in sorted(STATE_ABBR.items(), key=lambda kv: kv[1]):
        all_items, housing = parities[fips]
        states[abbr] = {"rpp": all_items, "rppHousing": housing, **{k: tables[k]["states"][fips] for k in TABLES}}

    counties = {
        fips: [tables[k]["counties"].get(fips) for k in TABLES]
        for fips in sorted(tables["medianIncome"]["counties"])
        if fips[:2] in STATE_ABBR
    }

    json.dump(states, open(os.path.join(ROOT, "src", "data", "state-cost.json"), "w"), indent=1)
    for out in (("public", "data"), ("src", "data")):
        json.dump(counties, open(os.path.join(ROOT, *out, "county-cost.json"), "w"), separators=(",", ":"))
    missing = sum(1 for v in counties.values() if None in v)
    print(f"{len(states) - 1} states, {len(counties)} counties ({missing} with a suppressed figure)")


if __name__ == "__main__":
    main()

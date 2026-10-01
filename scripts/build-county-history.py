"""
Generates public/data/county-history.json for the Demographics view of the US map: county
shares of the same groups as the state "Population by ethnic group" chart, for every year on
the map's slider, keyed by year then 5-digit FIPS:

  [european, hispanic, african, indian, eastAsian, arab, nativeAmerican]
  (% of population; Other is the rest)

European is non-Hispanic White minus Arab ancestry; African is non-Hispanic Black; Native American is non-Hispanic American Indian
and Alaska Native alone; Indian is
Asian Indian, Pakistani, and Bangladeshi; East Asian is Chinese, Taiwanese, Japanese, Korean,
Mongolian, Okinawan, and Hmong (single-group Asian counts, as in the state build). 1990 has no
county Asian-group or ancestry data, so indian / eastAsian / arab are null and European is
all non-Hispanic White.

Sources (cached in scripts/.cache):
  1990  Census Bureau county estimates by race and Hispanic origin (CO-99-10), July 1, 1990.
  2000  Decennial census SF1 P4 (Hispanic origin by race) and PCT5 (Asian groups);
        SF3 PCT18 (ancestry) for Arab.
  2010  Decennial census SF1 P5 and PCT5; ACS 2006-2010 5-year B04006 for Arab.
  2020  ACS 2016-2020 5-year DP05, B02015 (Asian groups), and B04006 (ancestry).
  2025  Vintage 2025 county estimates by race and Hispanic origin (cc-est2025-alldata),
        July 1, 2025, with Indian, East Asian, and Arab shares from ACS 2020-2024 5-year
        B02015 and B04006, as in the state build.

Connecticut's 2025 figures are published for its nine planning regions (09110-09190), which
replaced its counties in 2022, so 2025 is keyed by region there; the map swaps in the region
shapes from public/geo/ct-planning-regions-albers.json (scripts/build-ct-regions-topo.js).

Counties are matched to today's map by FIPS. Counties that were created or redrawn since
(Broomfield CO, several Alaska boroughs) have no value for the years they didn't exist;
renamed counties are re-keyed and Chugach + Copper River are merged back into the
Valdez-Cordova census area the map still draws.

Run with: python3 scripts/build-county-history.py
"""

import csv
import json
import os
import urllib.request
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache")
OUT = os.path.join(ROOT, "public", "data", "county-history.json")
ALL_COUNTIES = "010XX00US$0500000"

# Same group definitions as build-states-data.py
INDIAN = ("Asian Indian", "Bangladeshi", "Pakistani")
EAST_ASIAN = ("Chinese", "Taiwanese", "Japanese", "Korean", "Mongolian", "Okinawan", "Hmong")

# Old code -> the code on today's map. Several old codes mapping to one new code are summed.
RECODED_FIPS = {
    "12025": "12086",  # Dade -> Miami-Dade (1997)
    "46113": "46102",  # Shannon -> Oglala Lakota (2015)
    "02270": "02158",  # Wade Hampton -> Kusilvak (2015)
    "02063": "02261",  # Chugach -> Valdez-Cordova (split 2019; us-atlas still has 02261)
    "02066": "02261",  # Copper River -> Valdez-Cordova
}

# asian_total is the denominator for indian / east: the population total, except in 2025 where
# the Asian-group counts come from a different source (the ACS) than the population estimate
FIELDS = ("total", "nhw", "hispanic", "nhb", "nhai", "indian", "east", "asian_total", "arab", "arab_total")


# Same cached downloader as build-states-data.py
def fetch(url, name):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=300) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def labels(api_group):
    path = fetch(f"https://api.census.gov/data/{api_group}.json", api_group.replace("/", "_") + ".json")
    return {k: v["label"] for k, v in json.load(open(path))["variables"].items() if not k.endswith(("EA", "MA", "M"))}


def leaf(label):
    return label.split("!!")[-1].rstrip(":").strip()


def table(table_id):
    """County rows of a data.census.gov table (no API key needed), keyed by 5-digit FIPS."""
    path = fetch(
        f"https://data.census.gov/api/access/data/table?id={table_id}&g={ALL_COUNTIES}",
        f"{table_id}_{ALL_COUNTIES.replace('$', '_')}.json",
    )
    head, *rows = json.load(open(path))["response"]["data"]
    return {
        r["GEO_ID"].split("US")[-1]: r
        for r in (dict(zip(head, row)) for row in rows)
        if not r["GEO_ID"].split("US")[-1].startswith("72")  # Puerto Rico isn't on the map
    }


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def asian_keys(api_group):
    lab = labels(api_group)
    ind = [k for k, l in lab.items() if leaf(l).startswith(INDIAN)]
    east = [k for k, l in lab.items() if leaf(l).startswith(EAST_ASIAN)]
    return ind, east


def arab_keys(api_group):
    """Same label match as build-states-data.py's arab_counts."""
    lab = labels(api_group)
    key = [k for k, l in lab.items() if leaf(l) == "Arab" and l.count("!!") == (2 if l.startswith("Estimate") else 1)]
    total = [k for k, l in lab.items() if l.rstrip(":") in ("Estimate!!Total", "Total specified ancestries tallied")]
    assert len(key) == 1 and len(total) == 1, (api_group, key, total)
    return key[0], total[0]


def recode(counts):
    """Sum each county's counts under the code today's map uses."""
    out = defaultdict(lambda: {f: 0.0 for f in FIELDS})
    for fips, c in counts.items():
        target = out[RECODED_FIPS.get(fips, fips)]
        for f in FIELDS:
            if c.get(f) is None:
                target[f] = None
            elif target[f] is not None:
                target[f] += c[f]
    return out


def shares(counts):
    def pct(part, total):
        return round(100 * part / total, 1) if part is not None and total else None

    out = {}
    for fips, c in sorted(recode(counts).items()):
        if not c["total"]:
            continue
        arab = pct(c["arab"], c["arab_total"])
        nhw = pct(c["nhw"], c["total"])
        out[fips] = [
            round(max(0.0, nhw - (arab or 0)), 1),
            pct(c["hispanic"], c["total"]),
            pct(c["nhb"], c["total"]),
            pct(c["indian"], c["asian_total"]),
            pct(c["east"], c["asian_total"]),
            arab,
            pct(c["nhai"], c["total"]),
        ]
    return out


def year_1990():
    path = fetch(
        "https://www2.census.gov/programs-surveys/popest/datasets/1990-2000/counties/asrh/co-99-10.txt",
        "co-99-10.txt",
    )
    counts = {}
    for line in open(path, encoding="latin-1"):
        parts = line.split()
        if len(parts) != 10 or parts[0] != "1990" or not parts[1].isdigit():
            continue
        values = [int(p) for p in parts[2:]]
        nh_white, nh_black, nh_aian, _, h_white, h_black, h_aian, h_asian = values
        counts[parts[1]] = {
            "total": sum(values), "nhw": nh_white, "nhb": nh_black, "nhai": nh_aian,
            "hispanic": h_white + h_black + h_aian + h_asian,
            "indian": None, "east": None, "asian_total": None, "arab": None, "arab_total": None,
        }
    return shares(counts)


def decennial(year, origin_table, total, nhw, hispanic, nhb, nhai, asian_table, asian_group, ancestry_table, ancestry_group):
    origin, asian, ancestry = table(origin_table), table(asian_table), table(ancestry_table)
    ind, east = asian_keys(asian_group)
    arab, arab_total = arab_keys(ancestry_group)
    counts = {}
    for fips, o in origin.items():
        a, anc = asian.get(fips, {}), ancestry.get(fips, {})
        counts[fips] = {
            "total": num(o[total]), "nhw": num(o[nhw]), "hispanic": num(o[hispanic]), "nhb": num(o[nhb]),
            "nhai": num(o[nhai]),
            "indian": sum(num(a.get(k)) for k in ind), "east": sum(num(a.get(k)) for k in east),
            "asian_total": num(o[total]),
            "arab": num(anc.get(arab)),
            # 2000's ancestry total counts ancestries tallied, not people; divide by population
            "arab_total": num(o[total]) if year == "2000" else num(anc.get(arab_total)),
        }
    return shares(counts)


def year_2020():
    dp05, asian, ancestry = table("ACSDP5Y2020.DP05"), table("ACSDT5Y2020.B02015"), table("ACSDT5Y2020.B04006")
    ind, east = asian_keys("2020/acs/acs5/groups/B02015")
    arab, arab_total = arab_keys("2020/acs/acs5/groups/B04006")
    counts = {}
    for fips, d in dp05.items():
        a, anc = asian.get(fips, {}), ancestry.get(fips, {})
        counts[fips] = {
            "total": num(d["DP05_0070E"]), "nhw": num(d["DP05_0077E"]),
            "hispanic": num(d["DP05_0071E"]), "nhb": num(d["DP05_0078E"]),
            "nhai": num(d["DP05_0079E"]),
            # ACS tables share one population control total, so DP05's total works for all three
            "indian": sum(num(a.get(k)) for k in ind), "east": sum(num(a.get(k)) for k in east),
            "asian_total": num(d["DP05_0070E"]),
            "arab": num(anc.get(arab)), "arab_total": num(anc.get(arab_total)),
        }
    return shares(counts)


def year_2025():
    path = fetch(
        "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/asrh/cc-est2025-alldata.csv",
        "cc-est2025-alldata.csv",
    )
    asian, ancestry = table("ACSDT5Y2024.B02015"), table("ACSDT5Y2024.B04006")
    ind, east = asian_keys("2024/acs/acs5/groups/B02015")
    arab, arab_total = arab_keys("2024/acs/acs5/groups/B04006")
    counts = {}
    for r in csv.DictReader(open(path, encoding="latin-1")):
        # YEAR 7 is the July 1, 2025 estimate; AGEGRP 0 is all ages
        if r["YEAR"] != "7" or r["AGEGRP"] != "0":
            continue
        fips = r["STATE"] + r["COUNTY"]
        a, anc = asian.get(fips, {}), ancestry.get(fips, {})
        counts[fips] = {
            "total": int(r["TOT_POP"]),
            "nhw": int(r["NHWA_MALE"]) + int(r["NHWA_FEMALE"]),
            "hispanic": int(r["H_MALE"]) + int(r["H_FEMALE"]),
            "nhb": int(r["NHBA_MALE"]) + int(r["NHBA_FEMALE"]),
            "nhai": int(r["NHIA_MALE"]) + int(r["NHIA_FEMALE"]),
            # Asian-group and ancestry shares come from the ACS, over the ACS's own total
            "indian": sum(num(a.get(k)) for k in ind), "east": sum(num(a.get(k)) for k in east),
            "asian_total": num(anc.get(arab_total)),
            "arab": num(anc.get(arab)), "arab_total": num(anc.get(arab_total)),
        }
    return shares(counts)


def main():
    history = {
        "1990": year_1990(),
        "2000": decennial(
            "2000", "DECENNIALSF12000.P004", "P004001", "P004005", "P004002", "P004006", "P004007",
            "DECENNIALSF12000.PCT005", "2000/dec/sf1/groups/PCT005",
            "DECENNIALSF32000.PCT018", "2000/dec/sf3/groups/PCT018",
        ),
        "2010": decennial(
            "2010", "DECENNIALSF12010.P5", "P005001", "P005003", "P005010", "P005004", "P005005",
            "DECENNIALSF12010.PCT5", "2010/dec/sf1/groups/PCT5",
            "ACSDT5Y2010.B04006", "2010/acs/acs5/groups/B04006",
        ),
        "2020": year_2020(),
        "2025": year_2025(),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(history, open(OUT, "w"), separators=(",", ":"))
    for year, counties in history.items():
        print(f"{year}: {len(counties)} counties")
    print(f"{os.path.getsize(OUT) / 1024:.0f} KB -> {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()

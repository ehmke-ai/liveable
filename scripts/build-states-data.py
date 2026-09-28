"""
Generates src/data/states.json (every state + DC), src/data/counties/<abbr>.json, and
src/data/county-labels.json.

Inputs are downloaded from the Census Bureau (cached in scripts/.cache); religion and
election figures come from scripts/data/{religion,elections}.json (Pew RLS 2023-24 and
Wikipedia results-by-state tables, collected once).

Run with: python3 scripts/build-states-data.py   (needs `pip install openpyxl`)
"""

import csv
import json
import os
import re
import urllib.request
from collections import defaultdict

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache")
DATA_OUT = os.path.join(ROOT, "src", "data")
ALL_STATES = "010XX00US$0400000"
ALL_COUNTIES = "010XX00US$0500000"

STATES = {
    "01": ("Alabama", "AL"), "02": ("Alaska", "AK"), "04": ("Arizona", "AZ"), "05": ("Arkansas", "AR"),
    "06": ("California", "CA"), "08": ("Colorado", "CO"), "09": ("Connecticut", "CT"), "10": ("Delaware", "DE"),
    "11": ("District of Columbia", "DC"), "12": ("Florida", "FL"), "13": ("Georgia", "GA"), "15": ("Hawaii", "HI"),
    "16": ("Idaho", "ID"), "17": ("Illinois", "IL"), "18": ("Indiana", "IN"), "19": ("Iowa", "IA"),
    "20": ("Kansas", "KS"), "21": ("Kentucky", "KY"), "22": ("Louisiana", "LA"), "23": ("Maine", "ME"),
    "24": ("Maryland", "MD"), "25": ("Massachusetts", "MA"), "26": ("Michigan", "MI"), "27": ("Minnesota", "MN"),
    "28": ("Mississippi", "MS"), "29": ("Missouri", "MO"), "30": ("Montana", "MT"), "31": ("Nebraska", "NE"),
    "32": ("Nevada", "NV"), "33": ("New Hampshire", "NH"), "34": ("New Jersey", "NJ"), "35": ("New Mexico", "NM"),
    "36": ("New York", "NY"), "37": ("North Carolina", "NC"), "38": ("North Dakota", "ND"), "39": ("Ohio", "OH"),
    "40": ("Oklahoma", "OK"), "41": ("Oregon", "OR"), "42": ("Pennsylvania", "PA"), "44": ("Rhode Island", "RI"),
    "45": ("South Carolina", "SC"), "46": ("South Dakota", "SD"), "47": ("Tennessee", "TN"), "48": ("Texas", "TX"),
    "49": ("Utah", "UT"), "50": ("Vermont", "VT"), "51": ("Virginia", "VA"), "53": ("Washington", "WA"),
    "54": ("West Virginia", "WV"), "55": ("Wisconsin", "WI"), "56": ("Wyoming", "WY"),
}
NO_COUNTY_MAP = {"11"}
COUNTY_NOUN = {"AK": "boroughs and census areas", "LA": "parishes"}


def slugify(name):
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", name.lower()))


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


def table(table_id, geo=ALL_STATES):
    path = fetch(
        f"https://data.census.gov/api/access/data/table?id={table_id}&g={geo}",
        f"{table_id}_{geo.replace('$', '_')}.json",
    )
    data = json.load(open(path))["response"]["data"]
    head = data[0]
    out = {}
    for row in data[1:]:
        r = dict(zip(head, row))
        out[r["GEO_ID"].split("US")[-1]] = r
    return out


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def leaf(label):
    return label.split("!!")[-1].rstrip(":").strip()


def keys_where(lab, pred):
    return [k for k, l in lab.items() if pred(l)]


INDIAN = ("Asian Indian", "Bangladeshi", "Pakistani")
EAST_ASIAN = ("Chinese", "Taiwanese", "Japanese", "Korean", "Mongolian", "Okinawan", "Hmong")


def asian_shares(table_id, api_group, totals=None):
    """Indian and East Asian counts / population. ACS tables divide by their own total."""
    lab = labels(api_group)
    ind = keys_where(lab, lambda l: leaf(l).startswith(INDIAN))
    east = keys_where(lab, lambda l: leaf(l).startswith(EAST_ASIAN))
    data = table(table_id)
    out = {}
    for fips, r in data.items():
        if fips not in STATES:
            continue
        denom = totals[fips] if totals else None
        if all(num(r.get(k)) is None for k in ind + east):
            continue
        out[fips] = (sum(num(r[k]) or 0 for k in ind), sum(num(r[k]) or 0 for k in east), denom)
    return out


def arab_counts(table_id, api_group):
    lab = labels(api_group)
    key = keys_where(lab, lambda l: leaf(l) == "Arab" and l.count("!!") == (2 if l.startswith("Estimate") else 1))
    total = keys_where(lab, lambda l: l.rstrip(":") in ("Estimate!!Total", "Total specified ancestries tallied"))
    assert len(key) == 1 and len(total) == 1, (table_id, key, total)
    data = table(table_id)
    return {f: (num(r.get(key[0])), num(r.get(total[0]))) for f, r in data.items() if f in STATES}


def median(counts):
    half = sum(counts.values()) / 2
    seen = 0
    for age in range(86):
        if seen + counts[age] >= half:
            return age + (half - seen) / counts[age]
        seen += counts[age]


def r1(x):
    return round(x + 1e-9, 1)


# ---------------------------------------------------------------- population estimates

def estimates_2020_2025():
    path = fetch(
        "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/state/asrh/sc-est2025-alldata6.csv",
        "sc-est2025-alldata6.csv",
    )
    tot = defaultdict(float)
    ages = defaultdict(lambda: defaultdict(float))
    for r in csv.DictReader(open(path)):
        if r["SEX"] != "0" or r["STATE"] not in STATES:
            continue
        f = r["STATE"]
        for year, col in (("2020", "ESTIMATESBASE2020"), ("2025", "POPESTIMATE2025")):
            v = float(r[col])
            tot[(f, year, r["ORIGIN"], r["RACE"])] += v
            tot[(f, year, r["ORIGIN"], "all")] += v
            if year == "2025":
                if r["ORIGIN"] == "0":
                    ages[(f, "all")][int(r["AGE"])] += v
                if r["ORIGIN"] == "1" and r["RACE"] == "1":
                    ages[(f, "nhw")][int(r["AGE"])] += v
    return tot, ages


def estimates_2000_2010():
    path = fetch(
        "https://www2.census.gov/programs-surveys/popest/datasets/2000-2010/intercensal/state/st-est00int-sexracehisp.csv",
        "st-est00int-sexracehisp.csv",
    )
    tot = defaultdict(float)
    for r in csv.DictReader(open(path, encoding="latin-1")):
        if r["SEX"] != "0" or r["STATE"].zfill(2) not in STATES:
            continue
        f = r["STATE"].zfill(2)
        for year, col in (("2000", "ESTIMATESBASE2000"), ("2010", "CENSUS2010POP")):
            tot[(f, year, r["ORIGIN"], r["RACE"])] += float(r[col])
    return tot


# ---------------------------------------------------------------- WP56 (1960-1990)

WP56_FIRST_TABLE = 15  # Alabama; tables run alphabetically through Wyoming (65), DC included


def wp56_table_number(fips):
    names = sorted(name for name, _ in STATES.values())
    return WP56_FIRST_TABLE + names.index(STATES[fips][0])


def wp56(fips):
    t = wp56_table_number(fips)
    path = fetch(f"https://www2.census.gov/library/working-papers/2002/demo/pop-twps0056/table{t}.xlsx", f"wp56-table{t}.xlsx")
    rows = list(openpyxl.load_workbook(path, read_only=True).active.iter_rows(values_only=True))
    title = rows[0][0]
    assert STATES[fips][0] in title, (fips, title)
    start = next(i for i, r in enumerate(rows) if r[0] == "PERCENT")
    by_year, last = {}, None
    for r in rows[start + 1:]:
        label = (r[0] or "").strip()
        m = re.match(r"^(\d{4})", label)
        if m:
            last = m.group(1)
            by_year[last] = r
        elif last == "1970" and "15%" in label:
            by_year["1970_15"] = r
    # columns: 0 label, 1 total, 2 white, 3 black, 4 AIAN, 5 API, 6 other, 7 hispanic, 8 NH white
    points = []
    white60, black60 = by_year["1960"][2], by_year["1960"][3]
    points.append({"year": 1960, "european": r1(white60), "african": r1(black60), "hispanic": 0})
    s70 = by_year["1970_15"]
    points.append({"year": 1970, "european": r1(s70[8]), "african": r1(by_year["1970"][3]), "hispanic": r1(s70[7])})
    for y in ("1980", "1990"):
        r = by_year[y]
        points.append({"year": int(y), "european": r1(r[8]), "african": r1(r[3]), "hispanic": r1(r[7])})
    for p in points:
        p.update(arab=None, indian=None, eastAsian=None)
        p["other"] = max(0, r1(100 - p["european"] - p["african"] - p["hispanic"]))
    return t, points


def merge_valdez_cordova(counties, dp05):
    """us-atlas still has Valdez-Cordova (02261), split in 2019 into 02063 and 02066."""
    parts = [c for c in counties if c["fips"] in ("02063", "02066")]
    pops = [num(dp05[c["fips"]]["DP05_0001E"]) for c in parts]
    merged = {"name": "Valdez-Cordova Census Area", "fips": "02261", "label": "Valdez-Cordova Census Area"}
    for k in ("nonHispanicWhitePct", "hispanicPct", "blackPct", "asianPct"):
        merged[k] = r1(sum(c[k] * p for c, p in zip(parts, pops)) / sum(pops))
    rest = [c for c in counties if c not in parts]
    return sorted(rest + [merged], key=lambda c: c["name"])


# ---------------------------------------------------------------- build

def main():
    tot20, ages = estimates_2020_2025()
    tot00 = estimates_2000_2010()
    decennial_total = {
        "2000": {f: tot00[(f, "2000", "0", "0")] for f in STATES},
        "2010": {f: tot00[(f, "2010", "0", "0")] for f in STATES},
    }
    asian = {
        "2000": asian_shares("DECENNIALSF12000.PCT005", "2000/dec/sf1/groups/PCT005", decennial_total["2000"]),
        "2010": asian_shares("DECENNIALSF12010.PCT5", "2010/dec/sf1/groups/PCT5", decennial_total["2010"]),
        "2020": asian_shares("ACSDT5Y2020.B02015", "2020/acs/acs5/groups/B02015"),
        "2025": asian_shares("ACSDT1Y2024.B02015", "2024/acs/acs1/groups/B02015"),
    }
    asian_fallback = {"2025": asian_shares("ACSDT5Y2024.B02015", "2024/acs/acs5/groups/B02015")}
    # ACS totals for the ACS-based Asian shares come from B04006's total (total population)
    arab = {
        "2000": arab_counts("DECENNIALSF32000.PCT018", "2000/dec/sf3/groups/PCT018"),
        "2010": arab_counts("ACSDT1Y2010.B04006", "2010/acs/acs1/groups/B04006"),
        "2020": arab_counts("ACSDT5Y2020.B04006", "2020/acs/acs5/groups/B04006"),
        "2025": arab_counts("ACSDT1Y2024.B04006", "2024/acs/acs1/groups/B04006"),
    }
    # 1-year ACS suppresses Arab ancestry in small states; fall back to the matching 5-year
    arab_fallback = {
        "2010": arab_counts("ACSDT5Y2010.B04006", "2010/acs/acs5/groups/B04006"),
        "2025": arab_counts("ACSDT5Y2024.B04006", "2024/acs/acs5/groups/B04006"),
    }
    acs_total = {"2020": {f: v[1] for f, v in arab["2020"].items()}, "2025": {f: v[1] for f, v in arab["2025"].items()}}
    for f, v in arab_fallback["2025"].items():
        if not acs_total["2025"].get(f):
            acs_total["2025"][f] = v[1]

    foreign_lab = labels("2024/acs/acs5/groups/B05002")
    fb_key = keys_where(foreign_lab, lambda l: l.rstrip(":") == "Estimate!!Total:!!Foreign-born")[0]
    foreign = table("ACSDT5Y2024.B05002")

    religion = json.load(open(os.path.join(ROOT, "scripts", "data", "religion.json")))
    elections = json.load(open(os.path.join(ROOT, "scripts", "data", "elections.json")))
    map_metrics = {}
    states_ts = open(os.path.join(ROOT, "src", "lib", "states.ts")).read()
    for m in re.finditer(r'abbr: "(\w\w)", native: [\d.]+, antiImmig: [\w.]+, gdp: ([\d.]+),.*?thirtyMarriedHomeowner: ([\d.]+)', states_ts):
        map_metrics[m.group(1)] = (float(m.group(2)), float(m.group(3)))

    states_out, county_labels = [], {}
    county_dp05 = table("ACSDP5Y2020.DP05", ALL_COUNTIES)
    dp_lab = labels("2020/acs/acs5/profile/groups/DP05")

    def dp_key(pred):
        ks = [k for k, l in dp_lab.items() if k.endswith("PE") and pred(l)]
        assert len(ks) == 1, ks
        return ks[0]

    k_nhw = dp_key(lambda l: l.endswith("Not Hispanic or Latino!!White alone"))
    k_his = dp_key(lambda l: l.endswith("Total population!!Hispanic or Latino (of any race)"))
    k_blk = dp_key(lambda l: l.endswith("One race!!Black or African American"))
    k_asn = dp_key(lambda l: l.endswith("One race!!Asian"))

    for fips, (name, abbr) in sorted(STATES.items(), key=lambda kv: kv[1][0]):
        slug = slugify(name)
        notes = []

        if fips not in NO_COUNTY_MAP:
            counties = []
            for cf, r in sorted(county_dp05.items()):
                if not cf.startswith(fips) or len(cf) != 5:
                    continue
                full = r["NAME"].rsplit(", ", 1)[0]
                short = full[: -len(" County")] if full.endswith(" County") else full
                row = {"name": short, "fips": cf}
                if short == full:
                    row["label"] = full
                row.update(
                    nonHispanicWhitePct=num(r[k_nhw]), hispanicPct=num(r[k_his]),
                    blackPct=num(r[k_blk]), asianPct=num(r[k_asn]),
                )
                counties.append(row)
            if abbr == "AK":
                counties = merge_valdez_cordova(counties, county_dp05)
            slugs = [slugify(c["name"]) for c in counties]
            assert len(slugs) == len(set(slugs)), f"county slug collision in {abbr}"
            county_labels[slug] = {slugify(c["name"]): c.get("label", c["name"] + " County") for c in counties}
            json.dump(counties, open(os.path.join(DATA_OUT, "counties", f"{abbr.lower()}.json"), "w"), separators=(",", ":"))

        wp_table, history = wp56(fips)
        for year, source in (("2000", tot00), ("2010", tot00), ("2020", tot20), ("2025", tot20)):
            total = source[(fips, year, "0", "0" if source is tot00 else "all")]
            nhw = source[(fips, year, "1", "1")] / total * 100
            nhb = source[(fips, year, "1", "2")] / total * 100
            hisp = source[(fips, year, "2", "0" if source is tot00 else "all")] / total * 100
            if fips in asian[year]:
                ind_n, east_n, denom = asian[year][fips]
                denom = denom or acs_total[year][fips]
            else:
                ind_n, east_n, _ = asian_fallback[year][fips]
                denom = arab_fallback[year][fips][1]
                notes.append(f"{year} Indian and East Asian shares use the ACS 5-year estimate (1-year table not published)")
            ind, east = ind_n / denom * 100, east_n / denom * 100

            a_count, a_total = arab[year][fips]
            if a_count is None and year in arab_fallback:
                a_count, a_total = arab_fallback[year][fips]
                notes.append(f"{year} Arab ancestry uses the ACS 5-year estimate (1-year figure suppressed)")
            if year in ("2000", "2010"):
                a_total = decennial_total[year][fips] if year == "2000" else a_total
            arab_share = a_count / a_total * 100 if a_count is not None else None

            european = nhw - (arab_share or 0)
            other = 100 - nhw - nhb - hisp - ind - east
            history.append({
                "year": int(year), "european": r1(european),
                "arab": r1(arab_share) if arab_share is not None else None,
                "indian": r1(ind), "eastAsian": r1(east), "african": r1(nhb), "hispanic": r1(hisp),
                "other": max(0, r1(other)),
            })

        pop25 = tot20[(fips, "2025", "0", "all")]
        gdp, fishback = map_metrics[abbr]
        rel = religion[abbr]
        lean = [
            {"year": e["year"], "leftWing": 0, "leftOfCenter": e["d"], "rightOfCenter": e["r"], "rightWing": 0}
            for e in elections[abbr]
        ]
        if abbr == "DC":
            notes.append("DC first voted for president in 1964, so its 1960 political point is the 1964 result")
        if abbr in ("AL", "MS"):
            notes.append(
                "In 1960 unpledged Democratic electors split the Democratic vote; the Democratic line shows Kennedy's share"
            )
        fb = num(foreign[fips][fb_key]) / num(foreign[fips]["B05002_001E"]) * 100
        geo = f"040XX00US{fips}"
        wiki = "the_District_of_Columbia" if abbr == "DC" else name.replace(" ", "_")

        sources = [
            {
                "label": "U.S. Census Bureau — State Population by Characteristics: 2020–2025 (Vintage 2025)",
                "detail": "Population, race and Hispanic origin, and median ages for 2020 (April 1 estimates base) and July 1, 2025 (file sc-est2025-alldata6). Median ages are interpolated from single-year-of-age counts.",
                "url": "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/state/asrh/sc-est2025-alldata6.csv",
            },
            {
                "label": "U.S. Census Bureau — Intercensal Estimates of the Resident Population: 2000–2010",
                "detail": "Race and Hispanic origin for 2000 (April 1 estimates base) and the 2010 census count (file st-est00int-sexracehisp).",
                "url": "https://www2.census.gov/programs-surveys/popest/datasets/2000-2010/intercensal/state/st-est00int-sexracehisp.csv",
            },
            {
                "label": "U.S. Census Bureau — Historical Census Statistics on Population Totals by Race and Hispanic Origin",
                "detail": f"Gibson & Jung, Working Paper No. 56, Table {wp_table}: {name}, 1960, 1970 (15% sample for Hispanic origin), 1980, and 1990.",
                "url": f"https://www2.census.gov/library/working-papers/2002/demo/pop-twps0056/table{wp_table}.xlsx",
            },
            {
                "label": "U.S. Census Bureau — Decennial Census Summary File 1, Table PCT5",
                "detail": f"Asian alone by group (Asian Indian, Pakistani, Bangladeshi, Chinese, Taiwanese, Japanese, Korean, Hmong), {name}, 2000 and 2010.",
                "url": f"https://data.census.gov/table/DECENNIALSF12010.PCT5?g={geo}",
            },
            {
                "label": "U.S. Census Bureau — American Community Survey, Table B02015",
                "detail": f"Asian alone by selected groups, {name}: 2016–2020 5-year (2020) and 2024 1-year (used for 2025).",
                "url": f"https://data.census.gov/table/ACSDT1Y2024.B02015?g={geo}",
            },
            {
                "label": "U.S. Census Bureau — Ancestry: Census 2000 SF3 Table PCT18 and ACS Table B04006",
                "detail": f"People reporting Arab ancestry, {name}: 2000 census, 2010 ACS 1-year, 2016–2020 ACS 5-year, and 2024 ACS 1-year (used for 2025).",
                "url": f"https://data.census.gov/table/ACSDT1Y2024.B04006?g={geo}",
            },
            {
                "label": "U.S. Census Bureau — American Community Survey 2020–2024 5-Year Estimates, Table B05002",
                "detail": "Foreign-born share of the population.",
                "url": f"https://data.census.gov/table/ACSDT5Y2024.B05002?g={geo}",
            },
            {
                "label": "Pew Research Center — Religious Landscape Study 2023–24",
                "detail": f"Catholic, Protestant (evangelical, mainline, and historically Black combined), and Orthodox self-identification among {name} adults.",
                "url": rel["url"],
            },
            {
                "label": "U.S. Bureau of Economic Analysis — GDP by State",
                "detail": f"Nominal (current-dollar) {name} GDP, 2025.",
                "url": "https://www.bea.gov/data/gdp/gdp-state",
            },
            {
                "label": f"Presidential election results in {name}",
                "detail": f"Democratic and Republican popular vote shares, 1960–2024, from state canvass figures as compiled in Wikipedia's results-by-state tables.",
                "url": f"https://en.wikipedia.org/wiki/United_States_presidential_elections_in_{wiki}",
            },
        ]
        if fips not in NO_COUNTY_MAP:
            sources.append({
                "label": "U.S. Census Bureau — American Community Survey 2020 5-Year Estimates, Table DP05",
                "detail": f"White alone not Hispanic or Latino, Hispanic or Latino (any race), Black alone, and Asian alone, % of population, all {len(county_labels[slug])} {name} {COUNTY_NOUN.get(abbr, 'counties')}.",
                "url": "https://data.census.gov/table/ACSDP5Y2020.DP05",
            })

        states_out.append({
            "state": name, "slug": slug, "abbr": abbr,
            "population": r1(pop25 / 1e6),
            "foreignBorn": round(fb),
            "catholic": rel["catholic"], "protestant": rel["protestant"], "orthodox": rel["orthodox"],
            "medianAge": r1(median(ages[(fips, "nhw")])),
            "medianAgeAll": r1(median(ages[(fips, "all")])),
            "gdp": gdp, "thirtyMarriedHomeowner": fishback,
            "populationHistory": history,
            "politicalLeanHistory": lean,
            **({"notes": sorted(set(notes))} if notes else {}),
            "sources": sources,
        })

    json.dump(states_out, open(os.path.join(DATA_OUT, "states.json"), "w"), indent=1)
    json.dump(county_labels, open(os.path.join(DATA_OUT, "county-labels.json"), "w"), separators=(",", ":"))

    abbrs = sorted(abbr for f, (_, abbr) in STATES.items() if f not in NO_COUNTY_MAP)
    with open(os.path.join(DATA_OUT, "counties", "index.ts"), "w") as f:
        f.write("// Generated by scripts/build-states-data.py\n")
        f.write('import type { CountyDemographics } from "@/lib/states"\n\n')
        for a in abbrs:
            f.write(f'import {a.lower()}Counties from "./{a.lower()}.json"\n')
        f.write("\nexport const countiesByAbbr: Record<string, CountyDemographics[]> = {\n")
        for a in abbrs:
            f.write(f"  {a}: {a.lower()}Counties,\n")
        f.write("}\n")
    print(f"{len(states_out)} states, {sum(len(v) for v in county_labels.values())} counties")


if __name__ == "__main__":
    main()

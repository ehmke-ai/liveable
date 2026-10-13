"""
Share of each state's population in six generations, from ACS 2024 5-year age counts.

Writes src/data/state-generation-pop.json:
  abbr (and "US") -> { silent, boomer, genx, millennial, genz, alpha } as percents.

Source: ACS 2020-2024 table B01001, sex by age, for the nation and the 50 states plus D.C.
https://data.census.gov/table/ACSDT5Y2024.B01001

Ages are as of the 2024 estimate year. Birth-year cuts:
  Gen Alpha 2013 or later (0-11), Gen Z 1997-2012 (12-27), Millennial 1981-1996 (28-43),
  Gen X 1965-1980 (44-59), Boomer 1946-1964 (60-78), Silent before 1946 (79+).
A Census age band that crosses a cut is split evenly by the years inside it.
"""

import json
import os
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache")
OUT = os.path.join(ROOT, "src", "data", "state-generation-pop.json")

STATE_ABBR = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE",
    "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA",
    "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
    "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM",
    "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
    "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
    "54": "WV", "55": "WI", "56": "WY",
}

# Male columns B01001_003E through _025E, then the same ages for women starting at _027E.
# (low age, high age). 85+ is treated as 85-94 so the open end still has a width.
BANDS = [
    (0, 4), (5, 9), (10, 14), (15, 17), (18, 19), (20, 20), (21, 21), (22, 24),
    (25, 29), (30, 34), (35, 39), (40, 44), (45, 49), (50, 54), (55, 59), (60, 61),
    (62, 64), (65, 66), (67, 69), (70, 74), (75, 79), (80, 84), (85, 94),
]
# Age in 2024, inclusive, for each generation.
GENERATIONS = [
    ("alpha", 0, 11),
    ("genz", 12, 27),
    ("millennial", 28, 43),
    ("genx", 44, 59),
    ("boomer", 60, 78),
    ("silent", 79, 94),
]
MALE_START = 3
FEMALE_START = 27


def fetch(url, name):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=300) as response, open(path, "wb") as handle:
            handle.write(response.read())
    return path


def acs(geo, name):
    path = fetch(
        f"https://data.census.gov/api/access/data/table?id=ACSDT5Y2024.B01001&g={geo}",
        name,
    )
    data = json.load(open(path))["response"]["data"]
    head = data[0]
    rows = []
    for row in data[1:]:
        rows.append(dict(zip(head, row)))
    return rows


def count(row, column):
    raw = (row.get(f"B01001_{column:03d}E") or "").replace(",", "")
    return int(raw) if raw.isdigit() else 0


def shares(row):
    totals = {key: 0.0 for key, _, _ in GENERATIONS}
    people = 0.0
    for sex_start in (MALE_START, FEMALE_START):
        for index, (low, high) in enumerate(BANDS):
            people_in_band = count(row, sex_start + index)
            width = high - low + 1
            people += people_in_band
            for key, gen_low, gen_high in GENERATIONS:
                overlap = min(high, gen_high) - max(low, gen_low) + 1
                if overlap > 0:
                    totals[key] += people_in_band * overlap / width
    if people <= 0:
        return None
    percents = {key: value / people * 100 for key, value in totals.items()}
    rounded = {key: round(value, 1) for key, value in percents.items()}
    drift = round(100 - sum(rounded.values()), 1)
    largest = max(rounded, key=rounded.get)
    rounded[largest] = round(rounded[largest] + drift, 1)
    return rounded


def main():
    out = {}
    for row in acs("010XX00US", "ACSDT5Y2024.B01001_010XX00US.json"):
        out["US"] = shares(row)
    for row in acs("010XX00US$0400000", "ACSDT5Y2024.B01001_010XX00US_0400000.json"):
        fips = row["GEO_ID"].split("US")[-1]
        abbr = STATE_ABBR.get(fips)
        if abbr:
            out[abbr] = shares(row)
    missing = [abbr for abbr in STATE_ABBR.values() if abbr not in out]
    if missing or "US" not in out:
        raise SystemExit(f"missing geographies: {missing}")
    with open(OUT, "w") as handle:
        json.dump(out, handle, separators=(",", ":"))
        handle.write("\n")
    print("wrote", OUT, "states", len(out) - 1)
    print("US", out["US"])
    print("TX", out["TX"])


if __name__ == "__main__":
    main()

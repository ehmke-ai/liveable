"""
Citizen and non-citizen employment by work field, from ACS 2024 1-year PUMS.

Writes src/data/field-citizenship.json:
  year, then US and each state abbreviation -> field id ->
  {citizen, naturalized, noncitizen, n}

citizen is everyone with U.S. citizenship, including naturalized.
naturalized is the naturalized part of that citizen count.
noncitizen is everyone else.
n is the unweighted number of employed respondents.

Fields are the SOC major groups used on the Where you stand page.
The survey records citizenship, not visa class.

Source: 2024 ACS 1-year person PUMS.
https://www2.census.gov/programs-surveys/acs/data/pums/2024/1-Year/csv_pus.zip
https://www.census.gov/programs-surveys/acs/microdata/documentation/2024.html

Civilian employed is ESR 1 (at work) or 2 (with a job, not at work), weighted by PWGTP.
Puerto Rico is in the file and is left out. A state share with n below 80 is hidden in the UI.
"""

import csv
import json
import os
import sys
import urllib.error
import urllib.request
import zipfile
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache")
OUT = os.path.join(ROOT, "src", "data", "field-citizenship.json")
URL = "https://www2.census.gov/programs-surveys/acs/data/pums/2024/1-Year/csv_pus.zip"
ZIP_NAME = "csv_pus.zip"

# Same map as scripts/build-county-visas.py. Anything else, including military, is other.
SOC_FIELD = {
    "11": "management",
    "13": "business",
    "15": "computer",
    "17": "engineering",
    "19": "science",
    "23": "legal",
    "25": "education",
    "27": "arts",
    "29": "healthcare",
    "31": "healthSupport",
    "35": "food",
    "37": "grounds",
    "39": "personal",
    "41": "sales",
    "43": "office",
    "45": "agriculture",
    "47": "construction",
    "49": "maintenance",
    "51": "production",
    "53": "transport",
}

FIELDS = [
    "computer",
    "engineering",
    "healthcare",
    "healthSupport",
    "business",
    "management",
    "education",
    "science",
    "legal",
    "arts",
    "sales",
    "office",
    "agriculture",
    "grounds",
    "construction",
    "food",
    "production",
    "transport",
    "maintenance",
    "personal",
    "other",
]

STATE_ABBR = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE",
    "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA",
    "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
    "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM",
    "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
    "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
    "54": "WV", "55": "WI", "56": "WY",
}

EMPLOYED = {"1", "2"}
CITIZEN = {"1", "2", "3", "4"}


def fetch():
    path = os.path.join(CACHE, ZIP_NAME)
    os.makedirs(CACHE, exist_ok=True)
    if not os.path.exists(path):
        print(f"downloading {URL}", flush=True)
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=600) as response, open(path, "wb") as handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
    return path


def blank():
    return {"citizen": 0.0, "naturalized": 0.0, "noncitizen": 0.0, "n": 0}


def field_of(socp):
    digits = "".join(ch for ch in socp if ch.isdigit())
    if len(digits) < 2:
        return None
    return SOC_FIELD.get(digits[:2], "other")


def share(cell, key):
    total = cell["citizen"] + cell["noncitizen"]
    if total <= 0:
        raise SystemExit(f"empty cell {cell}")
    return cell[key] / total


def main():
    counts = defaultdict(lambda: defaultdict(blank))
    missing_soc = 0
    bad_cit = 0
    skipped_geo = 0
    rows = 0

    with zipfile.ZipFile(fetch()) as archive:
        members = [name for name in archive.namelist() if name.lower().endswith(".csv")]
        if not members:
            raise SystemExit("PUMS zip has no CSV")
        for name in members:
            print(f"reading {name}", flush=True)
            with archive.open(name) as raw:
                text = (line.decode("utf-8") for line in raw)
                reader = csv.reader(text)
                header = next(reader)
                index = {column: i for i, column in enumerate(header)}
                for column in ("STATE", "CIT", "ESR", "SOCP", "PWGTP"):
                    if column not in index:
                        raise SystemExit(f"{name} is missing {column}")
                state_i = index["STATE"]
                cit_i = index["CIT"]
                esr_i = index["ESR"]
                soc_i = index["SOCP"]
                weight_i = index["PWGTP"]
                for row in reader:
                    rows += 1
                    if row[esr_i] not in EMPLOYED:
                        continue
                    abbr = STATE_ABBR.get(row[state_i].zfill(2))
                    if not abbr:
                        skipped_geo += 1
                        continue
                    cit = row[cit_i]
                    if cit not in CITIZEN and cit != "5":
                        bad_cit += 1
                        continue
                    field = field_of(row[soc_i])
                    if field is None:
                        missing_soc += 1
                        continue
                    weight = float(row[weight_i])
                    for geo in (abbr, "US"):
                        cell = counts[geo][field]
                        cell["n"] += 1
                        if cit == "5":
                            cell["noncitizen"] += weight
                        else:
                            cell["citizen"] += weight
                            if cit == "4":
                                cell["naturalized"] += weight

    places = {}
    for geo in ["US", *STATE_ABBR.values()]:
        fields = {}
        for field in FIELDS:
            cell = counts[geo][field]
            citizen = int(round(cell["citizen"]))
            naturalized = min(citizen, int(round(cell["naturalized"])))
            noncitizen = int(round(cell["noncitizen"]))
            fields[field] = {
                "citizen": citizen,
                "naturalized": naturalized,
                "noncitizen": noncitizen,
                "n": cell["n"],
            }
        places[geo] = fields

    us = places["US"]
    employed = sum(cell["citizen"] + cell["noncitizen"] for cell in us.values())
    overall_n = sum(cell["n"] for cell in us.values())
    overall = sum(cell["noncitizen"] for cell in us.values()) / employed

    def pct(field):
        return share(us[field], "noncitizen")

    print(f"person rows {rows:,}")
    print(f"employed {employed:,} from {overall_n:,} respondents")
    print(f"missing occupation {missing_soc:,}; bad citizenship {bad_cit:,}; outside 50 states and DC {skipped_geo:,}")
    print(f"overall noncitizen {overall:.1%}")
    for field in ("computer", "agriculture", "legal", "education"):
        cell = us[field]
        print(
            f"{field} noncitizen {pct(field):.1%} "
            f"naturalized {share(cell, 'naturalized'):.1%} n={cell['n']:,}"
        )

    if not (140_000_000 <= employed <= 190_000_000):
        raise SystemExit(f"employed {employed:,} is outside the expected ACS range")
    if missing_soc > overall_n * 0.01:
        raise SystemExit(f"too many employed rows without an occupation ({missing_soc:,})")
    if not (0.04 <= overall <= 0.16):
        raise SystemExit(f"overall noncitizen share {overall:.1%} is outside 4–16%")
    if not (pct("computer") > overall and pct("agriculture") > overall):
        raise SystemExit("computer or agriculture is not above the overall noncitizen share")
    if not (pct("legal") < overall and pct("education") < pct("computer")):
        raise SystemExit("legal or education share is out of line")
    for geo, fields in places.items():
        for field, cell in fields.items():
            if cell["naturalized"] > cell["citizen"]:
                raise SystemExit(f"naturalized exceeds citizens in {geo} {field}")
            if cell["n"] < 0 or cell["citizen"] < 0 or cell["noncitizen"] < 0:
                raise SystemExit(f"negative count in {geo} {field}")

    payload = {"year": 2024, **places}
    with open(OUT, "w") as handle:
        json.dump(payload, handle, separators=(",", ":"))
        handle.write("\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.URLError as error:
        sys.exit(f"download failed: {error}")

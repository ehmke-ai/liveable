"""
County worksite counts for the H-1B, H-2A, and H-2B maps.

Writes public/data/county-visas.json:
  FIPS -> [h1b positions, h2a workers, h2b workers, population or null]

Also writes public/data/county-visa-fields.json:
  FIPS -> {field: {program: count}} for certified job slots by SOC major group.
  Programs are h1b, specialty (H-1B1 and E-3), perm, h2a, and h2b. Zeros are omitted.

And src/data/county-fips.json:
  state slug -> county slug -> FIPS, for the Where you stand page.

Sources (cached in scripts/.cache):
  DOL OFLC disclosure data, FY 2025.
  https://www.dol.gov/agencies/eta/foreign-labor/performance
  - LCA_Disclosure_Data_FY2025_Q1..Q4.xlsx (quarterly, not cumulative)
  - H-2A_Disclosure_Data_FY2025_Q4.xlsx and H-2B_Disclosure_Data_FY2025_Q4.xlsx (full year)
  - PERM_Disclosure_Data_FY2025_Q4.xlsx (full year, new ETA-9089 layout)

LCA counts positions whose latest status is Certified, at the primary worksite. H-1B
updates the map total. H-1B1 and E-3 are counted only in the field file. H-2A and H-2B
count certified workers (including partial certifications) at the primary worksite.
PERM counts certified applications, including those later marked expired, one worker
each, at the primary worksite. The published FY 2025 certified total is 138,093.
An application with several worksites is counted in the first county.
A certified slot is not a person admitted. The same worker can appear in more than one program.

Most H-1B worksite counties are blank, so a ZIP is assigned to the 2020 county with the
largest land-area overlap (Census ZCTA-county relationship). County names fill the rest.

Population is the Census July 1, 2024 county estimate. Connecticut's 2024 estimates are
planning regions, so its eight counties use the July 1, 2021 estimates.
"""

import csv
import json
import os
import re
import unicodedata
from collections import Counter, defaultdict

from python_calamine import CalamineWorkbook

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache")
COUNTY_DIR = os.path.join(ROOT, "src", "data", "counties")
OUT = os.path.join(ROOT, "public", "data", "county-visas.json")
FIELDS_OUT = os.path.join(ROOT, "public", "data", "county-visa-fields.json")
FIPS_OUT = os.path.join(ROOT, "src", "data", "county-fips.json")

# SOC major group -> field id on the Where you stand page. Anything else is "other".
SOC_FIELD = {
    "15": "computer",
    "17": "engineering",
    "29": "healthcare",
    "31": "healthSupport",
    "13": "business",
    "11": "management",
    "25": "education",
    "19": "science",
    "23": "legal",
    "27": "arts",
    "41": "sales",
    "43": "office",
    "45": "agriculture",
    "37": "grounds",
    "47": "construction",
    "35": "food",
    "51": "production",
    "53": "transport",
    "49": "maintenance",
    "39": "personal",
}

STATE_SLUG = {
    "AL": "alabama", "AK": "alaska", "AZ": "arizona", "AR": "arkansas", "CA": "california",
    "CO": "colorado", "CT": "connecticut", "DE": "delaware", "DC": "district-of-columbia",
    "FL": "florida", "GA": "georgia", "HI": "hawaii", "ID": "idaho", "IL": "illinois",
    "IN": "indiana", "IA": "iowa", "KS": "kansas", "KY": "kentucky", "LA": "louisiana",
    "ME": "maine", "MD": "maryland", "MA": "massachusetts", "MI": "michigan", "MN": "minnesota",
    "MS": "mississippi", "MO": "missouri", "MT": "montana", "NE": "nebraska", "NV": "nevada",
    "NH": "new-hampshire", "NJ": "new-jersey", "NM": "new-mexico", "NY": "new-york",
    "NC": "north-carolina", "ND": "north-dakota", "OH": "ohio", "OK": "oklahoma", "OR": "oregon",
    "PA": "pennsylvania", "RI": "rhode-island", "SC": "south-carolina", "SD": "south-dakota",
    "TN": "tennessee", "TX": "texas", "UT": "utah", "VT": "vermont", "VA": "virginia",
    "WA": "washington", "WV": "west-virginia", "WI": "wisconsin", "WY": "wyoming",
}

STATE_ABBR = {
    "ALABAMA": "AL", "ALASKA": "AK", "ARIZONA": "AZ", "ARKANSAS": "AR", "CALIFORNIA": "CA",
    "COLORADO": "CO", "CONNECTICUT": "CT", "DELAWARE": "DE", "DISTRICT OF COLUMBIA": "DC",
    "FLORIDA": "FL", "GEORGIA": "GA", "HAWAII": "HI", "IDAHO": "ID", "ILLINOIS": "IL",
    "INDIANA": "IN", "IOWA": "IA", "KANSAS": "KS", "KENTUCKY": "KY", "LOUISIANA": "LA",
    "MAINE": "ME", "MARYLAND": "MD", "MASSACHUSETTS": "MA", "MICHIGAN": "MI", "MINNESOTA": "MN",
    "MISSISSIPPI": "MS", "MISSOURI": "MO", "MONTANA": "MT", "NEBRASKA": "NE", "NEVADA": "NV",
    "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY",
    "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", "OHIO": "OH", "OKLAHOMA": "OK", "OREGON": "OR",
    "PENNSYLVANIA": "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC", "SOUTH DAKOTA": "SD",
    "TENNESSEE": "TN", "TEXAS": "TX", "UTAH": "UT", "VERMONT": "VT", "VIRGINIA": "VA",
    "WASHINGTON": "WA", "WEST VIRGINIA": "WV", "WISCONSIN": "WI", "WYOMING": "WY",
    "WASHINGTON DC": "DC", "WASHINGTON D C": "DC", "D C": "DC",
}
ABBRS = set(STATE_ABBR.values())

# Names DOL uses that do not normalize onto the county file.
ALIASES = {
    ("AK", "PRINCEOFWALESOUTERKETCHIKAN"): "02198",  # old name; 2020 successor is Prince of Wales-Hyder
    ("AK", "PRINCEOFWALES"): "02198",
    ("AK", "SKAGWAYHOONAHANGOON"): "02230",
    ("AK", "WADEHAMPTON"): "02158",
    ("AK", "VALDEZCORDOVA"): "02063",  # split; Chugach is the larger piece
    ("IL", "LASALLE"): "17099",
    ("IN", "LAPORTE"): "18091",
    ("LA", "LASALLE"): "22059",
    ("NM", "DONAANA"): "35013",
    ("SD", "SHANNON"): "46102",
    ("VA", "FAIRFAXCITY"): "51600",
}


def to_abbr(value):
    text = re.sub(r"[^A-Z ]", "", str(value or "").upper()).strip()
    text = re.sub(r"\s+", " ", text)
    if text in ABBRS:
        return text
    return STATE_ABBR.get(text)


def norm_county(name):
    text = unicodedata.normalize("NFKD", str(name or "").upper())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.replace("&", " AND ")
    text = text.replace("'", "")
    text = text.replace(".", "")
    text = re.sub(r"\bSAINTE\b", "STE", text)
    text = re.sub(r"\bSAINT\b", "ST", text)
    text = re.sub(r"^COUNTY OF\s+", "", text.strip())
    for suffix in (
        " CITY AND BOROUGH",
        " CENSUS AREA",
        " MUNICIPALITY",
        " BOROUGH",
        " PARISH",
        " COUNTY",
        " CO",
    ):
        if text.endswith(suffix):
            text = text[: -len(suffix)]
            break
    return re.sub(r"[^A-Z0-9]", "", text)


def zip5(value):
    if value is None or value == "":
        return ""
    if isinstance(value, float):
        value = int(value)
    digits = "".join(ch for ch in str(value).split("-")[0].split(".")[0] if ch.isdigit())
    if len(digits) >= 5:
        return digits[:5]
    if 3 <= len(digits) <= 4:
        return digits.zfill(5)
    return ""


def as_int(value):
    if value is None or value == "":
        return 0
    if isinstance(value, bool):
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    text = str(value).replace(",", "").strip()
    try:
        return int(float(text))
    except ValueError:
        return 0


def rows_of(name):
    path = os.path.join(CACHE, name)
    sheet = CalamineWorkbook.from_path(path).get_sheet_by_index(0)
    iterator = sheet.iter_rows()
    header = [str(cell) for cell in next(iterator)]
    index = {column: i for i, column in enumerate(header)}
    return index, iterator


def load_counties():
    """(abbr, normalized name) -> fips, and the set of county fips we draw."""
    lookup = {}
    fips_set = set()
    for filename in sorted(os.listdir(COUNTY_DIR)):
        if not filename.endswith(".json"):
            continue
        abbr = filename[:2].upper()
        for county in json.load(open(os.path.join(COUNTY_DIR, filename))):
            fips_set.add(county["fips"])
            lookup[(abbr, norm_county(county["name"]))] = county["fips"]
    for key, fips in ALIASES.items():
        if fips in fips_set:
            lookup[key] = fips
    return lookup, fips_set


def load_zips(fips_set):
    path = os.path.join(CACHE, "tab20_zcta520_county20_natl.txt")
    best = {}
    with open(path, encoding="utf-8-sig") as handle:
        header = handle.readline().strip().split("|")
        zi = header.index("GEOID_ZCTA5_20")
        ci = header.index("GEOID_COUNTY_20")
        ai = header.index("AREALAND_PART")
        for line in handle:
            parts = line.rstrip("\n").split("|")
            zcta = parts[zi]
            county = parts[ci]
            if len(zcta) != 5 or len(county) != 5:
                continue
            area = int(parts[ai] or 0)
            previous = best.get(zcta)
            if previous is None or area > previous[0]:
                best[zcta] = (area, county)
    remap = {"46113": "46102", "02270": "02158"}
    out = {}
    for zcta, (_, county) in best.items():
        county = remap.get(county, county)
        if county in fips_set or county == "11001":
            out[zcta] = county
    return out


def load_population(fips_set):
    pop = {}
    with open(os.path.join(CACHE, "co-est2024-alldata.csv"), encoding="latin-1") as handle:
        for row in csv.DictReader(handle):
            if row["SUMLEV"] != "050" or row["STATE"] == "09":
                continue
            fips = row["STATE"] + row["COUNTY"]
            if fips in fips_set:
                pop[fips] = int(row["POPESTIMATE2024"])
    with open(os.path.join(CACHE, "co-est2021-alldata.csv"), encoding="latin-1") as handle:
        for row in csv.DictReader(handle):
            if row["SUMLEV"] != "050" or row["STATE"] != "09":
                continue
            fips = row["STATE"] + row["COUNTY"]
            if fips in fips_set:
                pop[fips] = int(row["POPESTIMATE2021"])
    # District of Columbia is a county equivalent on the national map
    with open(os.path.join(CACHE, "co-est2024-alldata.csv"), encoding="latin-1") as handle:
        for row in csv.DictReader(handle):
            if row["STATE"] == "11" and row["SUMLEV"] == "050":
                pop["11001"] = int(row["POPESTIMATE2024"])
    return pop


FIPS_OF_ABBR = {
    "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06", "CO": "08", "CT": "09", "DE": "10",
    "DC": "11", "FL": "12", "GA": "13", "HI": "15", "ID": "16", "IL": "17", "IN": "18", "IA": "19",
    "KS": "20", "KY": "21", "LA": "22", "ME": "23", "MD": "24", "MA": "25", "MI": "26", "MN": "27",
    "MS": "28", "MO": "29", "MT": "30", "NE": "31", "NV": "32", "NH": "33", "NJ": "34", "NM": "35",
    "NY": "36", "NC": "37", "ND": "38", "OH": "39", "OK": "40", "OR": "41", "PA": "42", "RI": "44",
    "SC": "45", "SD": "46", "TN": "47", "TX": "48", "UT": "49", "VT": "50", "VA": "51", "WA": "53",
    "WV": "54", "WI": "55", "WY": "56",
}


def lookup_name(abbr, county, lookup):
    """County name to FIPS. A trailing City or Town is dropped when that is not its own county."""
    if abbr == "DC":
        return "11001"
    key = norm_county(county)
    if not abbr or not key:
        return None
    found = lookup.get((abbr, key))
    if found:
        return found
    for suffix in ("CITY", "TOWN"):
        if key.endswith(suffix):
            found = lookup.get((abbr, key[: -len(suffix)]))
            if found:
                return found
    return None


def locate(abbr, county, postal, lookup, zips):
    code = zip5(postal)
    mapped = zips.get(code) if code else None
    if mapped and (abbr is None or mapped[:2] == FIPS_OF_ABBR.get(abbr)):
        return mapped
    found = lookup_name(abbr, county, lookup) if abbr else None
    return found or mapped


def cell(row, index, column):
    position = index.get(column)
    if position is None or position >= len(row):
        return ""
    return row[position]


def soc_field(code):
    digits = "".join(ch for ch in str(code or "") if ch.isdigit())
    return SOC_FIELD.get(digits[:2], "other")


def slugify(name):
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", str(name).lower()))


def lca_program(visa):
    """Map an LCA visa class onto a field-file program. H-1B also feeds the map total."""
    text = str(visa or "").strip()
    if text == "H-1B":
        return "h1b"
    if text.startswith("H-1B1") or text.startswith("E-3"):
        return "specialty"
    return None


def lca_cases():
    """case number -> (workers, state, county, zip, soc, program) for the latest Certified LCA."""
    chosen = {}
    classes = Counter()
    for quarter in ("Q1", "Q2", "Q3", "Q4"):
        index, iterator = rows_of(f"LCA_Disclosure_Data_FY2025_{quarter}.xlsx")
        kept = 0
        for row in iterator:
            status = str(cell(row, index, "CASE_STATUS") or "")
            program = lca_program(cell(row, index, "VISA_CLASS"))
            if status != "Certified" or not program:
                continue
            classes[str(cell(row, index, "VISA_CLASS") or "")] += 1
            case = str(cell(row, index, "CASE_NUMBER") or "")
            decision = str(cell(row, index, "DECISION_DATE") or "")
            # Deduplicate within a program. A case that changes class keeps both filings.
            key = (case, program)
            previous = chosen.get(key)
            if previous and previous[0] > decision:
                continue
            worksite_workers = as_int(cell(row, index, "WORKSITE_WORKERS"))
            total_positions = as_int(cell(row, index, "TOTAL_WORKER_POSITIONS"))
            chosen[key] = (
                decision,
                worksite_workers,
                total_positions,
                to_abbr(cell(row, index, "WORKSITE_STATE")),
                str(cell(row, index, "WORKSITE_COUNTY") or ""),
                cell(row, index, "WORKSITE_POSTAL_CODE"),
                str(cell(row, index, "SOC_CODE") or ""),
                program,
            )
            kept += 1
        print(f"  LCA {quarter}: {kept:,} certified specialty rows")
    print("  LCA classes", dict(classes))
    return chosen


def add_lca(counts, fields, cases, lookup, zips):
    """Count certified positions at the primary worksite county, by occupation field."""
    unmatched = Counter()
    placed = Counter()
    missed = Counter()
    for _, workers, total, abbr, county, postal, soc, program in cases.values():
        count = total if total > 0 else workers
        if count <= 0:
            continue
        fips = locate(abbr, county, postal, lookup, zips)
        if fips:
            if program == "h1b":
                counts[fips][0] += count
            fields[fips][soc_field(soc)][program] += count
            placed[program] += count
        else:
            missed[program] += count
            unmatched[(abbr or "?", norm_county(county) or zip5(postal) or "?")] += count
    for program in ("h1b", "specialty"):
        got = placed[program]
        lost = missed[program]
        total = got + lost
        rate = got / total if total else 0
        print(f"  {program} placed {got:,.0f}, missed {lost:,.0f} ({rate:.1%})")
    print("  LCA unmatched", unmatched.most_common(8))


def certified_status(status):
    text = str(status or "").strip()
    return text.startswith("Determination Issued - Certification") or text.startswith(
        "Determination Issued - Partial Certification"
    )


def add_guest(counts, fields, filename, slot, program, workers_column, lookup, zips):
    index, iterator = rows_of(filename)
    matched = missed = 0
    unmatched = Counter()
    seen = {}
    for row in iterator:
        if not certified_status(cell(row, index, "CASE_STATUS")):
            continue
        case = str(cell(row, index, "CASE_NUMBER") or "")
        decision = str(cell(row, index, "DECISION_DATE") or "")
        previous = seen.get(case)
        if previous and previous >= decision:
            continue
        seen[case] = decision
        workers = as_int(cell(row, index, workers_column))
        if workers <= 0:
            continue
        abbr = to_abbr(cell(row, index, "WORKSITE_STATE"))
        county = str(cell(row, index, "WORKSITE_COUNTY") or "")
        postal = cell(row, index, "WORKSITE_POSTAL_CODE")
        soc = str(cell(row, index, "SOC_CODE") or "")
        fips = locate(abbr, county, postal, lookup, zips)
        if fips:
            counts[fips][slot] += workers
            fields[fips][soc_field(soc)][program] += workers
            matched += workers
        else:
            missed += workers
            unmatched[(abbr or "?", norm_county(county) or zip5(postal) or "?")] += workers
    total = matched + missed
    label = "H-2A" if program == "h2a" else "H-2B"
    print(f"  {label} {matched:,.0f} matched, {missed:,.0f} missed ({matched / total:.1%})")
    print(f"  {label} unmatched", unmatched.most_common(12))


def column_of(index, names):
    for name in names:
        if name in index:
            return name
    raise KeyError(f"none of {names} in {sorted(index)}")


def add_perm(fields, filename, lookup, zips):
    """Certified PERM applications, including ones later marked expired. One worker each."""
    index, iterator = rows_of(filename)
    soc_col = column_of(index, ("PWD_SOC_CODE", "SOC_CODE", "PW_SOC_CODE"))
    state_col = column_of(index, ("PRIMARY_WORKSITE_STATE", "WORKSITE_STATE", "JOB_INFO_WORK_STATE"))
    county_col = next(
        (name for name in ("PRIMARY_WORKSITE_COUNTY", "WORKSITE_COUNTY", "JOB_INFO_WORK_COUNTY") if name in index),
        None,
    )
    postal_col = column_of(
        index, ("PRIMARY_WORKSITE_POSTAL_CODE", "WORKSITE_POSTAL_CODE", "JOB_INFO_WORK_POSTAL_CODE")
    )
    worker_col = next(
        (name for name in ("TOTAL_WORKERS", "NBR_WORKERS", "NUMBER_OF_WORKERS") if name in index),
        None,
    )
    statuses = Counter()
    chosen = {}
    for row in iterator:
        status = str(cell(row, index, "CASE_STATUS") or "").strip()
        statuses[status] += 1
        if not status.lower().startswith("certified"):
            continue
        case = str(cell(row, index, "CASE_NUMBER") or "")
        decision = str(cell(row, index, "DECISION_DATE") or "")
        previous = chosen.get(case)
        if previous and previous[0] >= decision:
            continue
        workers = as_int(cell(row, index, worker_col)) if worker_col else 1
        if workers <= 0:
            workers = 1
        chosen[case] = (
            decision,
            to_abbr(cell(row, index, state_col)),
            str(cell(row, index, county_col) or "") if county_col else "",
            cell(row, index, postal_col),
            str(cell(row, index, soc_col) or ""),
            workers,
        )
    placed = missed = 0
    unmatched = Counter()
    for _, abbr, county, postal, soc, workers in chosen.values():
        fips = locate(abbr, county, postal, lookup, zips)
        if fips:
            fields[fips][soc_field(soc)]["perm"] += workers
            placed += workers
        else:
            missed += workers
            unmatched[(abbr or "?", norm_county(county) or zip5(postal) or "?")] += workers
    total = placed + missed
    print("  PERM statuses", dict(statuses))
    print(f"  PERM placed {placed:,.0f}, missed {missed:,.0f} ({placed / total:.1%})")
    print("  PERM unmatched", unmatched.most_common(8))


def main():
    print("loading counties, zips, population")
    lookup, fips_set = load_counties()
    zips = load_zips(fips_set)
    population = load_population(fips_set)
    print(f"  {len(lookup):,} county names, {len(zips):,} ZIPs, {len(population):,} populations")

    counts = defaultdict(lambda: [0, 0, 0])
    fields = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    print("LCA")
    add_lca(counts, fields, lca_cases(), lookup, zips)
    print("H-2A")
    add_guest(
        counts,
        fields,
        "H-2A_Disclosure_Data_FY2025_Q4.xlsx",
        1,
        "h2a",
        "TOTAL_WORKERS_H2A_CERTIFIED",
        lookup,
        zips,
    )
    print("H-2B")
    add_guest(
        counts,
        fields,
        "H-2B_Disclosure_Data_FY2025_Q4.xlsx",
        2,
        "h2b",
        "TOTAL_WORKERS_CERTIFIED",
        lookup,
        zips,
    )
    print("PERM")
    add_perm(fields, "PERM_Disclosure_Data_FY2025_Q4.xlsx", lookup, zips)

    out = {}
    for fips in fips_set | ({"11001"} if "11001" in population else set()):
        h1b, h2a, h2b = counts.get(fips, (0, 0, 0))
        pop = population.get(fips)
        if h1b or h2a or h2b or pop:
            out[fips] = [h1b, h2a, h2b, pop]
    print(
        "totals",
        {
            "h1b": sum(v[0] for v in out.values()),
            "h2a": sum(v[1] for v in out.values()),
            "h2b": sum(v[2] for v in out.values()),
            "counties": sum(1 for v in out.values() if v[0] or v[1] or v[2]),
        },
    )
    # State check against the published primary-worksite table is not exact: H-1B here includes
    # additional worksites. Print the ten largest H-1B counties.
    ranked = sorted(out.items(), key=lambda item: item[1][0], reverse=True)[:8]
    print("top H-1B", ranked)
    field_out = {}
    field_totals = Counter()
    program_totals = Counter()
    for fips, buckets in fields.items():
        kept = {}
        for field, programs in buckets.items():
            nonzero = {key: value for key, value in programs.items() if value}
            if not nonzero:
                continue
            kept[field] = nonzero
            for key, value in nonzero.items():
                field_totals[field] += value
                program_totals[key] += value
        if kept:
            field_out[fips] = kept
    print("program totals", dict(program_totals))
    print("field totals", dict(field_totals))
    for label, fips in (("Santa Clara", "06085"), ("Fresno", "06019"), ("King", "53033")):
        print(label, field_out.get(fips))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as handle:
        json.dump(out, handle, separators=(",", ":"))
        handle.write("\n")
    with open(FIELDS_OUT, "w") as handle:
        json.dump(field_out, handle, separators=(",", ":"))
        handle.write("\n")
    write_fips_index()
    stale = os.path.join(ROOT, "public", "data", "county-h1b-fields.json")
    if os.path.exists(stale):
        os.remove(stale)
        print("removed", stale)
    print("wrote", OUT, os.path.getsize(OUT))
    print("wrote", FIELDS_OUT, os.path.getsize(FIELDS_OUT))


def write_fips_index():
    """state slug -> county slug -> FIPS. Slugs match scripts/build-states-data.py."""
    index = {}
    for filename in sorted(os.listdir(COUNTY_DIR)):
        if not filename.endswith(".json"):
            continue
        abbr = filename[:2].upper()
        state_slug = STATE_SLUG[abbr]
        counties = {}
        for county in json.load(open(os.path.join(COUNTY_DIR, filename))):
            counties[slugify(county["name"])] = county["fips"]
        index[state_slug] = counties
    index["district-of-columbia"] = {"district-of-columbia": "11001"}
    with open(FIPS_OUT, "w") as handle:
        json.dump(index, handle, separators=(",", ":"))
        handle.write("\n")
    print("wrote", FIPS_OUT, os.path.getsize(FIPS_OUT))


if __name__ == "__main__":
    main()

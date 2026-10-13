"""
Certified foreign-worker positions at colleges and universities, FY 2025.

Writes:
  src/data/schools.json
    [{id, name, city, state}] for the Where you stand search box.
  public/data/school-visas.json
    tax id -> {h1b, specialty, perm, fields, jobs}
    fields is the work-field id -> {program: count}
    jobs is [SOC title, field id, count], largest first.
    Zeros are omitted.

An employer is included when the filing's NAICS code starts with 6112 (junior
colleges) or 6113 (colleges, universities, and professional schools). Hospitals
and physician groups that put "university" in the name but file under a hospital
code are left out.

Counting matches scripts/build-county-visas.py. LCA rows are the latest Certified
filing for each case and program. Positions are TOTAL_WORKER_POSITIONS, or the
worksite worker count when that is blank. PERM rows are certified applications,
including ones later marked expired, one worker each. A certified slot is not a
person admitted.

Sources, cached in scripts/.cache:
  DOL OFLC disclosure data, FY 2025.
  https://www.dol.gov/agencies/eta/foreign-labor/performance
"""

import json
import os
import re
from collections import Counter, defaultdict

from python_calamine import CalamineWorkbook

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache")
SCHOOLS_OUT = os.path.join(ROOT, "src", "data", "schools.json")
VISAS_OUT = os.path.join(ROOT, "public", "data", "school-visas.json")

# SOC major group -> field id. Same map as build-county-visas.py.
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

SMALL_WORDS = {"of", "the", "and", "for", "at", "in", "de", "du", "a", "an"}
PROGRAMS = ("h1b", "specialty", "perm")


def rows_of(name):
    path = os.path.join(CACHE, name)
    sheet = CalamineWorkbook.from_path(path).get_sheet_by_index(0)
    iterator = sheet.iter_rows()
    header = [str(cell) for cell in next(iterator)]
    index = {column: i for i, column in enumerate(header)}
    return index, iterator


def cell(row, index, column):
    position = index.get(column)
    if position is None or position >= len(row):
        return ""
    return row[position]


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


def digits(value):
    """Digits of a code. A float such as 611310.0 is taken as an integer first."""
    if isinstance(value, float):
        if value != value:
            return ""
        value = int(value)
    elif isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def is_school(naics):
    return naics.startswith("6112") or naics.startswith("6113")


def fein_of(value):
    code = digits(value)
    if len(code) > 9:
        code = code[:9]
    if not code:
        return ""
    return code.zfill(9)


def soc_field(code):
    return SOC_FIELD.get(digits(code)[:2], "other")


def display_name(name):
    """Title-case an all-caps legal name. Mixed-case names are kept."""
    text = re.sub(r"\s+", " ", str(name or "")).strip()
    letters = [ch for ch in text if ch.isalpha()]
    if not text or not letters or not all(ch.isupper() for ch in letters):
        return text
    words = []
    for index, word in enumerate(text.split(" ")):
        lower = word.lower()
        if index and lower.strip(".,") in SMALL_WORDS:
            words.append(lower)
        else:
            words.append(lower[:1].upper() + lower[1:] if lower else lower)
    return " ".join(words)


def lca_program(visa):
    text = str(visa or "").strip()
    if text == "H-1B":
        return "h1b"
    if text.startswith("H-1B1") or text.startswith("E-3"):
        return "specialty"
    return None


def bump(schools, fein, name, city, state, program, soc_code, soc_title, count):
    if count <= 0 or not fein:
        return
    school = schools[fein]
    school["name"][name] += count
    if city:
        school["city"][city] += count
    if state:
        school["state"][state] += count
    school["programs"][program] += count
    field = soc_field(soc_code)
    school["fields"][field][program] += count
    title = re.sub(r"\s+", " ", str(soc_title or "")).strip() or "Unspecified occupation"
    school["jobs"][(title, field)] += count


def add_lca(schools):
    chosen = {}
    for quarter in ("Q1", "Q2", "Q3", "Q4"):
        index, iterator = rows_of(f"LCA_Disclosure_Data_FY2025_{quarter}.xlsx")
        kept = 0
        for row in iterator:
            status = str(cell(row, index, "CASE_STATUS") or "")
            program = lca_program(cell(row, index, "VISA_CLASS"))
            if status != "Certified" or not program:
                continue
            naics = digits(cell(row, index, "NAICS_CODE"))
            if not is_school(naics):
                continue
            case = str(cell(row, index, "CASE_NUMBER") or "")
            decision = str(cell(row, index, "DECISION_DATE") or "")
            key = (case, program)
            previous = chosen.get(key)
            if previous and previous[0] > decision:
                continue
            worksite_workers = as_int(cell(row, index, "WORKSITE_WORKERS"))
            total_positions = as_int(cell(row, index, "TOTAL_WORKER_POSITIONS"))
            count = total_positions if total_positions > 0 else worksite_workers
            chosen[key] = (
                decision,
                fein_of(cell(row, index, "EMPLOYER_FEIN")),
                str(cell(row, index, "EMPLOYER_NAME") or ""),
                str(cell(row, index, "EMPLOYER_CITY") or ""),
                str(cell(row, index, "EMPLOYER_STATE") or "").strip().upper(),
                program,
                str(cell(row, index, "SOC_CODE") or ""),
                str(cell(row, index, "SOC_TITLE") or ""),
                count,
            )
            kept += 1
        print(f"  LCA {quarter}: {kept:,} certified school rows")
    for _, fein, name, city, state, program, soc, title, count in chosen.values():
        bump(schools, fein, name, city, state, program, soc, title, count)
    print(f"  LCA school cases {len(chosen):,}")


def add_perm(schools):
    index, iterator = rows_of("PERM_Disclosure_Data_FY2025_Q4.xlsx")
    chosen = {}
    for row in iterator:
        status = str(cell(row, index, "CASE_STATUS") or "").strip()
        if not status.lower().startswith("certified"):
            continue
        naics = digits(cell(row, index, "EMP_NAICS"))
        if not is_school(naics):
            continue
        case = str(cell(row, index, "CASE_NUMBER") or "")
        decision = str(cell(row, index, "DECISION_DATE") or "")
        previous = chosen.get(case)
        if previous and previous[0] >= decision:
            continue
        chosen[case] = (
            decision,
            fein_of(cell(row, index, "EMP_FEIN")),
            str(cell(row, index, "EMP_BUSINESS_NAME") or ""),
            str(cell(row, index, "EMP_CITY") or ""),
            str(cell(row, index, "EMP_STATE") or "").strip().upper(),
            str(cell(row, index, "PWD_SOC_CODE") or ""),
            str(cell(row, index, "PWD_SOC_TITLE") or ""),
        )
    for _, fein, name, city, state, soc, title in chosen.values():
        bump(schools, fein, name, city, state, "perm", soc, title, 1)
    print(f"  PERM school applications {len(chosen):,}")


def mode(counter):
    if not counter:
        return ""
    return counter.most_common(1)[0][0]


def compact_programs(counter):
    return {program: counter[program] for program in PROGRAMS if counter[program]}


def main():
    schools = defaultdict(
        lambda: {
            "name": Counter(),
            "city": Counter(),
            "state": Counter(),
            "programs": Counter(),
            "fields": defaultdict(Counter),
            "jobs": Counter(),
        }
    )
    print("LCA")
    add_lca(schools)
    print("PERM")
    add_perm(schools)

    directory = []
    visas = {}
    for fein, school in schools.items():
        raw_name = mode(school["name"])
        name = display_name(raw_name)
        city = display_name(mode(school["city"]))
        state = mode(school["state"])
        if not name:
            continue
        directory.append({"id": fein, "name": name, "city": city, "state": state})
        fields = {}
        for field, programs in school["fields"].items():
            packed = compact_programs(programs)
            if packed:
                fields[field] = packed
        jobs = [
            [title, field, count]
            for (title, field), count in school["jobs"].most_common()
            if count
        ]
        visas[fein] = {
            **compact_programs(school["programs"]),
            "fields": fields,
            "jobs": jobs,
        }

    directory.sort(key=lambda row: (row["name"].casefold(), row["state"], row["city"], row["id"]))
    os.makedirs(os.path.dirname(SCHOOLS_OUT), exist_ok=True)
    with open(SCHOOLS_OUT, "w", encoding="utf-8") as handle:
        json.dump(directory, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")
    with open(VISAS_OUT, "w", encoding="utf-8") as handle:
        json.dump(visas, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")

    positions = sum(sum(row[program] for program in PROGRAMS if program in row) for row in visas.values())
    print(f"  {len(directory):,} schools, {positions:,} certified positions")
    for needle in ("Stanford", "Michigan"):
        hits = [row for row in directory if needle.lower() in row["name"].lower()]
        for row in hits[:3]:
            record = visas[row["id"]]
            print(
                f"  {row['name']}, {row['city']}, {row['state']}: "
                f"h1b={record.get('h1b', 0)} specialty={record.get('specialty', 0)} "
                f"perm={record.get('perm', 0)} jobs={len(record['jobs'])}"
            )


if __name__ == "__main__":
    main()

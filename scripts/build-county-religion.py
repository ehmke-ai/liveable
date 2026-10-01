"""
Generates public/data/county-religion.json for the religion view of the US map: each county's
religious adherents by tradition, as a share of its population, by census year:

  {"1990": {fips: [evangelical, mainline, blackProtestant, catholic, orthodox, lds, jewish, muslim, other]}, ...}
  (% of population, one decimal; whatever is left is unclaimed — not an adherent of any group counted)

Sources (cached in scripts/.cache):
  2020  U.S. Religion Census: Religious Congregations & Membership Study (ASARB),
        2020_USRC_Group_Detail.xlsx ("2020 Group by County") and 2020_USRC_Summaries.xlsx (population)
  2010  U.S. Religion Census 2010, County File (ASARB, via the ARDA)
  2000  Religious Congregations and Membership Study 2000, Counties File (ASARB, via the ARDA)
  1990  Churches and Church Membership in the United States 1990, Counties (Glenmary Research
        Center, via the ARDA)
The ARDA's downloads are fetched from the Internet Archive's copies, as the ARDA site itself is down.

Each study reports a few hundred groups. Each is sorted into a tradition, following the ASARB/Pew
families: by group code where the file gives one (1990, 2020), otherwise by matching its name to
the 2020 list; groups named explicitly in TRADITION, then by name (Orthodox, Judaism, ...), and
every remaining Christian body is Evangelical Protestant, as the Religion Census itself classes
non-denominational churches. Groups that reported congregations but no adherent count add nothing.

Coverage differs by year: 1990 has a Black Baptists estimate but no Muslim one; 2000 has no
historically Black denominations at all; Muslims are first estimated in 2000.

Adherents are counted where their congregation meets, so a county with a large church drawing from
its neighbours can exceed 100%; the map clamps those to the deepest shade.

FIPS codes are moved onto the county shapes the map draws (MERGED): Alaska's Valdez-Cordova
(02261) split in 2019 and its successors are summed back into it; older codes for counties since
renamed or folded into a neighbour are moved onto the current one.
"""

import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache"
OUT = ROOT / "public" / "data" / "county-religion.json"
USRC = "https://www.usreligioncensus.org/sites/default/files/2023-06/"
DETAIL = "2020_USRC_Group_Detail.xlsx"
SUMMARY = "2020_USRC_Summaries.xlsx"

# The ARDA's files, as captured by the Internet Archive: (capture timestamp, ARDA file name)
ARDA = "http://www.thearda.com/download/download.aspx?file="
FILES_1990 = "Churches and Church Membership in the United States, 1990 (Counties)"
FILES_2000 = "Religious Congregations and Membership Study, 2000 (Counties File)"
FILES_2010 = "U.S. Religion Census Religious Congregations and Membership Study, 2010 (County File)"
CAPTURES = {
    f"{FILES_1990}.DAT": ("20131030191315", "%20"),
    f"{FILES_1990}.COL": ("20131030191319", "%20"),
    f"{FILES_1990} cb_descr.TXT": ("20131030191314", "%20"),
    f"{FILES_2000}.DAT": ("20150827152435", "%20"),
    f"{FILES_2000}.COL": ("20101112112507", "+"),
    f"{FILES_2000} cb_descr.TXT": ("20120412043742", "+"),
    f"{FILES_2010}.XLSX": ("20180206111253", "+"),
    f"{FILES_2010} cb_descr.TXT": ("20180206103910", "+"),
}

# FIPS codes the map draws under another code
MERGED = {
    "02063": "02261",  # Chugach -> Valdez-Cordova (split 2019)
    "02066": "02261",  # Copper River -> Valdez-Cordova
    "12025": "12086",  # Dade -> Miami-Dade (renumbered 1997)
    "46113": "46102",  # Shannon -> Oglala Lakota (renamed 2015)
    "02270": "02158",  # Wade Hampton -> Kusilvak (renamed 2015)
    "51560": "51005",  # Clifton Forge city -> Alleghany County (2001)
    "51780": "51083",  # South Boston city -> Halifax County (1995)
    "51515": "51019",  # Bedford city -> Bedford County (2013)
}

TRADITIONS = [
    "evangelical",
    "mainline",
    "blackProtestant",
    "catholic",
    "orthodox",
    "lds",
    "jewish",
    "muslim",
    "other",
]

# Group code -> tradition, for groups whose name doesn't give it away
TRADITION = {
    # Catholic
    "081": "catholic",  # Catholic Church
    "FFP": "catholic",  # Ecumenical Catholic Communion
    "439": "catholic",  # United Catholic Church
    # Latter-day Saints
    "151": "lds",
    # Muslim
    "267": "muslim",
    # Mainline Protestant
    "449": "mainline",  # United Methodist Church
    "207": "mainline",  # Evangelical Lutheran Church in America
    "193": "mainline",  # Episcopal Church
    "355": "mainline",  # Presbyterian Church (U.S.A.)
    "019": "mainline",  # American Baptist Churches in the USA
    "443": "mainline",  # United Church of Christ
    "093": "mainline",  # Christian Church (Disciples of Christ)
    "371": "mainline",  # Reformed Church in America
    "157": "mainline",  # Church of the Brethren
    "293": "mainline",  # Moravian Church in America--Northern Province
    "295": "mainline",  # Moravian Church in America--Southern Province
    "292": "mainline",  # Moravian Church in America--Alaska Province
    "175": "mainline",  # National Association of Congregational Christian Churches
    "176": "mainline",  # Congregational Christian Churches, Additional
    "391": "mainline",  # Friends General Conference
    "225": "mainline",  # Friends United Meeting
    "393": "mainline",  # Friends General Conference and Friends United Meeting
    "338": "mainline",  # Independent Yearly Meetings of Friends
    "390": "mainline",  # Conservative Yearly Meeting of Friends
    "389": "mainline",  # Unaffiliated Friends Meetings
    "290": "mainline",  # Metropolitan Community Churches
    "239": "mainline",  # Swedenborgian Church
    "405": "mainline",  # Schwenkfelder Church
    "262": "mainline",  # International Council of Community Churches
    "012": "mainline",  # Alliance of Baptists
    # Black Protestant
    "003": "blackProtestant",  # African Methodist Episcopal Church
    "005": "blackProtestant",  # African Methodist Episcopal Zion Church
    "101": "blackProtestant",  # Christian Methodist Episcopal Church
    "302": "blackProtestant",  # National Missionary Baptist Convention
    "300": "blackProtestant",  # National Baptist Convention, USA
    "301": "blackProtestant",  # National Baptist Convention of America
    "364": "blackProtestant",  # Progressive National Baptist Convention
    "141": "blackProtestant",  # Church of God in Christ
    "232": "blackProtestant",  # Full Gospel Baptist Church Fellowship
    "155": "blackProtestant",  # Church of Our Lord Jesus Christ of the Apostolic Faith
    "D71": "blackProtestant",  # Pentecostal Assemblies of the World
    "F58": "blackProtestant",  # United House of Prayer
    "E54": "blackProtestant",  # Bible Way Church of Our Lord Jesus Christ World Wide
    "445": "blackProtestant",  # United Holy Church of America
    "304": "blackProtestant",  # National Primitive Baptist Convention
    "187": "blackProtestant",  # Cumberland Presbyterian Church in America
    "384": "blackProtestant",  # Reformed Zion Union Apostolic Church
    "110": "blackProtestant",  # Church of Christ (Holiness), U.S.A.
    "C22": "blackProtestant",  # Church of God and Saints of Christ
    "A47": "blackProtestant",  # Church of the Living God (CWFF)
    "D59": "blackProtestant",  # Church of the Living God: Pillar and Ground of the Truth
    "D92": "blackProtestant",  # House of God, Holy Church of the Living God
    "D83": "blackProtestant",  # Christ's Sanctified Holy Church
    "FGV": "blackProtestant",  # Union American Methodist Episcopal Church
    "F57": "blackProtestant",  # United American Free Will Baptist Denomination
    "122": "blackProtestant",  # Church of God by Faith
    # Orthodox, beyond those with "Orthodox" in the name
    "050": "orthodox",  # Armenian Church of North America
    "049": "orthodox",  # Armenian Apostolic Church of America
    "F28": "orthodox",  # Malankara Mar Thoma Church
    "FFL": "orthodox",  # Knanaya Churches in the USA
    # Other religions, and Christian bodies outside the Protestant families
    "272": "other",  # Jehovah's Witnesses
    "435": "other",  # Unitarian Universalist Association
    "056": "other",  # Baha'i Faith USA
    "015": "other",  # Amana Church Society
    "111": "other",  # Church of Christ, Scientist
    "124": "other",  # Unity Churches
    "173": "other",  # Community of Christ
    "149": "other",  # Church of Jesus Christ (Bickertonites)
    "233": "other",  # General Church of the New Jerusalem
    "303": "other",  # National Spiritualist Association of Churches
    "904": "other",  # American Ethical Union
    "FER": "other",  # Unification Church
    "087": "other",  # Christadelphian
    "FGQ": "other",  # Twelve Tribes
}

# Name patterns for the groups not listed above, checked in order
# Name patterns for groups without a listed code, checked in order (case-insensitive). Older
# studies name some groups differently, or report estimates the Religion Census later split up.
BY_NAME = [
    (r"Reorganized Church of Jesus Christ", "other"),  # Community of Christ's old name
    (r"Latter-day Saints", "lds"),
    (r"Black Baptists", "blackProtestant"),
    (r"Judaism|Jewish", "jewish"),
    (r"Muslim|Islam", "muslim"),
    (r"^Catholic Church$", "catholic"),
    (r"Orthodox (Church|Diocese|Archdiocese|Parishes|Catholic|Christian|Syrian|Greek)|Orthodox$|Coptic|Antiochian|Armenian Apostolic|Assyrian Church of the East", "orthodox"),
    (r"Hindu|Buddhis|Sikh|Jain|Shinto|Tao$|Taoist|Vedanta|Zoroastrian|Baha'?i", "other"),
    (r"Friends \(Quakers\)|Friends General Conference|Friends United Meeting|Conservative Yearly Meeting", "mainline"),
    (r"Moravian|Metropolitan Community Churches|^Congregational Christian Churches|Community Church", "mainline"),
    (r"Jehovah|Unitarian|Christian Science|Church of Christ, Scientist|\bUnity\b", "other"),
]


def normalize(name):
    name = name.lower().replace("&", "and")
    name = re.sub(r"\b(the|inc|incorporated)\b", "", name)
    return re.sub(r"[^a-z0-9]+", "", name)


def classifier(code_by_name):
    """tradition_of(code, name), where `code` may be None and is then looked up from `name`"""

    def tradition_of(code, name):
        if code is None:
            code = code_by_name.get(normalize(name))
        if code in TRADITION:
            return TRADITION[code]
        for pattern, tradition in BY_NAME:
            if re.search(pattern, name, re.IGNORECASE):
                return tradition
        return "evangelical"

    return tradition_of


NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_ID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def sheet_rows(path, sheet_name):
    """Rows of one sheet as {column letter: value}, read with the standard library."""
    z = zipfile.ZipFile(path)
    workbook = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    targets = {r.get("Id"): r.get("Target") for r in rels}
    rid = next(s.get(REL_ID) for s in workbook.find("m:sheets", NS) if s.get("name") == sheet_name)
    target = "xl/" + targets[rid].removeprefix("/xl/").removeprefix("/")
    strings = [
        "".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t"))
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS)
    ]
    for _, el in ET.iterparse(z.open(target)):
        if not el.tag.endswith("}row"):
            continue
        row = {}
        for c in el.findall("m:c", NS):
            col = re.match(r"[A-Z]+", c.get("r")).group()
            v = c.find("m:v", NS)
            if v is None:
                row[col] = None
            elif c.get("t") == "s":
                row[col] = strings[int(v.text)]
            else:
                row[col] = v.text
        yield row
        el.clear()


def cached(name):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / re.sub(r"[^A-Za-z0-9.]+", "_", name)
    if not path.exists():
        if name in CAPTURES:
            ts, space = CAPTURES[name]
            url = ARDA + urllib.parse.quote(name, safe="(),").replace("%20", space)
            urllib.request.urlretrieve(f"https://web.archive.org/web/{ts}id_/{url}", path)
        else:
            urllib.request.urlretrieve(USRC + name, path)
    return path


def map_fips(fips):
    fips = str(fips).strip().zfill(5)
    return MERGED.get(fips, fips)


def fixed_width(stem):
    """Rows of an ARDA fixed-width file as {variable: text}, with each variable's description"""
    columns = []
    for line in cached(f"{stem}.COL").read_text(errors="replace").splitlines():
        m = re.match(r"\s*\d+\)\s*(\S+):\s*(\d+)(?:-(\d+))?", line)
        if m:
            columns.append((m[1], int(m[2]) - 1, int(m[3] or m[2])))
    text = cached(f"{stem} cb_descr.TXT").read_text(errors="replace").replace("\r", "")
    descr = dict(re.findall(r"^\d+\)\s*(\S+)\n(.+)$", text, re.MULTILINE))
    rows = (
        {name: line[a:b].strip() for name, a, b in columns}
        for line in cached(f"{stem}.DAT").read_text(errors="replace").splitlines()
        if line.strip()
    )
    return rows, descr


def number(text):
    try:
        return float(text)
    except (TypeError, ValueError):
        return 0.0


class Year:
    def __init__(self):
        self.population = defaultdict(int)
        self.adherents = defaultdict(lambda: [0.0] * len(TRADITIONS))
        self.unmatched = defaultdict(float)

    def add(self, fips, tradition, count):
        self.adherents[fips][TRADITIONS.index(tradition)] += count

    def shares(self):
        return {
            fips: [round(n / self.population[fips] * 100, 1) for n in counts]
            for fips, counts in sorted(self.adherents.items())
            if self.population.get(fips)
        }


def year_2020(tradition_of):
    year = Year()
    for row in sheet_rows(cached(SUMMARY), "2020 County Summary"):
        fips = row.get("A")
        if fips and fips.isdigit() and row.get("D"):
            year.population[map_fips(fips)] += int(float(row["D"]))
    for row in sheet_rows(cached(DETAIL), "2020 Group by County"):
        fips, code, name, count = row.get("A"), row.get("D"), row.get("E"), row.get("G")
        if fips and fips.isdigit() and count:
            year.add(map_fips(fips), tradition_of(code, name), float(count))
    return year


def year_2010(tradition_of):
    year = Year()
    rows = sheet_rows(cached(f"{FILES_2010}.XLSX"), "Data")
    header = next(rows)
    names = {col: var for col, var in header.items() if var}
    # Groups are named in the codebook; read the names from the column descriptions there
    descr = group_names_2010()
    for row in rows:
        values = {names[c]: v for c, v in row.items() if c in names}
        fips = map_fips(int(float(values["FIPS"])))
        year.population[fips] += int(float(values.get("POP2010") or 0))
        for var, name in descr.items():
            count = number(values.get(var))
            if count:
                year.add(fips, tradition_of(None, name), count)
    return year


def group_names_2010():
    """Adherent-count variables of the 2010 file -> group name, leaving out the tradition totals"""
    text = cached(f"{FILES_2010} cb_descr.TXT").read_text(errors="replace").replace("\r", "")
    out = {}
    for var, d in re.findall(r"^\d+\)\s*(\S+)\n(.+)$", text, re.MULTILINE):
        if var.endswith("ADH") and not d.startswith(
            ("All denominations", "Evangelical Protestant--", "Black Protestant--",
             "Mainline Protestant--", "Catholic--", "Orthodox--", "Other--")
        ):
            out[var] = d.rsplit("--", 1)[0]
    return out


def year_2000(tradition_of):
    year = Year()
    rows, descr = fixed_width(FILES_2000)
    groups = {
        var: d.rsplit("--", 1)[0]
        for var, d in descr.items()
        if re.search(r"--Number of Adherents", d, re.IGNORECASE)
    }
    for row in rows:
        fips = map_fips(row["FIP"])
        year.population[fips] += int(number(row["POP200"]))
        for var, name in groups.items():
            count = number(row.get(var))
            if count:
                year.add(fips, tradition_of(None, name), count)
    return year


def year_1990(tradition_of):
    year = Year()
    rows, descr = fixed_width(FILES_1990)
    groups = {}
    for var, d in descr.items():
        m = re.match(r"Number of Adherents \(1990\)--(.+)--Denomination Code (\d+)", d)
        if var.endswith("@A") and m:
            groups[var] = (m[2].zfill(3), m[1].title())
    for row in rows:
        fips = map_fips(row["FIPS"])
        year.population[fips] += int(number(row["TOTPOP"]))
        for var, (code, name) in groups.items():
            count = number(row.get(var))
            if count:
                year.add(fips, tradition_of(code, name), count)
    return year


def main():
    code_by_name = {}
    for row in sheet_rows(cached(DETAIL), "2020 Group by Nation"):
        if row.get("A") and row.get("B") and row["A"] != "Group Code":
            code_by_name[normalize(row["B"])] = row["A"]
    tradition_of = classifier(code_by_name)

    out = {}
    for label, build in [
        ("1990", year_1990),
        ("2000", year_2000),
        ("2010", year_2010),
        ("2020", year_2020),
    ]:
        out[label] = build(tradition_of).shares()
        print(f"{label}: {len(out[label])} counties")
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

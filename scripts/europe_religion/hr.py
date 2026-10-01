"""Croatia: population by religion, by county (zupanija = NUTS3, NUTS 2021 codes), Census 2021.

Source: DZS (Croatian Bureau of Statistics), "Popis stanovnistva, kucanstava i
stanova 2021. - Stanovnistvo po gradovima/opcinama", Tab. 2 "Stanovnistvo prema
vjeri po gradovima/opcinama" (county subtotal rows are used directly), refined
with Tab. 5 (religious community of persons who answered just "Christian" /
"believer"); see REALLOCATE_COMMUNITY.
"""
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

SOURCE = "Croatian Bureau of Statistics (DZS), Census 2021 (Population by religion, Tab. 2)"
YEAR = 2021
URL = "https://podaci.dzs.hr/media/td3jvrbu/popis_2021-stanovnistvo_po_gradovima_opcinama.xlsx"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

NUTS = {
    "Bjelovarsko-bilogorska": "HR021", "Virovitičko-podravska": "HR022",
    "Požeško-slavonska": "HR023", "Brodsko-posavska": "HR024", "Osječko-baranjska": "HR025",
    "Vukovarsko-srijemska": "HR026", "Karlovačka": "HR027", "Sisačko-moslavačka": "HR028",
    "Primorsko-goranska": "HR031", "Ličko-senjska": "HR032", "Zadarska": "HR033",
    "Šibensko-kninska": "HR034", "Splitsko-dalmatinska": "HR035", "Istarska": "HR036",
    "Dubrovačko-neretvanska": "HR037", "Grad Zagreb": "HR050", "Međimurska": "HR061",
    "Varaždinska": "HR062", "Koprivničko-križevačka": "HR063", "Krapinsko-zagorska": "HR064",
    "Zagrebačka": "HR065",
}

# header prefix (first line, lowercased) -> group. Percentage columns are skipped.
GROUPS = [
    ("katolici", "catholic"),
    ("pravoslavci", "orthodox"),
    ("protestanti", "protestant"),
    ("ostali kršćani", "otherChristian"),  # other / denomination-unspecified Christians
    ("muslimani", "muslim"),
    ("židovi", "jewish"),
    ("istočne religije", "other"),
    ("ostale religije", "other"),
    ("agnostici", "none"),
    ("nisu vjernici", "none"),
    ("ne izjašnjavaju", "notStated"),
    ("nepoznato", "notStated"),
]

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def _read_xlsx(path, sheet_name):
    z = zipfile.ZipFile(path)
    ss = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(NS + "si"):
            ss.append("".join(t.text or "" for t in si.iter(NS + "t")))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rmap = {r.get("Id"): r.get("Target") for r in rels}
    sh = next(s for s in wb.find(NS + "sheets") if s.get("name") == sheet_name)
    tgt = rmap[sh.get(RNS)].lstrip("/")
    if not tgt.startswith("xl/"):
        tgt = "xl/" + tgt
    rows = []
    for row in ET.fromstring(z.read(tgt)).iter(NS + "row"):
        out = {}
        for c in row.iter(NS + "c"):
            col = re.match(r"[A-Z]+", c.get("r")).group()
            ci = 0
            for ch in col:
                ci = ci * 26 + ord(ch) - 64
            v = c.find(NS + "v")
            t = c.get("t")
            if t == "s" and v is not None:
                val = ss[int(v.text)]
            elif t == "inlineStr":
                val = "".join(x.text or "" for x in c.iter(NS + "t"))
            else:
                val = v.text if v is not None else None
            out[ci - 1] = val
        rows.append([out.get(i) for i in range(max(out) + 1)] if out else [])
    return rows


def _num(v):
    v = (v or "").strip()
    if v in ("", "-", "*"):
        return 0
    return int(float(v))


# Tab. 5: persons whose answer to the religion question was just "Christian"
# (counted in "Ostali krscani") or "believer" (counted in "Ostale religije...")
# were also asked for their church / religious community. With
# REALLOCATE_COMMUNITY = True these people are moved into the group of the
# community they named (87% of the "Christians" named the Catholic Church);
# those naming no community / no answer stay where the religion question put them.
REALLOCATE_COMMUNITY = True

# keyword (lowercased, matched against the English part of the header) -> group; first match wins
COMMUNITY_RULES = [
    ("old catholic", "otherChristian"),
    ("liberal catholic", "otherChristian"),
    ("catholic church", "catholic"),
    ("orthodox", "orthodox"),
    ("jehovah", "otherChristian"),
    ("latter-day", "otherChristian"),
    ("new apostolic", "otherChristian"),
    ("spiritual church", "otherChristian"),
    ("islamic", "muslim"),
    ("jewish", "jewish"),
    ("krishna", "other"),
    ("buddhist", "other"),
    ("baha", "other"),
    ("hindu", "other"),
    ("scientology", "other"),
    ("universal life", "other"),
    ("not a member", None),
    ("no answer", None),
    ("total", None),
    # everything else in this table is an evangelical / Reformation church:
    # Word of Life, Adventist, Pentecostal, Baptist, Evangelical (Lutheran),
    # Church of Christ, Church of God, Reformed/Calvinist, Methodist,
    # Waldensian, Nazarene, Full Gospel, Joyful News, Disciples of Christ ...
    ("", "protestant"),
]


def _reallocate(f, out):
    rows = _read_xlsx(f, "5.")
    hdr_i = next(i for i, r in enumerate(rows) if r and r[0] == "Županija")
    hdr = rows[hdr_i]
    cols = {}
    start = next(ci for ci, h in enumerate(hdr) if h and h.lower().startswith("ukupno")) + 1
    for ci in range(start, len(hdr)):
        h = hdr[ci]
        if not h:
            continue
        en = (h.split("\n", 1)[-1] if "\n" in h else h).lower()
        for kw, g in COMMUNITY_RULES:
            if kw in en:
                if g:
                    cols[ci] = g
                break
    for r in rows[hdr_i + 1:]:
        if not r or not r[0] or (len(r) > 4 and (r[4] or "").strip()):
            continue
        code = NUTS.get(r[0].strip())
        label = (r[5] or "").lower() if len(r) > 5 else ""
        if not code or not label.startswith("od toga"):
            continue
        src = "otherChristian" if "kršćani" in label else "other"
        d = out[code]
        for ci, g in cols.items():
            n = _num(r[ci] if ci < len(r) else None)
            if n and g != src:
                d[src] = d.get(src, 0) - n
                d[g] = d.get(g, 0) + n
        if d.get(src, 0) < 0:
            raise ValueError(f"negative {src} after reallocation in {code}")


def load(cache: Path) -> dict:
    cache = Path(cache)
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / "hr_popis_2021-stanovnistvo_po_gradovima_opcinama.xlsx"
    if not f.exists():
        req = urllib.request.Request(URL, headers={"User-Agent": UA})
        f.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    rows = _read_xlsx(f, "2.")
    hdr_i = next(i for i, r in enumerate(rows) if r and r[0] == "Županija")
    hdr = rows[hdr_i]
    total_col = None
    colmap = {}
    for ci, h in enumerate(hdr):
        if not h:
            continue
        first = h.split("\n")[0].strip().lower()
        if "%" in first:
            continue
        if first.startswith("ukupno"):
            total_col = ci
            continue
        for pref, g in GROUPS:
            if first.startswith(pref):
                colmap[ci] = g
                break
    if total_col is None or len(colmap) != len(GROUPS):
        raise ValueError(f"unexpected header layout: {hdr}")
    out = {}
    for r in rows[hdr_i + 1:]:
        # county subtotal rows: county name in col 0, no unit type in col 1
        if not r or not r[0] or (len(r) > 1 and r[1]):
            continue
        code = NUTS.get(r[0].strip())
        if not code:
            continue
        d = {"total": _num(r[total_col])}
        for ci, g in colmap.items():
            d[g] = d.get(g, 0) + _num(r[ci] if ci < len(r) else None)
        out[code] = d
    missing = set(NUTS.values()) - set(out)
    if missing:
        raise ValueError(f"missing counties: {sorted(missing)}")
    if REALLOCATE_COMMUNITY:
        _reallocate(f, out)
    return {c: {k: v for k, v in d.items() if v or k == "total"} for c, d in out.items()}

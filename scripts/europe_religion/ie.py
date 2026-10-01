"""Ireland: religion by NUTS 3 region, Census of Population 2022.

Source: CSO PxStat table F5051 "Population usually resident and present in the State by
sex, religion, county and city" (2011/2016/2022), JSON-stat 2.0 via the PxStat REST API.
Published at county / city-and-county (local authority) level; aggregated to NUTS 2021
NUTS 3 regions (which are exact unions of local authorities in Ireland):

  IE041 Border     : Cavan, Donegal, Leitrim, Monaghan, Sligo
  IE042 West       : Galway City, Galway County, Mayo, Roscommon
  IE051 Mid-West   : Clare, Limerick City and County, Tipperary
  IE052 South-East : Carlow, Kilkenny, Waterford City and County, Wexford
  IE053 South-West : Cork City and Cork County, Kerry
  IE061 Dublin     : Dublin City, Dún Laoghaire-Rathdown, Fingal, South Dublin
  IE062 Mid-East   : Kildare, Louth, Meath, Wicklow
  IE063 Midland    : Laois, Longford, Offaly, Westmeath

Universe: usually resident and present population, all ages.
"""
import json
import urllib.request
from pathlib import Path

SOURCE = "CSO Ireland, Census of Population 2022 (PxStat table F5051)"
YEAR = 2022

URL = "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/F5051/JSON-stat/2.0/en"

NUTS_OF = {
    "Cavan": "IE041", "Donegal": "IE041", "Leitrim": "IE041", "Monaghan": "IE041", "Sligo": "IE041",
    "Galway City": "IE042", "Galway County": "IE042", "Mayo": "IE042", "Roscommon": "IE042",
    "Clare": "IE051", "Limerick City and County": "IE051", "Tipperary": "IE051",
    "Carlow": "IE052", "Kilkenny": "IE052", "Waterford City and County": "IE052", "Wexford": "IE052",
    "Cork City and Cork County": "IE053", "Kerry": "IE053",
    "Dublin City": "IE061", "Dún Laoghaire-Rathdown": "IE061", "Fingal": "IE061", "South Dublin": "IE061",
    "Kildare": "IE062", "Louth": "IE062", "Meath": "IE062", "Wicklow": "IE062",
    "Laois": "IE063", "Longford": "IE063", "Offaly": "IE063", "Westmeath": "IE063",
}

# Religion codes (C02712V03280) -> group
GROUP = {
    "01": "catholic",        # Roman Catholic
    "25": "catholic",        # Lapsed (Roman) Catholic -- self-described; kept with Catholic
    "04": "protestant",      # Church of Ireland, England, Anglican, Episcopalian
    "05": "protestant",      # Protestant
    "09": "protestant",      # Presbyterian
    "11": "protestant",      # Methodist, Wesleyan
    "12": "protestant",      # Apostolic or Pentecostal
    "15": "protestant",      # Lutheran
    "16": "protestant",      # Evangelical
    "18": "protestant",      # Baptist
    "38": "protestant",      # Born Again Christian
    "10": "orthodox",        # Orthodox (Greek, Coptic, Russian)
    "17": "otherChristian",  # Jehovah's Witness
    "59": "otherChristian",  # Christian (not specified)
    "60": "muslim",          # Islam
    "13": "other",           # Buddhist
    "14": "other",           # Hindu
    "20": "other",           # Pagan, Pantheist
    "34": "other",           # Other stated religion (nec) -- includes Judaism (not separately published)
    "37": "other",           # Spiritualist
    "21": "none",            # Agnostic
    "23": "none",            # Atheist
    "35": "none",            # No religion
    "36": "notStated",       # Not stated
}


def _fetch(cache: Path) -> dict:
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / "ie_F5051.json"
    if not f.exists():
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            f.write_bytes(r.read())
    return json.loads(f.read_text(encoding="utf-8"))


def load(cache: Path) -> dict[str, dict[str, int]]:
    d = _fetch(Path(cache))
    ids, size, dims = d["id"], d["size"], d["dimension"]
    idx = {k: dims[k]["category"]["index"] for k in ids}
    idx = {k: (v if isinstance(v, list) else sorted(v, key=v.get)) for k, v in idx.items()}
    labels = {k: dims[k]["category"]["label"] for k in ids}
    vals = d["value"]
    strides = []
    s = 1
    for n in reversed(size):
        strides.insert(0, s)
        s *= n

    def get(sel: dict) -> float:
        off = sum(strides[i] * idx[k].index(sel[k]) for i, k in enumerate(ids))
        v = vals[off] if isinstance(vals, list) else vals.get(str(off))
        return v or 0

    rel_dim = "C02712V03280"
    geo_dim = "C04104V04868"
    base = {"STATISTIC": idx["STATISTIC"][0], "TLIST(A1)": "2022", "C02199V02655": "-"}
    out: dict[str, dict[str, int]] = {}
    for gcode in idx[geo_dim]:
        name = labels[geo_dim][gcode]
        if name == "State":
            continue
        nuts = NUTS_OF[name]
        r = out.setdefault(nuts, {})
        sel = dict(base, **{geo_dim: gcode})
        r["total"] = r.get("total", 0) + int(get(dict(sel, **{rel_dim: "-"})))
        for rc, g in GROUP.items():
            r[g] = r.get(g, 0) + int(get(dict(sel, **{rel_dim: rc})))
    missing = set(labels[geo_dim].values()) - set(NUTS_OF) - {"State"}
    if missing:
        raise ValueError(f"unmapped IE areas: {missing}")
    return out


if __name__ == "__main__":
    import sys
    res = load(Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/religion-cache"))
    for k in sorted(res):
        v = res[k]
        print(k, v, "residual", v["total"] - sum(x for g, x in v.items() if g != "total"))

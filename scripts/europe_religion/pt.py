"""Portugal: religion by NUTS 3 region, Censos 2021.

Sources (INE Portugal JSON indicator API, www.ine.pt/ine/json_indicador/pindica.jsp):
  * 0011644 "População residente com 15 e mais anos de idade (N.º) por Local de residência
    à data dos Censos [2021] (NUTS - 2013) e Religião". Published down to freguesia; the
    NUTS 3 rows (geocod '111', '16B', ... '300') are used directly -> key 'PT' + geocod.
    The religion question was optional and only asked of persons 15+. This table's 'Total'
    is the number of 15+ persons who ANSWERED (sum of the 11 categories exactly).
  * 0011609 "População residente ... (NUTS - 2013), Sexo e Grupo etário" -> resident
    population aged 15+ (Total minus 0-14), used as the denominator.
"notStated" = population 15+ minus respondents (non-response to the optional question).
"total" = full resident population aged 15+.
NUTS 2013 NUTS 3 codes for Portugal are identical to NUTS 2016/2021.
"""
import json
import urllib.request
from pathlib import Path

SOURCE = "INE Portugal, Censos 2021 (indicators 0011644 religion, 0011609 age; population 15+)"
YEAR = 2021

API = "https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&lang=PT&varcd="

NUTS3 = ["111", "112", "119", "11A", "11B", "11C", "11D", "11E", "150", "16B", "16D", "16E",
         "16F", "16G", "16H", "16I", "16J", "170", "181", "184", "185", "186", "187", "200", "300"]

GROUP = {
    "1": "catholic",        # Católica
    "2": "orthodox",        # Ortodoxa
    "3": "protestant",      # Protestante/Evangélica
    "4": "otherChristian",  # Testemunhas de Jeová
    "5": "otherChristian",  # Outra cristã
    "6": "other",           # Budista
    "7": "other",           # Hindu
    "8": "jewish",          # Judaica
    "9": "muslim",          # Muçulmana
    "10": "other",          # Outra não cristã
    "11": "none",           # Sem religião
}


def _get(cache: Path, name: str, query: str) -> list:
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / name
    if not f.exists():
        req = urllib.request.Request(API + query, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=600) as r:
            data = r.read()
        json.loads(data)  # validate before caching
        f.write_bytes(data)
    return json.loads(f.read_text(encoding="utf-8"))[0]["Dados"]["2021"]


def load(cache: Path) -> dict[str, dict[str, int]]:
    cache = Path(cache)
    rel = _get(cache, "pt_0011644.json", "0011644&Dim1=S7A2021")
    age = _get(cache, "pt_0011609.json", "0011609&Dim1=S7A2021&Dim3=T")
    out: dict[str, dict[str, int]] = {}
    answered: dict[str, int] = {}
    for r in rel:
        g = r["geocod"]
        if g not in NUTS3:
            continue
        v = int(r["valor"]) if r.get("valor") not in (None, "") else 0
        key = "PT" + g
        if r["dim_3"] == "T":
            answered[key] = v
        else:
            grp = GROUP[r["dim_3"]]
            d = out.setdefault(key, {})
            d[grp] = d.get(grp, 0) + v
    pop: dict[str, dict[str, int]] = {}
    for r in age:
        g = r["geocod"]
        if g in NUTS3:
            pop.setdefault("PT" + g, {})[r["dim_4"]] = int(r["valor"])
    for key, d in out.items():
        p15 = pop[key]["T"] - pop[key]["1"]
        assert abs(sum(d.values()) - answered[key]) <= 5, key
        d["notStated"] = p15 - answered[key]
        d["total"] = p15
    return {k: {g: v for g, v in d.items() if v or g == "total"} for k, d in out.items()}


if __name__ == "__main__":
    import sys
    res = load(Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/religion-cache"))
    for k in sorted(res):
        v = res[k]
        print(k, v, "residual", v["total"] - sum(x for g, x in v.items() if g != "total"))

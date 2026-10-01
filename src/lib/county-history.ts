import {
  POPULATION_GROUP_LABELS,
  POPULATION_LABEL_THRESHOLD,
  type PopulationGroup,
} from "@/lib/states"

/** Years on the county maps' sliders, oldest first; each is a key of county-history.json */
export const COUNTY_HISTORY_YEARS = [1990, 2000, 2010, 2020, 2025]

export const COUNTY_HISTORY_URL = "/data/county-history.json"

/**
 * [european, hispanic, african, indian, eastAsian, arab, nativeAmerican] % of population, the same
 * groups as the state ethnic chart; Other is the remainder. Indian, East Asian, and Arab are null
 * in 1990.
 */
export type CountyValues = [
  number,
  number,
  number,
  number | null,
  number | null,
  number | null,
  number,
]

/** Year -> FIPS -> CountyValues, from scripts/build-county-history.py */
export type CountyHistory = Record<string, Record<string, CountyValues>>

export type GroupKey = PopulationGroup | "other"

const VALUE_ORDER: PopulationGroup[] = [
  "european",
  "hispanic",
  "african",
  "indian",
  "eastAsian",
  "arab",
  "nativeAmerican",
]

export const GROUPS: { key: GroupKey; label: string }[] = [
  ...VALUE_ORDER.map((key) => ({ key, label: POPULATION_GROUP_LABELS[key] })),
  { key: "other", label: "Other" },
]

/** Connecticut's state FIPS; its 2025 figures are keyed by planning region, not county */
export const CT_FIPS = "09"

/** A group's share of a county, or null where that year has no figure for it */
export function groupShare(values: CountyValues, key: GroupKey): number | null {
  if (key !== "other") return values[VALUE_ORDER.indexOf(key)]
  const known = values.reduce<number>((t, v) => t + (v ?? 0), 0)
  return Math.max(0, Math.round((100 - known) * 10) / 10)
}

/** The tooltip rows: groups under the state chart's threshold fold into Other, largest first */
export function foldedBreakdown(values: CountyValues) {
  const rows = GROUPS.flatMap(({ key, label }) => {
    const value = groupShare(values, key)
    return value == null ? [] : [{ key, label, value }]
  })
  const shown = rows.filter((r) => r.key !== "other" && r.value >= POPULATION_LABEL_THRESHOLD)
  const other = rows
    .filter((r) => !shown.includes(r))
    .reduce((t, r) => t + r.value, 0)
  return [...shown, { key: "other" as const, label: "Other", value: Math.round(other * 10) / 10 }].sort(
    (a, b) => b.value - a.value
  )
}

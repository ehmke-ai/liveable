import stateCostData from "@/data/state-cost.json"

/** Per-state (and national) cost-of-living figures, from scripts/build-cost-of-living.py */
export type CostOfLiving = {
  /** BEA Regional Price Parity, all items, 2024 (US = 100) */
  rpp: number
  /** BEA Regional Price Parity, housing services (rents), 2024 (US = 100) */
  rppHousing: number
  /** ACS 2020–2024 median household income, USD */
  medianIncome: number
  /** ACS 2020–2024 median value of owner-occupied homes, USD */
  medianHomeValue: number
  /** ACS 2020–2024 median gross rent (contract rent plus utilities), USD per month */
  medianRent: number
}

/** USPS abbreviation (and "US" for the nation) -> figures */
export const stateCost = stateCostData as Record<string, CostOfLiving>

export const usCost = stateCost.US

/**
 * [medianIncome, medianHomeValue, medianRent] by county FIPS; null where the ACS suppresses the
 * figure. Connecticut is keyed by planning region, so its old counties have no entry.
 */
export type CountyCost = [number | null, number | null, number | null]

export const COUNTY_COST_URL = "/data/county-cost.json"

export const COUNTY_COST_SOURCE =
  "Source: U.S. Census Bureau, ACS 2020–2024 5-year estimates (B19013, B25077, B25064)"

export const RPP_SOURCE = "Source: BEA Regional Price Parities, 2024"

/** Median home value as a multiple of median household income */
export function priceToIncome(homeValue: number | null, income: number | null): number | null {
  return homeValue == null || !income ? null : homeValue / income
}

/** A year of median gross rent as a share of median household income, % */
export function rentToIncome(rent: number | null, income: number | null): number | null {
  return rent == null || !income ? null : ((rent * 12) / income) * 100
}

/** e.g. "$80.7K", "$1.2M" */
export function formatDollarsShort(value: number): string {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `$${Math.round(value / 1e3)}K`
  return `$${value}`
}

export function formatDollars(value: number): string {
  return `$${value.toLocaleString("en-US")}`
}

export function formatRent(value: number): string {
  return `${formatDollars(value)}/mo`
}

export function formatRatio(value: number): string {
  return `${value.toFixed(1)}×`
}

/** e.g. "110.7 (+10.7%)" */
export function formatRpp(value: number): string {
  const diff = value - 100
  return `${value.toFixed(1)} (${diff >= 0 ? "+" : "−"}${Math.abs(diff).toFixed(1)}%)`
}

/** Shown under Sources on state and county pages */
export const COST_SOURCES = [
  {
    label: "U.S. Bureau of Economic Analysis — Regional Price Parities by State, 2024",
    detail:
      "Price level of all goods and services, and of housing services (rents), relative to the national average (US = 100).",
    url: "https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area",
  },
  {
    label:
      "U.S. Census Bureau — American Community Survey 2020–2024 5-Year Estimates, Tables B19013, B25077, B25064",
    detail: "Median household income, median value of owner-occupied homes, and median gross rent.",
    url: "https://data.census.gov/table/ACSDT5Y2024.B25077",
  },
]

/** One place's figures for a comparison table; counties have no price parities */
export type CostPlace = Partial<Pick<CostOfLiving, "rpp" | "rppHousing">> & {
  medianIncome: number | null
  medianHomeValue: number | null
  medianRent: number | null
}

export function countyCostPlace([medianIncome, medianHomeValue, medianRent]: CountyCost): CostPlace {
  return { medianIncome, medianHomeValue, medianRent }
}

const COST_ROWS: { label: string; value: (p: CostPlace) => string | null }[] = [
  { label: "Price level (US = 100)", value: (p) => (p.rpp == null ? null : formatRpp(p.rpp)) },
  {
    label: "Housing price level (US = 100)",
    value: (p) => (p.rppHousing == null ? null : formatRpp(p.rppHousing)),
  },
  {
    label: "Median household income",
    value: (p) => (p.medianIncome == null ? null : formatDollars(p.medianIncome)),
  },
  {
    label: "Median home value",
    value: (p) => (p.medianHomeValue == null ? null : formatDollars(p.medianHomeValue)),
  },
  {
    label: "Home price to income",
    value: (p) => {
      const r = priceToIncome(p.medianHomeValue, p.medianIncome)
      return r == null ? null : formatRatio(r)
    },
  },
  {
    label: "Median gross rent",
    value: (p) => (p.medianRent == null ? null : formatRent(p.medianRent)),
  },
  {
    label: "Rent to income",
    value: (p) => {
      const r = rentToIncome(p.medianRent, p.medianIncome)
      return r == null ? null : `${r.toFixed(1)}%`
    },
  },
]

/** Each figure across `places` (a dash where a place has none), skipping figures none of them have */
export function costComparisonRows(places: (CostPlace | null)[]): { label: string; values: string[] }[] {
  return COST_ROWS.flatMap(({ label, value }) => {
    const values = places.map((p) => (p ? value(p) : null))
    return values.some((v) => v != null) ? [{ label, values: values.map((v) => v ?? "—") }] : []
  })
}

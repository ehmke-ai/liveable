import type { PoliticalLeanPoint } from "@/lib/demographics"

/**
 * Population share (%) by ethnic group. Every group except Hispanic is non-Hispanic.
 * Arab, Indian, and East Asian are not separable before 2000 (null) and sit in `other`.
 */
export type PopulationPoint = {
  year: number
  /** Non-Hispanic White minus Arab ancestry */
  european: number
  /** Arab ancestry (Census ancestry question) */
  arab: number | null
  /** Asian Indian, Pakistani, and Bangladeshi */
  indian: number | null
  /** Chinese, Taiwanese, Japanese, Korean, Mongolian, Okinawan, Hmong (Census East Asian) */
  eastAsian: number | null
  /** Black or African American */
  african: number
  hispanic: number
  /** Everyone else: Southeast, other South and Central Asian, American Indian, Pacific Islander, multiracial */
  other: number
}

export type PopulationGroup = Exclude<keyof PopulationPoint, "year" | "other">

/** Requested groups, in stacking order */
export const POPULATION_GROUP_LABELS: Record<PopulationGroup, string> = {
  european: "European",
  hispanic: "Hispanic",
  african: "African",
  indian: "Indian",
  eastAsian: "East Asian",
  arab: "Arab",
}

/** Groups below this share in the latest year fold into "Other" on the chart */
export const POPULATION_LABEL_THRESHOLD = 3

export type StateSource = {
  label: string
  detail: string
  url: string
}

export type StateDemographics = {
  state: string
  slug: string
  /** USPS abbreviation (matches FIPS_TO_ABBR in the US map) */
  abbr: string
  /** Resident population, millions */
  population: number
  foreignBorn: number
  catholic: number
  protestant: number
  orthodox: number
  /** Median age of the non-Hispanic White alone population, years */
  medianAge: number
  /** Median age of the whole population, years */
  medianAgeAll: number
  /** Nominal state GDP, billions of USD */
  gdp: number
  populationHistory: PopulationPoint[]
  /** Democratic → left of centre, Republican → right of centre (presidential popular vote) */
  politicalLeanHistory: PoliticalLeanPoint[]
  sources: StateSource[]
}

export const statesData: StateDemographics[] = [
  {
    state: "Texas",
    slug: "texas",
    abbr: "TX",
    population: 31.7,
    foreignBorn: 17,
    catholic: 22,
    protestant: 43,
    orthodox: 1,
    medianAge: 43.5,
    medianAgeAll: 36.0,
    gdp: 2710,
    // Census Bureau. Broad groups: WP56 table 58 (1970 15% sample, 1980, 1990), population
    // estimates April 1 bases (2000, 2010, 2020) and July 1, 2025. Indian and East Asian: census
    // SF1 PCT5 (2000, 2010), ACS B02015 (2016–2020 5-year; 2024 1-year for 2025). Arab: ancestry,
    // census SF3 PCT18 (2000) and ACS B04006 (2010 1-year, 2016–2020 5-year, 2024 1-year).
    // Hispanic origin was not tabulated in 1960.
    populationHistory: [
      { year: 1970, european: 69.6, arab: null, indian: null, eastAsian: null, african: 12.5, hispanic: 17.7, other: 0.2 },
      { year: 1980, european: 65.7, arab: null, indian: null, eastAsian: null, african: 12.0, hispanic: 21.0, other: 1.3 },
      { year: 1990, european: 60.6, arab: null, indian: null, eastAsian: null, african: 11.9, hispanic: 25.5, other: 2.0 },
      { year: 2000, european: 52.4, arab: 0.3, indian: 0.7, eastAsian: 0.8, african: 11.4, hispanic: 32.0, other: 2.4 },
      { year: 2010, european: 45.0, arab: 0.4, indian: 1.2, eastAsian: 1.0, african: 11.5, hispanic: 37.6, other: 3.2 },
      { year: 2020, european: 39.9, arab: 0.5, indian: 1.8, eastAsian: 1.1, african: 12.0, hispanic: 39.3, other: 5.3 },
      { year: 2025, european: 36.7, arab: 0.6, indian: 2.6, eastAsian: 1.3, african: 12.3, hispanic: 40.9, other: 5.8 },
    ],
    // Decade points use the nearest presidential election (1968, 1988, 2008, 2024), matching the US series
    politicalLeanHistory: [
      { year: 1960, leftWing: 0, leftOfCenter: 51, rightOfCenter: 49, rightWing: 0 },
      { year: 1970, leftWing: 0, leftOfCenter: 41, rightOfCenter: 40, rightWing: 0 },
      { year: 1980, leftWing: 0, leftOfCenter: 41, rightOfCenter: 55, rightWing: 0 },
      { year: 1990, leftWing: 0, leftOfCenter: 43, rightOfCenter: 56, rightWing: 0 },
      { year: 2000, leftWing: 0, leftOfCenter: 38, rightOfCenter: 59, rightWing: 0 },
      { year: 2010, leftWing: 0, leftOfCenter: 44, rightOfCenter: 55, rightWing: 0 },
      { year: 2020, leftWing: 0, leftOfCenter: 46, rightOfCenter: 52, rightWing: 0 },
      { year: 2025, leftWing: 0, leftOfCenter: 42, rightOfCenter: 56, rightWing: 0 },
    ],
    sources: [
      {
        label: "U.S. Census Bureau — State Population by Characteristics: 2020–2025 (Vintage 2025)",
        detail:
          "Population, race and Hispanic origin, and median ages for 2020 (April 1 estimates base) and July 1, 2025 (file sc-est2025-alldata6). Median ages are interpolated from single-year-of-age counts.",
        url: "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/state/asrh/sc-est2025-alldata6.csv",
      },
      {
        label: "U.S. Census Bureau — Intercensal Estimates of the Resident Population: 2000–2010",
        detail:
          "Race and Hispanic origin for 2000 (April 1 estimates base) and the 2010 census count (file st-est00int-sexracehisp).",
        url: "https://www2.census.gov/programs-surveys/popest/datasets/2000-2010/intercensal/state/st-est00int-sexracehisp.csv",
      },
      {
        label: "U.S. Census Bureau — Historical Census Statistics on Population Totals by Race and Hispanic Origin",
        detail:
          "Gibson & Jung, Working Paper No. 56, Table 58: Texas, 1970 (15% sample for Hispanic origin), 1980, and 1990.",
        url: "https://www2.census.gov/library/working-papers/2002/demo/pop-twps0056/table58.xlsx",
      },
      {
        label: "U.S. Census Bureau — Decennial Census Summary File 1, Table PCT5",
        detail:
          "Asian alone by group (Asian Indian, Pakistani, Bangladeshi, Chinese, Taiwanese, Japanese, Korean, Hmong), Texas, 2000 and 2010.",
        url: "https://data.census.gov/table/DECENNIALSF12010.PCT5?g=040XX00US48",
      },
      {
        label: "U.S. Census Bureau — American Community Survey, Table B02015",
        detail:
          "Asian alone by selected groups, Texas: 2016–2020 5-year (2020) and 2024 1-year (used for 2025).",
        url: "https://data.census.gov/table/ACSDT1Y2024.B02015?g=040XX00US48",
      },
      {
        label: "U.S. Census Bureau — Ancestry: Census 2000 SF3 Table PCT18 and ACS Table B04006",
        detail:
          "People reporting Arab ancestry, Texas: 2000 census, 2010 ACS 1-year, 2016–2020 ACS 5-year, and 2024 ACS 1-year (used for 2025).",
        url: "https://data.census.gov/table/ACSDT1Y2024.B04006?g=040XX00US48",
      },
      {
        label: "U.S. Census Bureau — QuickFacts: Texas",
        detail: "Foreign-born share (American Community Survey 5-year estimates).",
        url: "https://www.census.gov/quickfacts/fact/table/TX/PST045224",
      },
      {
        label: "Pew Research Center — Religious Landscape Study 2023–24",
        detail: "Catholic, Protestant, and Orthodox self-identification among Texas adults.",
        url: "https://www.pewresearch.org/religious-landscape-study/state/texas/",
      },
      {
        label: "U.S. Bureau of Economic Analysis — GDP by State",
        detail: "Nominal (current-dollar) Texas GDP, 2024.",
        url: "https://www.bea.gov/data/gdp/gdp-state",
      },
      {
        label: "Texas Secretary of State — Historical Election Results",
        detail:
          "Presidential popular vote in Texas, 1960–2024 (Democratic and Republican candidates).",
        url: "https://www.sos.state.tx.us/elections/historical/index.shtml",
      },
    ],
  },
]

export const stateBySlug: Record<string, StateDemographics> = Object.fromEntries(
  statesData.map((s) => [s.slug, s])
)

export const stateByAbbr: Record<string, StateDemographics> = Object.fromEntries(
  statesData.map((s) => [s.abbr, s])
)

export function getStateBySlug(slug: string): StateDemographics | undefined {
  return stateBySlug[slug]
}

export function formatGdp(billions: number): string {
  return billions >= 1000 ? `$${(billions / 1000).toFixed(2)}T` : `$${billions}B`
}

/** Latest population point, used for the snapshot figures */
export function latestPopulation(state: StateDemographics): PopulationPoint {
  return state.populationHistory[state.populationHistory.length - 1]
}

export type StackedPopulationRow = { year: number } & Record<string, number>

/**
 * Keeps requested groups at or above POPULATION_LABEL_THRESHOLD in the latest year as their
 * own series (in POPULATION_GROUP_LABELS order, so stacking and colors stay fixed) and adds
 * the rest to "other".
 */
export function stackPopulationHistory(history: PopulationPoint[]): {
  series: { key: string; label: string }[]
  data: StackedPopulationRow[]
} {
  const latest = history[history.length - 1]
  const groups = Object.keys(POPULATION_GROUP_LABELS) as PopulationGroup[]
  const labeled = latest
    ? groups.filter((g) => (latest[g] ?? 0) >= POPULATION_LABEL_THRESHOLD)
    : []
  const folded = groups.filter((g) => !labeled.includes(g))

  const series: { key: string; label: string }[] = labeled.map((g) => ({
    key: g,
    label: POPULATION_GROUP_LABELS[g],
  }))
  series.push({ key: "other", label: "Other" })

  const data = history.map((point) => {
    const row: StackedPopulationRow = { year: point.year }
    for (const g of labeled) row[g] = point[g] ?? 0
    const other = folded.reduce((sum, g) => sum + (point[g] ?? 0), point.other)
    row.other = Math.round(other * 10) / 10
    return row
  })

  return { series, data }
}

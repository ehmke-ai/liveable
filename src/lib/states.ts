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

/** ILRC's grouping of states by immigration-enforcement legislation, protective → harmful */
export type EnforcementTier =
  | "mostProtective"
  | "broadSanctuary"
  | "limitedProtections"
  | "smallSteps"
  | "noLaws"
  | "someParticipation"
  | "broadAntiSanctuary"
  | "comprehensiveEnforcement"
  | "mostFarReaching"

export const ENFORCEMENT_TIER_LABELS: Record<EnforcementTier, string> = {
  mostProtective: "Most protective (sanctuary)",
  broadSanctuary: "Broad sanctuary protections",
  limitedProtections: "Limited protections",
  smallSteps: "Small protective steps",
  noLaws: "No enforcement laws",
  someParticipation: "Some mandated ICE participation",
  broadAntiSanctuary: "Broad anti-sanctuary laws",
  comprehensiveEnforcement: "Comprehensive ICE enforcement",
  mostFarReaching: "Most far-reaching enforcement",
}

/** Per-state figures for the US choropleth (all 50 states + DC) */
export type StateMapMetrics = {
  state: string
  /** USPS abbreviation (matches FIPS_TO_ABBR in the US map) */
  abbr: string
  /**
   * Non-Hispanic White alone minus Arab ancestry, % of population. Census Vintage 2025
   * estimates (July 1, 2025) less ACS 2024 1-year Arab ancestry (B04006; suppressed, so
   * not subtracted, for North Dakota, Vermont, and Wyoming).
   */
  native: number
  /**
   * % saying the growing number of newcomers from other countries "threatens traditional
   * American customs and values" (PRRI 2015 American Values Atlas). DC was not reported.
   */
  antiImmig: number | null
  /** Nominal 2025 GDP, billions of USD (BEA SAGDP1) */
  gdp: number
  /**
   * ILRC State Map on Immigration Enforcement (July 2026) average score across ~20 state-law
   * parameters: ICE detainers, 287(g), info sharing, anti-sanctuary mandates, state
   * immigration crimes, etc. 1 = most ICE cooperation / harmful, 3 = no laws, 5 = most protective.
   */
  enforcementScore: number
  enforcementTier: EnforcementTier
}

export const stateMapData: StateMapMetrics[] = [
  { state: "Alabama", abbr: "AL", native: 62, antiImmig: 47, gdp: 341, enforcementScore: 2.2, enforcementTier: "comprehensiveEnforcement" },
  { state: "Alaska", abbr: "AK", native: 57, antiImmig: 30, gdp: 75, enforcementScore: 3.0, enforcementTier: "noLaws" },
  { state: "Arizona", abbr: "AZ", native: 51, antiImmig: 31, gdp: 598, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement" },
  { state: "Arkansas", abbr: "AR", native: 67, antiImmig: 44, gdp: 198, enforcementScore: 2.4, enforcementTier: "broadAntiSanctuary" },
  { state: "California", abbr: "CA", native: 32, antiImmig: 26, gdp: 4251, enforcementScore: 4.0, enforcementTier: "broadSanctuary" },
  { state: "Colorado", abbr: "CO", native: 63, antiImmig: 29, gdp: 584, enforcementScore: 3.8, enforcementTier: "broadSanctuary" },
  { state: "Connecticut", abbr: "CT", native: 60, antiImmig: 30, gdp: 376, enforcementScore: 3.5, enforcementTier: "limitedProtections" },
  { state: "Delaware", abbr: "DE", native: 56, antiImmig: 30, gdp: 117, enforcementScore: 3.1, enforcementTier: "smallSteps" },
  { state: "District of Columbia", abbr: "DC", native: 37, antiImmig: null, gdp: 193, enforcementScore: 3.5, enforcementTier: "limitedProtections" },
  { state: "Florida", abbr: "FL", native: 49, antiImmig: 36, gdp: 1835, enforcementScore: 1.7, enforcementTier: "mostFarReaching" },
  { state: "Georgia", abbr: "GA", native: 47, antiImmig: 35, gdp: 925, enforcementScore: 2.5, enforcementTier: "broadAntiSanctuary" },
  { state: "Hawaii", abbr: "HI", native: 21, antiImmig: 21, gdp: 125, enforcementScore: 3.2, enforcementTier: "smallSteps" },
  { state: "Idaho", abbr: "ID", native: 78, antiImmig: 41, gdp: 136, enforcementScore: 2.4, enforcementTier: "broadAntiSanctuary" },
  { state: "Illinois", abbr: "IL", native: 56, antiImmig: 33, gdp: 1202, enforcementScore: 4.3, enforcementTier: "mostProtective" },
  { state: "Indiana", abbr: "IN", native: 73, antiImmig: 40, gdp: 545, enforcementScore: 2.4, enforcementTier: "broadAntiSanctuary" },
  { state: "Iowa", abbr: "IA", native: 81, antiImmig: 39, gdp: 277, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement" },
  { state: "Kansas", abbr: "KS", native: 71, antiImmig: 36, gdp: 241, enforcementScore: 2.6, enforcementTier: "someParticipation" },
  { state: "Kentucky", abbr: "KY", native: 79, antiImmig: 44, gdp: 307, enforcementScore: 3.0, enforcementTier: "noLaws" },
  { state: "Louisiana", abbr: "LA", native: 54, antiImmig: 39, gdp: 340, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement" },
  { state: "Maine", abbr: "ME", native: 89, antiImmig: 40, gdp: 103, enforcementScore: 3.8, enforcementTier: "broadSanctuary" },
  { state: "Maryland", abbr: "MD", native: 45, antiImmig: 33, gdp: 568, enforcementScore: 3.6, enforcementTier: "limitedProtections" },
  { state: "Massachusetts", abbr: "MA", native: 65, antiImmig: 26, gdp: 820, enforcementScore: 3.7, enforcementTier: "limitedProtections" },
  { state: "Michigan", abbr: "MI", native: 70, antiImmig: 38, gdp: 730, enforcementScore: 3.0, enforcementTier: "noLaws" },
  { state: "Minnesota", abbr: "MN", native: 74, antiImmig: 38, gdp: 531, enforcementScore: 3.1, enforcementTier: "smallSteps" },
  { state: "Mississippi", abbr: "MS", native: 54, antiImmig: 43, gdp: 165, enforcementScore: 2.1, enforcementTier: "comprehensiveEnforcement" },
  { state: "Missouri", abbr: "MO", native: 75, antiImmig: 36, gdp: 468, enforcementScore: 2.6, enforcementTier: "someParticipation" },
  { state: "Montana", abbr: "MT", native: 83, antiImmig: 39, gdp: 82, enforcementScore: 2.6, enforcementTier: "someParticipation" },
  { state: "Nebraska", abbr: "NE", native: 73, antiImmig: 36, gdp: 198, enforcementScore: 3.0, enforcementTier: "noLaws" },
  { state: "Nevada", abbr: "NV", native: 42, antiImmig: 38, gdp: 281, enforcementScore: 3.1, enforcementTier: "smallSteps" },
  { state: "New Hampshire", abbr: "NH", native: 86, antiImmig: 40, gdp: 126, enforcementScore: 2.5, enforcementTier: "someParticipation" },
  { state: "New Jersey", abbr: "NJ", native: 48, antiImmig: 27, gdp: 887, enforcementScore: 3.9, enforcementTier: "broadSanctuary" },
  { state: "New Mexico", abbr: "NM", native: 35, antiImmig: 30, gdp: 153, enforcementScore: 3.2, enforcementTier: "limitedProtections" },
  { state: "New York", abbr: "NY", native: 51, antiImmig: 27, gdp: 2468, enforcementScore: 3.7, enforcementTier: "limitedProtections" },
  { state: "North Carolina", abbr: "NC", native: 58, antiImmig: 37, gdp: 894, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement" },
  { state: "North Dakota", abbr: "ND", native: 80, antiImmig: 39, gdp: 82, enforcementScore: 2.7, enforcementTier: "someParticipation" },
  { state: "Ohio", abbr: "OH", native: 74, antiImmig: 40, gdp: 967, enforcementScore: 2.9, enforcementTier: "someParticipation" },
  { state: "Oklahoma", abbr: "OK", native: 58, antiImmig: 38, gdp: 274, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement" },
  { state: "Oregon", abbr: "OR", native: 69, antiImmig: 28, gdp: 343, enforcementScore: 4.3, enforcementTier: "mostProtective" },
  { state: "Pennsylvania", abbr: "PA", native: 71, antiImmig: 38, gdp: 1056, enforcementScore: 3.0, enforcementTier: "noLaws" },
  { state: "Rhode Island", abbr: "RI", native: 66, antiImmig: 29, gdp: 84, enforcementScore: 3.3, enforcementTier: "smallSteps" },
  { state: "South Carolina", abbr: "SC", native: 62, antiImmig: 38, gdp: 379, enforcementScore: 2.5, enforcementTier: "broadAntiSanctuary" },
  { state: "South Dakota", abbr: "SD", native: 78, antiImmig: 43, gdp: 81, enforcementScore: 3.0, enforcementTier: "someParticipation" },
  { state: "Tennessee", abbr: "TN", native: 69, antiImmig: 43, gdp: 590, enforcementScore: 2.4, enforcementTier: "broadAntiSanctuary" },
  { state: "Texas", abbr: "TX", native: 37, antiImmig: 34, gdp: 2904, enforcementScore: 1.6, enforcementTier: "mostFarReaching" },
  { state: "Utah", abbr: "UT", native: 73, antiImmig: 33, gdp: 316, enforcementScore: 2.6, enforcementTier: "someParticipation" },
  { state: "Vermont", abbr: "VT", native: 89, antiImmig: 35, gdp: 48, enforcementScore: 3.9, enforcementTier: "broadSanctuary" },
  { state: "Virginia", abbr: "VA", native: 56, antiImmig: 35, gdp: 798, enforcementScore: 3.3, enforcementTier: "limitedProtections" },
  { state: "Washington", abbr: "WA", native: 60, antiImmig: 31, gdp: 895, enforcementScore: 3.9, enforcementTier: "broadSanctuary" },
  { state: "West Virginia", abbr: "WV", native: 88, antiImmig: 47, gdp: 109, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement" },
  { state: "Wisconsin", abbr: "WI", native: 77, antiImmig: 37, gdp: 473, enforcementScore: 3.0, enforcementTier: "noLaws" },
  { state: "Wyoming", abbr: "WY", native: 81, antiImmig: 48, gdp: 53, enforcementScore: 2.9, enforcementTier: "someParticipation" },
]

export const stateMapByAbbr: Record<string, StateMapMetrics> = Object.fromEntries(
  stateMapData.map((s) => [s.abbr, s])
)

const antiImmigValues = stateMapData.flatMap((s) => (s.antiImmig == null ? [] : [s.antiImmig]))
export const minStateAntiImmig = Math.min(...antiImmigValues)
export const maxStateAntiImmig = Math.max(...antiImmigValues)
export const minStateNative = Math.min(...stateMapData.map((s) => s.native))
export const maxStateNative = Math.max(...stateMapData.map((s) => s.native))
export const minStateGdp = Math.min(...stateMapData.map((s) => s.gdp))
export const maxStateGdp = Math.max(...stateMapData.map((s) => s.gdp))
export const minStateEnforcementScore = Math.min(...stateMapData.map((s) => s.enforcementScore))
export const maxStateEnforcementScore = Math.max(...stateMapData.map((s) => s.enforcementScore))

/** Enforcement intensity in [0, 1] — more ICE cooperation (lower ILRC score) scores higher */
export function enforcementIntensity(score: number): number {
  return 1 - rangeIntensity(score, minStateEnforcementScore, maxStateEnforcementScore)
}

/** Linear position of `value` within [min, max], clamped to [0, 1] */
export function rangeIntensity(value: number, min: number, max: number): number {
  if (max <= min) return 1
  return Math.min(1, Math.max(0, (value - min) / (max - min)))
}

/** Log-scaled position of a GDP within the state range, in [0, 1] */
export function gdpIntensity(billions: number): number {
  return rangeIntensity(Math.log10(billions), Math.log10(minStateGdp), Math.log10(maxStateGdp))
}

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

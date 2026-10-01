import { slugify, type PoliticalLeanPoint } from "@/lib/demographics"

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
  /**
   * American Indian and Alaska Native alone. Non-Hispanic from 2000; before 2000 the Census
   * didn't cross it with Hispanic origin, so it includes Hispanic American Indians.
   */
  nativeAmerican: number
  /** Everyone else: Southeast, other South and Central Asian, Pacific Islander, multiracial */
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
  nativeAmerican: "Native American",
}

/** Groups below this share in the latest year fold into "Other" on the chart */
export const POPULATION_LABEL_THRESHOLD = 3

export type StateSource = {
  label: string
  detail: string
  url: string
}

export type CountyDemographics = {
  /** County name without a trailing " County" (other types keep theirs, e.g. "Orleans Parish") */
  name: string
  /** Display name when it isn't "<name> County", e.g. "Richmond city" or "Juneau City and Borough" */
  label?: string
  /** 5-digit state + county FIPS code */
  fips: string
  /** White alone, not Hispanic or Latino, % of county population */
  nonHispanicWhitePct: number
  /** Hispanic or Latino, of any race, % of county population */
  hispanicPct: number
  /** Black or African American alone, % of county population (not Hispanic-origin-exclusive) */
  blackPct: number
  /** American Indian and Alaska Native alone, % of county population (not Hispanic-origin-exclusive) */
  aianPct: number
  /** Asian alone, % of county population (not Hispanic-origin-exclusive) */
  asianPct: number
}

export type CountyEthnicBreakdown = Record<PopulationGroup, number> & { other: number }

/**
 * Approximates a county's ethnic makeup using the same categories as the state's
 * "Population by ethnic group" chart (see PopulationPoint above). Hispanic, African (Black
 * alone), Native American (American Indian and Alaska Native alone), and Asian alone come straight from ACS county tables; Asian is split into
 * Indian/East Asian using the state's own latest ratio between those two groups, since no
 * county-level ancestry breakdown is published. Arab ancestry isn't tabulated at county
 * granularity for most counties, so it's folded into `other` rather than estimated.
 */
export function countyEthnicBreakdown(
  state: StateDemographics,
  county: CountyDemographics
): CountyEthnicBreakdown {
  const latest = state.populationHistory[state.populationHistory.length - 1]
  const indianShare = latest.indian ?? 0
  const eastAsianShare = latest.eastAsian ?? 0
  const asianTotal = indianShare + eastAsianShare
  const indianRatio = asianTotal > 0 ? indianShare / asianTotal : 0.5

  const european = county.nonHispanicWhitePct
  const hispanic = county.hispanicPct
  const african = county.blackPct
  const nativeAmerican = county.aianPct
  const indian = Math.round(county.asianPct * indianRatio * 10) / 10
  const eastAsian = Math.round((county.asianPct - indian) * 10) / 10
  const arab = 0
  const other = Math.max(
    0,
    Math.round((100 - european - hispanic - african - nativeAmerican - indian - eastAsian) * 10) / 10
  )

  return { european, hispanic, african, indian, eastAsian, arab, nativeAmerican, other }
}

export const countySlug = slugify

export function countyLabel(county: CountyDemographics): string {
  return county.label ?? `${county.name} County`
}

/** TopoJSON path for a state's county map, e.g. `/geo/tx-counties-10m.json` */
export function countyGeoUrl(state: { abbr: string }): string {
  return `/geo/${state.abbr.toLowerCase()}-counties-10m.json`
}

/**
 * Groups below the same fold threshold the state-level chart uses collapse into "Other",
 * sorted largest first. Shared by the county choropleth tooltip/panel and county pages.
 */
export function foldedCountyBreakdown(
  state: StateDemographics,
  county: CountyDemographics
): { key: PopulationGroup | "other"; label: string; value: number }[] {
  const groups = Object.keys(POPULATION_GROUP_LABELS) as PopulationGroup[]
  const breakdown = countyEthnicBreakdown(state, county)
  const labeled = groups.filter((g) => breakdown[g] >= POPULATION_LABEL_THRESHOLD)
  const folded = groups.filter((g) => !labeled.includes(g))
  const other =
    Math.round((breakdown.other + folded.reduce((sum, g) => sum + breakdown[g], 0)) * 10) / 10

  return [
    ...labeled.map((g) => ({ key: g, label: POPULATION_GROUP_LABELS[g], value: breakdown[g] })),
    { key: "other" as const, label: "Other", value: other },
  ].sort((a, b) => b.value - a.value)
}

/**
 * Groups below POPULATION_LABEL_THRESHOLD in the state's latest population point collapse
 * into "Other", sorted largest first. Used as the state-wide fallback wherever a per-county
 * breakdown (see foldedCountyBreakdown) would otherwise be shown but no county is selected.
 */
export function foldedStateBreakdown(
  state: StateDemographics
): { key: PopulationGroup | "other"; label: string; value: number }[] {
  const latest = state.populationHistory[state.populationHistory.length - 1]
  const groups = Object.keys(POPULATION_GROUP_LABELS) as PopulationGroup[]
  const labeled = groups.filter((g) => (latest[g] ?? 0) >= POPULATION_LABEL_THRESHOLD)
  const folded = groups.filter((g) => !labeled.includes(g))
  const other =
    Math.round((latest.other + folded.reduce((sum, g) => sum + (latest[g] ?? 0), 0)) * 10) / 10

  return [
    ...labeled.map((g) => ({ key: g, label: POPULATION_GROUP_LABELS[g], value: latest[g] ?? 0 })),
    { key: "other" as const, label: "Other", value: other },
  ].sort((a, b) => b.value - a.value)
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
  /**
   * Share of 30-year-olds who are married with spouse present and own their home
   * ("Fishback benchmark" — see us-map.tsx).
   */
  thirtyMarriedHomeowner: number
  populationHistory: PopulationPoint[]
  /** Democratic → left of centre, Republican → right of centre (presidential popular vote) */
  politicalLeanHistory: PoliticalLeanPoint[]
  /** State-specific caveats, appended to the page's notes */
  notes?: string[]
  sources: StateSource[]
}

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
  /**
   * Among 30-year-olds, % who are married (spouse present) and own their home. Estimated
   * from ACS 2024 1-year cross-tabulations by age, marital status, and tenure (S1201, B25007);
   * the Census does not publish a single-age 3-way cross-tab, so this combines state marriage
   * rates for ages 25-34 with homeownership rates for householders in that age band.
   */
  thirtyMarriedHomeowner: number
  /**
   * Estimated share of total household net wealth held by residents aged 30 and under.
   * Derived from the state's Fishback benchmark (marriage + homeownership at 30) as a
   * proxy for early wealth accumulation, scaled against Federal Reserve Distributional
   * Financial Accounts national under-35 wealth shares.
   */
  wealthShareUnder30: number
  /** 2024 presidential election, % of the statewide popular vote for Trump (certified results) */
  trump2024: number
  /** 2024 presidential election, % of the statewide popular vote for Harris (certified results) */
  harris2024: number
}

export const stateMapData: StateMapMetrics[] = [
  { state: "Alabama", abbr: "AL", native: 62, antiImmig: 47, gdp: 341, enforcementScore: 2.2, enforcementTier: "comprehensiveEnforcement", thirtyMarriedHomeowner: 34, wealthShareUnder30: 8, trump2024: 64.6, harris2024: 34.1 },
  { state: "Alaska", abbr: "AK", native: 57, antiImmig: 30, gdp: 75, enforcementScore: 3.0, enforcementTier: "noLaws", thirtyMarriedHomeowner: 26, wealthShareUnder30: 6, trump2024: 54.5, harris2024: 41.4 },
  { state: "Arizona", abbr: "AZ", native: 51, antiImmig: 31, gdp: 598, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement", thirtyMarriedHomeowner: 27, wealthShareUnder30: 6, trump2024: 52.2, harris2024: 46.7 },
  { state: "Arkansas", abbr: "AR", native: 67, antiImmig: 44, gdp: 198, enforcementScore: 2.4, enforcementTier: "broadAntiSanctuary", thirtyMarriedHomeowner: 33, wealthShareUnder30: 7, trump2024: 64.2, harris2024: 33.6 },
  { state: "California", abbr: "CA", native: 32, antiImmig: 26, gdp: 4251, enforcementScore: 4.0, enforcementTier: "broadSanctuary", thirtyMarriedHomeowner: 16, wealthShareUnder30: 4, trump2024: 38.3, harris2024: 58.5 },
  { state: "Colorado", abbr: "CO", native: 63, antiImmig: 29, gdp: 584, enforcementScore: 3.8, enforcementTier: "broadSanctuary", thirtyMarriedHomeowner: 26, wealthShareUnder30: 6, trump2024: 43.1, harris2024: 54.2 },
  { state: "Connecticut", abbr: "CT", native: 60, antiImmig: 30, gdp: 376, enforcementScore: 3.5, enforcementTier: "limitedProtections", thirtyMarriedHomeowner: 24, wealthShareUnder30: 5, trump2024: 41.9, harris2024: 56.4 },
  { state: "Delaware", abbr: "DE", native: 56, antiImmig: 30, gdp: 117, enforcementScore: 3.1, enforcementTier: "smallSteps", thirtyMarriedHomeowner: 25, wealthShareUnder30: 6, trump2024: 41.8, harris2024: 56.5 },
  { state: "District of Columbia", abbr: "DC", native: 37, antiImmig: null, gdp: 193, enforcementScore: 3.5, enforcementTier: "limitedProtections", thirtyMarriedHomeowner: 8, wealthShareUnder30: 2, trump2024: 6.5, harris2024: 90.3 },
  { state: "Florida", abbr: "FL", native: 49, antiImmig: 36, gdp: 1835, enforcementScore: 1.7, enforcementTier: "mostFarReaching", thirtyMarriedHomeowner: 24, wealthShareUnder30: 5, trump2024: 56.1, harris2024: 43.0 },
  { state: "Georgia", abbr: "GA", native: 47, antiImmig: 35, gdp: 925, enforcementScore: 2.5, enforcementTier: "broadAntiSanctuary", thirtyMarriedHomeowner: 27, wealthShareUnder30: 6, trump2024: 50.7, harris2024: 48.5 },
  { state: "Hawaii", abbr: "HI", native: 21, antiImmig: 21, gdp: 125, enforcementScore: 3.2, enforcementTier: "smallSteps", thirtyMarriedHomeowner: 18, wealthShareUnder30: 4, trump2024: 37.5, harris2024: 60.6 },
  { state: "Idaho", abbr: "ID", native: 78, antiImmig: 41, gdp: 136, enforcementScore: 2.4, enforcementTier: "broadAntiSanctuary", thirtyMarriedHomeowner: 38, wealthShareUnder30: 8, trump2024: 66.9, harris2024: 30.4 },
  { state: "Illinois", abbr: "IL", native: 56, antiImmig: 33, gdp: 1202, enforcementScore: 4.3, enforcementTier: "mostProtective", thirtyMarriedHomeowner: 27, wealthShareUnder30: 6, trump2024: 43.5, harris2024: 54.4 },
  { state: "Indiana", abbr: "IN", native: 73, antiImmig: 40, gdp: 545, enforcementScore: 2.4, enforcementTier: "broadAntiSanctuary", thirtyMarriedHomeowner: 34, wealthShareUnder30: 8, trump2024: 58.6, harris2024: 39.6 },
  { state: "Iowa", abbr: "IA", native: 81, antiImmig: 39, gdp: 277, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement", thirtyMarriedHomeowner: 37, wealthShareUnder30: 8, trump2024: 55.7, harris2024: 42.5 },
  { state: "Kansas", abbr: "KS", native: 71, antiImmig: 36, gdp: 241, enforcementScore: 2.6, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 33, wealthShareUnder30: 7, trump2024: 57.2, harris2024: 41.0 },
  { state: "Kentucky", abbr: "KY", native: 79, antiImmig: 44, gdp: 307, enforcementScore: 3.0, enforcementTier: "noLaws", thirtyMarriedHomeowner: 32, wealthShareUnder30: 7, trump2024: 64.5, harris2024: 33.9 },
  { state: "Louisiana", abbr: "LA", native: 54, antiImmig: 39, gdp: 340, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement", thirtyMarriedHomeowner: 28, wealthShareUnder30: 6, trump2024: 60.2, harris2024: 38.2 },
  { state: "Maine", abbr: "ME", native: 89, antiImmig: 40, gdp: 103, enforcementScore: 3.8, enforcementTier: "broadSanctuary", thirtyMarriedHomeowner: 28, wealthShareUnder30: 6, trump2024: 45.5, harris2024: 52.4 },
  { state: "Maryland", abbr: "MD", native: 45, antiImmig: 33, gdp: 568, enforcementScore: 3.6, enforcementTier: "limitedProtections", thirtyMarriedHomeowner: 24, wealthShareUnder30: 5, trump2024: 34.1, harris2024: 62.6 },
  { state: "Massachusetts", abbr: "MA", native: 65, antiImmig: 26, gdp: 820, enforcementScore: 3.7, enforcementTier: "limitedProtections", thirtyMarriedHomeowner: 19, wealthShareUnder30: 4, trump2024: 36.0, harris2024: 61.2 },
  { state: "Michigan", abbr: "MI", native: 70, antiImmig: 38, gdp: 730, enforcementScore: 3.0, enforcementTier: "noLaws", thirtyMarriedHomeowner: 29, wealthShareUnder30: 6, trump2024: 49.7, harris2024: 48.3 },
  { state: "Minnesota", abbr: "MN", native: 74, antiImmig: 38, gdp: 531, enforcementScore: 3.1, enforcementTier: "smallSteps", thirtyMarriedHomeowner: 31, wealthShareUnder30: 7, trump2024: 46.7, harris2024: 50.9 },
  { state: "Mississippi", abbr: "MS", native: 54, antiImmig: 43, gdp: 165, enforcementScore: 2.1, enforcementTier: "comprehensiveEnforcement", thirtyMarriedHomeowner: 29, wealthShareUnder30: 6, trump2024: 60.9, harris2024: 38.0 },
  { state: "Missouri", abbr: "MO", native: 75, antiImmig: 36, gdp: 468, enforcementScore: 2.6, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 31, wealthShareUnder30: 7, trump2024: 58.5, harris2024: 40.1 },
  { state: "Montana", abbr: "MT", native: 83, antiImmig: 39, gdp: 82, enforcementScore: 2.6, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 33, wealthShareUnder30: 7, trump2024: 58.4, harris2024: 38.5 },
  { state: "Nebraska", abbr: "NE", native: 73, antiImmig: 36, gdp: 198, enforcementScore: 3.0, enforcementTier: "noLaws", thirtyMarriedHomeowner: 35, wealthShareUnder30: 8, trump2024: 59.3, harris2024: 38.9 },
  { state: "Nevada", abbr: "NV", native: 42, antiImmig: 38, gdp: 281, enforcementScore: 3.1, enforcementTier: "smallSteps", thirtyMarriedHomeowner: 22, wealthShareUnder30: 5, trump2024: 50.6, harris2024: 47.5 },
  { state: "New Hampshire", abbr: "NH", native: 86, antiImmig: 40, gdp: 126, enforcementScore: 2.5, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 29, wealthShareUnder30: 6, trump2024: 47.9, harris2024: 50.7 },
  { state: "New Jersey", abbr: "NJ", native: 48, antiImmig: 27, gdp: 887, enforcementScore: 3.9, enforcementTier: "broadSanctuary", thirtyMarriedHomeowner: 22, wealthShareUnder30: 5, trump2024: 46.1, harris2024: 52.0 },
  { state: "New Mexico", abbr: "NM", native: 35, antiImmig: 30, gdp: 153, enforcementScore: 3.2, enforcementTier: "limitedProtections", thirtyMarriedHomeowner: 22, wealthShareUnder30: 5, trump2024: 45.9, harris2024: 51.9 },
  { state: "New York", abbr: "NY", native: 51, antiImmig: 27, gdp: 2468, enforcementScore: 3.7, enforcementTier: "limitedProtections", thirtyMarriedHomeowner: 17, wealthShareUnder30: 4, trump2024: 43.3, harris2024: 55.9 },
  { state: "North Carolina", abbr: "NC", native: 58, antiImmig: 37, gdp: 894, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement", thirtyMarriedHomeowner: 27, wealthShareUnder30: 6, trump2024: 50.9, harris2024: 47.7 },
  { state: "North Dakota", abbr: "ND", native: 80, antiImmig: 39, gdp: 82, enforcementScore: 2.7, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 36, wealthShareUnder30: 8, trump2024: 67.0, harris2024: 30.5 },
  { state: "Ohio", abbr: "OH", native: 74, antiImmig: 40, gdp: 967, enforcementScore: 2.9, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 30, wealthShareUnder30: 7, trump2024: 55.1, harris2024: 43.9 },
  { state: "Oklahoma", abbr: "OK", native: 58, antiImmig: 38, gdp: 274, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement", thirtyMarriedHomeowner: 30, wealthShareUnder30: 7, trump2024: 66.2, harris2024: 31.9 },
  { state: "Oregon", abbr: "OR", native: 69, antiImmig: 28, gdp: 343, enforcementScore: 4.3, enforcementTier: "mostProtective", thirtyMarriedHomeowner: 25, wealthShareUnder30: 6, trump2024: 41.0, harris2024: 55.3 },
  { state: "Pennsylvania", abbr: "PA", native: 71, antiImmig: 38, gdp: 1056, enforcementScore: 3.0, enforcementTier: "noLaws", thirtyMarriedHomeowner: 28, wealthShareUnder30: 6, trump2024: 50.4, harris2024: 48.7 },
  { state: "Rhode Island", abbr: "RI", native: 66, antiImmig: 29, gdp: 84, enforcementScore: 3.3, enforcementTier: "smallSteps", thirtyMarriedHomeowner: 21, wealthShareUnder30: 5, trump2024: 41.8, harris2024: 55.5 },
  { state: "South Carolina", abbr: "SC", native: 62, antiImmig: 38, gdp: 379, enforcementScore: 2.5, enforcementTier: "broadAntiSanctuary", thirtyMarriedHomeowner: 27, wealthShareUnder30: 6, trump2024: 58.2, harris2024: 40.4 },
  { state: "South Dakota", abbr: "SD", native: 78, antiImmig: 43, gdp: 81, enforcementScore: 3.0, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 35, wealthShareUnder30: 8, trump2024: 63.4, harris2024: 34.2 },
  { state: "Tennessee", abbr: "TN", native: 69, antiImmig: 43, gdp: 590, enforcementScore: 2.4, enforcementTier: "broadAntiSanctuary", thirtyMarriedHomeowner: 29, wealthShareUnder30: 6, trump2024: 64.2, harris2024: 34.5 },
  { state: "Texas", abbr: "TX", native: 37, antiImmig: 34, gdp: 2904, enforcementScore: 1.6, enforcementTier: "mostFarReaching", thirtyMarriedHomeowner: 25, wealthShareUnder30: 6, trump2024: 56.1, harris2024: 42.5 },
  { state: "Utah", abbr: "UT", native: 73, antiImmig: 33, gdp: 316, enforcementScore: 2.6, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 41, wealthShareUnder30: 9, trump2024: 59.4, harris2024: 37.8 },
  { state: "Vermont", abbr: "VT", native: 89, antiImmig: 35, gdp: 48, enforcementScore: 3.9, enforcementTier: "broadSanctuary", thirtyMarriedHomeowner: 27, wealthShareUnder30: 6, trump2024: 32.3, harris2024: 63.8 },
  { state: "Virginia", abbr: "VA", native: 56, antiImmig: 35, gdp: 798, enforcementScore: 3.3, enforcementTier: "limitedProtections", thirtyMarriedHomeowner: 27, wealthShareUnder30: 6, trump2024: 46.1, harris2024: 51.8 },
  { state: "Washington", abbr: "WA", native: 60, antiImmig: 31, gdp: 895, enforcementScore: 3.9, enforcementTier: "broadSanctuary", thirtyMarriedHomeowner: 26, wealthShareUnder30: 6, trump2024: 39.0, harris2024: 57.2 },
  { state: "West Virginia", abbr: "WV", native: 88, antiImmig: 47, gdp: 109, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement", thirtyMarriedHomeowner: 27, wealthShareUnder30: 6, trump2024: 70.0, harris2024: 28.1 },
  { state: "Wisconsin", abbr: "WI", native: 77, antiImmig: 37, gdp: 473, enforcementScore: 3.0, enforcementTier: "noLaws", thirtyMarriedHomeowner: 32, wealthShareUnder30: 7, trump2024: 49.6, harris2024: 48.7 },
  { state: "Wyoming", abbr: "WY", native: 81, antiImmig: 48, gdp: 53, enforcementScore: 2.9, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 34, wealthShareUnder30: 8, trump2024: 71.6, harris2024: 25.8 },
]

/** Name, slug, and abbreviation for every state: safe to import from client components */
export const stateNav: { state: string; slug: string; abbr: string }[] = stateMapData.map((s) => ({
  state: s.state,
  slug: slugify(s.state),
  abbr: s.abbr,
}))

export const stateNavBySlug = Object.fromEntries(stateNav.map((s) => [s.slug, s]))
export const stateNavByAbbr = Object.fromEntries(stateNav.map((s) => [s.abbr, s]))

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
export const minStateThirtyMarriedHomeowner = Math.min(
  ...stateMapData.map((s) => s.thirtyMarriedHomeowner)
)
export const maxStateThirtyMarriedHomeowner = Math.max(
  ...stateMapData.map((s) => s.thirtyMarriedHomeowner)
)
export const minStateWealthShareUnder30 = Math.min(
  ...stateMapData.map((s) => s.wealthShareUnder30)
)
export const maxStateWealthShareUnder30 = Math.max(
  ...stateMapData.map((s) => s.wealthShareUnder30)
)

/** Enforcement intensity in [0, 1] — more ICE cooperation (lower ILRC score) scores higher */
export function enforcementIntensity(score: number): number {
  return 1 - rangeIntensity(score, minStateEnforcementScore, maxStateEnforcementScore)
}

/** Margins at or beyond this many points take the deepest shade (DC's ~84 would wash out the rest) */
export const ELECTION_MARGIN_CAP = 40

/** 2024 Trump-minus-Harris margin in points: positive is a Trump win */
export function election2024Margin(d: Pick<StateMapMetrics, "trump2024" | "harris2024">): number {
  return d.trump2024 - d.harris2024
}

/** Diverging position in [0, 1]: 0 = Harris by the cap or more, 0.5 = tied, 1 = Trump by the cap or more */
export function election2024Intensity(d: Pick<StateMapMetrics, "trump2024" | "harris2024">): number {
  return rangeIntensity(election2024Margin(d), -ELECTION_MARGIN_CAP, ELECTION_MARGIN_CAP)
}

/** Winner first, e.g. "Trump +1.7 (50.4% – 48.7%)" */
export function formatElection2024(d: Pick<StateMapMetrics, "trump2024" | "harris2024">): string {
  const margin = election2024Margin(d)
  const [winner, won, lost] =
    margin >= 0 ? ["Trump", d.trump2024, d.harris2024] : ["Harris", d.harris2024, d.trump2024]
  return `${winner} +${Math.abs(margin).toFixed(1)} (${won.toFixed(1)}% – ${lost.toFixed(1)}%)`
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

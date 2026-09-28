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

export type CountyDemographics = {
  /** County name, without the "County" suffix (matches public/geo/tx-counties-10m.json) */
  name: string
  /** 5-digit state + county FIPS code */
  fips: string
  /** White alone, not Hispanic or Latino, % of county population */
  nonHispanicWhitePct: number
  /** Hispanic or Latino, of any race, % of county population */
  hispanicPct: number
  /** Black or African American alone, % of county population (not Hispanic-origin-exclusive) */
  blackPct: number
  /** Asian alone, % of county population (not Hispanic-origin-exclusive) */
  asianPct: number
}

export type CountyEthnicBreakdown = Record<PopulationGroup, number> & { other: number }

/**
 * Approximates a county's ethnic makeup using the same categories as the state's
 * "Population by ethnic group" chart (see PopulationPoint above). Hispanic, African (Black
 * alone), and Asian alone come straight from ACS county tables; Asian is split into
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
  const indian = Math.round(county.asianPct * indianRatio * 10) / 10
  const eastAsian = Math.round((county.asianPct - indian) * 10) / 10
  const arab = 0
  const other = Math.max(
    0,
    Math.round((100 - european - hispanic - african - indian - eastAsian) * 10) / 10
  )

  return { european, hispanic, african, indian, eastAsian, arab, other }
}

export const countySlug = slugify

export function getCountyBySlug(
  state: StateDemographics,
  slug: string
): CountyDemographics | undefined {
  return state.countyDemographics?.find((c) => countySlug(c.name) === slug)
}

/** States with a county-level choropleth (i.e. `countyDemographics` populated) */
export function statesWithCounties(): StateDemographics[] {
  return statesData.filter((s) => (s.countyDemographics?.length ?? 0) > 0)
}

/** TopoJSON path for a state's county map, e.g. `/geo/tx-counties-10m.json` */
export function countyGeoUrl(state: StateDemographics): string {
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
  /** Per-county breakdown for the county choropleth; only populated for states with a map */
  countyDemographics?: CountyDemographics[]
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
    thirtyMarriedHomeowner: 25,
    // Census Bureau. Broad groups: 1960 census (final population counts, PC(1)-45B Texas), WP56
    // table 58 (1970 15% sample, 1980, 1990), population estimates April 1 bases (2000, 2010,
    // 2020) and July 1, 2025. Indian and East Asian: census SF1 PCT5 (2000, 2010), ACS B02015
    // (2016–2020 5-year; 2024 1-year for 2025). Arab: ancestry, census SF3 PCT18 (2000) and ACS
    // B04006 (2010 1-year, 2016–2020 5-year, 2024 1-year).
    // Hispanic origin was not tabulated in 1960; Hispanic residents were classified as White, so
    // 1960's non-Hispanic White figure is overstated relative to every later year.
    populationHistory: [
      { year: 1960, european: 87.4, arab: null, indian: null, eastAsian: null, african: 12.4, hispanic: 0, other: 0.2 },
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
    // American Community Survey 2020 5-year estimates, Table DP05: White alone not Hispanic
    // or Latino, Hispanic or Latino (any race), Black or African American alone, and Asian
    // alone, all as % of county population. FIPS codes per the Census Bureau's Texas county
    // code assignments. Black/Asian figures aren't Hispanic-origin-exclusive (a small share
    // of each county's Hispanic population is also Black or Asian), so ethnic breakdowns
    // derived from these (see countyEthnicBreakdown) are approximate, matching this app's
    // other stylized metrics.
    countyDemographics: [
      { name: "Anderson", fips: "48001", nonHispanicWhitePct: 58.7, hispanicPct: 18, blackPct: 21.7, asianPct: 0.9 },
      { name: "Andrews", fips: "48003", nonHispanicWhitePct: 39.9, hispanicPct: 56.6, blackPct: 1.9, asianPct: 0.8 },
      { name: "Angelina", fips: "48005", nonHispanicWhitePct: 60.3, hispanicPct: 22.5, blackPct: 15.5, asianPct: 1.1 },
      { name: "Aransas", fips: "48007", nonHispanicWhitePct: 67.5, hispanicPct: 27.4, blackPct: 1.7, asianPct: 2 },
      { name: "Archer", fips: "48009", nonHispanicWhitePct: 88.3, hispanicPct: 8.2, blackPct: 1.2, asianPct: 0.5 },
      { name: "Armstrong", fips: "48011", nonHispanicWhitePct: 89.1, hispanicPct: 8, blackPct: 1.1, asianPct: 0.2 },
      { name: "Atascosa", fips: "48013", nonHispanicWhitePct: 33.1, hispanicPct: 64.7, blackPct: 1.3, asianPct: 0.6 },
      { name: "Austin", fips: "48015", nonHispanicWhitePct: 61.7, hispanicPct: 27.6, blackPct: 9.3, asianPct: 0.8 },
      { name: "Bailey", fips: "48017", nonHispanicWhitePct: 33, hispanicPct: 64.1, blackPct: 2.2, asianPct: 0.9 },
      { name: "Bandera", fips: "48019", nonHispanicWhitePct: 77.2, hispanicPct: 19.4, blackPct: 1.1, asianPct: 0.6 },
      { name: "Bastrop", fips: "48021", nonHispanicWhitePct: 52, hispanicPct: 38.7, blackPct: 7.4, asianPct: 0.9 },
      { name: "Baylor", fips: "48023", nonHispanicWhitePct: 81.3, hispanicPct: 13.7, blackPct: 3, asianPct: 0.5 },
      { name: "Bee", fips: "48025", nonHispanicWhitePct: 30.9, hispanicPct: 59.3, blackPct: 8.9, asianPct: 0.6 },
      { name: "Bell", fips: "48027", nonHispanicWhitePct: 44.8, hispanicPct: 25.3, blackPct: 24.4, asianPct: 3.3 },
      { name: "Bexar", fips: "48029", nonHispanicWhitePct: 27.4, hispanicPct: 60.5, blackPct: 8.5, asianPct: 3.3 },
      { name: "Blanco", fips: "48031", nonHispanicWhitePct: 76.4, hispanicPct: 19.8, blackPct: 1.6, asianPct: 1.1 },
      { name: "Borden", fips: "48033", nonHispanicWhitePct: 78.2, hispanicPct: 18.7, blackPct: 0.9, asianPct: 0.2 },
      { name: "Bosque", fips: "48035", nonHispanicWhitePct: 77.2, hispanicPct: 19, blackPct: 2.1, asianPct: 0.6 },
      { name: "Bowie", fips: "48037", nonHispanicWhitePct: 63.1, hispanicPct: 7.8, blackPct: 25.4, asianPct: 1.4 },
      { name: "Brazoria", fips: "48039", nonHispanicWhitePct: 46.2, hispanicPct: 31.1, blackPct: 14.7, asianPct: 7 },
      { name: "Brazos", fips: "48041", nonHispanicWhitePct: 55.3, hispanicPct: 26, blackPct: 11, asianPct: 6.6 },
      { name: "Brewster", fips: "48043", nonHispanicWhitePct: 50.4, hispanicPct: 45, blackPct: 1.6, asianPct: 1.4 },
      { name: "Briscoe", fips: "48045", nonHispanicWhitePct: 69.2, hispanicPct: 24.8, blackPct: 3.6, asianPct: 0.3 },
      { name: "Brooks", fips: "48047", nonHispanicWhitePct: 6.6, hispanicPct: 91.6, blackPct: 1, asianPct: 1.1 },
      { name: "Brown", fips: "48049", nonHispanicWhitePct: 71, hispanicPct: 22.7, blackPct: 4.1, asianPct: 0.8 },
      { name: "Burleson", fips: "48051", nonHispanicWhitePct: 64.4, hispanicPct: 20.8, blackPct: 12.9, asianPct: 0.4 },
      { name: "Burnet", fips: "48053", nonHispanicWhitePct: 72.9, hispanicPct: 22.7, blackPct: 2.1, asianPct: 0.9 },
      { name: "Caldwell", fips: "48055", nonHispanicWhitePct: 39, hispanicPct: 53, blackPct: 6.5, asianPct: 1 },
      { name: "Calhoun", fips: "48057", nonHispanicWhitePct: 41.7, hispanicPct: 49.1, blackPct: 3.2, asianPct: 5.5 },
      { name: "Callahan", fips: "48059", nonHispanicWhitePct: 85.8, hispanicPct: 9.9, blackPct: 1.7, asianPct: 0.7 },
      { name: "Cameron", fips: "48061", nonHispanicWhitePct: 8.8, hispanicPct: 89.8, blackPct: 0.8, asianPct: 0.8 },
      { name: "Camp", fips: "48063", nonHispanicWhitePct: 55.2, hispanicPct: 25.7, blackPct: 16.7, asianPct: 1 },
      { name: "Carson", fips: "48065", nonHispanicWhitePct: 85, hispanicPct: 10.5, blackPct: 0.9, asianPct: 0.5 },
      { name: "Cass", fips: "48067", nonHispanicWhitePct: 76.3, hispanicPct: 4.7, blackPct: 16.9, asianPct: 0.5 },
      { name: "Castro", fips: "48069", nonHispanicWhitePct: 30.9, hispanicPct: 65.5, blackPct: 2.7, asianPct: 0.7 },
      { name: "Chambers", fips: "48071", nonHispanicWhitePct: 66.3, hispanicPct: 22.8, blackPct: 8.5, asianPct: 1.3 },
      { name: "Cherokee", fips: "48073", nonHispanicWhitePct: 60.2, hispanicPct: 23.6, blackPct: 14.6, asianPct: 0.6 },
      { name: "Childress", fips: "48075", nonHispanicWhitePct: 55.3, hispanicPct: 32, blackPct: 10.9, asianPct: 0.7 },
      { name: "Clay", fips: "48077", nonHispanicWhitePct: 89.4, hispanicPct: 6.5, blackPct: 0.9, asianPct: 0.5 },
      { name: "Cochran", fips: "48079", nonHispanicWhitePct: 34.9, hispanicPct: 59.9, blackPct: 4.3, asianPct: 0.5 },
      { name: "Coke", fips: "48081", nonHispanicWhitePct: 75.1, hispanicPct: 21.5, blackPct: 0.9, asianPct: 0.1 },
      { name: "Coleman", fips: "48083", nonHispanicWhitePct: 76.4, hispanicPct: 17.5, blackPct: 3.2, asianPct: 1.1 },
      { name: "Collin", fips: "48085", nonHispanicWhitePct: 55.9, hispanicPct: 15.4, blackPct: 10.5, asianPct: 15.9 },
      { name: "Collingsworth", fips: "48087", nonHispanicWhitePct: 57.8, hispanicPct: 33.9, blackPct: 6.1, asianPct: 0.5 },
      { name: "Colorado", fips: "48089", nonHispanicWhitePct: 55.9, hispanicPct: 30.6, blackPct: 12.8, asianPct: 0.7 },
      { name: "Comal", fips: "48091", nonHispanicWhitePct: 67, hispanicPct: 27.8, blackPct: 2.5, asianPct: 1.4 },
      { name: "Comanche", fips: "48093", nonHispanicWhitePct: 69.1, hispanicPct: 28.3, blackPct: 1.1, asianPct: 0.6 },
      { name: "Concho", fips: "48095", nonHispanicWhitePct: 40.4, hispanicPct: 55.3, blackPct: 2.9, asianPct: 1.4 },
      { name: "Cooke", fips: "48097", nonHispanicWhitePct: 74.7, hispanicPct: 18.8, blackPct: 3.4, asianPct: 1.1 },
      { name: "Coryell", fips: "48099", nonHispanicWhitePct: 57.9, hispanicPct: 18.7, blackPct: 17.7, asianPct: 2.1 },
      { name: "Cottle", fips: "48101", nonHispanicWhitePct: 63.6, hispanicPct: 24.6, blackPct: 10.9, asianPct: 0.1 },
      { name: "Crane", fips: "48103", nonHispanicWhitePct: 30.4, hispanicPct: 65.2, blackPct: 3.7, asianPct: 0.9 },
      { name: "Crockett", fips: "48105", nonHispanicWhitePct: 31.3, hispanicPct: 66.3, blackPct: 1.6, asianPct: 0.7 },
      { name: "Crosby", fips: "48107", nonHispanicWhitePct: 39.6, hispanicPct: 55.8, blackPct: 3.9, asianPct: 0.3 },
      { name: "Culberson", fips: "48109", nonHispanicWhitePct: 23.1, hispanicPct: 72.1, blackPct: 1, asianPct: 2 },
      { name: "Dallam", fips: "48111", nonHispanicWhitePct: 48, hispanicPct: 47.4, blackPct: 2.4, asianPct: 1.2 },
      { name: "Dallas", fips: "48113", nonHispanicWhitePct: 28.6, hispanicPct: 40.5, blackPct: 23.5, asianPct: 6.7 },
      { name: "Dawson", fips: "48115", nonHispanicWhitePct: 34.9, hispanicPct: 58.1, blackPct: 6.1, asianPct: 1.1 },
      { name: "Deaf Smith", fips: "48117", nonHispanicWhitePct: 24.1, hispanicPct: 73.5, blackPct: 2, asianPct: 0.6 },
      { name: "Delta", fips: "48119", nonHispanicWhitePct: 80.1, hispanicPct: 8.5, blackPct: 6.7, asianPct: 0.7 },
      { name: "Denton", fips: "48121", nonHispanicWhitePct: 58.3, hispanicPct: 19.5, blackPct: 10.6, asianPct: 9.5 },
      { name: "DeWitt", fips: "48123", nonHispanicWhitePct: 54.7, hispanicPct: 35.5, blackPct: 9.5, asianPct: 0.4 },
      { name: "Dickens", fips: "48125", nonHispanicWhitePct: 60.8, hispanicPct: 31.6, blackPct: 5.9, asianPct: 1.3 },
      { name: "Dimmit", fips: "48127", nonHispanicWhitePct: 10.5, hispanicPct: 87.4, blackPct: 1.6, asianPct: 0.7 },
      { name: "Donley", fips: "48129", nonHispanicWhitePct: 79.7, hispanicPct: 11.9, blackPct: 5.9, asianPct: 0.8 },
      { name: "Duval", fips: "48131", nonHispanicWhitePct: 9, hispanicPct: 89.1, blackPct: 1.5, asianPct: 0.5 },
      { name: "Eastland", fips: "48133", nonHispanicWhitePct: 78.7, hispanicPct: 16.8, blackPct: 2.1, asianPct: 0.7 },
      { name: "Ector", fips: "48135", nonHispanicWhitePct: 31.8, hispanicPct: 61.3, blackPct: 5.2, asianPct: 1.2 },
      { name: "Edwards", fips: "48137", nonHispanicWhitePct: 42.5, hispanicPct: 55.3, blackPct: 1.1, asianPct: 0.7 },
      { name: "El Paso", fips: "48141", nonHispanicWhitePct: 11.6, hispanicPct: 83, blackPct: 3.9, asianPct: 1.3 },
      { name: "Ellis", fips: "48139", nonHispanicWhitePct: 59.9, hispanicPct: 26.6, blackPct: 11.4, asianPct: 0.8 },
      { name: "Erath", fips: "48143", nonHispanicWhitePct: 74.1, hispanicPct: 21.7, blackPct: 2, asianPct: 0.9 },
      { name: "Falls", fips: "48145", nonHispanicWhitePct: 50.8, hispanicPct: 23.7, blackPct: 24.2, asianPct: 0.6 },
      { name: "Fannin", fips: "48147", nonHispanicWhitePct: 78.5, hispanicPct: 11.6, blackPct: 6.6, asianPct: 0.8 },
      { name: "Fayette", fips: "48149", nonHispanicWhitePct: 70.7, hispanicPct: 21.6, blackPct: 6.6, asianPct: 0.5 },
      { name: "Fisher", fips: "48151", nonHispanicWhitePct: 65.7, hispanicPct: 28.6, blackPct: 4.2, asianPct: 0.5 },
      { name: "Floyd", fips: "48153", nonHispanicWhitePct: 35.9, hispanicPct: 59.5, blackPct: 4.1, asianPct: 0.5 },
      { name: "Foard", fips: "48155", nonHispanicWhitePct: 74.3, hispanicPct: 18.8, blackPct: 4.8, asianPct: 0.8 },
      { name: "Fort Bend", fips: "48157", nonHispanicWhitePct: 32.5, hispanicPct: 24.7, blackPct: 21.1, asianPct: 20.8 },
      { name: "Franklin", fips: "48159", nonHispanicWhitePct: 78.5, hispanicPct: 14.8, blackPct: 4, asianPct: 1 },
      { name: "Freestone", fips: "48161", nonHispanicWhitePct: 66.6, hispanicPct: 15.8, blackPct: 15.8, asianPct: 0.8 },
      { name: "Frio", fips: "48163", nonHispanicWhitePct: 14.6, hispanicPct: 79.3, blackPct: 3.9, asianPct: 2.5 },
      { name: "Gaines", fips: "48165", nonHispanicWhitePct: 54.7, hispanicPct: 42.4, blackPct: 2.2, asianPct: 0.4 },
      { name: "Galveston", fips: "48167", nonHispanicWhitePct: 57, hispanicPct: 25, blackPct: 13.3, asianPct: 3.5 },
      { name: "Garza", fips: "48169", nonHispanicWhitePct: 39.6, hispanicPct: 52.4, blackPct: 7.6, asianPct: 0.6 },
      { name: "Gillespie", fips: "48171", nonHispanicWhitePct: 74.3, hispanicPct: 23.7, blackPct: 0.7, asianPct: 0.5 },
      { name: "Glasscock", fips: "48173", nonHispanicWhitePct: 59.2, hispanicPct: 38.5, blackPct: 1.6, asianPct: 0.1 },
      { name: "Goliad", fips: "48175", nonHispanicWhitePct: 57.6, hispanicPct: 36.4, blackPct: 5.3, asianPct: 0.5 },
      { name: "Gonzales", fips: "48177", nonHispanicWhitePct: 41.1, hispanicPct: 51.5, blackPct: 7.3, asianPct: 0.5 },
      { name: "Gray", fips: "48179", nonHispanicWhitePct: 63.2, hispanicPct: 29.2, blackPct: 5.2, asianPct: 0.7 },
      { name: "Grayson", fips: "48181", nonHispanicWhitePct: 75, hispanicPct: 13.8, blackPct: 6.3, asianPct: 1.5 },
      { name: "Gregg", fips: "48183", nonHispanicWhitePct: 57.1, hispanicPct: 19.2, blackPct: 20.9, asianPct: 1.4 },
      { name: "Grimes", fips: "48185", nonHispanicWhitePct: 58.3, hispanicPct: 24.6, blackPct: 15.6, asianPct: 0.4 },
      { name: "Guadalupe", fips: "48187", nonHispanicWhitePct: 49.8, hispanicPct: 38.3, blackPct: 8.6, asianPct: 2 },
      { name: "Hale", fips: "48189", nonHispanicWhitePct: 33.5, hispanicPct: 59.7, blackPct: 5.8, asianPct: 0.7 },
      { name: "Hall", fips: "48191", nonHispanicWhitePct: 55.7, hispanicPct: 34.2, blackPct: 9.2, asianPct: 0.4 },
      { name: "Hamilton", fips: "48193", nonHispanicWhitePct: 84.1, hispanicPct: 13, blackPct: 1, asianPct: 0.8 },
      { name: "Hansford", fips: "48195", nonHispanicWhitePct: 49.6, hispanicPct: 48.3, blackPct: 1, asianPct: 0.4 },
      { name: "Hardeman", fips: "48197", nonHispanicWhitePct: 68.2, hispanicPct: 23.8, blackPct: 5.9, asianPct: 0.6 },
      { name: "Hardin", fips: "48199", nonHispanicWhitePct: 86.3, hispanicPct: 5.9, blackPct: 5.6, asianPct: 0.7 },
      { name: "Harris", fips: "48201", nonHispanicWhitePct: 29.1, hispanicPct: 43.3, blackPct: 19.9, asianPct: 7.4 },
      { name: "Harrison", fips: "48203", nonHispanicWhitePct: 63.2, hispanicPct: 13.6, blackPct: 21.1, asianPct: 0.8 },
      { name: "Hartley", fips: "48205", nonHispanicWhitePct: 64.3, hispanicPct: 27.1, blackPct: 7, asianPct: 0.7 },
      { name: "Haskell", fips: "48207", nonHispanicWhitePct: 63.3, hispanicPct: 29.7, blackPct: 4.7, asianPct: 1 },
      { name: "Hays", fips: "48209", nonHispanicWhitePct: 53.2, hispanicPct: 39.6, blackPct: 4.4, asianPct: 1.7 },
      { name: "Hemphill", fips: "48211", nonHispanicWhitePct: 62.6, hispanicPct: 34.2, blackPct: 0.8, asianPct: 1.3 },
      { name: "Henderson", fips: "48213", nonHispanicWhitePct: 77.7, hispanicPct: 13.3, blackPct: 6.4, asianPct: 0.7 },
      { name: "Hidalgo", fips: "48215", nonHispanicWhitePct: 6, hispanicPct: 92.4, blackPct: 0.9, asianPct: 1.1 },
      { name: "Hill", fips: "48217", nonHispanicWhitePct: 69.8, hispanicPct: 21.4, blackPct: 6.8, asianPct: 0.6 },
      { name: "Hockley", fips: "48219", nonHispanicWhitePct: 46.1, hispanicPct: 48.7, blackPct: 4, asianPct: 0.6 },
      { name: "Hood", fips: "48221", nonHispanicWhitePct: 83.5, hispanicPct: 12.9, blackPct: 1.1, asianPct: 0.9 },
      { name: "Hopkins", fips: "48223", nonHispanicWhitePct: 72.9, hispanicPct: 17.4, blackPct: 7.4, asianPct: 0.7 },
      { name: "Houston", fips: "48225", nonHispanicWhitePct: 61.3, hispanicPct: 11.5, blackPct: 25.5, asianPct: 0.8 },
      { name: "Howard", fips: "48227", nonHispanicWhitePct: 48.1, hispanicPct: 43.1, blackPct: 7.2, asianPct: 1.2 },
      { name: "Hudspeth", fips: "48229", nonHispanicWhitePct: 16.6, hispanicPct: 78, blackPct: 3.6, asianPct: 1.5 },
      { name: "Hunt", fips: "48231", nonHispanicWhitePct: 71, hispanicPct: 17, blackPct: 8.3, asianPct: 1.7 },
      { name: "Hutchinson", fips: "48233", nonHispanicWhitePct: 69.5, hispanicPct: 24, blackPct: 3, asianPct: 0.7 },
      { name: "Irion", fips: "48235", nonHispanicWhitePct: 70.4, hispanicPct: 26.3, blackPct: 1.2, asianPct: 0.3 },
      { name: "Jack", fips: "48237", nonHispanicWhitePct: 76.8, hispanicPct: 17.3, blackPct: 4, asianPct: 0.5 },
      { name: "Jackson", fips: "48239", nonHispanicWhitePct: 57.6, hispanicPct: 34, blackPct: 6.5, asianPct: 1.1 },
      { name: "Jasper", fips: "48241", nonHispanicWhitePct: 74.8, hispanicPct: 6.9, blackPct: 16.1, asianPct: 0.5 },
      { name: "Jeff Davis", fips: "48243", nonHispanicWhitePct: 62.8, hispanicPct: 32.8, blackPct: 1.4, asianPct: 1.1 },
      { name: "Jefferson", fips: "48245", nonHispanicWhitePct: 39.8, hispanicPct: 21.5, blackPct: 34.1, asianPct: 4 },
      { name: "Jim Hogg", fips: "48247", nonHispanicWhitePct: 5.5, hispanicPct: 92.8, blackPct: 0.8, asianPct: 0.5 },
      { name: "Jim Wells", fips: "48249", nonHispanicWhitePct: 17.8, hispanicPct: 80.4, blackPct: 1.1, asianPct: 0.5 },
      { name: "Johnson", fips: "48251", nonHispanicWhitePct: 71.2, hispanicPct: 22, blackPct: 3.8, asianPct: 0.9 },
      { name: "Jones", fips: "48253", nonHispanicWhitePct: 58.3, hispanicPct: 27.8, blackPct: 13.3, asianPct: 0.8 },
      { name: "Karnes", fips: "48255", nonHispanicWhitePct: 35.2, hispanicPct: 55.3, blackPct: 9.3, asianPct: 0.5 },
      { name: "Kaufman", fips: "48257", nonHispanicWhitePct: 62.2, hispanicPct: 22.4, blackPct: 12.5, asianPct: 1.4 },
      { name: "Kendall", fips: "48259", nonHispanicWhitePct: 71.6, hispanicPct: 24.4, blackPct: 1.4, asianPct: 1.4 },
      { name: "Kenedy", fips: "48261", nonHispanicWhitePct: 20.8, hispanicPct: 73.3, blackPct: 3.8, asianPct: 0.7 },
      { name: "Kent", fips: "48263", nonHispanicWhitePct: 76.3, hispanicPct: 19.7, blackPct: 1.5, asianPct: 0.1 },
      { name: "Kerr", fips: "48265", nonHispanicWhitePct: 68.4, hispanicPct: 27.5, blackPct: 1.9, asianPct: 1.1 },
      { name: "Kimble", fips: "48267", nonHispanicWhitePct: 72.7, hispanicPct: 24.9, blackPct: 0.7, asianPct: 0.8 },
      { name: "King", fips: "48269", nonHispanicWhitePct: 80.9, hispanicPct: 15.5, blackPct: 0, asianPct: 0 },
      { name: "Kinney", fips: "48271", nonHispanicWhitePct: 36.3, hispanicPct: 60.2, blackPct: 2.1, asianPct: 0.4 },
      { name: "Kleberg", fips: "48273", nonHispanicWhitePct: 19.9, hispanicPct: 73.4, blackPct: 4.2, asianPct: 2.5 },
      { name: "Knox", fips: "48275", nonHispanicWhitePct: 57.3, hispanicPct: 34.9, blackPct: 6.2, asianPct: 0.3 },
      { name: "La Salle", fips: "48283", nonHispanicWhitePct: 11.4, hispanicPct: 87.1, blackPct: 1.3, asianPct: 0.4 },
      { name: "Lamar", fips: "48277", nonHispanicWhitePct: 74, hispanicPct: 8.1, blackPct: 13.4, asianPct: 0.8 },
      { name: "Lamb", fips: "48279", nonHispanicWhitePct: 39.2, hispanicPct: 55.9, blackPct: 4.6, asianPct: 0.4 },
      { name: "Lampasas", fips: "48281", nonHispanicWhitePct: 72.1, hispanicPct: 19.8, blackPct: 4.1, asianPct: 1.4 },
      { name: "Lavaca", fips: "48285", nonHispanicWhitePct: 73.2, hispanicPct: 19.2, blackPct: 6.6, asianPct: 0.5 },
      { name: "Lee", fips: "48287", nonHispanicWhitePct: 63.4, hispanicPct: 23.9, blackPct: 11.1, asianPct: 0.6 },
      { name: "Leon", fips: "48289", nonHispanicWhitePct: 75.8, hispanicPct: 15, blackPct: 7.2, asianPct: 0.7 },
      { name: "Liberty", fips: "48291", nonHispanicWhitePct: 61.5, hispanicPct: 26.8, blackPct: 10, asianPct: 0.8 },
      { name: "Limestone", fips: "48293", nonHispanicWhitePct: 58, hispanicPct: 22.7, blackPct: 17.4, asianPct: 0.8 },
      { name: "Lipscomb", fips: "48295", nonHispanicWhitePct: 61.1, hispanicPct: 34.5, blackPct: 1.9, asianPct: 0.8 },
      { name: "Live Oak", fips: "48297", nonHispanicWhitePct: 53.4, hispanicPct: 40.4, blackPct: 4.8, asianPct: 0.8 },
      { name: "Llano", fips: "48299", nonHispanicWhitePct: 85.8, hispanicPct: 10.9, blackPct: 1.2, asianPct: 0.6 },
      { name: "Loving", fips: "48301", nonHispanicWhitePct: 78.3, hispanicPct: 16.4, blackPct: 4.6, asianPct: 0 },
      { name: "Lubbock", fips: "48303", nonHispanicWhitePct: 53, hispanicPct: 35.9, blackPct: 7.8, asianPct: 2.5 },
      { name: "Lynn", fips: "48305", nonHispanicWhitePct: 49.1, hispanicPct: 47.2, blackPct: 2.8, asianPct: 0.5 },
      { name: "Madison", fips: "48313", nonHispanicWhitePct: 55, hispanicPct: 23.4, blackPct: 20, asianPct: 0.8 },
      { name: "Marion", fips: "48315", nonHispanicWhitePct: 70.6, hispanicPct: 4.3, blackPct: 21.3, asianPct: 0.9 },
      { name: "Martin", fips: "48317", nonHispanicWhitePct: 49.2, hispanicPct: 47.4, blackPct: 3, asianPct: 0.5 },
      { name: "Mason", fips: "48319", nonHispanicWhitePct: 72.2, hispanicPct: 26.1, blackPct: 0.9, asianPct: 0.3 },
      { name: "Matagorda", fips: "48321", nonHispanicWhitePct: 43.7, hispanicPct: 42.9, blackPct: 11.3, asianPct: 1.9 },
      { name: "Maverick", fips: "48323", nonHispanicWhitePct: 2.7, hispanicPct: 95.2, blackPct: 0.6, asianPct: 0.7 },
      { name: "McCulloch", fips: "48307", nonHispanicWhitePct: 62.9, hispanicPct: 32.9, blackPct: 2.7, asianPct: 0.8 },
      { name: "McLennan", fips: "48309", nonHispanicWhitePct: 55.6, hispanicPct: 26.7, blackPct: 14.9, asianPct: 1.8 },
      { name: "McMullen", fips: "48311", nonHispanicWhitePct: 52.7, hispanicPct: 43, blackPct: 2.7, asianPct: 0.7 },
      { name: "Medina", fips: "48325", nonHispanicWhitePct: 43.2, hispanicPct: 52.4, blackPct: 3, asianPct: 0.9 },
      { name: "Menard", fips: "48327", nonHispanicWhitePct: 60.9, hispanicPct: 36.5, blackPct: 1.6, asianPct: 0.2 },
      { name: "Midland", fips: "48329", nonHispanicWhitePct: 44.9, hispanicPct: 45.3, blackPct: 6.8, asianPct: 2.2 },
      { name: "Milam", fips: "48331", nonHispanicWhitePct: 61.9, hispanicPct: 26.9, blackPct: 9.6, asianPct: 0.9 },
      { name: "Mills", fips: "48333", nonHispanicWhitePct: 79.1, hispanicPct: 18.4, blackPct: 1.1, asianPct: 0.4 },
      { name: "Mitchell", fips: "48335", nonHispanicWhitePct: 48.3, hispanicPct: 40.2, blackPct: 10.5, asianPct: 0.7 },
      { name: "Montague", fips: "48337", nonHispanicWhitePct: 85.5, hispanicPct: 11.3, blackPct: 0.7, asianPct: 0.5 },
      { name: "Montgomery", fips: "48339", nonHispanicWhitePct: 65.1, hispanicPct: 24.8, blackPct: 5.6, asianPct: 3.2 },
      { name: "Moore", fips: "48341", nonHispanicWhitePct: 31.4, hispanicPct: 56.3, blackPct: 3.9, asianPct: 7.5 },
      { name: "Morris", fips: "48343", nonHispanicWhitePct: 63.9, hispanicPct: 10, blackPct: 22.7, asianPct: 0.6 },
      { name: "Motley", fips: "48345", nonHispanicWhitePct: 77.7, hispanicPct: 18.3, blackPct: 2.9, asianPct: 0.2 },
      { name: "Nacogdoches", fips: "48347", nonHispanicWhitePct: 59.2, hispanicPct: 19.7, blackPct: 18.3, asianPct: 1.6 },
      { name: "Navarro", fips: "48349", nonHispanicWhitePct: 55.4, hispanicPct: 28, blackPct: 13.5, asianPct: 0.8 },
      { name: "Newton", fips: "48351", nonHispanicWhitePct: 73, hispanicPct: 3.7, blackPct: 20.3, asianPct: 0.6 },
      { name: "Nolan", fips: "48353", nonHispanicWhitePct: 55, hispanicPct: 38.1, blackPct: 5.2, asianPct: 0.9 },
      { name: "Nueces", fips: "48355", nonHispanicWhitePct: 29, hispanicPct: 64.2, blackPct: 4.3, asianPct: 2.2 },
      { name: "Ochiltree", fips: "48357", nonHispanicWhitePct: 41.9, hispanicPct: 55.4, blackPct: 1.2, asianPct: 0.7 },
      { name: "Oldham", fips: "48359", nonHispanicWhitePct: 77.3, hispanicPct: 16.3, blackPct: 3.4, asianPct: 1.4 },
      { name: "Orange", fips: "48361", nonHispanicWhitePct: 80.4, hispanicPct: 8, blackPct: 8.8, asianPct: 1.2 },
      { name: "Palo Pinto", fips: "48363", nonHispanicWhitePct: 74.8, hispanicPct: 20.2, blackPct: 2.6, asianPct: 0.9 },
      { name: "Panola", fips: "48365", nonHispanicWhitePct: 72.9, hispanicPct: 8.8, blackPct: 15.9, asianPct: 0.9 },
      { name: "Parker", fips: "48367", nonHispanicWhitePct: 82.9, hispanicPct: 12.8, blackPct: 1.6, asianPct: 0.7 },
      { name: "Parmer", fips: "48369", nonHispanicWhitePct: 33.3, hispanicPct: 64.3, blackPct: 1.7, asianPct: 0.9 },
      { name: "Pecos", fips: "48371", nonHispanicWhitePct: 25, hispanicPct: 68.8, blackPct: 4.6, asianPct: 1.1 },
      { name: "Polk", fips: "48373", nonHispanicWhitePct: 70.8, hispanicPct: 15.5, blackPct: 10.2, asianPct: 0.8 },
      { name: "Potter", fips: "48375", nonHispanicWhitePct: 43.4, hispanicPct: 38.7, blackPct: 11, asianPct: 6 },
      { name: "Presidio", fips: "48377", nonHispanicWhitePct: 12.4, hispanicPct: 83, blackPct: 1.5, asianPct: 2.7 },
      { name: "Rains", fips: "48379", nonHispanicWhitePct: 85, hispanicPct: 9.2, blackPct: 2.6, asianPct: 1.1 },
      { name: "Randall", fips: "48381", nonHispanicWhitePct: 70.8, hispanicPct: 22.3, blackPct: 3.5, asianPct: 1.8 },
      { name: "Reagan", fips: "48383", nonHispanicWhitePct: 26.8, hispanicPct: 68.9, blackPct: 3.3, asianPct: 0.6 },
      { name: "Real", fips: "48385", nonHispanicWhitePct: 68.5, hispanicPct: 27.8, blackPct: 1.1, asianPct: 0.4 },
      { name: "Red River", fips: "48387", nonHispanicWhitePct: 73.2, hispanicPct: 7.5, blackPct: 16.8, asianPct: 0.4 },
      { name: "Reeves", fips: "48389", nonHispanicWhitePct: 18.2, hispanicPct: 75, blackPct: 5.2, asianPct: 1.5 },
      { name: "Refugio", fips: "48391", nonHispanicWhitePct: 41.9, hispanicPct: 50.3, blackPct: 6.4, asianPct: 0.9 },
      { name: "Roberts", fips: "48393", nonHispanicWhitePct: 85.8, hispanicPct: 11.2, blackPct: 0.4, asianPct: 0.2 },
      { name: "Robertson", fips: "48395", nonHispanicWhitePct: 56.9, hispanicPct: 21.5, blackPct: 20.3, asianPct: 0.8 },
      { name: "Rockwall", fips: "48397", nonHispanicWhitePct: 70.3, hispanicPct: 18, blackPct: 6.8, asianPct: 3.1 },
      { name: "Runnels", fips: "48399", nonHispanicWhitePct: 61.1, hispanicPct: 34.2, blackPct: 2.4, asianPct: 1.7 },
      { name: "Rusk", fips: "48401", nonHispanicWhitePct: 63, hispanicPct: 17.3, blackPct: 17.6, asianPct: 0.7 },
      { name: "Sabine", fips: "48403", nonHispanicWhitePct: 85.6, hispanicPct: 4.9, blackPct: 6.9, asianPct: 0.3 },
      { name: "San Augustine", fips: "48405", nonHispanicWhitePct: 69.2, hispanicPct: 7.1, blackPct: 22, asianPct: 0.3 },
      { name: "San Jacinto", fips: "48407", nonHispanicWhitePct: 74.6, hispanicPct: 13.2, blackPct: 9.7, asianPct: 0.5 },
      { name: "San Patricio", fips: "48409", nonHispanicWhitePct: 37.8, hispanicPct: 58.4, blackPct: 2, asianPct: 1.2 },
      { name: "San Saba", fips: "48411", nonHispanicWhitePct: 63.5, hispanicPct: 30.7, blackPct: 4, asianPct: 0.5 },
      { name: "Schleicher", fips: "48413", nonHispanicWhitePct: 44.1, hispanicPct: 53.3, blackPct: 1.8, asianPct: 0.4 },
      { name: "Scurry", fips: "48415", nonHispanicWhitePct: 52.6, hispanicPct: 40.6, blackPct: 5.4, asianPct: 0.8 },
      { name: "Shackelford", fips: "48417", nonHispanicWhitePct: 85.7, hispanicPct: 10.9, blackPct: 1.8, asianPct: 0.4 },
      { name: "Shelby", fips: "48419", nonHispanicWhitePct: 61.2, hispanicPct: 18.6, blackPct: 17.8, asianPct: 1.5 },
      { name: "Sherman", fips: "48421", nonHispanicWhitePct: 53.3, hispanicPct: 43.9, blackPct: 1.8, asianPct: 0.9 },
      { name: "Smith", fips: "48423", nonHispanicWhitePct: 59.3, hispanicPct: 19.9, blackPct: 17.8, asianPct: 1.8 },
      { name: "Somervell", fips: "48425", nonHispanicWhitePct: 77.5, hispanicPct: 18.3, blackPct: 1.3, asianPct: 1.1 },
      { name: "Starr", fips: "48427", nonHispanicWhitePct: 3.3, hispanicPct: 96.4, blackPct: 0.4, asianPct: 0.2 },
      { name: "Stephens", fips: "48429", nonHispanicWhitePct: 71, hispanicPct: 23.9, blackPct: 2.8, asianPct: 0.9 },
      { name: "Sterling", fips: "48431", nonHispanicWhitePct: 54.8, hispanicPct: 40.7, blackPct: 2.1, asianPct: 0.5 },
      { name: "Stonewall", fips: "48433", nonHispanicWhitePct: 74.3, hispanicPct: 18.9, blackPct: 3.7, asianPct: 1.6 },
      { name: "Sutton", fips: "48435", nonHispanicWhitePct: 35.7, hispanicPct: 63.1, blackPct: 1, asianPct: 0.6 },
      { name: "Swisher", fips: "48437", nonHispanicWhitePct: 45.7, hispanicPct: 44.5, blackPct: 8.4, asianPct: 0.7 },
      { name: "Tarrant", fips: "48439", nonHispanicWhitePct: 45.9, hispanicPct: 29.2, blackPct: 17.5, asianPct: 5.8 },
      { name: "Taylor", fips: "48441", nonHispanicWhitePct: 63, hispanicPct: 24.8, blackPct: 8.3, asianPct: 2.4 },
      { name: "Terrell", fips: "48443", nonHispanicWhitePct: 40.8, hispanicPct: 54.3, blackPct: 1.5, asianPct: 1 },
      { name: "Terry", fips: "48445", nonHispanicWhitePct: 38.6, hispanicPct: 55.9, blackPct: 4.9, asianPct: 0.6 },
      { name: "Throckmorton", fips: "48447", nonHispanicWhitePct: 82.4, hispanicPct: 14.5, blackPct: 1.3, asianPct: 0.5 },
      { name: "Titus", fips: "48449", nonHispanicWhitePct: 44.3, hispanicPct: 44.1, blackPct: 10, asianPct: 1.2 },
      { name: "Tom Green", fips: "48451", nonHispanicWhitePct: 52.7, hispanicPct: 40.5, blackPct: 4.4, asianPct: 1.4 },
      { name: "Travis", fips: "48453", nonHispanicWhitePct: 48.8, hispanicPct: 33.9, blackPct: 8.9, asianPct: 7.3 },
      { name: "Trinity", fips: "48455", nonHispanicWhitePct: 77.6, hispanicPct: 10.5, blackPct: 9.3, asianPct: 0.6 },
      { name: "Tyler", fips: "48457", nonHispanicWhitePct: 78.5, hispanicPct: 8.1, blackPct: 11.4, asianPct: 0.6 },
      { name: "Upshur", fips: "48459", nonHispanicWhitePct: 80.2, hispanicPct: 9, blackPct: 8, asianPct: 0.5 },
      { name: "Upton", fips: "48461", nonHispanicWhitePct: 41.8, hispanicPct: 53.7, blackPct: 3.4, asianPct: 0.7 },
      { name: "Uvalde", fips: "48463", nonHispanicWhitePct: 25.8, hispanicPct: 72.1, blackPct: 1.2, asianPct: 0.9 },
      { name: "Val Verde", fips: "48465", nonHispanicWhitePct: 14.7, hispanicPct: 82.5, blackPct: 2.1, asianPct: 0.8 },
      { name: "Van Zandt", fips: "48467", nonHispanicWhitePct: 83.4, hispanicPct: 11.2, blackPct: 2.9, asianPct: 0.5 },
      { name: "Victoria", fips: "48469", nonHispanicWhitePct: 44.3, hispanicPct: 47.4, blackPct: 6.6, asianPct: 1.4 },
      { name: "Walker", fips: "48471", nonHispanicWhitePct: 56.4, hispanicPct: 18.1, blackPct: 23.4, asianPct: 1.2 },
      { name: "Waller", fips: "48473", nonHispanicWhitePct: 43.1, hispanicPct: 30.8, blackPct: 24.4, asianPct: 1.2 },
      { name: "Ward", fips: "48475", nonHispanicWhitePct: 39.4, hispanicPct: 54.3, blackPct: 5, asianPct: 0.6 },
      { name: "Washington", fips: "48477", nonHispanicWhitePct: 63.8, hispanicPct: 16.4, blackPct: 17.3, asianPct: 1.9 },
      { name: "Webb", fips: "48479", nonHispanicWhitePct: 3.6, hispanicPct: 95.5, blackPct: 0.7, asianPct: 0.6 },
      { name: "Wharton", fips: "48481", nonHispanicWhitePct: 43.9, hispanicPct: 42, blackPct: 13.8, asianPct: 0.6 },
      { name: "Wheeler", fips: "48483", nonHispanicWhitePct: 68.7, hispanicPct: 25.6, blackPct: 3.2, asianPct: 0.9 },
      { name: "Wichita", fips: "48485", nonHispanicWhitePct: 64.8, hispanicPct: 19.4, blackPct: 11.3, asianPct: 2.2 },
      { name: "Wilbarger", fips: "48487", nonHispanicWhitePct: 57.6, hispanicPct: 29.5, blackPct: 8.2, asianPct: 2.8 },
      { name: "Willacy", fips: "48489", nonHispanicWhitePct: 8.6, hispanicPct: 88.4, blackPct: 2.7, asianPct: 0.9 },
      { name: "Williamson", fips: "48491", nonHispanicWhitePct: 58.6, hispanicPct: 24.8, blackPct: 7.2, asianPct: 7.7 },
      { name: "Wilson", fips: "48493", nonHispanicWhitePct: 56.7, hispanicPct: 40, blackPct: 1.8, asianPct: 0.6 },
      { name: "Winkler", fips: "48495", nonHispanicWhitePct: 34.9, hispanicPct: 60.8, blackPct: 3.3, asianPct: 0.9 },
      { name: "Wise", fips: "48497", nonHispanicWhitePct: 76.3, hispanicPct: 19.7, blackPct: 1.6, asianPct: 0.6 },
      { name: "Wood", fips: "48499", nonHispanicWhitePct: 82.2, hispanicPct: 10.3, blackPct: 5.5, asianPct: 0.6 },
      { name: "Yoakum", fips: "48501", nonHispanicWhitePct: 30.5, hispanicPct: 66.9, blackPct: 1.5, asianPct: 0.5 },
      { name: "Young", fips: "48503", nonHispanicWhitePct: 77.3, hispanicPct: 19.1, blackPct: 1.6, asianPct: 0.9 },
      { name: "Zapata", fips: "48505", nonHispanicWhitePct: 4.8, hispanicPct: 94.6, blackPct: 0.4, asianPct: 0.3 },
      { name: "Zavala", fips: "48507", nonHispanicWhitePct: 5, hispanicPct: 93.9, blackPct: 1.3, asianPct: 0.3 },
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
      {
        label: "U.S. Census Bureau — American Community Survey 2020 5-Year Estimates, Table DP05",
        detail:
          "White alone not Hispanic or Latino, Hispanic or Latino (any race), Black alone, and Asian alone, % of population, all 254 Texas counties.",
        url: "https://data.census.gov/table/ACSDP5Y2020.DP05",
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
}

export const stateMapData: StateMapMetrics[] = [
  { state: "Alabama", abbr: "AL", native: 62, antiImmig: 47, gdp: 341, enforcementScore: 2.2, enforcementTier: "comprehensiveEnforcement", thirtyMarriedHomeowner: 34, wealthShareUnder30: 8 },
  { state: "Alaska", abbr: "AK", native: 57, antiImmig: 30, gdp: 75, enforcementScore: 3.0, enforcementTier: "noLaws", thirtyMarriedHomeowner: 26, wealthShareUnder30: 6 },
  { state: "Arizona", abbr: "AZ", native: 51, antiImmig: 31, gdp: 598, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement", thirtyMarriedHomeowner: 27, wealthShareUnder30: 6 },
  { state: "Arkansas", abbr: "AR", native: 67, antiImmig: 44, gdp: 198, enforcementScore: 2.4, enforcementTier: "broadAntiSanctuary", thirtyMarriedHomeowner: 33, wealthShareUnder30: 7 },
  { state: "California", abbr: "CA", native: 32, antiImmig: 26, gdp: 4251, enforcementScore: 4.0, enforcementTier: "broadSanctuary", thirtyMarriedHomeowner: 16, wealthShareUnder30: 4 },
  { state: "Colorado", abbr: "CO", native: 63, antiImmig: 29, gdp: 584, enforcementScore: 3.8, enforcementTier: "broadSanctuary", thirtyMarriedHomeowner: 26, wealthShareUnder30: 6 },
  { state: "Connecticut", abbr: "CT", native: 60, antiImmig: 30, gdp: 376, enforcementScore: 3.5, enforcementTier: "limitedProtections", thirtyMarriedHomeowner: 24, wealthShareUnder30: 5 },
  { state: "Delaware", abbr: "DE", native: 56, antiImmig: 30, gdp: 117, enforcementScore: 3.1, enforcementTier: "smallSteps", thirtyMarriedHomeowner: 25, wealthShareUnder30: 6 },
  { state: "District of Columbia", abbr: "DC", native: 37, antiImmig: null, gdp: 193, enforcementScore: 3.5, enforcementTier: "limitedProtections", thirtyMarriedHomeowner: 8, wealthShareUnder30: 2 },
  { state: "Florida", abbr: "FL", native: 49, antiImmig: 36, gdp: 1835, enforcementScore: 1.7, enforcementTier: "mostFarReaching", thirtyMarriedHomeowner: 24, wealthShareUnder30: 5 },
  { state: "Georgia", abbr: "GA", native: 47, antiImmig: 35, gdp: 925, enforcementScore: 2.5, enforcementTier: "broadAntiSanctuary", thirtyMarriedHomeowner: 27, wealthShareUnder30: 6 },
  { state: "Hawaii", abbr: "HI", native: 21, antiImmig: 21, gdp: 125, enforcementScore: 3.2, enforcementTier: "smallSteps", thirtyMarriedHomeowner: 18, wealthShareUnder30: 4 },
  { state: "Idaho", abbr: "ID", native: 78, antiImmig: 41, gdp: 136, enforcementScore: 2.4, enforcementTier: "broadAntiSanctuary", thirtyMarriedHomeowner: 38, wealthShareUnder30: 8 },
  { state: "Illinois", abbr: "IL", native: 56, antiImmig: 33, gdp: 1202, enforcementScore: 4.3, enforcementTier: "mostProtective", thirtyMarriedHomeowner: 27, wealthShareUnder30: 6 },
  { state: "Indiana", abbr: "IN", native: 73, antiImmig: 40, gdp: 545, enforcementScore: 2.4, enforcementTier: "broadAntiSanctuary", thirtyMarriedHomeowner: 34, wealthShareUnder30: 8 },
  { state: "Iowa", abbr: "IA", native: 81, antiImmig: 39, gdp: 277, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement", thirtyMarriedHomeowner: 37, wealthShareUnder30: 8 },
  { state: "Kansas", abbr: "KS", native: 71, antiImmig: 36, gdp: 241, enforcementScore: 2.6, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 33, wealthShareUnder30: 7 },
  { state: "Kentucky", abbr: "KY", native: 79, antiImmig: 44, gdp: 307, enforcementScore: 3.0, enforcementTier: "noLaws", thirtyMarriedHomeowner: 32, wealthShareUnder30: 7 },
  { state: "Louisiana", abbr: "LA", native: 54, antiImmig: 39, gdp: 340, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement", thirtyMarriedHomeowner: 28, wealthShareUnder30: 6 },
  { state: "Maine", abbr: "ME", native: 89, antiImmig: 40, gdp: 103, enforcementScore: 3.8, enforcementTier: "broadSanctuary", thirtyMarriedHomeowner: 28, wealthShareUnder30: 6 },
  { state: "Maryland", abbr: "MD", native: 45, antiImmig: 33, gdp: 568, enforcementScore: 3.6, enforcementTier: "limitedProtections", thirtyMarriedHomeowner: 24, wealthShareUnder30: 5 },
  { state: "Massachusetts", abbr: "MA", native: 65, antiImmig: 26, gdp: 820, enforcementScore: 3.7, enforcementTier: "limitedProtections", thirtyMarriedHomeowner: 19, wealthShareUnder30: 4 },
  { state: "Michigan", abbr: "MI", native: 70, antiImmig: 38, gdp: 730, enforcementScore: 3.0, enforcementTier: "noLaws", thirtyMarriedHomeowner: 29, wealthShareUnder30: 6 },
  { state: "Minnesota", abbr: "MN", native: 74, antiImmig: 38, gdp: 531, enforcementScore: 3.1, enforcementTier: "smallSteps", thirtyMarriedHomeowner: 31, wealthShareUnder30: 7 },
  { state: "Mississippi", abbr: "MS", native: 54, antiImmig: 43, gdp: 165, enforcementScore: 2.1, enforcementTier: "comprehensiveEnforcement", thirtyMarriedHomeowner: 29, wealthShareUnder30: 6 },
  { state: "Missouri", abbr: "MO", native: 75, antiImmig: 36, gdp: 468, enforcementScore: 2.6, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 31, wealthShareUnder30: 7 },
  { state: "Montana", abbr: "MT", native: 83, antiImmig: 39, gdp: 82, enforcementScore: 2.6, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 33, wealthShareUnder30: 7 },
  { state: "Nebraska", abbr: "NE", native: 73, antiImmig: 36, gdp: 198, enforcementScore: 3.0, enforcementTier: "noLaws", thirtyMarriedHomeowner: 35, wealthShareUnder30: 8 },
  { state: "Nevada", abbr: "NV", native: 42, antiImmig: 38, gdp: 281, enforcementScore: 3.1, enforcementTier: "smallSteps", thirtyMarriedHomeowner: 22, wealthShareUnder30: 5 },
  { state: "New Hampshire", abbr: "NH", native: 86, antiImmig: 40, gdp: 126, enforcementScore: 2.5, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 29, wealthShareUnder30: 6 },
  { state: "New Jersey", abbr: "NJ", native: 48, antiImmig: 27, gdp: 887, enforcementScore: 3.9, enforcementTier: "broadSanctuary", thirtyMarriedHomeowner: 22, wealthShareUnder30: 5 },
  { state: "New Mexico", abbr: "NM", native: 35, antiImmig: 30, gdp: 153, enforcementScore: 3.2, enforcementTier: "limitedProtections", thirtyMarriedHomeowner: 22, wealthShareUnder30: 5 },
  { state: "New York", abbr: "NY", native: 51, antiImmig: 27, gdp: 2468, enforcementScore: 3.7, enforcementTier: "limitedProtections", thirtyMarriedHomeowner: 17, wealthShareUnder30: 4 },
  { state: "North Carolina", abbr: "NC", native: 58, antiImmig: 37, gdp: 894, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement", thirtyMarriedHomeowner: 27, wealthShareUnder30: 6 },
  { state: "North Dakota", abbr: "ND", native: 80, antiImmig: 39, gdp: 82, enforcementScore: 2.7, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 36, wealthShareUnder30: 8 },
  { state: "Ohio", abbr: "OH", native: 74, antiImmig: 40, gdp: 967, enforcementScore: 2.9, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 30, wealthShareUnder30: 7 },
  { state: "Oklahoma", abbr: "OK", native: 58, antiImmig: 38, gdp: 274, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement", thirtyMarriedHomeowner: 30, wealthShareUnder30: 7 },
  { state: "Oregon", abbr: "OR", native: 69, antiImmig: 28, gdp: 343, enforcementScore: 4.3, enforcementTier: "mostProtective", thirtyMarriedHomeowner: 25, wealthShareUnder30: 6 },
  { state: "Pennsylvania", abbr: "PA", native: 71, antiImmig: 38, gdp: 1056, enforcementScore: 3.0, enforcementTier: "noLaws", thirtyMarriedHomeowner: 28, wealthShareUnder30: 6 },
  { state: "Rhode Island", abbr: "RI", native: 66, antiImmig: 29, gdp: 84, enforcementScore: 3.3, enforcementTier: "smallSteps", thirtyMarriedHomeowner: 21, wealthShareUnder30: 5 },
  { state: "South Carolina", abbr: "SC", native: 62, antiImmig: 38, gdp: 379, enforcementScore: 2.5, enforcementTier: "broadAntiSanctuary", thirtyMarriedHomeowner: 27, wealthShareUnder30: 6 },
  { state: "South Dakota", abbr: "SD", native: 78, antiImmig: 43, gdp: 81, enforcementScore: 3.0, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 35, wealthShareUnder30: 8 },
  { state: "Tennessee", abbr: "TN", native: 69, antiImmig: 43, gdp: 590, enforcementScore: 2.4, enforcementTier: "broadAntiSanctuary", thirtyMarriedHomeowner: 29, wealthShareUnder30: 6 },
  { state: "Texas", abbr: "TX", native: 37, antiImmig: 34, gdp: 2904, enforcementScore: 1.6, enforcementTier: "mostFarReaching", thirtyMarriedHomeowner: 25, wealthShareUnder30: 6 },
  { state: "Utah", abbr: "UT", native: 73, antiImmig: 33, gdp: 316, enforcementScore: 2.6, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 41, wealthShareUnder30: 9 },
  { state: "Vermont", abbr: "VT", native: 89, antiImmig: 35, gdp: 48, enforcementScore: 3.9, enforcementTier: "broadSanctuary", thirtyMarriedHomeowner: 27, wealthShareUnder30: 6 },
  { state: "Virginia", abbr: "VA", native: 56, antiImmig: 35, gdp: 798, enforcementScore: 3.3, enforcementTier: "limitedProtections", thirtyMarriedHomeowner: 27, wealthShareUnder30: 6 },
  { state: "Washington", abbr: "WA", native: 60, antiImmig: 31, gdp: 895, enforcementScore: 3.9, enforcementTier: "broadSanctuary", thirtyMarriedHomeowner: 26, wealthShareUnder30: 6 },
  { state: "West Virginia", abbr: "WV", native: 88, antiImmig: 47, gdp: 109, enforcementScore: 2.3, enforcementTier: "comprehensiveEnforcement", thirtyMarriedHomeowner: 27, wealthShareUnder30: 6 },
  { state: "Wisconsin", abbr: "WI", native: 77, antiImmig: 37, gdp: 473, enforcementScore: 3.0, enforcementTier: "noLaws", thirtyMarriedHomeowner: 32, wealthShareUnder30: 7 },
  { state: "Wyoming", abbr: "WY", native: 81, antiImmig: 48, gdp: 53, enforcementScore: 2.9, enforcementTier: "someParticipation", thirtyMarriedHomeowner: 34, wealthShareUnder30: 8 },
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

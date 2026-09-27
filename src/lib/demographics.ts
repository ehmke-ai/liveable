export type CountryDemographics = {
  country: string
  /** ISO 3166-1 numeric code as string (matches world-atlas ids) */
  isoNumeric: string
  native: number
  catholic: number
  protestant: number
  orthodox: number
  antiImmig: number
  /** Domestic listed equity market capitalization, billions of USD */
  marketCap: number
  /**
   * Median age of the native / European population in years (lower = younger).
   * Europe: Eurostat native-born (born in reporting country).
   * United States: Census non-Hispanic White alone.
   */
  medianAge: number
  /** When false, included in charts/tables but omitted from the Europe map */
  onMap?: boolean
}

export const demographicsData: CountryDemographics[] = [
  { country: "Germany", isoNumeric: "276", native: 80, catholic: 24, protestant: 22, orthodox: 3, antiImmig: 34, marketCap: 3036, medianAge: 45.9 },
  { country: "Austria", isoNumeric: "040", native: 81, catholic: 50, protestant: 3, orthodox: 5, antiImmig: 57, marketCap: 224.5, medianAge: 44.4 },
  { country: "Switzerland", isoNumeric: "756", native: 75, catholic: 30, protestant: 19, orthodox: 2, antiImmig: 31, marketCap: 1790, medianAge: 41.3 },
  { country: "Netherlands", isoNumeric: "528", native: 75, catholic: 17, protestant: 14, orthodox: 1, antiImmig: 39, marketCap: 2120, medianAge: 43.0 },
  { country: "Norway", isoNumeric: "578", native: 85, catholic: 3, protestant: 62, orthodox: 1, antiImmig: 16, marketCap: 515, medianAge: 41.1 },
  { country: "Denmark", isoNumeric: "208", native: 84, catholic: 1, protestant: 70, orthodox: 1, antiImmig: 40, marketCap: 650, medianAge: 43.1 },
  { country: "Sweden", isoNumeric: "752", native: 78, catholic: 1, protestant: 51, orthodox: 2, antiImmig: 13, marketCap: 1410, medianAge: 40.7 },
  { country: "Poland", isoNumeric: "616", native: 97, catholic: 71, protestant: 1, orthodox: 1, antiImmig: 49, marketCap: 292, medianAge: 43.6 },
  { country: "Italy", isoNumeric: "380", native: 91, catholic: 61, protestant: 1, orthodox: 3, antiImmig: 41, marketCap: 950, medianAge: 50.1 },
  { country: "France", isoNumeric: "250", native: 80, catholic: 47, protestant: 2, orthodox: 1, antiImmig: 32, marketCap: 3450, medianAge: 41.9 },
  { country: "Ireland", isoNumeric: "372", native: 77, catholic: 69, protestant: 3, orthodox: 2, antiImmig: 40, marketCap: 298, medianAge: 40.0 },
  {
    country: "United States",
    isoNumeric: "840",
    native: 58,
    catholic: 19,
    protestant: 40,
    orthodox: 1,
    antiImmig: 30,
    marketCap: 79470,
    medianAge: 44.2,
    onMap: false,
  },
]

/** Countries rendered / selectable on the Europe choropleth */
export const mapDemographicsData = demographicsData.filter((d) => d.onMap !== false)

export const demographicsByIso = Object.fromEntries(
  mapDemographicsData.map((d) => [String(Number(d.isoNumeric)), d])
) as Record<string, CountryDemographics>

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export const countryBySlug: Record<string, CountryDemographics> = Object.fromEntries(
  demographicsData.map((d) => [slugify(d.country), d])
)

export function getCountryBySlug(slug: string): CountryDemographics | undefined {
  return countryBySlug[slug]
}

export const rankedByNative = [...demographicsData].sort(
  (a, b) => b.native - a.native
)

export const maxNative = Math.max(...rankedByNative.map((d) => d.native))

export const rankedByAntiImmig = [...demographicsData].sort(
  (a, b) => b.antiImmig - a.antiImmig
)

export const maxAntiImmig = Math.max(...rankedByAntiImmig.map((d) => d.antiImmig))

export const rankedByMarketCap = [...demographicsData].sort(
  (a, b) => b.marketCap - a.marketCap
)

export const maxMarketCap = Math.max(...rankedByMarketCap.map((d) => d.marketCap))

/** Max among countries shown on the Europe map (excludes USA) */
export const maxMapMarketCap = Math.max(...mapDemographicsData.map((d) => d.marketCap))

/** Youngest first — lower native / European median age ranks higher */
export const rankedByMedianAge = [...demographicsData].sort(
  (a, b) => a.medianAge - b.medianAge
)

export const minMedianAge = Math.min(...rankedByMedianAge.map((d) => d.medianAge))
export const maxMedianAge = Math.max(...rankedByMedianAge.map((d) => d.medianAge))

export const minMapMedianAge = Math.min(...mapDemographicsData.map((d) => d.medianAge))
export const maxMapMedianAge = Math.max(...mapDemographicsData.map((d) => d.medianAge))

/** Format market cap stored in billions of USD */
export function formatMarketCap(billions: number): string {
  if (billions >= 1000) {
    const trillions = billions / 1000
    return `$${trillions >= 10 ? trillions.toFixed(0) : trillions.toFixed(1)}T`
  }
  if (billions >= 10) return `$${Math.round(billions)}B`
  if (billions >= 1) return `$${billions.toFixed(1)}B`
  return `$${Math.round(billions * 1000)}M`
}

export function formatMedianAge(years: number): string {
  return Number.isInteger(years) ? `${years}` : years.toFixed(1)
}

export type NativeSharePoint = {
  year: number
  /** Approximate native / European population share (%) */
  native: number
}

/**
 * Approximate native / European population share over time.
 * Europe: ethnic European / autochthonous proxy (not identical to foreign-born).
 * United States: non-Hispanic White alone (Census).
 * Series end at the snapshot `native` values above.
 */
export const nativeShareHistoryByCountry: Record<string, NativeSharePoint[]> = {
  Germany: [
    { year: 1960, native: 99 },
    { year: 1970, native: 96 },
    { year: 1980, native: 93 },
    { year: 1990, native: 91 },
    { year: 2000, native: 88 },
    { year: 2010, native: 84 },
    { year: 2020, native: 81 },
    { year: 2025, native: 80 },
  ],
  Austria: [
    { year: 1960, native: 98 },
    { year: 1970, native: 96 },
    { year: 1980, native: 95 },
    { year: 1990, native: 93 },
    { year: 2000, native: 90 },
    { year: 2010, native: 86 },
    { year: 2020, native: 82 },
    { year: 2025, native: 81 },
  ],
  Switzerland: [
    { year: 1960, native: 89 },
    { year: 1970, native: 83 },
    { year: 1980, native: 84 },
    { year: 1990, native: 82 },
    { year: 2000, native: 79 },
    { year: 2010, native: 77 },
    { year: 2020, native: 75 },
    { year: 2025, native: 75 },
  ],
  Netherlands: [
    { year: 1960, native: 98 },
    { year: 1970, native: 96 },
    { year: 1980, native: 94 },
    { year: 1990, native: 91 },
    { year: 2000, native: 86 },
    { year: 2010, native: 80 },
    { year: 2020, native: 76 },
    { year: 2025, native: 75 },
  ],
  Norway: [
    { year: 1960, native: 99 },
    { year: 1970, native: 98 },
    { year: 1980, native: 97 },
    { year: 1990, native: 96 },
    { year: 2000, native: 94 },
    { year: 2010, native: 90 },
    { year: 2020, native: 86 },
    { year: 2025, native: 85 },
  ],
  Denmark: [
    { year: 1960, native: 99 },
    { year: 1970, native: 98 },
    { year: 1980, native: 97 },
    { year: 1990, native: 96 },
    { year: 2000, native: 93 },
    { year: 2010, native: 89 },
    { year: 2020, native: 85 },
    { year: 2025, native: 84 },
  ],
  Sweden: [
    { year: 1960, native: 96 },
    { year: 1970, native: 94 },
    { year: 1980, native: 92 },
    { year: 1990, native: 91 },
    { year: 2000, native: 88 },
    { year: 2010, native: 84 },
    { year: 2020, native: 79 },
    { year: 2025, native: 78 },
  ],
  Poland: [
    { year: 1960, native: 98 },
    { year: 1970, native: 98 },
    { year: 1980, native: 98 },
    { year: 1990, native: 98 },
    { year: 2000, native: 98 },
    { year: 2010, native: 98 },
    { year: 2020, native: 97 },
    { year: 2025, native: 97 },
  ],
  Italy: [
    { year: 1960, native: 99 },
    { year: 1970, native: 99 },
    { year: 1980, native: 99 },
    { year: 1990, native: 98 },
    { year: 2000, native: 97 },
    { year: 2010, native: 94 },
    { year: 2020, native: 92 },
    { year: 2025, native: 91 },
  ],
  France: [
    { year: 1960, native: 93 },
    { year: 1970, native: 91 },
    { year: 1980, native: 89 },
    { year: 1990, native: 88 },
    { year: 2000, native: 86 },
    { year: 2010, native: 83 },
    { year: 2020, native: 81 },
    { year: 2025, native: 80 },
  ],
  Ireland: [
    { year: 1960, native: 99 },
    { year: 1970, native: 99 },
    { year: 1980, native: 98 },
    { year: 1990, native: 97 },
    { year: 2000, native: 94 },
    { year: 2010, native: 87 },
    { year: 2020, native: 80 },
    { year: 2025, native: 77 },
  ],
  "United States": [
    { year: 1960, native: 85 },
    { year: 1970, native: 83 },
    { year: 1980, native: 80 },
    { year: 1990, native: 76 },
    { year: 2000, native: 69 },
    { year: 2010, native: 64 },
    { year: 2020, native: 58 },
    { year: 2025, native: 58 },
  ],
}

export const nativeShareHistoryCountries = demographicsData.map((d) => d.country)

export const DEFAULT_NATIVE_SHARE_COUNTRY = "Austria"

export function getNativeShareHistory(country: string): NativeSharePoint[] {
  return nativeShareHistoryByCountry[country] ?? []
}

/** Log-normalized intensity in [0, 1] for choropleth / bar opacity */
export function marketCapIntensity(billions: number, maxBillions: number): number {
  if (billions <= 0 || maxBillions <= 0) return 0
  return Math.log10(billions) / Math.log10(maxBillions)
}

/** Youth intensity in [0, 1] — younger native / European median age scores higher */
export function medianAgeYouthIntensity(
  medianAge: number,
  minAge: number,
  maxAge: number
): number {
  if (maxAge <= minAge) return 1
  return (maxAge - medianAge) / (maxAge - minAge)
}

export type PoliticalLeanPoint = {
  year: number
  /** Far-left / radical left parties — ParlGov left–right < 3 */
  leftWing: number
  /** Centre-left parties — ParlGov left–right 3–5 */
  leftOfCenter: number
  /** Centre-right parties — ParlGov left–right 5–7.5 */
  rightOfCenter: number
  /** Far-right / radical right parties — ParlGov left–right ≥ 7.5 */
  rightWing: number
}

/**
 * Parliamentary vote share by left–right band over time.
 * Europe: ParlGov party left–right scores (0–10) aggregated into four bands;
 * parties at exactly 5.0 and parties without a score are omitted.
 * Recent elections after ParlGov coverage use the same thresholds on known party scores.
 * United States: Democratic → left of centre, Republican → right of centre
 * (presidential popular vote; wing bands unused).
 */
export const politicalLeanHistoryByCountry: Record<string, PoliticalLeanPoint[]> = {
  Germany: [
    { year: 1960, leftWing: 2, leftOfCenter: 36, rightOfCenter: 61, rightWing: 0 },
    { year: 1970, leftWing: 0, leftOfCenter: 43, rightOfCenter: 52, rightWing: 4 },
    { year: 1980, leftWing: 2, leftOfCenter: 43, rightOfCenter: 55, rightWing: 0 },
    { year: 1990, leftWing: 7, leftOfCenter: 34, rightOfCenter: 55, rightWing: 2 },
    { year: 2000, leftWing: 12, leftOfCenter: 41, rightOfCenter: 41, rightWing: 3 },
    { year: 2010, leftWing: 23, leftOfCenter: 23, rightOfCenter: 48, rightWing: 2 },
    { year: 2020, leftWing: 20, leftOfCenter: 26, rightOfCenter: 38, rightWing: 10 },
    { year: 2025, leftWing: 25, leftOfCenter: 16, rightOfCenter: 33, rightWing: 21 },
  ],
  Austria: [
    { year: 1960, leftWing: 3, leftOfCenter: 45, rightOfCenter: 44, rightWing: 8 },
    { year: 1970, leftWing: 1, leftOfCenter: 48, rightOfCenter: 45, rightWing: 6 },
    { year: 1980, leftWing: 1, leftOfCenter: 51, rightOfCenter: 42, rightWing: 6 },
    { year: 1990, leftWing: 7, leftOfCenter: 43, rightOfCenter: 32, rightWing: 17 },
    { year: 2000, leftWing: 7, leftOfCenter: 37, rightOfCenter: 27, rightWing: 27 },
    { year: 2010, leftWing: 10, leftOfCenter: 33, rightOfCenter: 26, rightWing: 28 },
    { year: 2020, leftWing: 16, leftOfCenter: 21, rightOfCenter: 46, rightWing: 16 },
    { year: 2025, leftWing: 11, leftOfCenter: 21, rightOfCenter: 35, rightWing: 29 },
  ],
  Switzerland: [
    { year: 1960, leftWing: 29, leftOfCenter: 32, rightOfCenter: 38, rightWing: 0 },
    { year: 1970, leftWing: 26, leftOfCenter: 30, rightOfCenter: 35, rightWing: 8 },
    { year: 1980, leftWing: 27, leftOfCenter: 28, rightOfCenter: 38, rightWing: 2 },
    { year: 1990, leftWing: 28, leftOfCenter: 23, rightOfCenter: 36, rightWing: 11 },
    { year: 2000, leftWing: 29, leftOfCenter: 18, rightOfCenter: 45, rightWing: 5 },
    { year: 2010, leftWing: 33, leftOfCenter: 14, rightOfCenter: 47, rightWing: 3 },
    { year: 2020, leftWing: 39, leftOfCenter: 13, rightOfCenter: 43, rightWing: 2 },
    { year: 2025, leftWing: 36, leftOfCenter: 14, rightOfCenter: 42, rightWing: 0 },
  ],
  Netherlands: [
    { year: 1960, leftWing: 4, leftOfCenter: 30, rightOfCenter: 61, rightWing: 3 },
    { year: 1970, leftWing: 7, leftOfCenter: 37, rightOfCenter: 50, rightWing: 4 },
    { year: 1980, leftWing: 6, leftOfCenter: 40, rightOfCenter: 48, rightWing: 4 },
    { year: 1990, leftWing: 5, leftOfCenter: 40, rightOfCenter: 50, rightWing: 5 },
    { year: 2000, leftWing: 11, leftOfCenter: 38, rightOfCenter: 43, rightWing: 6 },
    { year: 2010, leftWing: 16, leftOfCenter: 27, rightOfCenter: 37, rightWing: 17 },
    { year: 2020, leftWing: 11, leftOfCenter: 23, rightOfCenter: 36, rightWing: 20 },
    { year: 2025, leftWing: 21, leftOfCenter: 6, rightOfCenter: 38, rightWing: 28 },
  ],
  Norway: [
    { year: 1960, leftWing: 5, leftOfCenter: 54, rightOfCenter: 18, rightWing: 19 },
    { year: 1970, leftWing: 4, leftOfCenter: 56, rightOfCenter: 18, rightWing: 19 },
    { year: 1980, leftWing: 6, leftOfCenter: 44, rightOfCenter: 13, rightWing: 36 },
    { year: 1990, leftWing: 10, leftOfCenter: 41, rightOfCenter: 12, rightWing: 35 },
    { year: 2000, leftWing: 14, leftOfCenter: 30, rightOfCenter: 18, rightWing: 36 },
    { year: 2010, leftWing: 8, leftOfCenter: 42, rightOfCenter: 9, rightWing: 40 },
    { year: 2020, leftWing: 16, leftOfCenter: 40, rightOfCenter: 9, rightWing: 32 },
    { year: 2025, leftWing: 16, leftOfCenter: 40, rightOfCenter: 9, rightWing: 32 },
  ],
  Denmark: [
    { year: 1960, leftWing: 7, leftOfCenter: 48, rightOfCenter: 44, rightWing: 0 },
    { year: 1970, leftWing: 12, leftOfCenter: 52, rightOfCenter: 36, rightWing: 0 },
    { year: 1980, leftWing: 12, leftOfCenter: 44, rightOfCenter: 33, rightWing: 11 },
    { year: 1990, leftWing: 12, leftOfCenter: 41, rightOfCenter: 39, rightWing: 6 },
    { year: 2000, leftWing: 9, leftOfCenter: 34, rightOfCenter: 44, rightWing: 12 },
    { year: 2010, leftWing: 16, leftOfCenter: 34, rightOfCenter: 37, rightWing: 12 },
    { year: 2020, leftWing: 18, leftOfCenter: 34, rightOfCenter: 34, rightWing: 13 },
    { year: 2025, leftWing: 17, leftOfCenter: 31, rightOfCenter: 36, rightWing: 14 },
  ],
  Sweden: [
    { year: 1960, leftWing: 4, leftOfCenter: 48, rightOfCenter: 31, rightWing: 17 },
    { year: 1970, leftWing: 5, leftOfCenter: 45, rightOfCenter: 38, rightWing: 12 },
    { year: 1980, leftWing: 6, leftOfCenter: 43, rightOfCenter: 30, rightWing: 20 },
    { year: 1990, leftWing: 4, leftOfCenter: 41, rightOfCenter: 25, rightWing: 29 },
    { year: 2000, leftWing: 12, leftOfCenter: 41, rightOfCenter: 22, rightWing: 23 },
    { year: 2010, leftWing: 6, leftOfCenter: 38, rightOfCenter: 19, rightWing: 36 },
    { year: 2020, leftWing: 8, leftOfCenter: 33, rightOfCenter: 20, rightWing: 37 },
    { year: 2025, leftWing: 7, leftOfCenter: 35, rightOfCenter: 17, rightWing: 40 },
  ],
  Poland: [
    { year: 1990, leftWing: 14, leftOfCenter: 21, rightOfCenter: 52, rightWing: 3 },
    { year: 2000, leftWing: 41, leftOfCenter: 19, rightOfCenter: 21, rightWing: 17 },
    { year: 2010, leftWing: 8, leftOfCenter: 8, rightOfCenter: 51, rightWing: 31 },
    { year: 2020, leftWing: 13, leftOfCenter: 9, rightOfCenter: 34, rightWing: 44 },
    { year: 2025, leftWing: 9, leftOfCenter: 0, rightOfCenter: 31, rightWing: 43 },
  ],
  Italy: [
    { year: 1960, leftWing: 23, leftOfCenter: 20, rightOfCenter: 49, rightWing: 7 },
    { year: 1970, leftWing: 31, leftOfCenter: 16, rightOfCenter: 47, rightWing: 4 },
    { year: 1980, leftWing: 32, leftOfCenter: 20, rightOfCenter: 41, rightWing: 5 },
    { year: 1990, leftWing: 25, leftOfCenter: 22, rightOfCenter: 35, rightWing: 14 },
    { year: 2000, leftWing: 25, leftOfCenter: 21, rightOfCenter: 37, rightWing: 16 },
    { year: 2010, leftWing: 37, leftOfCenter: 4, rightOfCenter: 46, rightWing: 11 },
    { year: 2020, leftWing: 23, leftOfCenter: 1, rightOfCenter: 19, rightWing: 22 },
    { year: 2025, leftWing: 20, leftOfCenter: 4, rightOfCenter: 22, rightWing: 36 },
  ],
  France: [
    { year: 1960, leftWing: 19, leftOfCenter: 26, rightOfCenter: 2, rightWing: 53 },
    { year: 1970, leftWing: 24, leftOfCenter: 16, rightOfCenter: 19, rightWing: 40 },
    { year: 1980, leftWing: 16, leftOfCenter: 49, rightOfCenter: 28, rightWing: 3 },
    { year: 1990, leftWing: 13, leftOfCenter: 36, rightOfCenter: 38, rightWing: 12 },
    { year: 2000, leftWing: 10, leftOfCenter: 31, rightOfCenter: 39, rightWing: 19 },
    { year: 2010, leftWing: 7, leftOfCenter: 41, rightOfCenter: 32, rightWing: 17 },
    { year: 2020, leftWing: 30, leftOfCenter: 3, rightOfCenter: 38, rightWing: 25 },
    { year: 2025, leftWing: 30, leftOfCenter: 3, rightOfCenter: 38, rightWing: 25 },
  ],
  Ireland: [
    { year: 1960, leftWing: 1, leftOfCenter: 12, rightOfCenter: 78, rightWing: 0 },
    { year: 1970, leftWing: 0, leftOfCenter: 17, rightOfCenter: 80, rightWing: 0 },
    { year: 1980, leftWing: 2, leftOfCenter: 10, rightOfCenter: 82, rightWing: 0 },
    { year: 1990, leftWing: 8, leftOfCenter: 10, rightOfCenter: 73, rightWing: 5 },
    { year: 2000, leftWing: 11, leftOfCenter: 11, rightOfCenter: 64, rightWing: 4 },
    { year: 2010, leftWing: 14, leftOfCenter: 19, rightOfCenter: 54, rightWing: 0 },
    { year: 2020, leftWing: 35, leftOfCenter: 7, rightOfCenter: 45, rightWing: 0 },
    { year: 2025, leftWing: 25, leftOfCenter: 9, rightOfCenter: 47, rightWing: 4 },
  ],
  "United States": [
    { year: 1960, leftWing: 0, leftOfCenter: 50, rightOfCenter: 50, rightWing: 0 },
    { year: 1970, leftWing: 0, leftOfCenter: 43, rightOfCenter: 43, rightWing: 0 },
    { year: 1980, leftWing: 0, leftOfCenter: 41, rightOfCenter: 51, rightWing: 0 },
    { year: 1990, leftWing: 0, leftOfCenter: 46, rightOfCenter: 53, rightWing: 0 },
    { year: 2000, leftWing: 0, leftOfCenter: 48, rightOfCenter: 48, rightWing: 0 },
    { year: 2010, leftWing: 0, leftOfCenter: 53, rightOfCenter: 46, rightWing: 0 },
    { year: 2020, leftWing: 0, leftOfCenter: 51, rightOfCenter: 47, rightWing: 0 },
    { year: 2025, leftWing: 0, leftOfCenter: 48, rightOfCenter: 50, rightWing: 0 },
  ],
}

export const politicalLeanHistoryCountries = demographicsData.map((d) => d.country)

export const DEFAULT_POLITICAL_LEAN_COUNTRY = "Austria"

export function getPoliticalLeanHistory(country: string): PoliticalLeanPoint[] {
  return politicalLeanHistoryByCountry[country] ?? []
}

export type CountryRanking = {
  label: string
  rank: number
  total: number
  value: string
  color: string
}

/** Where a country lands across each ranking, in table order */
export function getCountryRankings(country: string): CountryRanking[] {
  return [
    {
      label: "Native / European share",
      rank: rankedByNative.findIndex((d) => d.country === country) + 1,
      total: rankedByNative.length,
      value: `${rankedByNative.find((d) => d.country === country)?.native}%`,
      color: COLORS.native,
    },
    {
      label: "Anti-immigration intensity",
      rank: rankedByAntiImmig.findIndex((d) => d.country === country) + 1,
      total: rankedByAntiImmig.length,
      value: `${rankedByAntiImmig.find((d) => d.country === country)?.antiImmig}%`,
      color: COLORS.anti,
    },
    {
      label: "Market capitalization",
      rank: rankedByMarketCap.findIndex((d) => d.country === country) + 1,
      total: rankedByMarketCap.length,
      value: formatMarketCap(
        rankedByMarketCap.find((d) => d.country === country)?.marketCap ?? 0
      ),
      color: COLORS.marketCap,
    },
    {
      label: "Native median age (youngest first)",
      rank: rankedByMedianAge.findIndex((d) => d.country === country) + 1,
      total: rankedByMedianAge.length,
      value: `${formatMedianAge(
        rankedByMedianAge.find((d) => d.country === country)?.medianAge ?? 0
      )} yrs`,
      color: COLORS.medianAge,
    },
  ]
}

export const COLORS = {
  native: "var(--chart-1)",
  catholic: "#e23d3d",
  protestant: "#3d7ee2",
  orthodox: "#c9a227",
  anti: "#d9782d",
  marketCap: "#2db88a",
  medianAge: "#58a0c8",
  leftWing: "#1d4ed8",
  leftOfCenter: "#7dd3fc",
  rightOfCenter: "#fca5a5",
  rightWing: "#b91c1c",
} as const

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
   * Median age of the native / white population in years (lower = younger).
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

/** Youngest first — lower native / white median age ranks higher */
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

/** Log-normalized intensity in [0, 1] for choropleth / bar opacity */
export function marketCapIntensity(billions: number, maxBillions: number): number {
  if (billions <= 0 || maxBillions <= 0) return 0
  return Math.log10(billions) / Math.log10(maxBillions)
}

/** Youth intensity in [0, 1] — younger native / white median age scores higher */
export function medianAgeYouthIntensity(
  medianAge: number,
  minAge: number,
  maxAge: number
): number {
  if (maxAge <= minAge) return 1
  return (maxAge - medianAge) / (maxAge - minAge)
}

export const COLORS = {
  native: "#ffffff",
  catholic: "#e23d3d",
  protestant: "#3d7ee2",
  orthodox: "#c9a227",
  anti: "#d9782d",
  marketCap: "#2db88a",
  medianAge: "#58a0c8",
} as const

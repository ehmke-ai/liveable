import generatedStates from "@/data/states.json"
import { countiesByAbbr } from "@/data/counties"
import countyCostData from "@/data/county-cost.json"
import type { CountyCost } from "@/lib/cost-of-living"
import {
  countyLabel,
  countySlug,
  type CountyDemographics,
  type StateDemographics,
} from "@/lib/states"

/*
 * Full per-state records. Server-only in practice: import this from pages, never from client
 * components (they get the lightweight `stateNav` from @/lib/states instead), so the
 * histories, sources, and county tables stay out of the browser bundle.
 */

export const statesData = generatedStates as StateDemographics[]

const stateBySlug: Record<string, StateDemographics> = Object.fromEntries(
  statesData.map((s) => [s.slug, s])
)

export function getStateBySlug(slug: string): StateDemographics | undefined {
  return stateBySlug[slug]
}

export function getCounties(state: StateDemographics): CountyDemographics[] {
  return countiesByAbbr[state.abbr] ?? []
}

export function getCountyBySlug(
  state: StateDemographics,
  slug: string
): CountyDemographics | undefined {
  return getCounties(state).find((c) => countySlug(c.name) === slug)
}

const countyCost = countyCostData as unknown as Record<string, CountyCost>

/** ACS cost-of-living medians for a county, if it has any (not Connecticut's old counties) */
export function getCountyCost(county: CountyDemographics): CountyCost | undefined {
  return countyCost[county.fips]
}

/**
 * County labels and state abbreviations (keyed by state FIPS) for the national county maps'
 * tooltips; the figures themselves load client-side from county-history.json
 */
export function usCountyMapData(): { counties: [string, string][]; states: Record<string, string> } {
  const counties: [string, string][] = []
  const states: Record<string, string> = {}
  for (const state of statesData) {
    const stateCounties = getCounties(state)
    if (!stateCounties.length) continue
    states[stateCounties[0].fips.slice(0, 2)] = state.abbr
    for (const c of stateCounties) counties.push([c.fips, countyLabel(c)])
  }
  return { counties, states }
}

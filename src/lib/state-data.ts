import generatedStates from "@/data/states.json"
import { countiesByAbbr } from "@/data/counties"
import {
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

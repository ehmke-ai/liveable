"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Button } from "@/components/ui/button"
import { UsCountyElectionMap } from "@/components/us-county-election-map"
import { UsCountyMap, type UsCountyRow } from "@/components/us-county-map"
import { UsCountyReligionMap } from "@/components/us-county-religion-map"
import {
  countyLabel,
  countySlug,
  type CountyDemographics,
  type StateDemographics,
} from "@/lib/states"

/** The same county-level views as the US map, in the same order */
const VIEWS = [
  { key: "demographics", label: "Demographics" },
  { key: "election2024", label: "2024 election" },
  { key: "religion", label: "Religion" },
] as const

type View = (typeof VIEWS)[number]["key"]

function countyHref(state: StateDemographics, county: CountyDemographics) {
  return `/united-states/${state.slug}/${countySlug(county.name)}`
}

function groupByLetter(counties: CountyDemographics[]) {
  const groups = new Map<string, CountyDemographics[]>()
  for (const county of counties) {
    const letter = county.name[0]?.toUpperCase() ?? "#"
    const group = groups.get(letter)
    if (group) group.push(county)
    else groups.set(letter, [county])
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}

/**
 * A state's counties on the US map's county views, fitted to the state. Clicking a county
 * opens its page. Every view stays mounted when hidden so it keeps its state.
 */
export function StateCountyMap({
  state,
  counties: data,
  years,
}: {
  state: StateDemographics
  counties: CountyDemographics[]
  /** Demographics slider years, oldest first; each must be a key of county-history.json */
  years: number[]
}) {
  const router = useRouter()
  const [view, setView] = useState<View>("demographics")

  const byFips = useMemo(() => Object.fromEntries(data.map((c) => [c.fips, c])), [data])
  const sortedCounties = useMemo(
    () => [...data].sort((a, b) => a.name.localeCompare(b.name)),
    [data]
  )
  const countyOptions = useMemo(
    () => sortedCounties.map((c) => ({ value: c.fips, label: countyLabel(c) })),
    [sortedCounties]
  )
  const countyGroups = useMemo(() => groupByLetter(sortedCounties), [sortedCounties])

  // The US maps' props: [fips, label] rows and the state's FIPS -> abbreviation
  const mapProps = useMemo(() => {
    const rows: UsCountyRow[] = sortedCounties.map((c) => [c.fips, countyLabel(c)])
    const stateFips = data[0]?.fips.slice(0, 2)
    return {
      counties: rows,
      states: stateFips ? { [stateFips]: state.abbr } : {},
      state,
      onOpenCounty: (fips: string) => {
        const county = byFips[fips]
        if (county) router.push(countyHref(state, county))
      },
    }
  }, [sortedCounties, data, state, byFips, router])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {VIEWS.map(({ key, label }) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={view === key ? "default" : "secondary"}
            aria-pressed={view === key}
            onClick={() => setView(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className={view === "demographics" ? undefined : "hidden"}>
        <UsCountyMap {...mapProps} years={years} />
      </div>
      <div className={view === "election2024" ? undefined : "hidden"}>
        <UsCountyElectionMap {...mapProps} />
      </div>
      <div className={view === "religion" ? undefined : "hidden"}>
        <UsCountyReligionMap {...mapProps} />
      </div>

      <Combobox
        items={countyOptions}
        value={null}
        onValueChange={(value) => {
          const county = value ? byFips[value] : undefined
          if (county) router.push(countyHref(state, county))
        }}
      >
        <ComboboxInput placeholder="Search for a county…" className="w-full rounded-none sm:w-72" />
        <ComboboxContent>
          <ComboboxEmpty>No county found.</ComboboxEmpty>
          <ComboboxList>
            {(option: { value: string; label: string }) => (
              <ComboboxItem key={option.value} value={option.value}>
                {option.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <div className="rounded-lg border border-border bg-card/40 px-4 py-3">
        <div className="columns-2 gap-x-6 sm:columns-3 lg:columns-4">
          {countyGroups.map(([letter, counties]) => (
            <div key={letter} className="mb-3 break-inside-avoid">
              <div className="text-xs font-semibold text-muted-foreground">{letter}</div>
              <ul>
                {counties.map((county) => (
                  <li key={county.fips}>
                    <Link
                      href={countyHref(state, county)}
                      className="block py-0.5 text-sm text-foreground hover:underline"
                    >
                      {county.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
